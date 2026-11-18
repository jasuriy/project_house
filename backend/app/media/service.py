import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.media import storage
from app.media.models import Upload

MAX_PENDING = 12  # unused uploads per user
MAX_AGE = timedelta(hours=24)  # an upload never attached within a day is removed
CLEAN_BATCH = 50


async def _clean_old(session: AsyncSession) -> None:
    """Remove anyone's uploads older than a day (rows first, files after the commit)."""
    cutoff = datetime.now(UTC) - MAX_AGE
    old = select(Upload.id).where(Upload.created_at < cutoff).limit(CLEAN_BATCH)
    keys = list(
        await session.scalars(delete(Upload).where(Upload.id.in_(old)).returning(Upload.key))
    )
    await session.commit()
    for key in keys:
        storage.delete(key)


async def create_upload(session: AsyncSession, owner_id: int, webp: bytes) -> Upload:
    await _clean_old(session)
    pending = await session.scalar(
        select(func.count()).select_from(Upload).where(Upload.owner_id == owner_id)
    )
    if (pending or 0) >= MAX_PENDING:
        raise AppError(429, "too_many_uploads", "Too many images waiting to be used")
    upload = Upload(owner_id=owner_id, key=storage.save(webp))
    session.add(upload)
    await session.commit()
    return upload


async def consume_uploads(session: AsyncSession, owner_id: int, ids: list[str]) -> list[str]:
    """Take the caller's unused uploads by id, in the given order, and return their storage keys.
    One DELETE ... RETURNING, so an upload can be attached once only. Any id that is not the
    caller's unused upload fails the whole call. The caller commits."""
    try:
        wanted = [uuid.UUID(i) for i in ids]
    except ValueError:
        raise AppError(422, "invalid_images", "Unknown image") from None
    if len(set(wanted)) != len(wanted):
        raise AppError(422, "invalid_images", "The same image twice")
    if not wanted:
        return []
    rows = (
        await session.execute(
            delete(Upload)
            .where(Upload.id.in_(wanted), Upload.owner_id == owner_id)
            .returning(Upload.id, Upload.key)
        )
    ).all()
    if len(rows) != len(wanted):
        raise AppError(422, "invalid_images", "Unknown image")
    key_of = {row.id: row.key for row in rows}
    return [key_of[i] for i in wanted]

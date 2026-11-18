from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import current_developer
from app.core.db import get_session
from app.core.errors import AppError
from app.media import images, service, storage
from app.users.models import User

router = APIRouter(tags=["media"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024


def _too_large() -> AppError:
    return AppError(413, "image_too_large", "The image is larger than 5 MB")


async def read_image_body(request: Request) -> bytes:
    """The raw request body, refused as soon as it passes 5 MB (also without Content-Length)."""
    declared = request.headers.get("content-length")
    if declared is not None and declared.isdigit() and int(declared) > MAX_UPLOAD_BYTES:
        raise _too_large()
    data = bytearray()
    async for chunk in request.stream():
        data += chunk
        if len(data) > MAX_UPLOAD_BYTES:
            raise _too_large()
    return bytes(data)


@router.post("/me/uploads", status_code=201)
async def upload_image(
    request: Request,
    user: Annotated[User, Depends(current_developer)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    webp = images.to_webp(await read_image_body(request))
    upload = await service.create_upload(session, user.id, webp)
    return {"id": str(upload.id), "url": storage.url(upload.key)}


@router.delete("/me/uploads/{upload_id}", status_code=204)
async def delete_upload(
    upload_id: str,
    user: Annotated[User, Depends(current_developer)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    await service.delete_upload(session, user.id, upload_id)


@router.get("/media/{key}")
async def get_media(key: str) -> FileResponse:
    file = storage.path(key)
    if file is None or not file.is_file():
        raise AppError(404, "not_found", "Not found")
    return FileResponse(
        file,
        media_type="image/webp",
        headers={
            "X-Content-Type-Options": "nosniff",
            # Keys are random and files never change: cache for a year.
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )

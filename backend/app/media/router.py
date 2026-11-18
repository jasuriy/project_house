from functools import partial
from typing import Annotated

import anyio
from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import current_developer, current_user
from app.core.db import get_session
from app.core.errors import AppError
from app.media import images, service, storage
from app.users.models import User

router = APIRouter(tags=["media"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
# Decoding and re-encoding take ~0.5 s for a phone photo: off the event loop, two at a time.
CONVERSIONS = anyio.CapacityLimiter(2)
AVATAR_SIDE = 512


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


async def to_webp(data: bytes, square: int | None = None) -> bytes:
    return await anyio.to_thread.run_sync(
        partial(images.to_webp, data, square=square), limiter=CONVERSIONS
    )


@router.post("/me/uploads", status_code=201)
async def upload_image(
    request: Request,
    user: Annotated[User, Depends(current_developer)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    webp = await to_webp(await read_image_body(request))
    upload = await service.create_upload(session, user.id, webp)
    return {"id": str(upload.id), "url": storage.url(upload.key)}


@router.delete("/me/uploads/{upload_id}", status_code=204)
async def delete_upload(
    upload_id: str,
    user: Annotated[User, Depends(current_developer)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    await service.delete_upload(session, user.id, upload_id)


@router.put("/me/avatar")
async def set_avatar(
    request: Request,
    user: Annotated[User, Depends(current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    """The profile photo (any account type): cropped to a 512 px square; replaces the old one."""
    webp = await to_webp(await read_image_body(request), square=AVATAR_SIDE)
    key = await service.replace_avatar(session, user, await storage.save(webp))
    return {"avatar_url": storage.url(key)}


@router.delete("/me/avatar", status_code=204)
async def delete_avatar(
    user: Annotated[User, Depends(current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    await service.replace_avatar(session, user, None)


@router.get("/media/{key}")
async def get_media(key: str) -> Response:
    data = await storage.read(key)
    if data is None:
        raise AppError(404, "not_found", "Not found")
    return Response(
        content=data,
        media_type="image/webp",
        headers={
            "X-Content-Type-Options": "nosniff",
            # Keys are random and files never change: cache for a year (the CDN keeps them too).
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )

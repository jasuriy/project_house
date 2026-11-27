"""File storage in Cloudflare R2 (S3-compatible API).

The browser uploads and downloads files straight from R2 with short-lived signed links
("presigned URLs"). This module signs links and checks, copies or deletes stored files; uploaded
file bytes never pass through the API. The one exception is the feed preview, which the preview
job makes and uploads itself (upload_file).
"""

import asyncio
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import get_settings

UPLOAD_LINK_SECONDS = 15 * 60
DOWNLOAD_LINK_SECONDS = 60 * 60


@dataclass(frozen=True)
class StoredFile:
    size: int
    content_type: str


class Storage(Protocol):
    def presign_put(self, key: str, content_type: str, size: int) -> str: ...
    def presign_get(self, key: str) -> str: ...
    async def head(self, key: str) -> StoredFile | None: ...
    async def copy(self, source: str, target: str) -> None: ...
    async def upload_file(self, path: str, key: str, content_type: str) -> None: ...
    async def delete(self, key: str) -> None: ...


class R2Storage:
    def __init__(self, account_id: str, access_key_id: str, secret: str, bucket: str) -> None:
        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )

    def presign_put(self, key: str, content_type: str, size: int) -> str:
        # Signing is a local computation (no network call), so it is safe in async code.
        # Content type and length are part of the signature: the upload must send exactly them.
        return self.client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ContentType": content_type,
                "ContentLength": size,
            },
            ExpiresIn=UPLOAD_LINK_SECONDS,
        )

    def presign_get(self, key: str) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=DOWNLOAD_LINK_SECONDS,
        )

    # boto3 is synchronous. Network calls run in a worker thread so they do not block the
    # event loop that serves every other request.
    async def head(self, key: str) -> StoredFile | None:
        try:
            meta = await asyncio.to_thread(self.client.head_object, Bucket=self.bucket, Key=key)
        except ClientError as exc:
            if exc.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
                return None
            raise
        return StoredFile(size=meta["ContentLength"], content_type=meta["ContentType"])

    async def copy(self, source: str, target: str) -> None:
        # Done inside R2: the bytes are never downloaded. The content type is copied along.
        await asyncio.to_thread(
            self.client.copy_object,
            Bucket=self.bucket,
            Key=target,
            CopySource={"Bucket": self.bucket, "Key": source},
        )

    async def upload_file(self, path: str, key: str, content_type: str) -> None:
        # The one file the backend itself writes: the feed preview, made on the server. The content
        # type is set explicitly; otherwise R2 serves binary/octet-stream, which Safari may refuse.
        await asyncio.to_thread(
            self.client.upload_file,
            path,
            self.bucket,
            key,
            ExtraArgs={"ContentType": content_type},
        )

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self.client.delete_object, Bucket=self.bucket, Key=key)


@lru_cache
def get_storage() -> Storage:
    s = get_settings()
    return R2Storage(s.r2_account_id, s.r2_access_key_id, s.r2_secret_access_key, s.r2_bucket)

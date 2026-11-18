"""Images in Cloudflare R2 (MEDIA_BACKEND=r2), tested against an in-memory stand-in for the S3 API."""

import io

import pytest
from botocore.exceptions import ClientError
from sqlalchemy import func, select

from app.core.config import get_settings
from app.media import storage
from app.media.models import Upload
from tests.media_helpers import signup, upload

pytest_plugins = ["tests.auth_fixtures", "tests.media_fixtures"]


class FakeS3:
    """The three S3 calls storage.py makes, kept in a dict; `fail_put` simulates an R2 outage."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.calls: list[str] = []
        self.fail_put = False

    def put_object(self, *, Bucket: str, Key: str, Body: bytes, ContentType: str) -> None:
        self.calls.append(f"put {Bucket}/{Key}")
        if self.fail_put:
            raise ClientError({"Error": {"Code": "InternalError"}}, "PutObject")
        assert ContentType == "image/webp"
        self.objects[Key] = Body

    def get_object(self, *, Bucket: str, Key: str) -> dict:
        self.calls.append(f"get {Bucket}/{Key}")
        if Key not in self.objects:
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")
        return {"Body": io.BytesIO(self.objects[Key])}

    def delete_object(self, *, Bucket: str, Key: str) -> None:
        self.calls.append(f"delete {Bucket}/{Key}")
        self.objects.pop(Key, None)


@pytest.fixture
def r2(monkeypatch) -> FakeS3:
    fake = FakeS3()
    settings = get_settings()
    monkeypatch.setattr(settings, "media_backend", "r2")
    monkeypatch.setattr(settings, "r2_bucket", "ph-test")
    monkeypatch.setattr(storage, "_client", lambda: fake)
    return fake


def _path(url: str) -> str:
    return "/api/v1/media/" + url.rsplit("/", 1)[1]


async def test_r2_upload_then_serve(auth_client, r2, media_root):
    await signup(auth_client)
    r = await upload(auth_client)
    assert r.status_code == 201, r.text
    key = r.json()["url"].rsplit("/", 1)[1]
    assert list(r2.objects) == [key]
    assert list(media_root.iterdir()) == []  # nothing on disk
    served = await auth_client.get(_path(r.json()["url"]))
    assert served.status_code == 200
    assert served.content == r2.objects[key]
    assert served.headers["content-type"] == "image/webp"
    assert served.headers["cache-control"] == "public, max-age=31536000, immutable"


async def test_r2_delete_removes_object(auth_client, r2):
    await signup(auth_client)
    r = await upload(auth_client)
    assert (await auth_client.delete(f"/api/v1/me/uploads/{r.json()['id']}")).status_code == 204
    assert r2.objects == {}


@pytest.mark.parametrize("key", ["abc", "x" * 32 + ".webp", "..%2F" + "a" * 32 + ".webp"])
async def test_r2_bad_key_never_calls_r2(auth_client, r2, key):
    r = await auth_client.get(f"/api/v1/media/{key}")
    assert r.status_code == 404
    assert r2.calls == []


async def test_r2_missing_object_is_404(auth_client, r2):
    r = await auth_client.get("/api/v1/media/" + "a" * 32 + ".webp")
    assert (r.status_code, r.json()["error"]["code"]) == (404, "not_found")


async def test_r2_put_failure_leaves_no_row(auth_client, r2, db_session):
    await signup(auth_client)
    r2.fail_put = True
    # The test client re-raises app errors; that an unexpected error answers 500 internal_error
    # is pinned in tests/test_errors.py. Here: the R2 error reaches the handler, and no row stays.
    with pytest.raises(ClientError):
        await upload(auth_client)
    assert r2.objects == {}
    assert await db_session.scalar(select(func.count()).select_from(Upload)) == 0


async def test_r2_avatar_replaces_and_deletes_the_old_object(auth_client, r2):
    await signup(auth_client)
    from tests.media_helpers import image_bytes

    first = await auth_client.put(
        "/api/v1/me/avatar", content=image_bytes(), headers={"content-type": "image/png"}
    )
    second = await auth_client.put(
        "/api/v1/me/avatar", content=image_bytes(), headers={"content-type": "image/png"}
    )
    assert first.status_code == second.status_code == 200
    assert list(r2.objects) == [second.json()["avatar_url"].rsplit("/", 1)[1]]


async def test_r2_delete_failure_after_commit_is_logged_not_500(auth_client, r2, caplog):
    await signup(auth_client)
    r = await upload(auth_client)

    def broken_delete(**_kwargs):
        raise ClientError({"Error": {"Code": "InternalError"}}, "DeleteObject")

    r2.delete_object = broken_delete
    # The row is gone and committed; R2 failing to drop the file must not turn that into a 500.
    assert (await auth_client.delete(f"/api/v1/me/uploads/{r.json()['id']}")).status_code == 204
    assert "could not delete" in caplog.text


def test_r2_client_has_short_timeouts_and_few_retries(monkeypatch):
    monkeypatch.setattr(storage, "_CLIENT", None)
    settings = get_settings()
    monkeypatch.setattr(settings, "r2_account_id", "acc")
    monkeypatch.setattr(settings, "r2_access_key_id", "id")
    monkeypatch.setattr(settings, "r2_secret_access_key", "secret")
    client = storage._client()
    config = client.meta.config
    assert (config.connect_timeout, config.read_timeout) == (5, 15)
    assert config.retries["total_max_attempts"] == 2  # two tries in all
    assert storage._client() is client  # built once
    monkeypatch.setattr(storage, "_CLIENT", None)

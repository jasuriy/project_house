from urllib.parse import parse_qs, urlparse

from app.storage import R2Storage


def test_upload_link_is_signed_for_exact_type_and_size() -> None:
    # Signing happens locally, so dummy credentials are enough and no network is used.
    storage = R2Storage("account123", "key-id", "secret", "bucket-name")

    url = urlparse(storage.presign_put("videos/p1/abc.mp4", "video/mp4", 1234))

    assert url.hostname == "account123.r2.cloudflarestorage.com"
    assert url.path == "/bucket-name/videos/p1/abc.mp4"
    query = parse_qs(url.query)
    assert query["X-Amz-Expires"] == ["900"]
    signed_headers = query["X-Amz-SignedHeaders"][0].split(";")
    assert "content-type" in signed_headers
    assert "content-length" in signed_headers


def test_download_link_lasts_one_hour() -> None:
    storage = R2Storage("account123", "key-id", "secret", "bucket-name")

    url = urlparse(storage.presign_get("videos/p1/abc.mp4"))

    assert parse_qs(url.query)["X-Amz-Expires"] == ["3600"]

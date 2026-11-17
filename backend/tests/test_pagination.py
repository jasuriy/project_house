from datetime import UTC, datetime, timedelta, timezone

import pytest

from app.core.errors import AppError
from app.core.pagination import decode_cursor, encode_cursor


def test_round_trip_equals_input():
    ts = datetime(2026, 11, 17, 9, 30, 15, 123456, tzinfo=UTC)
    assert decode_cursor(encode_cursor(ts, 42)) == (ts, 42)


def test_round_trip_normalises_to_utc():
    ts = datetime(2026, 11, 17, 14, 30, tzinfo=timezone(timedelta(hours=5)))
    decoded_ts, decoded_id = decode_cursor(encode_cursor(ts, 7))
    assert decoded_ts == ts
    assert decoded_ts.utcoffset() == timedelta(0)
    assert decoded_id == 7


def test_cursor_is_url_safe():
    cursor = encode_cursor(datetime(2026, 1, 1, tzinfo=UTC), 1)
    assert all(c.isalnum() or c in "-_" for c in cursor)


def test_encode_rejects_naive_datetime():
    with pytest.raises(ValueError):
        encode_cursor(datetime(2026, 1, 1), 1)


@pytest.mark.parametrize(
    "cursor",
    [
        "",
        "not-base64!!",
        "bm90IGpzb24",  # base64 of "not json"
        "e30",  # {}
        "W10",  # []
        "eyJ0IjoiMjAyNi0wMS0wMVQwMDowMDowMCIsImkiOjF9",  # naive timestamp
        "eyJ0IjoiMjAyNi0wMS0wMVQwMDowMDowMCswMDowMCIsImkiOnRydWV9",  # id is true
        "eyJ0IjoiMjAyNi0wMS0wMVQwMDowMDowMCswMDowMCIsImkiOiJ4In0",  # id is "x"
        "eyJ0IjoieHh4IiwiaSI6MX0",  # unparsable timestamp
        "\u00e9\u00e9",
    ],
)
def test_malformed_cursor_raises_invalid_cursor(cursor):
    with pytest.raises(AppError) as exc:
        decode_cursor(cursor)
    assert exc.value.status == 400
    assert exc.value.code == "invalid_cursor"

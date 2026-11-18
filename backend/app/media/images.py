"""Decode an uploaded image and re-encode it as a clean WebP (no metadata, bounded size)."""

import io
import warnings

from PIL import Image, ImageOps

from app.core.errors import AppError

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_PIXELS = 40_000_000  # checked from the header, before any pixel is decoded


def _invalid() -> AppError:
    return AppError(422, "invalid_image", "The file is not a JPEG, PNG or WebP image")


def to_webp(data: bytes, *, max_side: int = 1600, square: int | None = None) -> bytes:
    """`square` crops to the centre and resizes to that side (profile photos)."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            image = Image.open(io.BytesIO(data))  # reads only the header
            if image.format not in ALLOWED_FORMATS:
                raise _invalid()
            width, height = image.size
            if width * height > MAX_PIXELS:
                raise _invalid()
            image = ImageOps.exif_transpose(image)
            image = image.convert("RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB")
    except AppError:
        raise
    except (OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise _invalid() from None

    if square:
        image = ImageOps.fit(image, (square, square))
    else:
        image.thumbnail((max_side, max_side))
    out = io.BytesIO()
    image.save(out, "WEBP", quality=82)  # a fresh image: no EXIF, no ICC, no text chunks
    return out.getvalue()

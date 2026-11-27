"""Password hashing with argon2id (argon2-cffi's default settings: 3 passes, 64 MiB, 4 lanes).

One hash takes about 30 ms of CPU and 64 MiB of memory, so it runs in a worker thread (the event
loop keeps serving other requests) and at most 4 run at once (20 parallel logins would otherwise
need 1.28 GB).
"""

import asyncio

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError

_hasher = PasswordHasher()
_slots = asyncio.Semaphore(4)
# Checked when the email has no password, so that answer takes as long as a wrong password.
_DUMMY_HASH = _hasher.hash("not a real password")


async def hash_password(password: str) -> str:
    async with _slots:
        return await asyncio.to_thread(_hasher.hash, password)


async def check_password(password_hash: str | None, password: str) -> bool:
    """True if the password matches. A missing hash is checked against a dummy and is False."""

    def verify() -> bool:
        try:
            return _hasher.verify(password_hash or _DUMMY_HASH, password)
        except VerificationError:
            return False

    async with _slots:
        matched = await asyncio.to_thread(verify)
    return matched and password_hash is not None

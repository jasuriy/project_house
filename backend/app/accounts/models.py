"""The account tables: people, their login sessions, and failed logins (for the login limit)."""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Identity, LargeBinary, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # The profile address (/u/<username>); always lowercase.
    username: Mapped[str] = mapped_column(Text, unique=True)
    display_name: Mapped[str] = mapped_column(Text)
    # Always stored lowercase, so one address cannot hold two accounts.
    email: Mapped[str] = mapped_column(Text, unique=True)
    # The argon2id hash, never the password. Empty for an account made with GitHub only.
    password_hash: Mapped[str | None] = mapped_column(Text)
    github_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    github_login: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Session(Base):
    """One logged-in browser. Only the SHA-256 of the cookie's token is kept."""

    __tablename__ = "sessions"

    token_hash: Mapped[bytes] = mapped_column(LargeBinary, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    expires_at: Mapped[datetime]


class LoginFailure(Base):
    """One wrong password for an email; recent rows decide whether the email is locked."""

    __tablename__ = "login_failures"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    email: Mapped[str] = mapped_column(Text, index=True)
    failed_at: Mapped[datetime] = mapped_column(server_default=func.now())

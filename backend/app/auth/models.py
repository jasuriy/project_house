from datetime import datetime
from typing import Any, ClassVar

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

PROVIDERS = ("google", "github", "email")
EMAIL_TOKEN_PURPOSES = ("verify", "reset")

# Fetch server-generated values (created_at, updated_at) in the same statement as the insert,
# so a flushed object can be read without a lazy load (impossible in async sessions).
_MAPPER_ARGS: dict[str, Any] = {"eager_defaults": True}


def _in_list(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{v}'" for v in values) + ")"


def _created_at() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


def _updated_at() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


def _user_fk() -> Mapped[int]:
    return mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), index=True)


class AuthIdentity(Base):
    """One way to sign in to an account. For provider `email`, `provider_user_id` is the
    normalized (stripped, lowercased) email, so the unique constraint makes duplicates impossible."""

    __tablename__ = "auth_identities"
    __table_args__ = (
        UniqueConstraint(
            "provider", "provider_user_id", name="uq_auth_identities_provider_provider_user_id"
        ),
        # One identity per provider per user; its index also serves lookups by user_id.
        UniqueConstraint("user_id", "provider", name="uq_auth_identities_user_id_provider"),
        CheckConstraint(_in_list("provider", PROVIDERS), name="provider"),
    )
    __mapper_args__: ClassVar[dict[str, Any]] = _MAPPER_ARGS

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"))
    provider: Mapped[str] = mapped_column(Text)
    provider_user_id: Mapped[str] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text, index=True)
    email_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()


class PasswordCredential(Base):
    __tablename__ = "password_credentials"
    __mapper_args__: ClassVar[dict[str, Any]] = _MAPPER_ARGS

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    password_hash: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()


class AuthSession(Base):
    """A login session. Only the SHA-256 hex of the cookie token is stored."""

    __tablename__ = "sessions"
    __mapper_args__: ClassVar[dict[str, Any]] = _MAPPER_ARGS

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[int] = _user_fk()
    token_hash: Mapped[str] = mapped_column(Text, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()


class EmailToken(Base):
    """A single-use token mailed to the user. Only the SHA-256 hex of the token is stored."""

    __tablename__ = "email_tokens"
    __table_args__ = (CheckConstraint(_in_list("purpose", EMAIL_TOKEN_PURPOSES), name="purpose"),)
    __mapper_args__: ClassVar[dict[str, Any]] = _MAPPER_ARGS

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[int] = _user_fk()
    purpose: Mapped[str] = mapped_column(Text)
    token_hash: Mapped[str] = mapped_column(Text, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

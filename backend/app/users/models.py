from datetime import datetime
from typing import Any, ClassVar

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, Identity, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

ACCOUNT_TYPES = ("developer", "company")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("username ~ '^[a-z0-9_-]{3,30}$'", name="username_format"),
        CheckConstraint(
            "account_type IN (" + ", ".join(f"'{t}'" for t in ACCOUNT_TYPES) + ")",
            name="account_type",
        ),
    )
    # Fetch server-generated values (created_at, updated_at) in the same statement, so a
    # freshly flushed object can be read without a lazy load (impossible in async sessions).
    __mapper_args__: ClassVar[dict[str, Any]] = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    username: Mapped[str] = mapped_column(Text, unique=True)
    display_name: Mapped[str] = mapped_column(Text)
    account_type: Mapped[str] = mapped_column(Text)
    headline: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(Text)
    university_or_employer: Mapped[str | None] = mapped_column(Text)
    company_name: Mapped[str | None] = mapped_column(Text)
    about: Mapped[str | None] = mapped_column(Text)
    open_to_work: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    is_verified_company: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false")
    )
    avatar_url: Mapped[str | None] = mapped_column(Text)
    # The uploaded profile photo (app/media/storage.py); the API builds avatar_url from it.
    avatar_key: Mapped[str | None] = mapped_column(Text)
    # Profile links as {label: url}, e.g. {"github": "https://github.com/..."}.
    links: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

from datetime import datetime
from typing import Any, ClassVar

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.projects.fields import FIELDS
from app.users.models import User


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint("owner_id IS NOT NULL OR is_demo", name="owner_or_demo"),
        CheckConstraint("field IN (" + ", ".join(f"'{f}'" for f in FIELDS) + ")", name="field"),
        # The frontend renders live_url as a link: only http(s), never a javascript: URL.
        CheckConstraint("live_url IS NULL OR live_url ~* '^https?://'", name="live_url"),
        # Real projects: one slug per owner. Demo rows have no owner: one slug among demo rows.
        Index(
            "uq_projects_owner_id_slug",
            "owner_id",
            "slug",
            unique=True,
            postgresql_where=text("owner_id IS NOT NULL"),
        ),
        Index("uq_projects_demo_slug", "slug", unique=True, postgresql_where=text("is_demo")),
        Index("ix_projects_tech_stack", "tech_stack", postgresql_using="gin"),
    )
    # Fetch server-generated values (created_at, updated_at) in the same statement, so a
    # freshly flushed object can be read without a lazy load (impossible in async sessions).
    __mapper_args__: ClassVar[dict[str, Any]] = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    demo_author: Mapped[str | None] = mapped_column(Text)
    demo_author_url: Mapped[str | None] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    one_line_problem: Mapped[str] = mapped_column(Text)
    short_description: Mapped[str] = mapped_column(Text)
    result: Mapped[str | None] = mapped_column(Text)
    field: Mapped[str] = mapped_column(Text)
    tech_stack: Mapped[list[str]] = mapped_column(
        ARRAY(Text), default=list, server_default=text("'{}'::text[]")
    )
    github_url: Mapped[str | None] = mapped_column(Text)
    live_url: Mapped[str | None] = mapped_column(Text)
    demo_video_url: Mapped[str | None] = mapped_column(Text)
    license: Mapped[str | None] = mapped_column(Text)
    role: Mapped[str | None] = mapped_column(Text)
    # NOT NULL: the feed's keyset cursor is (published_at, id) and cannot order NULLs.
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # lazy="raise": async sessions cannot lazy-load, so every query names what it needs
    # (selectinload / joinedload) and a forgotten option fails loudly instead of silently.
    owner: Mapped[User | None] = relationship(lazy="raise")
    media: Mapped[list["ProjectMedia"]] = relationship(
        cascade="all, delete-orphan",
        order_by="ProjectMedia.position, ProjectMedia.id",
        lazy="raise",
    )


# Feed order: newest first, id as the tie-break (the keyset cursor is (published_at, id)).
Index("ix_projects_feed", Project.published_at.desc(), Project.id.desc())


class ProjectMedia(Base):
    __tablename__ = "project_media"
    __table_args__ = (
        CheckConstraint("kind IN ('image', 'video')", name="kind"),
        # External media (video links, the samples) have a URL; images we store have a key.
        CheckConstraint("url IS NOT NULL OR storage_key IS NOT NULL", name="url_or_key"),
    )
    __mapper_args__: ClassVar[dict[str, Any]] = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer)
    alt: Mapped[str | None] = mapped_column(Text)
    # Set for images we store (app/media/storage.py); NULL for external URLs (the samples).
    storage_key: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

REPORT_REASONS = ("spam", "not_own_work", "offensive", "other")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{v}'" for v in values) + ")"


class ProjectLike(Base):
    __tablename__ = "project_likes"
    __table_args__ = (
        Index("ix_project_likes_project_id", "project_id"),
        Index("ix_project_likes_user_id_created_at", "user_id", "created_at"),
    )

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProjectSave(Base):
    __tablename__ = "project_saves"
    __table_args__ = (
        Index("ix_project_saves_project_id", "project_id"),
        Index("ix_project_saves_user_id_created_at", "user_id", "created_at"),
    )

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = (Index("ix_comments_project_id_created_at", "project_id", "created_at", "id"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("projects.id", ondelete="CASCADE")
    )
    author_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Report(Base):
    """A report outlives what it reports: the target ids go NULL on delete, the snapshot stays."""

    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint(_in("target_kind", ("project", "comment")), name="target_kind"),
        CheckConstraint(_in("reason", REPORT_REASONS), name="reason"),
        # One report per person per item (while both still exist).
        Index(
            "uq_reports_reporter_project",
            "reporter_id",
            "project_id",
            unique=True,
            postgresql_where=text("target_kind = 'project' AND project_id IS NOT NULL"),
        ),
        Index(
            "uq_reports_reporter_comment",
            "reporter_id",
            "comment_id",
            unique=True,
            postgresql_where=text("comment_id IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    reporter_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL")
    )
    target_kind: Mapped[str] = mapped_column(Text)
    project_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("projects.id", ondelete="SET NULL")
    )
    comment_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("comments.id", ondelete="SET NULL")
    )
    reason: Mapped[str] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    snapshot: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

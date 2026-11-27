"""The projects table. One row is one published project; a row is written only on Render."""

import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, ForeignKey, Text, false, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.accounts.models import User
from app.db import Base


def _text_list() -> Mapped[list[str]]:
    return mapped_column(ARRAY(Text), default=list, server_default="{}")


class Project(Base):
    __tablename__ = "projects"

    # Random id, chosen before the row exists: the files are copied under it first.
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    published_at: Mapped[datetime]
    # The page address (/projects/<slug>); unique, so two projects never share one.
    slug: Mapped[str] = mapped_column(Text, unique=True)
    # Who published it (accounts step 3). RESTRICT: a project never loses its owner silently.
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    # Loaded only on purpose (service.py reads projects with it); a forgotten load fails loudly
    # instead of querying in the background, which an async session cannot do.
    owner: Mapped[User] = relationship(lazy="raise")

    # Project details
    name: Mapped[str | None] = mapped_column(Text)
    short_description: Mapped[str | None] = mapped_column(Text)
    project_type: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(Text)
    problem: Mapped[str | None] = mapped_column(Text)
    outcome: Mapped[str | None] = mapped_column(Text)

    # Technology stack (names from the catalog, or typed by the user)
    languages: Mapped[list[str]] = _text_list()
    tools: Mapped[list[str]] = _text_list()

    # Setup & delivery
    deliverables: Mapped[list[str]] = _text_list()
    license: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(Text)
    how_it_works: Mapped[str | None] = mapped_column(Text)
    started_on: Mapped[date | None]
    finished_on: Mapped[date | None]
    ongoing: Mapped[bool] = mapped_column(default=False, server_default=false())

    # Demo video in R2 (only keys are stored; the files live in the bucket)
    video_key: Mapped[str | None] = mapped_column(Text)
    video_file_name: Mapped[str | None] = mapped_column(Text)
    video_content_type: Mapped[str | None] = mapped_column(Text)
    video_size: Mapped[int | None] = mapped_column(BigInteger)
    video_duration_seconds: Mapped[float | None]
    poster_key: Mapped[str | None] = mapped_column(Text)
    # The short, light copy the feed plays (app/previews.py); made after Render, so empty at first.
    preview_key: Mapped[str | None] = mapped_column(Text)

    # GitHub repository and the preview read from it once
    repo_url: Mapped[str | None] = mapped_column(Text)
    repo_snapshot: Mapped[dict | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

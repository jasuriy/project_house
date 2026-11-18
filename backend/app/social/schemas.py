from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.pagination import MAX_ID


class CommentInput(BaseModel):
    """The body is checked in the service, so a bad one answers `invalid_comment`."""

    model_config = ConfigDict(extra="forbid")

    body: str


class CommentAuthor(BaseModel):
    name: str
    url: str
    avatar_url: str | None


class CommentOut(BaseModel):
    id: int
    body: str
    created_at: datetime
    author: CommentAuthor
    # True for the comment's author and the project's owner.
    can_delete: bool


class CommentPage(BaseModel):
    items: list[CommentOut]
    next_cursor: str | None


class ReportInput(BaseModel):
    """Exactly one of `project_id` / `comment_id`; values checked in the service (`invalid_report`)."""

    model_config = ConfigDict(extra="forbid")

    project_id: int | None = Field(default=None, ge=1, le=MAX_ID)
    comment_id: int | None = Field(default=None, ge=1, le=MAX_ID)
    reason: str
    note: str | None = None


class ReportResult(BaseModel):
    """False when this person had already reported the item (no new report was made)."""

    created: bool

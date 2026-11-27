"""add preview_key: the short, light copy of the demo video that the feed plays

The feed plays a few seconds of each project's video on its own, as Instagram does (Bek,
2026-11-27, D34). Playing the uploaded file there would be heavy (up to 300 MB), so a small copy
is made after Render and its key is stored here. Empty until the copy exists.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-27
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("preview_key", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "preview_key")

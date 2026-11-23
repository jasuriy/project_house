"""no drafts: every row is a published project

A row is written only when Render is pressed (Bek, 2026-11-24), so the address and the publish
time always exist. Fails on purpose if an old draft row (NULL slug) is still in the table.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-24
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("projects", "slug", existing_type=sa.Text(), nullable=False)
    op.alter_column(
        "projects", "published_at", existing_type=sa.DateTime(timezone=True), nullable=False
    )


def downgrade() -> None:
    op.alter_column(
        "projects", "published_at", existing_type=sa.DateTime(timezone=True), nullable=True
    )
    op.alter_column("projects", "slug", existing_type=sa.Text(), nullable=True)

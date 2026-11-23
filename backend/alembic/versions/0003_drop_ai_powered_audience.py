"""drop ai_powered and audience

Both fields were removed from the upload page and the project page (Bek, 2026-11-24, D25).
Their values are deleted with the columns.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-24
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("projects", "ai_powered")
    op.drop_column("projects", "audience")


def downgrade() -> None:
    # The columns come back empty: the dropped values cannot be restored.
    op.add_column("projects", sa.Column("audience", sa.Text(), nullable=True))
    op.add_column(
        "projects",
        sa.Column("ai_powered", sa.Boolean(), server_default=sa.false(), nullable=False),
    )

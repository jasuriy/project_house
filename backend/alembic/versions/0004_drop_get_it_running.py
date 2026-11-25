"""drop post_languages, getting_started, requirements and limitations

Post language was removed, and Get it running (getting started, requirements, limitations) gave its
place to the repository preview, whose README already shows how to run a project (Bek, 2026-11-25,
D29). Their values are deleted with the columns.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("projects", "post_languages")
    op.drop_column("projects", "getting_started")
    op.drop_column("projects", "requirements")
    op.drop_column("projects", "limitations")


def downgrade() -> None:
    # The columns come back empty: the dropped values cannot be restored.
    op.add_column("projects", sa.Column("limitations", sa.Text(), nullable=True))
    op.add_column("projects", sa.Column("requirements", sa.Text(), nullable=True))
    op.add_column("projects", sa.Column("getting_started", sa.Text(), nullable=True))
    op.add_column(
        "projects",
        sa.Column(
            "post_languages", postgresql.ARRAY(sa.Text()), server_default="{}", nullable=False
        ),
    )

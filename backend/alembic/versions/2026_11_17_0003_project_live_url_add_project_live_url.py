"""add project live_url

Revision ID: 0003_project_live_url
Revises: 0002_auth
Create Date: 2026-11-17 23:04:32.265349

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_project_live_url"
down_revision: str | Sequence[str] | None = "0002_auth"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("projects", sa.Column("live_url", sa.Text(), nullable=True))
    op.create_check_constraint(
        op.f("ck_projects_live_url"), "projects", "live_url IS NULL OR live_url ~* '^https?://'"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(op.f("ck_projects_live_url"), "projects", type_="check")
    op.drop_column("projects", "live_url")

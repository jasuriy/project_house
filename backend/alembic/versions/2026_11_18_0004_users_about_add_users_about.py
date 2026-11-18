"""add users.about

Revision ID: 0004_users_about
Revises: 0003_project_live_url
Create Date: 2026-11-18 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_users_about"
down_revision: str | Sequence[str] | None = "0003_project_live_url"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("users", sa.Column("about", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "about")

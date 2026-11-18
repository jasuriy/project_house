"""add uploads, project_media.storage_key, users.avatar_key

Revision ID: 0005_uploads
Revises: 0004_users_about
Create Date: 2026-11-18 18:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_uploads"
down_revision: str | Sequence[str] | None = "0004_users_about"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "uploads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.BigInteger(), nullable=False),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name=op.f("fk_uploads_owner_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_uploads")),
    )
    op.create_index(op.f("ix_uploads_owner_id"), "uploads", ["owner_id"], unique=False)
    op.add_column("project_media", sa.Column("storage_key", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("avatar_key", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "avatar_key")
    op.drop_column("project_media", "storage_key")
    op.drop_index(op.f("ix_uploads_owner_id"), table_name="uploads")
    op.drop_table("uploads")

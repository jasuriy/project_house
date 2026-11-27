"""add projects.owner_id: every project belongs to the account that published it

Accounts step 3 (docs/specs/2026-11-27-accounts.md). The projects published before accounts
existed are given to the account `jasuriy` (Bek, who published them). Where there are projects
without an owner and no such account, the migration stops and changes nothing.

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-27
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: str | Sequence[str] | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

FIRST_OWNER = "jasuriy"


def upgrade() -> None:
    op.add_column("projects", sa.Column("owner_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_projects_owner_id_users", "projects", "users", ["owner_id"], ["id"], ondelete="RESTRICT"
    )
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])

    connection = op.get_bind()
    ownerless = connection.scalar(sa.text("SELECT count(*) FROM projects WHERE owner_id IS NULL"))
    if ownerless:
        owner = connection.scalar(
            sa.text("SELECT id FROM users WHERE username = :name"), {"name": FIRST_OWNER}
        )
        if owner is None:
            # Raising rolls the whole migration back (it runs in one transaction).
            raise RuntimeError(
                f"{ownerless} project(s) have no owner and there is no account '{FIRST_OWNER}' to "
                f"give them to. Sign up as '{FIRST_OWNER}' on this database first, or delete those "
                "projects, then run the migration again."
            )
        connection.execute(
            sa.text("UPDATE projects SET owner_id = :owner WHERE owner_id IS NULL"),
            {"owner": owner},
        )

    op.alter_column("projects", "owner_id", nullable=False)


def downgrade() -> None:
    op.drop_index("ix_projects_owner_id", table_name="projects")
    op.drop_constraint("fk_projects_owner_id_users", "projects", type_="foreignkey")
    op.drop_column("projects", "owner_id")

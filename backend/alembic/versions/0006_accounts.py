"""add accounts: users, their login sessions, and failed logins

Everybody can sign up with email and password and log in (Bek, 2026-11-27; accounts spec,
docs/specs/2026-11-27-accounts.md). Projects get their owner in a later step.

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-27
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("github_id", sa.BigInteger(), nullable=True),
        sa.Column("github_login", sa.Text(), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("github_id", name="uq_users_github_id"),
    )
    op.create_table(
        "sessions",
        sa.Column("token_hash", sa.LargeBinary(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_sessions_user_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("token_hash", name="pk_sessions"),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_table(
        "login_failures",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column(
            "failed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_login_failures"),
    )
    op.create_index("ix_login_failures_email", "login_failures", ["email"])


def downgrade() -> None:
    op.drop_table("login_failures")
    op.drop_table("sessions")
    op.drop_table("users")

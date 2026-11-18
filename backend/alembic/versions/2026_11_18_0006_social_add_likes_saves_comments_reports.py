"""add project_likes, project_saves, comments, reports

Revision ID: 0006_social
Revises: 0005_uploads
Create Date: 2026-11-18 20:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006_social"
down_revision: str | Sequence[str] | None = "0005_uploads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NOW = sa.text("now()")


def _pair_table(name: str) -> None:
    op.create_table(
        name,
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f(f"fk_{name}_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f(f"fk_{name}_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "project_id", name=op.f(f"pk_{name}")),
    )
    op.create_index(f"ix_{name}_project_id", name, ["project_id"])
    op.create_index(f"ix_{name}_user_id_created_at", name, ["user_id", "created_at"])


def upgrade() -> None:
    """Upgrade schema."""
    _pair_table("project_likes")
    _pair_table("project_saves")
    op.create_table(
        "comments",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("author_id", sa.BigInteger(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            name=op.f("fk_comments_author_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_comments_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_comments")),
    )
    op.create_index(op.f("ix_comments_author_id"), "comments", ["author_id"])
    op.create_index(
        "ix_comments_project_id_created_at", "comments", ["project_id", "created_at", "id"]
    )
    op.create_table(
        "reports",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("reporter_id", sa.BigInteger(), nullable=True),
        sa.Column("target_kind", sa.Text(), nullable=False),
        sa.Column("project_id", sa.BigInteger(), nullable=True),
        sa.Column("comment_id", sa.BigInteger(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("snapshot", sa.Text(), nullable=False),
        sa.Column("target_user_id", sa.BigInteger(), nullable=True),
        sa.Column("target_username", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.CheckConstraint(
            "target_kind IN ('project', 'comment')", name=op.f("ck_reports_target_kind")
        ),
        sa.CheckConstraint(
            "reason IN ('spam', 'not_own_work', 'offensive', 'other')",
            name=op.f("ck_reports_reason"),
        ),
        sa.ForeignKeyConstraint(
            ["comment_id"],
            ["comments.id"],
            name=op.f("fk_reports_comment_id_comments"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_reports_project_id_projects"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["reporter_id"],
            ["users.id"],
            name=op.f("fk_reports_reporter_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["target_user_id"],
            ["users.id"],
            name=op.f("fk_reports_target_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reports")),
    )
    op.create_index(
        "uq_reports_reporter_project",
        "reports",
        ["reporter_id", "project_id"],
        unique=True,
        postgresql_where=sa.text("target_kind = 'project' AND project_id IS NOT NULL"),
    )
    op.create_index(
        "uq_reports_reporter_comment",
        "reports",
        ["reporter_id", "comment_id"],
        unique=True,
        postgresql_where=sa.text("comment_id IS NOT NULL"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("reports")
    op.drop_table("comments")
    op.drop_table("project_saves")
    op.drop_table("project_likes")

"""create projects tables

Revision ID: 0002_projects
Revises: 0001
Create Date: 2026-11-17 18:55:22.804716

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_projects"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "projects",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("owner_id", sa.BigInteger(), nullable=True),
        sa.Column("is_demo", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("demo_author", sa.Text(), nullable=True),
        sa.Column("demo_author_url", sa.Text(), nullable=True),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("one_line_problem", sa.Text(), nullable=False),
        sa.Column("short_description", sa.Text(), nullable=False),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column("field", sa.Text(), nullable=False),
        sa.Column(
            "tech_stack",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("'{}'::text[]"),
            nullable=False,
        ),
        sa.Column("github_url", sa.Text(), nullable=True),
        sa.Column("demo_video_url", sa.Text(), nullable=True),
        sa.Column("license", sa.Text(), nullable=True),
        sa.Column("role", sa.Text(), nullable=True),
        sa.Column(
            "published_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "field IN ('ai-apps', 'cv-ml', 'web', 'mobile', 'devtools', 'hardware', 'data')",
            name=op.f("ck_projects_field"),
        ),
        sa.CheckConstraint(
            "owner_id IS NOT NULL OR is_demo", name=op.f("ck_projects_owner_or_demo")
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name=op.f("fk_projects_owner_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_projects")),
    )
    op.create_index(
        op.f("uq_projects_owner_id_slug"),
        "projects",
        ["owner_id", "slug"],
        unique=True,
        postgresql_where=sa.text("owner_id IS NOT NULL"),
    )
    op.create_index(
        op.f("uq_projects_demo_slug"),
        "projects",
        ["slug"],
        unique=True,
        postgresql_where=sa.text("is_demo"),
    )
    op.create_index(
        op.f("ix_projects_tech_stack"), "projects", ["tech_stack"], postgresql_using="gin"
    )
    op.create_index(
        op.f("ix_projects_feed"),
        "projects",
        [sa.literal_column("published_at DESC"), sa.literal_column("id DESC")],
    )
    op.create_table(
        "project_media",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("alt", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("kind IN ('image', 'video')", name=op.f("ck_project_media_kind")),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_project_media_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_project_media")),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("project_media")
    op.drop_index(op.f("ix_projects_feed"), table_name="projects")
    op.drop_index(op.f("ix_projects_tech_stack"), table_name="projects", postgresql_using="gin")
    op.drop_index(op.f("uq_projects_demo_slug"), table_name="projects")
    op.drop_index(op.f("uq_projects_owner_id_slug"), table_name="projects")
    op.drop_table("projects")

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.projects.fields import FIELDS
from app.projects.models import Project
from tests.projects_fixtures import add_projects, make_project, make_user, media


def test_field_list_is_the_agreed_one():
    assert FIELDS == ("ai-apps", "cv-ml", "web", "mobile", "devtools", "hardware", "data")


async def test_valid_demo_project_round_trips(db_session):
    await add_projects(
        db_session,
        make_project(slug="a", tech_stack=["Go", "Rust"], media=[media("image", "u", 0)]),
    )
    row = (await db_session.scalars(select(Project))).one()
    assert row.owner_id is None and row.is_demo is True
    assert row.tech_stack == ["Go", "Rust"]
    assert row.created_at is not None and row.updated_at is not None


async def test_ownerless_non_demo_project_is_rejected(db_session):
    db_session.add(make_project(is_demo=False, owner_id=None))
    with pytest.raises(IntegrityError, match="ck_projects_owner_or_demo"):
        await db_session.commit()


async def test_unknown_field_is_rejected(db_session):
    db_session.add(make_project(field="blockchain"))
    with pytest.raises(IntegrityError, match="ck_projects_field"):
        await db_session.commit()


@pytest.mark.parametrize("url", [None, "http://example.com", "https://example.com/app"])
async def test_live_url_accepts_null_http_and_https(db_session, url):
    await add_projects(db_session, make_project(live_url=url))
    row = (await db_session.scalars(select(Project))).one()
    assert row.live_url == url


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "ftp://example.com",
        "example.com",
        "javascript:alert(1)//https://x",  # scheme not at the start: guards the ^ anchor
        "https:evil.com",  # no "//": guards the slashes
        " https://x",  # leading space: guards the ^ anchor
    ],
)
async def test_live_url_other_schemes_are_rejected(db_session, url):
    db_session.add(make_project(live_url=url))
    with pytest.raises(IntegrityError, match="ck_projects_live_url"):
        await db_session.commit()


async def test_unknown_media_kind_is_rejected(db_session):
    db_session.add(make_project(media=[media("audio", "u", 0)]))
    with pytest.raises(IntegrityError, match="ck_project_media_kind"):
        await db_session.commit()


async def test_duplicate_demo_slug_is_rejected(db_session):
    db_session.add_all([make_project(slug="same"), make_project(slug="same")])
    with pytest.raises(IntegrityError, match="uq_projects_demo_slug"):
        await db_session.commit()


async def test_same_slug_for_different_owners_is_allowed(db_session):
    a = await make_user(db_session, "aziz")
    b = await make_user(db_session, "bobur")
    await add_projects(
        db_session,
        make_project(is_demo=False, owner_id=a.id, slug="same"),
        make_project(is_demo=False, owner_id=b.id, slug="same"),
    )
    count = await db_session.scalar(select(func.count()).select_from(Project))
    assert count == 2


async def test_same_slug_for_same_owner_is_rejected(db_session):
    a = await make_user(db_session, "aziz")
    db_session.add_all(
        [
            make_project(is_demo=False, owner_id=a.id, slug="same"),
            make_project(is_demo=False, owner_id=a.id, slug="same"),
        ]
    )
    with pytest.raises(IntegrityError, match="uq_projects_owner_id_slug"):
        await db_session.commit()


async def test_demo_and_real_project_may_share_a_slug(db_session):
    a = await make_user(db_session, "aziz")
    await add_projects(
        db_session,
        make_project(slug="same"),
        make_project(is_demo=False, owner_id=a.id, slug="same"),
    )
    count = await db_session.scalar(select(func.count()).select_from(Project))
    assert count == 2


async def test_media_cascades_with_project(db_session):
    project = make_project(media=[media("image", "u1", 0), media("video", "u2", 1)])
    await add_projects(db_session, project)
    await db_session.delete(await db_session.get(Project, project.id))
    await db_session.commit()
    remaining = await db_session.scalar(text("SELECT count(*) FROM project_media"))
    assert remaining == 0


async def test_media_foreign_key_is_indexed(db_session):
    indexes = set(
        await db_session.scalars(
            text("SELECT indexname FROM pg_indexes WHERE tablename = 'project_media'")
        )
    )
    assert "ix_project_media_project_id" in indexes

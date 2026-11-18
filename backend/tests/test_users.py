from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError
from app.users import service
from app.users.models import User
from app.users.usernames import RESERVED_USERNAMES, validate_username


@pytest.mark.parametrize("name", ["aziz-rahimov", "abc", "a_b-9", "x" * 30])
def test_validate_username_accepts(name):
    validate_username(name)


@pytest.mark.parametrize(
    "name",
    ["a.b", "uz", "demo", "AB", "ab", "Aziz", "x" * 31, "abc\n", "a b", "", "api", "login"],
)
def test_validate_username_rejects(name):
    with pytest.raises(AppError) as exc:
        validate_username(name)
    assert exc.value.status == 422
    assert exc.value.code == "invalid_username"


def test_reserved_list_matches_architecture():
    expected = [
        "uz",
        "ru",
        "en",
        "api",
        "_next",
        "_vercel",
        "demo",
        "new",
        "messages",
        "settings",
        "login",
        "logout",
        "signup",
        "admin",
        "explore",
        "feed",
        "search",
        "about",
        "help",
        "forgot-password",
        "reset-password",
        "verify-email",
        "onboarding",
        "saved",
        "liked",
    ]
    assert set(RESERVED_USERNAMES) == set(expected)


async def test_db_rejects_uppercase_username(db_session):
    db_session.add(User(username="Aziz", display_name="Aziz", account_type="developer"))
    with pytest.raises(IntegrityError, match="ck_users_username_format"):
        await db_session.commit()


async def test_db_rejects_unknown_account_type(db_session):
    db_session.add(User(username="aziz", display_name="Aziz", account_type="robot"))
    with pytest.raises(IntegrityError, match="ck_users_account_type"):
        await db_session.commit()


async def test_create_user_flushes_without_commit(db_session):
    user = await service.create_user(
        db_session, username="aziz", display_name="Aziz R.", account_type="developer"
    )
    assert user.id is not None
    assert user.created_at is not None
    assert user.open_to_work is False
    assert user.links == {}
    await db_session.rollback()
    assert await service.username_exists(db_session, "aziz") is False


async def test_create_user_duplicate_raises_409_and_session_stays_usable(db_session):
    await service.create_user(
        db_session, username="aziz", display_name="A", account_type="developer"
    )
    with pytest.raises(AppError) as exc:
        await service.create_user(
            db_session, username="aziz", display_name="B", account_type="company"
        )
    assert (exc.value.status, exc.value.code) == (409, "username_taken")
    # The first user is still pending in the same transaction and can be committed.
    await db_session.commit()
    assert await service.username_exists(db_session, "aziz") is True


async def test_create_user_rejects_reserved_username(db_session):
    with pytest.raises(AppError) as exc:
        await service.create_user(
            db_session, username="demo", display_name="D", account_type="developer"
        )
    assert exc.value.code == "invalid_username"


@pytest.mark.parametrize(
    "name", ["forgot-password", "reset-password", "verify-email", "onboarding"]
)
async def test_create_user_rejects_frontend_route_names(db_session, name):
    with pytest.raises(AppError) as exc:
        await service.create_user(
            db_session, username=name, display_name="D", account_type="developer"
        )
    assert (exc.value.status, exc.value.code) == (422, "invalid_username")


async def test_create_user_rejects_unknown_account_type(db_session):
    with pytest.raises(AppError) as exc:
        await service.create_user(
            db_session, username="aziz", display_name="A", account_type="robot"
        )
    assert (exc.value.status, exc.value.code) == (422, "invalid_account_type")


async def test_get_by_id_and_username(db_session):
    user = await service.create_user(
        db_session, username="aziz", display_name="A", account_type="developer"
    )
    await db_session.commit()
    assert (await service.get_by_id(db_session, user.id)).username == "aziz"
    assert (await service.get_by_username(db_session, "aziz")).id == user.id
    assert await service.get_by_id(db_session, user.id + 1) is None
    assert await service.get_by_username(db_session, "nobody") is None


async def test_get_user_endpoint_200(client, db_session):
    user = await service.create_user(
        db_session, username="aziz-rahimov", display_name="Aziz Rahimov", account_type="developer"
    )
    user.headline = "Backend developer"
    user.links = {"github": "https://github.com/aziz"}
    await db_session.commit()

    r = await client.get("/api/v1/users/aziz-rahimov")
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "aziz-rahimov"
    assert body["display_name"] == "Aziz Rahimov"
    assert body["account_type"] == "developer"
    assert body["headline"] == "Backend developer"
    assert body["links"] == {"github": "https://github.com/aziz"}
    assert body["open_to_work"] is False
    assert body["is_verified_company"] is False
    assert body["created_at"].endswith("Z") or body["created_at"].endswith("+00:00")
    assert "id" not in body


async def test_get_user_endpoint_404_shape(client):
    r = await client.get("/api/v1/users/nobody")
    assert r.status_code == 404
    assert r.json() == {"error": {"code": "user_not_found", "message": "User not found"}}


class _FakeDriverError(Exception):
    def __init__(self, constraint_name):
        super().__init__("fake")
        cause = Exception("driver")
        cause.constraint_name = constraint_name
        self.__cause__ = cause


@pytest.mark.parametrize("constraint", ["ck_users_username_format", None])
async def test_create_user_reraises_other_integrity_errors(db_session, monkeypatch, constraint):
    async def failing_flush(*_, **__):
        raise IntegrityError("INSERT", {}, _FakeDriverError(constraint))

    monkeypatch.setattr(db_session, "flush", failing_flush)
    with pytest.raises(IntegrityError):
        await service.create_user(
            db_session, username="aziz", display_name="A", account_type="developer"
        )


async def _owned(user, slug: str, day: int):
    from tests.projects_fixtures import make_project

    return make_project(
        is_demo=False,
        owner_id=user.id,
        demo_author=None,
        demo_author_url=None,
        slug=slug,
        published_at=datetime(2026, 11, day, tzinfo=UTC),
    )


async def test_profile_returns_about_and_project_count(client, db_session):
    from tests.projects_fixtures import add_projects, make_project, make_user

    user = await make_user(db_session, username="aziz")
    user.about = "Hi"
    await add_projects(
        db_session, await _owned(user, "one", 1), await _owned(user, "two", 2), make_project()
    )

    body = (await client.get("/api/v1/users/aziz")).json()
    assert (body["about"], body["project_count"]) == ("Hi", 2)
    assert "email" not in body


async def test_profile_of_user_without_projects_has_count_zero(client, db_session):
    from tests.projects_fixtures import make_user

    await make_user(db_session, username="aziz")
    body = (await client.get("/api/v1/users/aziz")).json()
    assert (body["about"], body["project_count"]) == (None, 0)

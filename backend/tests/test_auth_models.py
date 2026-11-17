import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.auth.models import AuthIdentity, AuthSession, EmailToken, PasswordCredential
from app.users import service as users_service

AUTH_TABLES = {"auth_identities", "password_credentials", "sessions", "email_tokens"}


def _public_tables(url: str) -> set[str]:
    async def query() -> set[str]:
        engine = create_async_engine(url, poolclass=NullPool)
        try:
            async with engine.connect() as conn:
                rows = await conn.execute(
                    text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
                )
                return {name for (name,) in rows}
        finally:
            await engine.dispose()

    return asyncio.run(query())


def test_auth_tables_exist_and_downgrade_removes_only_them(alembic_cli, test_database_url):
    try:
        assert AUTH_TABLES <= _public_tables(test_database_url)
        down = alembic_cli("downgrade", "0001")
        assert down.returncode == 0, down.stderr
        tables = _public_tables(test_database_url)
        assert not AUTH_TABLES & tables
        assert "users" in tables
        up = alembic_cli("upgrade", "head")
        assert up.returncode == 0, up.stderr
        assert AUTH_TABLES <= _public_tables(test_database_url)
    finally:
        alembic_cli("upgrade", "head")


def test_migration_revision_id_and_parent(alembic_cli):
    result = alembic_cli("history")
    assert result.returncode == 0, result.stderr
    assert "0001 -> 0002_auth (head)" in result.stdout


async def _user(db_session, username="aziz"):
    return await users_service.create_user(
        db_session, username=username, display_name="Aziz", account_type="developer"
    )


async def test_identity_rejects_unknown_provider(db_session):
    user = await _user(db_session)
    db_session.add(
        AuthIdentity(
            user_id=user.id, provider="twitter", provider_user_id="1", email_verified=False
        )
    )
    with pytest.raises(IntegrityError, match="ck_auth_identities_provider"):
        await db_session.commit()


async def test_identity_unique_per_provider_and_provider_user_id(db_session):
    user = await _user(db_session)
    other = await _user(db_session, "bobur")
    db_session.add(
        AuthIdentity(user_id=user.id, provider="github", provider_user_id="7", email_verified=True)
    )
    await db_session.flush()
    db_session.add(
        AuthIdentity(user_id=other.id, provider="github", provider_user_id="7", email_verified=True)
    )
    with pytest.raises(IntegrityError, match="uq_auth_identities_provider_provider_user_id"):
        await db_session.flush()


async def test_email_token_rejects_unknown_purpose(db_session):
    user = await _user(db_session)
    db_session.add(
        EmailToken(
            user_id=user.id,
            purpose="login",
            token_hash="h",
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )
    )
    with pytest.raises(IntegrityError, match="ck_email_tokens_purpose"):
        await db_session.commit()


async def test_session_token_hash_is_unique(db_session):
    user = await _user(db_session)
    now = datetime.now(UTC)
    for _ in range(2):
        db_session.add(
            AuthSession(
                user_id=user.id,
                token_hash="same",
                expires_at=now + timedelta(days=1),
                last_seen_at=now,
            )
        )
    with pytest.raises(IntegrityError, match="uq_sessions_token_hash"):
        await db_session.flush()


async def test_deleting_user_cascades_to_auth_rows(db_session):
    user = await _user(db_session)
    now = datetime.now(UTC)
    db_session.add_all(
        [
            AuthIdentity(
                user_id=user.id, provider="email", provider_user_id="a@b.c", email_verified=False
            ),
            PasswordCredential(user_id=user.id, password_hash="x"),
            AuthSession(user_id=user.id, token_hash="t", expires_at=now, last_seen_at=now),
            EmailToken(user_id=user.id, purpose="verify", token_hash="v", expires_at=now),
        ]
    )
    await db_session.commit()
    await db_session.execute(text("DELETE FROM users"))
    await db_session.commit()
    for table in AUTH_TABLES:
        count = await db_session.scalar(text(f"SELECT count(*) FROM {table}"))
        assert count == 0, table

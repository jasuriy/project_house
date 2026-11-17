import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool


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


def test_upgrade_downgrade_upgrade(alembic_cli, test_database_url):
    try:
        assert "users" in _public_tables(test_database_url)
        down = alembic_cli("downgrade", "base")
        assert down.returncode == 0, down.stderr
        assert "users" not in _public_tables(test_database_url)
        up = alembic_cli("upgrade", "head")
        assert up.returncode == 0, up.stderr
        assert "users" in _public_tables(test_database_url)
    finally:
        alembic_cli("upgrade", "head")


def test_exactly_one_head(alembic_cli):
    result = alembic_cli("heads")
    assert result.returncode == 0, result.stderr
    assert result.stdout.count("(head)") == 1


def test_models_match_migrations(alembic_cli):
    """`alembic check` fails if autogenerate would produce a new migration."""
    result = alembic_cli("check")
    assert result.returncode == 0, f"{result.stdout}\n{result.stderr}"

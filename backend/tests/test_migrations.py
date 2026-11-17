def test_upgrade_downgrade_upgrade(alembic_cli):
    try:
        down = alembic_cli("downgrade", "base")
        assert down.returncode == 0, down.stderr
        up = alembic_cli("upgrade", "head")
        assert up.returncode == 0, up.stderr
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

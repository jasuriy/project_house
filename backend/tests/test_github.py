import httpx
import pytest

from app.github import GitHubUnavailable, parse_repo_url, readme_preview
from tests.fakes import fake_github, repo_routes


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://github.com/reflex-dev/reflex", ("reflex-dev", "reflex")),
        ("github.com/reflex-dev/reflex/", ("reflex-dev", "reflex")),
        ("https://github.com/reflex-dev/reflex.git", ("reflex-dev", "reflex")),
        ("  https://www.github.com/a/b.c  ", ("a", "b.c")),
        ("https://gitlab.com/reflex-dev/reflex", None),
        ("https://github.com/reflex-dev", None),
        ("https://github.com/reflex-dev/reflex/tree/main", None),
    ],
)
def test_parse_repo_url(url: str, expected: tuple[str, str] | None) -> None:
    assert parse_repo_url(url) == expected


def test_readme_preview_skips_html_badges_quotes_and_rules(reflex_readme: str) -> None:
    lines = readme_preview(reflex_readme)

    assert lines[:3] == [
        "### **✨ Performant, customizable web apps in pure Python. Deploy in seconds. ✨**",
        "# Introduction",
        "Reflex is a library to build full-stack web apps in pure Python.",
    ]
    assert len(lines) == 10


def test_readme_preview_skips_code_blocks() -> None:
    assert readme_preview("# Title\n```\nnot this\n```\nText") == ["# Title", "Text"]


async def test_snapshot_of_a_public_repo(reflex_readme: str) -> None:
    github = fake_github(repo_routes("reflex-dev", "reflex", reflex_readme))

    snapshot = await github.fetch_snapshot("reflex-dev", "reflex")

    assert snapshot is not None
    assert snapshot.full_name == "reflex-dev/reflex"
    assert snapshot.html_url == "https://github.com/reflex-dev/reflex"
    # folders first, then files, each alphabetical (as GitHub shows them)
    assert [(e.name, e.type) for e in snapshot.entries] == [
        ("docs", "dir"),
        ("reflex", "dir"),
        ("pyproject.toml", "file"),
        ("README.md", "file"),
    ]
    assert snapshot.readme_lines[1] == "# Introduction"


async def test_private_or_missing_repo_has_no_snapshot(reflex_readme: str) -> None:
    private = fake_github(repo_routes("me", "secret", reflex_readme, private=True))
    missing = fake_github({})

    assert await private.fetch_snapshot("me", "secret") is None
    assert await missing.fetch_snapshot("me", "nothing") is None


async def test_rate_limit_or_server_error_is_reported_as_unavailable() -> None:
    limited = fake_github({"/repos/a/b": httpx.Response(403)})

    with pytest.raises(GitHubUnavailable):
        await limited.fetch_snapshot("a", "b")

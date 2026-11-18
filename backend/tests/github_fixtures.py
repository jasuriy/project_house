"""The fake GitHub as a fixture (autouse is off: tests ask for `github`)."""

import pytest

from app.main import app
from app.projects.github import get_github
from tests.github_fake import FakeGitHub


@pytest.fixture
def github(client) -> FakeGitHub:
    """Depends on `client`: its teardown clears the overrides."""
    fake = FakeGitHub()
    app.dependency_overrides[get_github] = lambda: fake
    return fake

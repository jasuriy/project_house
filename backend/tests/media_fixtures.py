"""Uploaded files go to a temporary folder, never into the repository (autouse via pytest_plugins)."""

from pathlib import Path

import pytest

from app.core.config import get_settings


@pytest.fixture(autouse=True)
def media_root(tmp_path, monkeypatch) -> Path:
    monkeypatch.setattr(get_settings(), "media_root", str(tmp_path))
    return tmp_path

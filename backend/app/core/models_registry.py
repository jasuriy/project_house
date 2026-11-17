"""Imports every feature's models module so Alembic autogenerate sees all tables.

Each feature task adds one import line here.
"""

from app.users import models as users_models

__all__ = ["users_models"]

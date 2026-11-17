"""Imports every feature's models module so Alembic autogenerate sees all tables.

Each feature task adds exactly one self-contained line, in alphabetical position, for example:

    from app.projects import models as _projects_models  # noqa: F401

Each line binds its own name, so its `noqa` stays valid no matter which other lines exist, and no
shared `__all__` list forces parallel branches to edit the same line.
"""

from app.users import models as _users_models  # noqa: F401

"""Prostagram API on Modal (production).

    uv run modal deploy modal_app.py                # the API (push day)
    uv run modal run modal_app.py::migrate          # alembic upgrade head (production database)

Every setting comes from the Modal secret "projecthouse-prod", with the same names as
backend/.env.example; no value lives here. Functions run in the EU, near the Neon database
(Frankfurt).
"""

import subprocess
import sys
from pathlib import Path

import modal

BACKEND = Path(__file__).resolve().parent
ROOT = "/srv"  # where the code sits in the container
SECRET = modal.Secret.from_name("projecthouse-prod")
REGION = ["eu"]

image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("ca-certificates")
    # Exactly the versions in uv.lock; --no-dev leaves test and deploy tools out of production.
    .uv_sync(str(BACKEND), extra_options="--no-dev")
    # PGSSLROOTCERT lets DATABASE_URL use ssl=verify-full: the database's certificate and host
    # name are checked, not only encrypted.
    .env({"PYTHONPATH": ROOT, "PGSSLROOTCERT": "/etc/ssl/certs/ca-certificates.crt"})
    .add_local_dir(str(BACKEND / "app"), f"{ROOT}/app")
    .add_local_dir(str(BACKEND / "alembic"), f"{ROOT}/alembic")
    .add_local_file(str(BACKEND / "alembic.ini"), f"{ROOT}/alembic.ini")
)

app = modal.App("projecthouse", image=image)


# One container stays warm, so a visit never waits for a cold start; one container serves up to
# 20 requests at once (the API mostly waits on the database and R2).
@app.function(secrets=[SECRET], region=REGION, min_containers=1)
@modal.concurrent(max_inputs=20)
@modal.asgi_app()
def web():
    from app.main import app as api  # settings are read from the secret

    return api


@app.function(secrets=[SECRET], region=REGION, timeout=600)
def migrate() -> None:
    """Bring the production database to the newest schema."""
    # sys.executable: the interpreter uv_sync installed the packages into, not whatever "python"
    # is first on PATH.
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=ROOT, check=True)

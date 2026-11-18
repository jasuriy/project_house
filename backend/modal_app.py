"""Project House on Modal: the API, the database migration and the one-time sample load.

    modal deploy backend/modal_app.py                                 # the API (web)
    modal run backend/modal_app.py::migrate                           # alembic upgrade head
    modal run backend/modal_app.py::seed_samples --owner jasurai      # the 29 samples, once

Every setting comes from the Modal secret "projecthouse-prod" (README, "Deploy"); no value lives
here. The functions run in the EU, near the Neon database (Frankfurt).
"""

import subprocess
from pathlib import Path

import modal

BACKEND = Path(__file__).resolve().parent
ROOT = "/srv"  # where the code sits in the container
SECRET = modal.Secret.from_name("projecthouse-prod")
REGION = ["eu"]

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ca-certificates")
    .pip_install_from_requirements(str(BACKEND / "requirements.txt"))
    # PGSSLROOTCERT lets DATABASE_URL use ssl=verify-full: the database's certificate and host
    # name are checked, not only encrypted.
    .env({"PYTHONPATH": ROOT, "PGSSLROOTCERT": "/etc/ssl/certs/ca-certificates.crt"})
    .add_local_dir(str(BACKEND / "app"), f"{ROOT}/app")
    .add_local_dir(str(BACKEND / "alembic"), f"{ROOT}/alembic")
    .add_local_file(str(BACKEND / "alembic.ini"), f"{ROOT}/alembic.ini")
    .add_local_file(
        str(BACKEND.parent / "seed" / "demo-projects.json"), f"{ROOT}/seed/demo-projects.json"
    )
)

app = modal.App("projecthouse", image=image)


# One container stays warm, so a visit never waits for a cold start. memory is a guaranteed
# floor, not a cap (Modal docs); 1 GiB is ample with email login off (no password hashing).
@app.function(secrets=[SECRET], region=REGION, min_containers=1, memory=1024)
@modal.concurrent(max_inputs=20)
@modal.asgi_app()
def web():
    from app.main import app as api  # the FastAPI app; settings are read from the secret

    return api


@app.function(secrets=[SECRET], region=REGION, timeout=600)
def migrate() -> None:
    """Bring the production database to the newest schema (take a pg_dump first, README)."""
    subprocess.run(["python", "-m", "alembic", "upgrade", "head"], cwd=ROOT, check=True)


@app.function(secrets=[SECRET], region=REGION, timeout=600)
def seed_samples(owner: str) -> None:
    """Give the 29 sample projects to `owner` (an existing account), once (Bek, 2026-11-18)."""
    subprocess.run(
        [
            "python",
            "-m",
            "app.projects.seed_demo",
            "--file",
            f"{ROOT}/seed/demo-projects.json",
            "--owner",
            owner,
            "--allow-production",
        ],
        cwd=ROOT,
        check=True,
    )

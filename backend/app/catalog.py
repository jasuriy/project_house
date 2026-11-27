"""Fixed choices, limits and the tech catalog: the single source for backend and frontend.

The frontend reads everything here from GET /api/v1/catalog, so a list or a limit is changed in
one place only.
"""

from fastapi import APIRouter

PROJECT_TYPES = {
    "web_app": "Web app",
    "website": "Website",
    "ai_model": "AI model",
    "library": "Library",
    "api": "API",
    "mobile_app": "Mobile app",
}

CATEGORIES = {
    "ai_ml": "AI & Machine Learning",
    "web": "Web Development",
    "mobile": "Mobile Development",
    "developer_tools": "Developer Tools",
    "data": "Data & Analytics",
    "games": "Games",
    "education": "Education",
    "productivity": "Productivity",
    "finance": "Finance",
    "health": "Health",
    "design": "Design",
    "security": "Security",
    "iot_hardware": "IoT & Hardware",
    "other": "Other",
}

STATUSES = {
    "idea": "Idea",
    "prototype": "Prototype",
    "beta": "Beta",
    "live": "Live",
    "archived": "Archived",
}

DELIVERABLES = {
    "source_code": "Source code",
    "hosted_web_app": "Hosted web app",
    "mobile_app": "Mobile app",
    "docker_setup": "Docker setup",
    "package": "Package (PyPI/npm)",
    "api": "API",
    "self_hosted": "Self-hosted deployment",
}

LICENSES = {
    "MIT": "MIT",
    "Apache-2.0": "Apache-2.0",
    "GPL-3.0": "GPL-3.0",
    "AGPL-3.0": "AGPL-3.0",
    "BSD-3-Clause": "BSD-3-Clause",
    "MPL-2.0": "MPL-2.0",
    "proprietary": "Proprietary",
    "none": "None",
}

# Longest allowed text per field (characters). Approved by Bek 2026-11-23.
TEXT_LIMITS = {
    "name": 80,
    "short_description": 160,
    "problem": 600,
    "outcome": 600,
    "how_it_works": 600,
}

MAX_TECH_NAME = 40  # one technology name, catalog or typed by the user
# Most entries per tech field (Bek, 2026-11-24, D26).
MAX_LANGUAGES = 7
MAX_TOOLS = 5

# What may be uploaded. "video" is the demo video, "poster" its first frame (a still image).
UPLOAD_RULES = {
    "video": {"content_types": ["video/mp4", "video/webm"], "max_bytes": 300 * 1024 * 1024},
    "poster": {"content_types": ["image/jpeg"], "max_bytes": 2 * 1024 * 1024},
}

# What a project needs before it can be rendered. The browser shows the checklist from this list
# and the server checks the same list again when the project is created.
REQUIRED_TEXT = [
    "name",
    "short_description",
    "project_type",
    "category",
    "problem",
    "outcome",
    "license",
    "status",
]
REQUIRED_LISTS = ["languages", "tools", "deliverables"]
REQUIRED_FIELDS = [*REQUIRED_TEXT, *REQUIRED_LISTS, "video"]

LANGUAGES_GROUP = "Languages"
OTHER_GROUP = "Other"

# (name, group, simple-icons slug or None when simple-icons has no logo for it)
TECH_CATALOG: list[tuple[str, str, str | None]] = [
    ("Python", "Languages", "python"),
    ("TypeScript", "Languages", "typescript"),
    ("JavaScript", "Languages", "javascript"),
    ("Go", "Languages", "go"),
    ("Rust", "Languages", "rust"),
    ("Java", "Languages", "openjdk"),
    ("Kotlin", "Languages", "kotlin"),
    ("Swift", "Languages", "swift"),
    ("Dart", "Languages", "dart"),
    ("C++", "Languages", "cplusplus"),
    ("C#", "Languages", "dotnet"),
    ("Ruby", "Languages", "ruby"),
    ("PHP", "Languages", "php"),
    ("React", "Frontend", "react"),
    ("Next.js", "Frontend", "nextdotjs"),
    ("Vue.js", "Frontend", "vuedotjs"),
    ("Svelte", "Frontend", "svelte"),
    ("Angular", "Frontend", "angular"),
    ("Tailwind CSS", "Frontend", "tailwindcss"),
    ("Radix UI", "Frontend", "radixui"),
    ("Vite", "Frontend", "vite"),
    ("Plotly", "Frontend", "plotly"),
    ("Recharts", "Frontend", None),
    ("FastAPI", "Backend & AI", "fastapi"),
    ("Django", "Backend & AI", "django"),
    ("Flask", "Backend & AI", "flask"),
    ("Starlette", "Backend & AI", None),
    ("Granian", "Backend & AI", None),
    ("Node.js", "Backend & AI", "nodedotjs"),
    ("Express", "Backend & AI", "express"),
    ("NestJS", "Backend & AI", "nestjs"),
    ("Socket.IO", "Backend & AI", "socketdotio"),
    ("PyTorch", "Backend & AI", "pytorch"),
    ("TensorFlow", "Backend & AI", "tensorflow"),
    ("Hugging Face", "Backend & AI", "huggingface"),
    ("OpenAI", "Backend & AI", None),
    ("Gemini", "Backend & AI", "googlegemini"),
    ("LangChain", "Backend & AI", "langchain"),
    ("pyannote.audio", "Backend & AI", None),
    ("OpenCV", "Backend & AI", "opencv"),
    ("scikit-learn", "Backend & AI", "scikitlearn"),
    ("PostgreSQL", "Storage", "postgresql"),
    ("MySQL", "Storage", "mysql"),
    ("SQLite", "Storage", "sqlite"),
    ("MongoDB", "Storage", "mongodb"),
    ("Redis", "Storage", "redis"),
    ("Supabase", "Storage", "supabase"),
    ("Cloudflare R2", "Storage", "cloudflare"),
    ("Amazon S3", "Storage", None),
    ("Flutter", "Mobile", "flutter"),
    ("React Native", "Mobile", "react"),
    ("Android", "Mobile", "android"),
    ("Expo", "Mobile", "expo"),
    ("Docker", "DevOps & Tools", "docker"),
    ("Kubernetes", "DevOps & Tools", "kubernetes"),
    ("GitHub Actions", "DevOps & Tools", "githubactions"),
    ("Vercel", "DevOps & Tools", "vercel"),
    ("Nginx", "DevOps & Tools", "nginx"),
    ("Git", "DevOps & Tools", "git"),
]

_TECH_BY_LOWER_NAME = {name.lower(): name for name, _, _ in TECH_CATALOG}


def canonical_tech_names(names: list[str]) -> list[str]:
    """Catalog spelling for catalog names ("python" -> "Python"); repeats dropped, any case."""
    result: dict[str, str] = {}
    for name in names:
        result.setdefault(name.lower(), _TECH_BY_LOWER_NAME.get(name.lower(), name))
    return list(result.values())


# Accounts (docs/specs/2026-11-27-accounts.md). The page checks a username with the same rules
# before sending it, so they live here and reach it through the catalog.
USERNAME_PATTERN = r"^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$"  # 3-30, no hyphen at either end
# Words the site itself uses as addresses, so no profile can take them.
RESERVED_USERNAMES = ["new", "login", "signup", "api", "admin", "settings", "u", "projects"]

router = APIRouter()


def _choices(options: dict[str, str]) -> list[dict[str, str]]:
    return [{"id": key, "label": label} for key, label in options.items()]


@router.get("/api/v1/catalog")
async def get_catalog() -> dict:
    return {
        "project_types": _choices(PROJECT_TYPES),
        "categories": _choices(CATEGORIES),
        "statuses": _choices(STATUSES),
        "deliverables": _choices(DELIVERABLES),
        "licenses": _choices(LICENSES),
        "text_limits": TEXT_LIMITS,
        "max_tech_name": MAX_TECH_NAME,
        "max_languages": MAX_LANGUAGES,
        "max_tools": MAX_TOOLS,
        "upload_rules": UPLOAD_RULES,
        "required_fields": REQUIRED_FIELDS,
        "tech": [{"name": n, "group": g, "icon": icon} for n, g, icon in TECH_CATALOG],
        "username_rules": {"pattern": USERNAME_PATTERN, "reserved": RESERVED_USERNAMES},
    }

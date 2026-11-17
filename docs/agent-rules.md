# Rules for implementation agents

Every agent working on this repository follows these rules. The orchestrator (main session) checks
them in review; a breach is a finding, not a style note.

## Before you write code

1. Read `docs/architecture.md` (binding), your task file, and the files your task touches.
2. If the task file and the architecture disagree, stop and report NEEDS_CONTEXT. Do not choose.
3. Work only in your own worktree / branch. Never push, merge, rebase or touch `main`.

## Scope

4. Change only the files your task lists. Shared files (`app/main.py` router registration,
   `app/core/*`, `tests/conftest.py`, `.env.example`, CI, `docker-compose.yml`) belong to the
   foundation: other tasks may add **one registration line** to `main.py` and nothing else there.
5. Anything useful you notice outside your scope goes into your report under "Deferred". Do not fix it.
6. No new dependency without a line in your report: name, exact version, why, and what it replaces.
   Pin exact versions (`==`).

## Code

7. Follow the layering in architecture section 2: router (HTTP only) -> service (rules, queries)
   -> models. No generic repository layer. No abstraction without a concrete second use.
8. Every schema change is an Alembic migration with a working `downgrade`. Never edit a migration
   that is already on another branch's base; add a new one. Use exactly the revision id your task
   file gives (parallel branches must never share an id: Alembic only warns on a duplicate id and
   silently drops one of the migrations).
9. API follows architecture section 5: `/api/v1`, one error shape, keyset pagination.
10. Type hints on every function. `ruff check` and `ruff format --check` clean.
11. Never log, print or return passwords, tokens, session ids or OAuth secrets.
12. No secrets in git. New settings get a safe dev default in code and a line in `.env.example`
    (production-required settings get no default).

## Tests

13. TDD: write the failing test, run it, see the expected failure, implement, see it pass.
    Your report shows both runs (command + relevant output).
14. Tests hit the real PostgreSQL through the foundation fixtures. Use your own database name
    from your task file. Mock only external services (Google, GitHub, email).
15. Test behaviour through the public API (HTTP) where a feature has one; unit-test pure functions
    directly. A test that cannot fail is a finding.
16. Full backend suite, ruff and the migration check pass before every commit.

## Output

17. No emoji anywhere: code, comments, commit messages, reports.
18. Commits: small, one logical change each, message `type(scope): summary` plus the trailer
    `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
19. Do not dispatch subagents. Do not spawn reviewers. Review is the orchestrator's job.
20. Report file (path given in your dispatch): what you built, files changed, test evidence,
    migrations added, dependencies added, deviations from the task file with reasons, deferred
    items, open questions. Reply with status DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT,
    commit list, one-line test summary, concerns.

# Coffee POS System

CSULB CECS 491B senior project. A point-of-sale system for a coffee shop,
managed entirely through GitHub.

> **New to this repo? Start with [guides/REPO-MAP.md](guides/REPO-MAP.md)** — what every folder is, who owns it, and what to do in it.

## Team

- Trung Tin Le (team lead)
- Bismah Farooq
- Minh Tri Chau
- Ryan Grubert
- Trong Nghia Le

Two sub-teams working in parallel:

- **frontend/** (2 people: Bismah Farooq, Minh Tri Chau) — everything the
  barista sees. Never writes SQL directly.
- **backend/** (3 people: Trung Tin Le, Ryan Grubert, Trong Nghia Le) —
  schema, migrations, RLS policies, database functions, and the
  data-access layer.

They meet at [docs/API_CONTRACT.md](docs/API_CONTRACT.md).

## Repo layout

```
/frontend   — barista/admin-facing UI (stack undecided, see docs/FRONTEND_DECISION.md)
/backend    — Supabase schema, migrations, RLS, database functions, JS data-access layer
/docs       — API contract, data model, use cases, requirements, architecture, setup, workflow
/supabase   — Supabase CLI project config
```

## Live URL

_TBD — Vercel deployment URL placeholder, fill in once the frontend
deploys._

## Quick start

See [docs/SETUP.md](docs/SETUP.md) for creating the Supabase project,
installing the CLI, running migrations, loading seed data, and env vars.

## Project management

**Sprint planning and task numbers are tracked in Jira** — Jira project:
_TBD, fill in the URL once created._ Every commit, PR, and the graded
per-sprint Code Contributions report (see
[docs/WORKFLOW.md](docs/WORKFLOW.md#code-contributions-reporting-sprint-grading))
reference Jira task labels (e.g. `A-22`), not GitHub issue numbers.

GitHub Issues are still used for bug reports and lightweight discussion,
tracked on a GitHub Projects board with columns:

```
Backlog → Sprint → In Progress → Review → Done
```

Issue templates: [user story](.github/ISSUE_TEMPLATE/user_story.yml),
[bug report](.github/ISSUE_TEMPLATE/bug_report.yml).

## Docs index

- [API_CONTRACT.md](docs/API_CONTRACT.md) — the frontend/backend handshake
- [DATA_MODEL.md](docs/DATA_MODEL.md) — the 11 tables and their mapping to the 491A class diagram
- [USE_CASES.md](docs/USE_CASES.md) — all 14 use cases
- [REQUIREMENTS.md](docs/REQUIREMENTS.md) — non-functional requirements
- [FRONTEND_DECISION.md](docs/FRONTEND_DECISION.md) — frontend stack ADR
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — why Supabase + Vercel, no app server
- [SETUP.md](docs/SETUP.md) — onboarding
- [WORKFLOW.md](docs/WORKFLOW.md) — how the sub-teams collaborate, and the graded Code Contributions report format
- [sprint-reports/TEMPLATE.md](docs/sprint-reports/TEMPLATE.md) — copy per sprint for the Code Contributions report
- [CONTRIBUTING.md](CONTRIBUTING.md) — branching, reviews, contribution rules

# Coffee POS System

CSULB CECS 491B senior project. A point-of-sale system for a coffee shop:
baristas take orders, take payment and run the live order queue on a
counter tablet; admins manage the menu, inventory, staff, refunds and
reports.

**Live:** https://coffee-pos-system-omega.vercel.app ·
**How to use it:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

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

## Stack

- **Frontend:** plain HTML, CSS and JavaScript modules, no build step
  ([FRONTEND_DECISION.md](docs/FRONTEND_DECISION.md)), hosted on **Vercel**.
- **Backend:** **Supabase** — PostgreSQL with Row Level Security, database
  functions for every money/stock/status change, Auth, and Realtime for the
  live order queue. No app server ([ARCHITECTURE.md](docs/ARCHITECTURE.md)).
- **Tests:** Vitest for the screens and services, SQL check files for the
  database rules, and Playwright end-to-end tests in a real browser.

## What it does

| Barista | Admin |
|---|---|
| Log in (auto sign-out after 10 minutes idle) | Admin Home with every admin screen |
| New Order with drink customizations | Menu Management (add, edit, hide items) |
| Payment by cash (with change) or card | Inventory with low-stock alerts and Restock |
| Active Orders queue, live across devices (Start, Complete, Pay, Cancel) | Staff accounts (roles, deactivate, reactivate) |
| Today's Orders with status and payment | Refunds (full or partial) |
| | Sales Report (day / week, CSV export, past reports) |
| | Reports Dashboard (best sellers, busiest hours, payment breakdown) |
| | Transaction Log (filters, CSV export) |

Paying deducts stock automatically from each menu item's recipe, and every
payment, refund and stock change is recorded in an audit log that can't be
edited or deleted.

## Repo layout

```
/frontend/src   — the site (screens, styles, tests); Vercel deploys this folder
/backend        — migrations, RLS policies, database functions, JS services, SQL checks
/supabase       — the Supabase CLI copies of the migrations
/tests/e2e      — Playwright end-to-end tests (barista and admin flows)
/scripts        — CI helpers, backend copy sync, live demo data
/docs           — API contract, data model, use cases, requirements, architecture, setup, user guide
```

## Live URL

https://coffee-pos-system-omega.vercel.app — auto-deploys from `main`.

## Quick start

See [docs/SETUP.md](docs/SETUP.md) for creating the Supabase project,
installing the CLI, running migrations, loading seed data, and running the
tests.

## Testing

Every pull request runs CI (`.github/workflows/ci.yml`): the backend copy
check, every migration plus all SQL check files on a fresh database, and
the frontend file check plus all Vitest tests. The end-to-end tests run
from `tests/e2e` against the live site or a Vercel preview — see
[SETUP.md](docs/SETUP.md#8-tests).

## Project management

**Sprint planning and task numbers are tracked in Jira** — project `POS`
at teampos.atlassian.net. Every commit, PR, and the graded
per-sprint Code Contributions report (see
[docs/WORKFLOW.md](docs/WORKFLOW.md#code-contributions-reporting-sprint-grading))
reference Jira task labels (e.g. `POS-7`), not GitHub issue numbers.

GitHub Issues are still used for bug reports and lightweight discussion,
tracked on a GitHub Projects board with columns:

```
Backlog → Sprint → In Progress → Review → Done
```

Issue templates: [user story](.github/ISSUE_TEMPLATE/user_story.yml),
[bug report](.github/ISSUE_TEMPLATE/bug_report.yml).

## Docs index

- [API_CONTRACT.md](docs/API_CONTRACT.md) — the frontend/backend handshake
- [DATA_MODEL.md](docs/DATA_MODEL.md) — the tables and their mapping to the 491A class diagram
- [USE_CASES.md](docs/USE_CASES.md) — all 14 use cases
- [REQUIREMENTS.md](docs/REQUIREMENTS.md) — non-functional requirements
- [FRONTEND_DECISION.md](docs/FRONTEND_DECISION.md) — frontend stack ADR
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — why Supabase + Vercel, no app server
- [SETUP.md](docs/SETUP.md) — onboarding, migrations, deploys, tests
- [USER_GUIDE.md](docs/USER_GUIDE.md) — how baristas and admins use the app
- [WORKFLOW.md](docs/WORKFLOW.md) — how the sub-teams collaborate, and the graded Code Contributions report format
- [sprint-reports/TEMPLATE.md](docs/sprint-reports/TEMPLATE.md) — copy per sprint for the Code Contributions report
- [CONTRIBUTING.md](CONTRIBUTING.md) — branching, reviews, contribution rules

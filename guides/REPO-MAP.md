# Repo Map — what every folder is and what to do in it

**Read this first.** Coffee POS System · Team POS · CECS 491B
Live: `coffee-pos-system-omega.vercel.app` · Sprint 1: Sept 14–27

The repo has two halves. **`frontend/` is what the barista sees. `backend/` is
everything that touches data.** They meet at `docs/API_CONTRACT.md` and nowhere
else. If you are editing a file in the other half, stop and ask.

---

## Read these three files before you write any code

| File | Why |
|---|---|
| `../docs/SETUP.md` | Get the project running on your machine. Start here. |
| `<YOUR SIDE>-GUIDE-Sprint1.md` (in this folder) | Your stories, with code patterns for each one |
| `GITHUB-WORKFLOW-Guide.md` (in this folder) | How we branch, commit and submit — the graded part |

---

## `/frontend` — owned by Bismah and Minh Tri

Everything the barista sees. **Never writes SQL. Never calls Supabase
directly.** All data goes through `backend/services/`.

| Path | State | What to do |
|---|---|---|
| `src/index.html` | Placeholder | Replace with the real login screen (POS-8) |
| `src/` | Empty | Your screens go here |
| `assets/` | Empty | Images, icons, fonts |
| `tests/` | Empty | Fill in once the stack is chosen |
| `README.md` | Written | Lists all 13 screens and which use case each serves |

**Blocking decision:** the stack is still undecided — see
`docs/FRONTEND_DECISION.md`. Until it is settled, Bismah and Minh Tri have
nothing concrete to build. Default to plain HTML/CSS/JS if the team cannot
agree.

---

## `/backend` — owned by Tin, Ryan and Nghia

### `migrations/` — Ryan
The database, defined as SQL files. **Schema changes happen ONLY here.** Nobody
edits tables by hand in the Supabase dashboard — that silently desyncs
everyone's local database.

| File | Lines | Owner | State |
|---|---|---|---|
| `0001_schema.sql` | 122 | Ryan | All 11 tables from the 491A class diagram — **review it, it was generated** |
| `0002_rls_policies.sql` | 177 | Tin | Security policies — the only authorization in the system |
| `0003_functions.sql` | 99 | Nghia | `create_order`, `checkout_order`, `process_refund`, `cancel_order`, `update_order_status` — signatures written, bodies to fill |

Apply with `supabase db push`. New change = new numbered file, never edit an
applied one.

### `services/` — Nghia (13 files)
The public API the frontend imports, one module per 491A controller. Currently
signatures and JSDoc, no bodies. **Sprint 1 needs `auth.js`, `menu.js`,
`orders.js`, `orderItems.js` (POS-7).**

**Publish your function signatures to `docs/API_CONTRACT.md` on day one**,
before implementing them. The frontend pair is blocked on the names, not the
code.

### `models/` — 11 files
Shape definitions and validators, one per entity. Fill in as the schema settles.

### `seed/seed.sql` — Ryan
Sample data for development. Currently 20 lines — **needs expanding (POS-2)**:
15+ menu items with some unavailable, inventory including one below threshold,
and a couple of pre-existing Pending orders so the queue screen isn't empty.
Make it re-runnable so anyone can reset to a known state.

### `tests/` — Tin
Only a README right now. The RLS test suite is Sprint 3's big security story,
but a basic version this sprint saves pain later.

### `supabase-client.js`
Reads the URL and key from environment variables. Don't hardcode anything here.

---

## `/docs` — shared, but each file has an owner

| File | Owner | What it is |
|---|---|---|
| `API_CONTRACT.md` | Nghia + frontend | **The handshake between the two halves.** Every backend operation: name, inputs, return shape, errors, which screen calls it. Changing it needs a reviewer from each side. |
| `DATA_MODEL.md` | Ryan | The 11 tables, their columns, and the mapping back to the 491A camelCase names |
| `SETUP.md` | Tin | How a teammate goes from clone to running |
| `ARCHITECTURE.md` | Tin | Browser → services → Supabase, why there's no server, and deviations from the 491A SRS |
| `FRONTEND_DECISION.md` | Bismah + Minh Tri | **Unfilled. Blocking two people.** Options A–D with trade-offs; write the decision and why |
| `USE_CASES.md` | — | All 14 use cases with actor and services touched |
| `REQUIREMENTS.md` | — | The SRS non-functional requirements: 5-second order creation, 100 concurrent orders, 10-minute timeout |
| `WORKFLOW.md` | Tin | How the two sub-teams work in parallel |
| `sprint-reports/TEMPLATE.md` | Tin | Per-sprint report format |
| `491A-reference/` | Tin | **Empty — commit the 491A SRS, Use Cases, Class Diagram and Sequence Diagram PDFs here.** They are our source of truth |

---

## `/guides` — you are here

- `REPO-MAP.md` — this file
- `BACKEND-GUIDE-Sprint1.md` — CLI setup, then a section per person with code patterns for each story
- `FRONTEND-GUIDE-Sprint1.md` — the stack decision, stub pattern so you don't wait on backend, code for each screen, tablet design rules
- `GITHUB-WORKFLOW-Guide.md` — **everyone reads this.** Branching, commits, PRs, and the graded Code Contributions format

---

## `/.github` — automation, mostly leave alone

| Path | What it does |
|---|---|
| `CODEOWNERS` | Auto-requests reviews from the owning sub-team. **Replace the placeholder usernames with real GitHub handles** |
| `ISSUE_TEMPLATE/user_story.yml` | The "As a… I want… so that…" form for new stories |
| `ISSUE_TEMPLATE/bug_report.yml` | Bug form |
| `pull_request_template.md` | Fills in every PR: linked issue, side, what changed, how tested |
| `workflows/ci.yml` | Two jobs, one per folder, each triggered only by changes to its own path |

---

## Root files

| File | Note |
|---|---|
| `README.md` | Project overview and quick start |
| `CONTRIBUTING.md` | Branch naming, review rules, no direct pushes to main |
| `.env.example` | Template. Copy to `.env` (gitignored) and fill in the real values from Tin |
| `.gitignore` | Keeps secrets and clutter out. **Never commit `.env` or any secret key — this repo is public** |
| `supabase/config.toml` | Supabase CLI project config |

---

## The rules that matter most

1. **Never push to `main`.** Branch, PR, one review, merge.
2. **Every commit starts with the Jira key:** `POS-12: Add confirm modal`. This is how our graded contribution report maps files to tasks.
3. **Commit your own work.** The commit author is the only record of who did what, and contributions are graded per person.
4. **Frontend never queries the database.** Everything through `backend/services/`.
5. **Schema changes are migration files.** Never the dashboard.
6. **Empty screen with no error usually means a missing RLS policy** — check that before debugging your code. It is the most common confusion on this stack.
7. **Merged is not Done.** Done is deployed and working on the live URL.

---

## What is blocking whom right now

| Blocker | Blocks | Owner |
|---|---|---|
| Frontend stack undecided | Bismah and Minh Tri entirely | The frontend pair |
| `0001_schema.sql` not applied to Supabase | Nghia's functions, both frontend people's real data | Ryan |
| `API_CONTRACT.md` signatures not published | Frontend can't even stub against the real names | Nghia |
| Test users not created in Supabase Auth | Nobody can test login | Tin |

Fix those four and everyone has work.

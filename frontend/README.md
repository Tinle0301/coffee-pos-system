# frontend/

Everything the barista or admin sees in a browser. This sub-team never writes
SQL directly — all data access goes through the contract documented in
[../docs/API_CONTRACT.md](../docs/API_CONTRACT.md), implemented by the
`backend/services/` JS modules (or, if the Python path is chosen, called
directly against Supabase via `supabase-py` following the same contract).

## Stack: undecided

See [../docs/FRONTEND_DECISION.md](../docs/FRONTEND_DECISION.md) for the
options (A. plain HTML/CSS/JS, B. React/TypeScript, C. Python Flask/Django,
D. Python desktop app), trade-offs, and the decision deadline. Until a
decision is recorded there, this folder stays a neutral layout: no
`package.json`, no `requirements.txt`, no framework config. `src/index.html`
is a temporary placeholder only, to prove the Vercel deploy pipeline works.

## Layout

- `src/` — application source (currently just the placeholder page)
- `assets/` — images, icons, static files
- `tests/` — frontend tests

## Ownership

Bismah Farooq, Minh Tri Chau.

## Screens

From the 491A boundary objects. Each row: screen, use case(s) it serves, and
owner (fill in which of the two teammates above owns each screen).

| Screen                     | Use Case(s)                        | Owner |
|-----------------------------|-------------------------------------|-------|
| Login                       | 1 Login/Logout                     |       |
| Staff Accounts (admin)      | 12 Manage Staff Accounts           |       |
| New Order                   | 2 Create Order                     |       |
| Modify Order                | 3 Modify Order                     |       |
| Checkout                    | 4 Process Payment                  |       |
| Refund (admin)              | 13 Process Refund                  |       |
| Transaction Logs            | 14 View Transaction Logs           |       |
| Owner Menu (admin)          | 8 Manage Menu Items                |       |
| Inventory (admin)           | 9 Manage Inventory                 |       |
| Staff Menu                  | 6 View Menu                        |       |
| Active Orders Queue         | 7 View Active Orders Queue         |       |
| Reports                     | 10 View Sales Reports              |       |
| Export Reports              | 11 Export Reports                  |       |

Screen files are not created yet — the stack is undecided, so there's no
framework to build them in. Once `FRONTEND_DECISION.md` records a decision,
scaffold the screens above under `src/`.

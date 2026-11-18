# Setup

How our Supabase project and Vercel site are set up, and how a teammate
gets a working copy. Written for someone who has never used Supabase.

Live site: https://coffee-pos-system-omega.vercel.app
Supabase project URL: `https://inwlmodlxpcajgivmlbr.supabase.co`
(project ref `inwlmodlxpcajgivmlbr`). Tin owns both accounts; ask him for
access.

## 1. The Supabase project

The project already exists. You only need these steps to rebuild it from
scratch.

1. Sign in at [supabase.com](https://supabase.com) and create a project
   (name, database password, region). Save the database password; the CLI
   asks for it when linking.
2. Go to **Project Settings > API Keys** and note:
   - **Project URL**: goes in `backend/config.js` as `SUPABASE_URL`.
   - **Publishable key** (`sb_publishable_...`): goes in
     `backend/config.js` as `SUPABASE_PUBLISHABLE_KEY`. It is safe in
     browser code; Row Level Security decides what it can read.
   - **Secret key** (`sb_secret_...`, or the legacy `service_role` key):
     never copy this into the repo. See the warning in section 6.

## 2. Auth settings

Staff sign in with email and password (`backend/services/auth.js`). There
is no sign-up page: an admin creates every account.

In the dashboard, under **Authentication**:

| Setting | Value | Why |
|---|---|---|
| Sign In / Providers > Email | Enabled | Staff log in with email and password |
| Allow new users to sign up | Off | Only admins create staff accounts |
| Confirm email | Off | Accounts are created by an admin, not by the staff member |
| URL Configuration > Site URL | `https://coffee-pos-system-omega.vercel.app` | Where Supabase sends users back to |
| JWT expiry | 3600 seconds (default) | The app also signs staff out after 10 idle minutes (`sessionTimeout.js`) |

`supabase/config.toml` holds the same settings for a local Supabase
(`enable_signup = false`, `jwt_expiry = 3600`).

### Adding a staff member

Being in Supabase Auth is not enough to log in. The app also needs a row
in `staff_accounts` with the same id, which is where the role comes from.

1. **Authentication > Users > Add user > Create new user**: enter their
   email and a temporary password, and tick **Auto Confirm User**.
2. Copy the new user's **UID**.
3. In the **SQL Editor**, run:

   ```sql
   insert into staff_accounts
     (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address)
   values
     ('<UID from step 2>', 'Full Name', 'Barista', 'their@email.com');
   ```

   Use `'Admin'` instead of `'Barista'` for an admin. To deactivate
   someone later, set `staff_account_status = false`; they are signed out
   on their next login.

The two staff rows in `backend/seed/seed.sql` are sample data with made-up
ids, so they cannot log in until you create matching Auth users.

## 3. Database migrations

The SQL lives in two places with the same content:

- `backend/migrations/0001_...sql` and up: the readable, numbered copies we
  review in PRs.
- `supabase/migrations/<timestamp>_...sql`: the copies the Supabase CLI
  actually runs.

When you add a migration, add it to **both** folders (same SQL, the
timestamp version named after the date).

Current migrations (22):

| # | Migration | What it does |
|---|---|---|
| 0001 | `schema` | The tables |
| 0002 | `rls_policies` | Row Level Security on every table |
| 0003 | `functions` | Helper functions and the first function stubs |
| 0004 | `create_order` | Create an order with its items (POS-8) |
| 0005 | `payment_security` | Payments and transaction logs can't be changed or deleted (POS-16) |
| 0006 | `status_role_checks` | Role checks on every order status change (POS-17) |
| 0007 | `checkout_order` | Take payment for an order (POS-18) |
| 0008 | `queue_realtime` | Live updates for the order queue (POS-19) |
| 0009 | `process_refund` | Full and partial refunds (POS-31) |
| 0010 | `checkout_keeps_order_open` | Pay first, then make (POS-39) |
| 0011 | `update_order_status` | Legal status changes, queue and log kept in sync (POS-21) |
| 0012 | `menu_item_ingredients` | Recipes; stock is deducted at checkout (POS-20) |
| 0013 | `queue_indexes` | Indexes for the queue and transaction log (POS-22) |
| 0014 | `cancel_order` | Cancel an unpaid order (POS-37) |
| 0015 | `low_stock_inventory` | List low-stock items (POS-57) |
| 0016 | `restock_inventory` | Audited restock (POS-58) |
| 0017 | `staff_management` | Change roles, deactivate/reactivate, no self-changes (POS-43) |
| 0018 | `stock_change_logging` | Every stock change is logged (POS-63) |
| 0019 | `sales_report_payment_breakdown` | Order count and totals by payment method (POS-66) |
| 0020 | `ingredient_usage_report` | Ingredient usage for a date range (POS-78) |
| 0021 | `sales_activity_report` | Best sellers and busiest hours (POS-64) |
| 0022 | `security_hardening` | Signed-out callers locked out of every table and function (POS-61) |

To apply them to the live project:

```bash
brew install supabase/tap/supabase      # once
supabase login                           # once
supabase link --project-ref inwlmodlxpcajgivmlbr   # once, asks for the DB password
supabase db push
```

`db push` only runs the files the project hasn't seen yet. Check with
`supabase migration list`: every row should have both a Local and a Remote
time. If a migration has an older timestamp than one already applied, a
plain `db push` skips it; use `supabase db push --include-all`. You can also
paste a single migration into the dashboard's **SQL Editor**, but then
`db push` will try to run it again later, so prefer `db push`.

After a migration that has a check file, run it in the SQL Editor (for
example `backend/tests/payment_security_check.sql`). Each check prints
PASS and rolls back, so it leaves no data behind.

## 4. Local development

- **Database (optional):** `supabase start` runs Supabase in Docker and
  `supabase db reset` applies every migration in `supabase/migrations/`.
  Load the sample data with
  `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f backend/seed/seed.sql`.
  To point the app at it, temporarily change `backend/config.js` to the
  local URL and key that `supabase start` prints, and don't commit that.
- **Frontend:** plain HTML/CSS/JS in `frontend/src/`. From that folder run
  `npm install`, then `npm run dev` for a local server and
  `npx vitest run` for the tests.

## 5. How the app gets its keys

There is no build step (see `docs/FRONTEND_DECISION.md`), so nothing reads
environment variables. The browser loads `backend/config.js` as-is; it holds
the project URL and the publishable key, both of which are meant to be
public.

The site uses a copy of `config.js` and the other backend files it needs
in `frontend/src/backend/` (Vercel only deploys `frontend/src/`). After
changing a backend file, run `node scripts/sync-backend.mjs` from the
repo root and commit the updated copy (POS-34).

`.env.example` is only for local scripts that need a URL or key. Nothing
in the app reads it, and no `.env` file is committed.

## 6. ⚠️ Secret key warning

The **secret key** (`sb_secret_...` or legacy `service_role`) bypasses Row
Level Security entirely. It must never be:

- committed to this repo (the repo is public),
- put in `backend/config.js`, `.env.example`, or anything under
  `frontend/`,
- added to Vercel's environment variables. The site has no server code
  that could keep it hidden from the browser.

If you need it for a one-off admin script, keep it in a local `.env`
(gitignored) and nowhere else.

## 7. Vercel deployment

Vercel deploys the GitHub repo automatically. There is no deploy workflow in
`.github/workflows/`.

| Vercel setting | Value |
|---|---|
| Git repository | `Tinle0301/coffee-pos-system` |
| Production branch | `main` |
| Root Directory | `frontend/src` |
| Framework Preset | Other |
| Build Command | none (`frontend/src/vercel.json` sets `"buildCommand": ""`) |
| Output Directory | `.` (same file) |
| Environment Variables | none needed (see section 5) |

What happens on each push:

1. A push or merge to `main` builds a new **production** deploy at the
   live URL, usually within a minute.
2. Every PR gets its own **preview** URL; the Vercel bot comments it on
   the PR. Check your change there before merging.
3. To undo a bad deploy, open the project's **Deployments** tab in Vercel,
   pick the last good one and choose **Promote to Production** (or
   **Instant Rollback**).

Database changes are not part of a Vercel deploy. Merge the PR, then run
`supabase db push` (section 3).

## 8. Tests

**Frontend and services** (Vitest), from `frontend/src`:

```bash
npm install
npx vitest run
node ../../scripts/check-frontend.mjs   # conflict markers, syntax, imports
```

**Database rules** (SQL checks), against an **empty** local Postgres
database, never the live project:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" bash scripts/run-sql-checks.sh
```

It applies every migration plus the seed data, then runs every file in
`backend/tests/`. CI runs both of these on every pull request.

**End-to-end** (Playwright, a real browser), from `tests/e2e`:

```bash
npm ci
npx playwright install chromium
export POS_BARISTA_EMAIL="barista@test.com"
read -s "POS_BARISTA_PASSWORD?Test barista password: " && export POS_BARISTA_PASSWORD && echo
export POS_ADMIN_EMAIL="<test admin email>"
read -s "POS_ADMIN_PASSWORD?Test admin password: " && export POS_ADMIN_PASSWORD && echo
npx playwright test
```

- Use the **test** accounts only; logins are never written in the repo.
- `POS_BASE_URL` picks the site: unset = the live site, or a Vercel
  preview URL to test a PR before merging.
- The barista test creates and completes 2 real orders per run; the admin
  test saves one Day report.
- `npx playwright show-report` shows a screenshot of any failing step.

## 9. Demo data

`scripts/demo-data-live.sql` loads 14 realistic orders (payments, refunds,
queue, logs) into the live project for a review or presentation: paste it
into the SQL Editor and run it. Running it again the same day adds
nothing; on a later day it adds a fresh set. Demo payments can't be
deleted later (audit rules), so never run it on a database with real
sales.


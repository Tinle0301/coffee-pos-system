# backend/

Schema, migrations, RLS policies, database functions, and the data-access
layer. Never imports from `frontend/`. The two sides meet only at
[../docs/API_CONTRACT.md](../docs/API_CONTRACT.md).

## Ownership

3 people (names TBD — placeholder, replace with the assigned teammates).

## Layout

- `migrations/` — Supabase CLI migration files, numbered
  (`0001_schema.sql`, `0002_rls_policies.sql`, `0003_functions.sql`). Schema
  changes happen ONLY here — nobody edits tables by hand in the dashboard.
- `seed/seed.sql` — sample menu items, staff, and inventory for local dev.
- `services/` — one JS module per 491A controller, exported function
  signatures with JSDoc, stubs only (no bodies yet).
- `models/` — JS shape definitions + validators for the 11 entities.
- `supabase-client.js` — client init reading env vars.
- `tests/` — RLS policy tests. See `tests/README.md` to run them locally.

## Why database functions instead of application logic

There is no application server. Any operation that touches more than one
table atomically (e.g. creating an order + its items + a queue entry +
an audit log row in one transaction) lives in a Postgres function
(`migrations/0003_functions.sql`), not in `services/`. The `services/`
modules call these functions and plain table reads through
`@supabase/supabase-js` — they contain no direct multi-table writes.

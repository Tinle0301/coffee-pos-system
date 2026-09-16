# backend/tests — Row Level Security tests

RLS is the only authorization layer in this system. There is no application
server, the publishable key ships in the browser, and this repo is public. If a
policy is wrong, a barista can reach admin data. These tests are how we know
the policies are right — and they run on every pull request that touches
`backend/`.

## What's here

| File | Purpose |
|---|---|
| `rls_test.sql` | The tests. Eight cases, each raising an exception on failure. |
| `ci_auth_shim.sql` | Makes plain Postgres behave like Supabase (`auth.uid()`, the `anon` / `authenticated` roles). Apply BEFORE migrations. |
| `grant_api_roles.sql` | Grants those roles the table privileges Supabase grants. Apply AFTER migrations. |

`ci_auth_shim.sql` exists because our policies call `auth.uid()`, which only
Supabase provides. Without it, migration 0002 fails on a bare Postgres with
"schema auth does not exist". **Never apply the shim to the real Supabase
project** — it would shadow the real `auth` schema.

## Running locally

With Docker, against a throwaway Postgres:

```bash
docker run --rm -d --name pos-test -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:15
sleep 5

PG="postgresql://postgres:postgres@localhost:5433/postgres"
psql "$PG" -f backend/tests/ci_auth_shim.sql
for f in backend/migrations/*.sql; do psql "$PG" -v ON_ERROR_STOP=1 -f "$f"; done
psql "$PG" -f backend/seed/seed.sql
psql "$PG" -f backend/tests/grant_api_roles.sql
psql "$PG" -v ON_ERROR_STOP=1 -f backend/tests/rls_test.sql

docker stop pos-test
```

Every test prints PASS or FAIL. A failure stops the run with a message saying
what the policy actually allowed.

## Adding a test

Copy an existing block. The pattern is:

```sql
begin;
  select set_config('request.jwt.claims', '{"sub":"<user-uuid>","role":"authenticated"}', true);
  set local role authenticated;
  do $$ ... raise exception 'FAIL n: ...' ... $$;
rollback;
```

Everything runs inside a transaction that rolls back, so tests never leave data
behind and can run in any order.

**Write the failure message as a sentence a teammate can act on.** "FAIL 5:
barista updated 3 menu_items rows — they can change prices" tells you what
broke. "assertion failed" does not.

## When you change a policy

Change `0002_rls_policies.sql` and the test in the same commit. A policy change
with no test change is the thing to question in code review.

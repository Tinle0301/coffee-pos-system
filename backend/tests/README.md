# backend/tests/

RLS policy tests. A wrong policy in `../migrations/0002_rls_policies.sql`
means a barista can make themselves an admin — these tests exist to catch
that before merge, not just via code review.

## Running locally

1. Install the Supabase CLI (see [../../docs/SETUP.md](../../docs/SETUP.md)).
2. Start a local Supabase instance: `supabase start`.
3. Apply migrations: `supabase db reset` (applies everything in
   `../migrations/` in order, then `../seed/seed.sql`).
4. Run the test suite: *(command TBD once a test runner is chosen — e.g.
   `pgTAP` run via `supabase test db`, or a JS suite hitting the local
   Supabase REST API with test JWTs for a barista and an admin role)*.

## What to cover

- A barista can read only their own `staff_accounts` row (not another
  staff member's) and cannot write to it. A barista cannot read/write
  `refunds`, `sales_reports`, or `transaction_logs`.
- A barista can only insert/update orders and order_items they created, not
  another staff member's.
- No client (barista or admin) can `update` or `delete` `transaction_logs`.
- An admin can read/write everything admin-scoped in
  `0002_rls_policies.sql`.
- An unauthenticated request is denied on every table.

This file is also referenced by the backend CI job in
`../../.github/workflows/ci.yml`, which spins up a Postgres service
container, applies migrations, and runs these tests.

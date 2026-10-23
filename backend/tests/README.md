# backend/tests/

RLS policy tests. A wrong policy in `../migrations/0002_rls_policies.sql`
means a barista can make themselves an admin — these tests exist to catch
that before merge, not just via code review.

## Running locally

1. Install the Supabase CLI (see [../../docs/SETUP.md](../../docs/SETUP.md)).
2. Start a local Supabase instance: `supabase start`.
3. Apply migrations: `supabase db reset` (applies everything in
   `../migrations/` in order, then `../seed/seed.sql`).
4. Run the test suite: *not written yet — the RLS suite is planned for
   Sprint 3 (e.g. `pgTAP` via `supabase test db`, or a JS suite hitting the
   local Supabase REST API with test JWTs for a barista and an admin).
   Frontend unit tests already exist: `npx vitest run` in `frontend/src/`.*

   **Payment and log security (POS-16):** `payment_security_check.sql` checks
   that payments and transaction logs cannot be altered. Run it after
   migrations `0001`–`0005` with
   `psql "<connection-string>" -f backend/tests/payment_security_check.sql`.
   It runs in one transaction and rolls back, so it leaves no data behind.

   **Order status role checks (POS-17):** `status_role_check.sql` checks who
   may change an order's status. Run it after migrations `0001`–`0006` the
   same way. It also rolls back.

   **Cancel order (POS-37):** `cancel_order_check.sql` checks that unpaid
   orders can be cancelled (status, queue and log), that paid or finished
   orders can't, and who may cancel. Run it after all migrations. It also
   rolls back.

   **RLS for staff, orders and order items (POS-40):**
   `rls_staff_accounts_check.sql`, `rls_orders_check.sql` and
   `rls_order_items_check.sql` sign in as a barista, a second barista, an
   admin, a deactivated account and a signed-out user, and check what each
   one can read and change. Run them after all migrations. They also roll
   back.

   **RLS for refunds, sales reports, logs and signed-out users (POS-41):**
   `rls_refunds_check.sql`, `rls_sales_reports_check.sql` and
   `rls_transaction_logs_check.sql` check that only active admins can read
   this data, and that nobody can edit or delete a log entry.
   `rls_signed_out_check.sql` checks that a signed-out caller (the public
   key in the browser) can't read or write any table or run any database
   function. Run them after all migrations. They also roll back.

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

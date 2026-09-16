# Backend Team Guide — Sprint 1
**Tin (Auth & Security) · Ryan (Schema & Data) · Nghia (Services & Functions)**
Sprint: `Create Order End-to-End` · Sept 14–27, 2026

---

## 0. Everyone does this first (Day 1, ~30 min)

```bash
# install the Supabase CLI
npm install -g supabase

# sign in (opens a browser)
supabase login

# from the repo root, link to our project
supabase link --project-ref inwlmodlxpcajgivmlbr
```

Create `.env` in the repo root (it is gitignored — never commit it):

```
SUPABASE_URL=https://inwlmodlxpcajgivmlbr.supabase.co
SUPABASE_PUBLISHABLE_KEY=<get from Tin>
```

**Optional but recommended** — run Postgres locally so you are not testing against the shared database:

```bash
supabase start     # first run downloads Docker images, takes a few minutes
supabase status    # shows local URLs and keys
supabase stop
```

**Resources**
- Supabase CLI: https://supabase.com/docs/guides/local-development/cli/getting-started
- Local development: https://supabase.com/docs/guides/local-development

---

## 1. The rule that prevents most of our problems

**Schema changes only happen through migration files committed to the repo.** Nobody edits tables in the dashboard. If you do, everyone else's local database silently diverges from production and we spend a sprint finding out why.

```bash
supabase migration new create_core_schema   # creates backend/migrations/<timestamp>_create_core_schema.sql
# write your SQL in that file
supabase db push                            # applies it to the linked project
```

---

# RYAN — Schema & Data (11 points)

## Story #1 — Database Schema (8 pts)

Build all 11 tables from the 491A class diagram. Use snake_case columns and document the mapping back to the camelCase names in `docs/DATA_MODEL.md`.

**Order of work:** tables with no foreign keys first (`users`, `staff_accounts`, `menu_items`, `inventory_items`), then `orders`, then everything that points at orders.

**Pattern to follow for every table:**

```sql
create table orders (
  order_identifier           uuid primary key default gen_random_uuid(),
  order_status_type          text not null default 'Pending'
                             check (order_status_type in ('Pending','In Progress','Completed','Cancelled')),
  order_subtotal_amount      numeric(10,2) not null default 0 check (order_subtotal_amount >= 0),
  order_tax_amount           numeric(10,2) not null default 0 check (order_tax_amount >= 0),
  order_total_amount         numeric(10,2) not null default 0 check (order_total_amount >= 0),
  order_creation_timestamp   timestamptz not null default now(),
  created_by_staff_identifier uuid not null references staff_accounts(staff_account_identifier)
);

create index idx_orders_status on orders(order_status_type);
create index idx_orders_created on orders(order_creation_timestamp desc);
```

**Rules for the whole schema**
- Money is `numeric(10,2)`, never `float`. Floats lose cents.
- Timestamps are `timestamptz`, never `timestamp`.
- IDs are `uuid` with `default gen_random_uuid()`.
- `order_items.associated_order_identifier` gets `on delete cascade` — deleting an order removes its items.
- Every status and role column gets a CHECK constraint. Let the database enforce it, not the app.
- Indexes on anything you filter or sort by: order status, order timestamp, order_items by order.

**Acceptance:** all 11 tables exist, `supabase db push` runs clean on an empty database, and `docs/DATA_MODEL.md` lists every table with its columns and one example row.

**Deliver a partial migration by Sept 17** even if incomplete — four people are blocked until tables exist. `users`, `staff_accounts`, `menu_items`, `orders`, `order_items` is enough to unblock everyone.

## Story #2 — Seed Data (3 pts)

Write `backend/seed/seed.sql`: 15+ menu items across categories (espresso, brewed, tea, food), 3 staff accounts (one Admin, two Barista), and inventory rows for the ingredients.

Make it re-runnable — start the file with `truncate` statements or use `on conflict do nothing`, so anyone can reset their database without errors.

**Resources**
- Postgres data types: https://www.postgresql.org/docs/current/datatype.html
- Supabase database docs: https://supabase.com/docs/guides/database/overview

---

# TIN — Auth & Security (12 points)

## Story #3 — Staff Login (5 pts)

Supabase Auth handles the password hashing and session. Your job is wiring it to our `staff_accounts` table and exposing the role.

Enable email auth (done — Confirm email is off). Create test users in Authentication → Users.

The role lives in a column our policies can read. Simplest approach for our project: store the role on the user's JWT via a custom claim, or read it from `staff_accounts` inside the policy. Pick one, write it down in `docs/ARCHITECTURE.md`, and use it consistently — mixing both is how policies get confusing.

A helper function makes every policy readable:

```sql
create or replace function auth_role()
returns text
language sql stable
as $$
  select staff_role_type
  from staff_accounts
  where staff_account_identifier = auth.uid()
$$;
```

## Story #4 — Session Timeout (2 pts)

10 minutes of inactivity ends the session (SRS requirement). Implement as a client-side idle timer that calls `supabase.auth.signOut()` — reset it on any click or keypress. Coordinate with Minh Tri, whose Logout story (#13) uses the same sign-out path.

## Story #5 — Baseline Security Policies (5 pts)

**This is the most important story in the sprint.** Our repo is public and the publishable key is in the frontend, so RLS is the only thing between a barista and admin data.

Enable RLS on every table and write policies. Comment each one.

```sql
alter table menu_items enable row level security;

-- Any signed-in staff member can read the menu
create policy "staff read menu"
on menu_items for select
to authenticated
using (true);

-- Only an Admin may change the menu
create policy "admin writes menu"
on menu_items for all
to authenticated
using (auth_role() = 'Admin')
with check (auth_role() = 'Admin');
```

**Sprint 1 minimum:** menu readable by authenticated staff, orders and order_items insertable by authenticated staff, everything else locked down. The full policy set and its test suite is Sprint 3 — this sprint is the baseline.

**The failure mode to remember:** RLS on with no policy = every query returns zero rows and **no error**. When the frontend says a screen is empty, check for a policy before anyone debugs JavaScript.

**Resources**
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth: https://supabase.com/docs/guides/auth
- Policy examples: https://supabase.com/docs/guides/troubleshooting/rls-simplified

---

# NGHIA — Services & Functions (13 points)

## Story #6 — Create Order Transaction (8 pts)

With no server, anything that must be atomic lives in the database. Creating an order writes to three tables and must be all-or-nothing.

```sql
create or replace function create_order(
  items jsonb,              -- [{menu_item_id, quantity, customization, price}, ...]
  staff_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  new_order_id uuid;
  subtotal numeric(10,2) := 0;
  tax numeric(10,2);
begin
  -- 1. compute subtotal from items
  -- 2. insert into orders, returning order_identifier into new_order_id
  -- 3. insert each element of items into order_items
  -- 4. insert a queue_entries row for the new order
  -- 5. insert a transaction_logs row
  return new_order_id;
end;
$$;
```

Everything inside a plpgsql function runs in one transaction — if step 4 fails, steps 1–3 roll back automatically. That is the whole reason this is a function and not four client calls.

Call it from JavaScript with `supabase.rpc('create_order', { items, staff_id })`.

**Watch out:** `security definer` makes the function run with the owner's privileges, bypassing RLS inside it. That is intentional here, but it means the function itself must validate that the caller is allowed to do this. Talk to Tin about this before you finish the story.

## Story #7 — Core Data Access Modules (5 pts)

`backend/services/` is the public API the frontend imports. Nobody on the frontend writes a query.

```js
// backend/services/menu.js
import { supabase } from '../supabase-client.js'

/**
 * Get all menu items, grouped by category.
 * @returns {Promise<{data: MenuItem[], error: Error|null}>}
 */
export async function listMenuItems() {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('menu_item_category_type')
  return { data, error }
}
```

**Sprint 1 modules:** `auth.js`, `menu.js`, `orders.js`, `orderItems.js`.

**Return shape matters more than anything else here.** Whatever you decide — `{data, error}` or throwing on error — write it at the top of `docs/API_CONTRACT.md` and never vary. The frontend is coding against that contract with fake data right now, and every inconsistency costs them a debugging session.

**Publish your function signatures to `docs/API_CONTRACT.md` on day one**, before you implement them. Bismah and Minh Tri are blocked on the names, not the code.

**Resources**
- supabase-js: https://supabase.com/docs/reference/javascript/introduction
- Database functions: https://supabase.com/docs/guides/database/functions
- plpgsql: https://www.postgresql.org/docs/current/plpgsql.html
- Calling functions from the client: https://supabase.com/docs/reference/javascript/rpc

---

## Working agreements

- Branch naming: `feature/<issue-number>-<short-description>`
- One teammate reviews every PR before merge; two if it touches `docs/API_CONTRACT.md`
- Never push to `main` directly
- Every schema change is a migration file, no exceptions
- If you are blocked more than half a day, say so at the daily scrum — that is what it is for

## Sprint 1 Definition of Done

Merged to `main` via reviewed PR · deployed and working on the live URL · acceptance criteria met · demoed to the team.

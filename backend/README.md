# backend/ — everything that touches data

**Owners:** Trung Tin Le (Auth & Security) · Ryan Grubert (Schema & Data) · Trong Nghia Le (Services & Functions)

This folder never imports from `frontend/`. The two halves of the project meet
at [`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md) and nowhere else.

**There is no application server.** Supabase *is* the backend: PostgreSQL for
data, Supabase Auth for login, Row Level Security for authorization, Realtime
for the live order queue. Everything here is SQL, database functions, or a thin
JavaScript layer that calls them.

---

## Who owns what

| Area | Owner | Files |
|---|---|---|
| Schema & data | Ryan | `migrations/0001_schema.sql`, `seed/seed.sql`, `models/` |
| Auth & security | Tin | `migrations/0002_rls_policies.sql`, `tests/`, `services/auth.js`, `services/staff.js` |
| Services & functions | Nghia | `migrations/0003_functions.sql`, the rest of `services/` |

Stay in your own files. If you need a change in someone else's, ask them —
two people editing `0001_schema.sql` is how a morning disappears.

---

## `migrations/` — the database, as code

**Schema changes happen ONLY through migration files committed to this repo.**
Nobody edits tables by hand in the Supabase dashboard. A dashboard edit
silently desyncs everyone's local database from production, and you find out
two weeks later when someone's query fails for no visible reason.

| File | Lines | Owner | What it does |
|---|---|---|---|
| `0001_schema.sql` | 122 | Ryan | All 11 tables from the 491A class diagram, with foreign keys, CHECK constraints and indexes |
| `0002_rls_policies.sql` | 177 | Tin | Every security policy. **This is the only authorization in the system** |
| `0003_functions.sql` | 99 | Nghia | `create_order`, `checkout_order`, `process_refund`, `cancel_order`, `update_order_status` — signatures written, bodies to fill |

### Working with migrations

```bash
supabase migration new add_something    # creates a new numbered file
# write your SQL in it
supabase db push                        # applies it to the linked project
```

**Never edit a migration that has already been applied.** Postgres has already
run it; changing the file changes history without changing the database. Write
a new numbered file instead.

### Conventions in `0001_schema.sql`

- Column names are `snake_case`; the mapping back to the 491A camelCase names
  is in [`../docs/DATA_MODEL.md`](../docs/DATA_MODEL.md)
- Money is `numeric(10,2)`, never `float` — floats lose cents
- Timestamps are `timestamptz`, never `timestamp`
- IDs are `uuid` with `default gen_random_uuid()`
- Status and role columns carry CHECK constraints — the database enforces
  valid values, not the application
- `order_items` cascades on delete from `orders`

**Ryan: read this file line by line before building on it.** It was generated
from the class diagram and it is your story (POS-1) to defend at the sprint
review. Generated SQL is a draft, not an answer.

### About `0002_rls_policies.sql` — read this even if it isn't yours

Our publishable key ships in the browser and this repo is public. The only
thing stopping anyone from reading our data is these policies. The shape:

```sql
alter table menu_items enable row level security;

-- any signed-in staff member may read the menu
create policy menu_items_select_staff on menu_items
  for select using (is_authenticated_staff());

-- only an admin may change it
create policy menu_items_write_admin on menu_items
  for all using (is_admin()) with check (is_admin());
```

`is_admin()` and `is_authenticated_staff()` are `security definer` helpers that
look the caller up in `staff_accounts` via `auth.uid()`.

**The consequence everyone needs to know:** a table with RLS enabled and no
matching policy returns **zero rows and no error**. When the frontend reports
an empty screen, a missing policy is the first thing to check — not their
JavaScript.

### About `0003_functions.sql`

With no server, anything that must be atomic across several tables lives in
the database. Creating an order writes to `orders`, `order_items`,
`queue_entries` and `transaction_logs` — all or nothing.

```sql
create or replace function create_order(items jsonb, staff_id uuid)
returns uuid
language plpgsql
security definer
as $$
begin
  -- everything in here is ONE transaction:
  -- if the last insert fails, the first three roll back automatically
end;
$$;
```

Called from JavaScript as `supabase.rpc('create_order', { items, staff_id })`.

**`security definer` means the function bypasses RLS while it runs.** That is
intentional — but it also means the function itself must check that the caller
is allowed to do this. Nghia and Tin should review these together before POS-6
is marked done.

---

## `services/` — the public API the frontend imports

One module per 491A controller. Currently signatures and JSDoc, no bodies:

```js
/**
 * @param {{ menuItemIdentifier: string, quantity: number, customization?: string }[]} items
 * @param {string} staffId
 * @returns {Promise<Order>}
 */
export async function CreateNewOrder(items, staffId) {}
```

| Module | Sprint | Controller |
|---|---|---|
| `auth.js` | **1** | AuthController — login, logout, session, timeout |
| `menu.js` | **1** | MenuController |
| `orders.js` | **1** | OrderController |
| `orderItems.js` | **1** | Add / update quantity / remove / list items |
| `payments.js` | 2 | PaymentController |
| `orderStatus.js` | 2 | Pending → In Progress → Completed |
| `queue.js` | 2 | Active queue + the Realtime subscription |
| `inventory.js` | 3 | InventoryController |
| `staff.js` | 3 | UserController |
| `refunds.js` | 3 | RefundController |
| `reports.js` | 4 | ReportController |
| `exports.js` | 4 | CSV / PDF export |
| `transactions.js` | 4 | Transaction log queries |

### Two rules for this folder

**Decide the return shape once and never vary it.** Whatever you pick —
`{ data, error }` or throwing on failure — write it at the top of
`API_CONTRACT.md` and hold to it. The frontend is coding against that contract
with stubbed values right now; every inconsistency costs them a debugging
session they can't diagnose.

**Publish signatures before implementing them.** Nghia: put the function names,
parameters and return shapes in `API_CONTRACT.md` on day one. Bismah and Minh
Tri are blocked on the *names*, not the code — once the names exist they can
stub and build in parallel.

---

## `models/` — 11 shape definitions

One per entity: plain JS objects plus validators. Keep them matching
`0001_schema.sql`; if a column changes, this changes in the same PR.

---

## `seed/seed.sql` — Ryan (POS-2)

Currently 20 lines. Sprint 1 needs it to be a realistic, **re-runnable**
dataset — start with `truncate ... cascade` so anyone can reset to a known
state in one command.

Worth including, because it saves testing time later: 15+ menu items across
categories with **two marked unavailable** (so out-of-stock display can be
tested without editing data), inventory with **one item below its threshold**,
prices that make tax checkable by hand (a $4.00 item at 10.25% → $0.41 →
$4.41), and **two pre-existing Pending orders** so the queue screen has content
before the create-order flow exists.

---

## `tests/` — Tin

RLS policies are the whole security model, so they need tests, not just review.
The full suite is Sprint 3 (POS story: Security Policy Test Suite), but even a
few cases this sprint catch the dangerous mistakes early.

The cases that matter most: anonymous user can read nothing · barista can read
the menu · barista **cannot** change the menu · barista **cannot** read
`staff_accounts` · barista **cannot** create an order in someone else's name ·
admin **can** change the menu · `transaction_logs` cannot be updated by anyone.

Note that our policies call `auth.uid()`, which only Supabase provides — tests
running against plain Postgres need a small shim defining `auth.uid()` and the
`anon` / `authenticated` roles, or the migrations won't even apply.

---

## `supabase-client.js`

Initializes the client from environment variables. **Never hardcode the URL or
key here.** Copy `.env.example` to `.env` (gitignored) and fill in the values
from Tin.

The publishable key is safe in browser code. Any secret key — `sb_secret_...`
or the legacy `service_role` — bypasses every policy in `0002` and belongs
nowhere in this repo.

---

## Getting set up

```bash
npm install -g supabase
supabase login
supabase link --project-ref inwlmodlxpcajgivmlbr
supabase db push        # apply migrations
```

Optional but worth it: `supabase start` runs the whole stack locally in Docker
so you're not testing against the shared database.

Full walkthrough in [`../docs/SETUP.md`](../docs/SETUP.md); your Sprint 1
stories with code patterns are in
[`../guides/BACKEND-GUIDE-Sprint1.md`](../guides/BACKEND-GUIDE-Sprint1.md).

---

## Sprint 1 checklist for this folder

- [ ] **POS-1** Schema applied to Supabase (Ryan) — *blocks four people, land a partial version early*
- [ ] **POS-2** Seed data expanded and re-runnable (Ryan)
- [ ] **POS-3** Login working end to end (Tin)
- [ ] **POS-4** 10-minute session timeout (Tin)
- [ ] **POS-5** RLS enabled on every table with baseline policies (Tin)
- [ ] **POS-6** `create_order` function writing all four tables atomically (Nghia)
- [ ] **POS-7** `auth.js`, `menu.js`, `orders.js`, `orderItems.js` implemented (Nghia)
- [ ] Signatures published to `API_CONTRACT.md` — **day one, before implementing**

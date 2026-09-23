-- 0002_rls_policies.sql
-- Coffee POS System — Row Level Security policies
--
-- RLS is the ONLY authorization mechanism in this system. There is no
-- application server to enforce access rules — every rule a client can rely
-- on must be encoded here. A wrong policy here means a barista can make
-- themselves an admin. These policies need tests (see backend/tests/), not
-- just review.
--
-- Convention used below: a staff member's role is read from staff_accounts
-- via auth.uid(), which Supabase Auth maps to the authenticated user. Adjust
-- the auth.uid() <-> staff_account_identifier linkage once auth is wired up;
-- left explicit here so the mapping is visible and reviewable.

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from staff_accounts
    where staff_account_identifier = auth.uid()
      and staff_role_type = 'Admin'
      and staff_account_status = true
  );
$$;

create or replace function is_authenticated_staff()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from staff_accounts
    where staff_account_identifier = auth.uid()
      and staff_account_status = true
  );
$$;

-- ── enable RLS on every table ──────────────────────────────────────────
alter table staff_accounts enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table refunds enable row level security;
alter table transaction_logs enable row level security;
alter table menu_items enable row level security;
alter table inventory_items enable row level security;
alter table queue_entries enable row level security;
alter table sales_reports enable row level security;

-- ── menu_items ──────────────────────────────────────────────────────────
-- Any authenticated barista or admin may read the menu.
create policy menu_items_select_staff on menu_items
  for select using (is_authenticated_staff());

-- Only admins may create/update/delete menu items.
create policy menu_items_write_admin on menu_items
  for all using (is_admin()) with check (is_admin());

-- ── inventory_items ─────────────────────────────────────────────────────
-- Any authenticated barista or admin may read inventory levels.
create policy inventory_items_select_staff on inventory_items
  for select using (is_authenticated_staff());

-- Only admins may create/update/delete inventory items.
create policy inventory_items_write_admin on inventory_items
  for all using (is_admin()) with check (is_admin());

-- ── orders ──────────────────────────────────────────────────────────────
-- Baristas insert and update orders they created; admins can read/write all.
create policy orders_select_own_or_admin on orders
  for select using (
    is_admin() or created_by_staff_identifier = auth.uid()
  );

create policy orders_insert_own on orders
  for insert with check (
    is_authenticated_staff() and created_by_staff_identifier = auth.uid()
  );

create policy orders_update_own_or_admin on orders
  for update using (
    is_admin() or created_by_staff_identifier = auth.uid()
  ) with check (
    is_admin() or created_by_staff_identifier = auth.uid()
  );

-- ── order_items ─────────────────────────────────────────────────────────
-- Follows the parent order: a barista may touch order_items on their own
-- orders; admins may touch any.
create policy order_items_select_via_order on order_items
  for select using (
    is_admin() or exists (
      select 1 from orders o
      where o.order_identifier = order_items.associated_order_identifier
        and o.created_by_staff_identifier = auth.uid()
    )
  );

create policy order_items_write_via_order on order_items
  for all using (
    is_admin() or exists (
      select 1 from orders o
      where o.order_identifier = order_items.associated_order_identifier
        and o.created_by_staff_identifier = auth.uid()
    )
  ) with check (
    is_admin() or exists (
      select 1 from orders o
      where o.order_identifier = order_items.associated_order_identifier
        and o.created_by_staff_identifier = auth.uid()
    )
  );

-- ── payments ────────────────────────────────────────────────────────────
-- Baristas insert payments (checkout); admins may read/write all. Baristas
-- may read payments on orders they created.
create policy payments_select_own_or_admin on payments
  for select using (
    is_admin() or exists (
      select 1 from orders o
      where o.order_identifier = payments.associated_order_identifier
        and o.created_by_staff_identifier = auth.uid()
    )
  );

create policy payments_insert_staff on payments
  for insert with check (is_authenticated_staff());

create policy payments_write_admin on payments
  for update using (is_admin()) with check (is_admin());

-- ── refunds ─────────────────────────────────────────────────────────────
-- Admin only, both read and write.
create policy refunds_admin_only on refunds
  for all using (is_admin()) with check (is_admin());

-- ── transaction_logs ────────────────────────────────────────────────────
-- Admin-only read. Inserts happen via SECURITY DEFINER database functions
-- (see 0003_functions.sql), never directly by clients. Nobody may update or
-- delete — audit records are immutable.
create policy transaction_logs_select_admin on transaction_logs
  for select using (is_admin());

-- Intentionally no insert/update/delete policy for regular clients: with RLS
-- enabled and no permissive policy, direct client writes are denied by
-- default. Only SECURITY DEFINER functions (owned by a role that bypasses
-- RLS) may write transaction_logs.

-- ── queue_entries ───────────────────────────────────────────────────────
-- Any authenticated staff may read the live queue.
create policy queue_entries_select_staff on queue_entries
  for select using (is_authenticated_staff());

-- Writes happen via database functions (create_order, checkout_order, etc.),
-- not directly by clients.

-- ── sales_reports ───────────────────────────────────────────────────────
-- Admin only, both read and write.
create policy sales_reports_admin_only on sales_reports
  for all using (is_admin()) with check (is_admin());

-- ── staff_accounts ──────────────────────────────────────────────────────
-- Admin-only read/write. A staff member is not granted self-read here on
-- purpose — expose only what's needed via a narrower view/function later if
-- "view my own profile" becomes a requirement.
create policy staff_accounts_admin_only on staff_accounts
  for all using (is_admin()) with check (is_admin());

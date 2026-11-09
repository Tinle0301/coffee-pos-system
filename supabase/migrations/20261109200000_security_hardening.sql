-- 0022_security_hardening.sql
-- POS-61: final security review of every table and database function.
--
-- The browser holds the public (anon) key, and the repo is public, so
-- anyone can call our database without logging in. RLS already returns
-- nothing to a signed-out caller; this migration closes the remaining
-- gaps so a signed-out caller can't even try:
--
--   1. Signed-out (anon) callers lose all table privileges. The app never
--      reads or writes a table before login (login goes through Supabase
--      Auth, not our tables), so nothing in the app changes. RLS stays on
--      as the main control for signed-in staff.
--   2. Signed-out callers can no longer run create_order, checkout_order,
--      process_refund or order_inventory_consumption. Those checked the
--      caller inside the function, but they shouldn't be callable at all.
--   3. Trigger functions can't be called directly by anyone. Triggers still
--      fire: Postgres doesn't check EXECUTE when a trigger runs.
--   4. Every SECURITY DEFINER function gets a fixed search_path, so nobody
--      can make one run a look-alike table or function from another schema
--      (Supabase's database linter flags this as "function_search_path_mutable").
--
-- is_admin() and is_authenticated_staff() stay callable by anon on
-- purpose: RLS policies call them, and they just return false when nobody
-- is signed in.
--
-- New tables and functions: Supabase grants anon access to anything new in
-- the public schema, so a later migration that adds one must revoke anon
-- the same way (see backend/tests/security_hardening_check.sql, which fails
-- if it doesn't).

-- 1. No table privileges for signed-out callers ---------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 2. Order, payment and refund functions: signed-in staff only ------------
revoke execute on function create_order(jsonb, uuid) from public, anon;
revoke execute on function checkout_order(uuid, text, numeric, jsonb) from public, anon;
revoke execute on function process_refund(uuid, text, numeric) from public, anon;
revoke execute on function order_inventory_consumption(uuid) from public, anon;

grant execute on function create_order(jsonb, uuid) to authenticated, service_role;
grant execute on function checkout_order(uuid, text, numeric, jsonb) to authenticated, service_role;
grant execute on function process_refund(uuid, text, numeric) to authenticated, service_role;
grant execute on function order_inventory_consumption(uuid) to authenticated, service_role;

-- 3. Trigger functions are not an API --------------------------------------
revoke execute on function enforce_order_status_roles() from public, anon, authenticated;
revoke execute on function enforce_staff_account_safety() from public, anon, authenticated;
revoke execute on function log_inventory_stock_change() from public, anon, authenticated;
revoke execute on function prevent_payment_tampering() from public, anon, authenticated;
revoke execute on function prevent_transaction_log_changes() from public, anon, authenticated;

-- 4. Fixed search_path on every SECURITY DEFINER function -----------------
alter function can_change_order_status(uuid, text, text) set search_path = public, pg_temp;
alter function cancel_order(uuid) set search_path = public, pg_temp;
alter function checkout_order(uuid, text, numeric, jsonb) set search_path = public, pg_temp;
alter function create_order(jsonb, uuid) set search_path = public, pg_temp;
alter function enforce_staff_account_safety() set search_path = public, pg_temp;
alter function is_admin() set search_path = public, pg_temp;
alter function is_authenticated_staff() set search_path = public, pg_temp;
alter function list_low_stock_inventory() set search_path = public, pg_temp;
alter function log_inventory_stock_change() set search_path = public, pg_temp;
alter function process_refund(uuid, text, numeric) set search_path = public, pg_temp;
alter function restock_inventory(uuid, numeric) set search_path = public, pg_temp;
alter function set_staff_active(uuid, boolean) set search_path = public, pg_temp;
alter function set_staff_role(uuid, text) set search_path = public, pg_temp;
alter function update_order_status(uuid, text) set search_path = public, pg_temp;

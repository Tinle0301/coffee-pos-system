-- rls_orders_check.sql — POS-40 checks for orders RLS
--
-- Run against a database that has all migrations applied, for example in
-- the Supabase SQL editor or:
--   psql "<connection-string>" -f backend/tests/rls_orders_check.sql
--
-- Everything runs inside one transaction and is rolled back at the end, so
-- it leaves no data behind. Each check prints PASS, or raises FAIL and stops.
--
-- Policies under test (0002_rls_policies.sql):
--   orders_select_own_or_admin  baristas read their own orders, admins read all
--   orders_insert_own           active staff insert orders as themselves only
--   orders_update_own_or_admin  baristas update their own orders, admins any
--   (no delete policy)          nobody deletes orders from the app
-- Status changes are covered separately by status_role_check.sql (POS-17).

begin;

-- fixtures (run as the table owner) ---------------------------------------
insert into staff_accounts (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address, staff_account_status)
values
  ('a2a2a2a2-0000-0000-0000-00000000000a', 'RLS Barista A',  'Barista', 'rls.orders.a@example.test', true),
  ('b2b2b2b2-0000-0000-0000-00000000000b', 'RLS Barista B',  'Barista', 'rls.orders.b@example.test', true),
  ('c2c2c2c2-0000-0000-0000-00000000000c', 'RLS Admin',      'Admin',   'rls.orders.admin@example.test', true),
  ('d2d2d2d2-0000-0000-0000-00000000000d', 'RLS Inactive',   'Barista', 'rls.orders.off@example.test', false);

insert into orders (order_identifier, order_status_type, order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
values
  ('e2e2e2e2-0000-0000-0000-0000000000a1', 'Pending', 10, 0.9, 10.9, 'a2a2a2a2-0000-0000-0000-00000000000a'),
  ('e2e2e2e2-0000-0000-0000-0000000000a2', 'Pending', 10, 0.9, 10.9, 'a2a2a2a2-0000-0000-0000-00000000000a'),
  ('e2e2e2e2-0000-0000-0000-0000000000b1', 'Pending', 10, 0.9, 10.9, 'b2b2b2b2-0000-0000-0000-00000000000b');

set local role authenticated;

-- ── barista A ────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a2a2a2a2-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1. a barista sees their own orders and nobody else's --------------------
do $$
declare mine integer; theirs integer;
begin
  select count(*) into mine from orders
   where created_by_staff_identifier = 'a2a2a2a2-0000-0000-0000-00000000000a';
  select count(*) into theirs from orders
   where created_by_staff_identifier <> 'a2a2a2a2-0000-0000-0000-00000000000a';
  if mine <> 2 then raise exception 'FAIL 1a: barista sees % of their 2 orders', mine; end if;
  if theirs <> 0 then raise exception 'FAIL 1b: barista sees % orders from other staff', theirs; end if;
  raise notice 'PASS 1: barista sees only their own orders';
end $$;

-- 2. a barista can create an order as themselves --------------------------
insert into orders (order_identifier, order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
values ('e2e2e2e2-0000-0000-0000-0000000000a3', 5, 0.45, 5.45, 'a2a2a2a2-0000-0000-0000-00000000000a');
do $$ begin raise notice 'PASS 2: barista can create an order as themselves'; end $$;

-- 3. a barista cannot create an order in someone else's name --------------
do $$
begin
  begin
    insert into orders (order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
    values (5, 0.45, 5.45, 'b2b2b2b2-0000-0000-0000-00000000000b');
    raise exception 'FAIL 3: barista created an order as another staff member';
  exception when insufficient_privilege then
    raise notice 'PASS 3: barista cannot create an order as someone else';
  end;
end $$;

-- 4. a barista can edit their own order (non-status fields) ---------------
do $$
declare n integer;
begin
  update orders set order_tax_amount = 0.95
   where order_identifier = 'e2e2e2e2-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 4: barista could not edit their own order'; end if;
  raise notice 'PASS 4: barista can edit their own order';
end $$;

-- 5. a barista cannot edit another barista's order ------------------------
do $$
declare n integer;
begin
  update orders set order_total_amount = 0
   where order_identifier = 'e2e2e2e2-0000-0000-0000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 5: barista edited another barista''s order'; end if;
  raise notice 'PASS 5: barista cannot edit another barista''s order';
end $$;

-- 6. a barista cannot hand their order to someone else --------------------
do $$
begin
  begin
    update orders set created_by_staff_identifier = 'b2b2b2b2-0000-0000-0000-00000000000b'
     where order_identifier = 'e2e2e2e2-0000-0000-0000-0000000000a2';
    raise exception 'FAIL 6: barista reassigned their order to another staff member';
  exception when insufficient_privilege then
    raise notice 'PASS 6: barista cannot reassign an order to someone else';
  end;
end $$;

-- 7. a barista cannot delete orders, even their own -----------------------
do $$
declare n integer;
begin
  delete from orders where order_identifier = 'e2e2e2e2-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 7: barista deleted an order'; end if;
  raise notice 'PASS 7: barista cannot delete orders';
end $$;

-- ── admin ────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"c2c2c2c2-0000-0000-0000-00000000000c","role":"authenticated"}', true);

-- 8. an admin sees every order --------------------------------------------
do $$
declare n integer;
begin
  select count(*) into n from orders
   where order_identifier::text like 'e2e2e2e2-%';
  if n <> 4 then raise exception 'FAIL 8: admin sees % of 4 test orders', n; end if;
  raise notice 'PASS 8: admin sees every order';
end $$;

-- 9. an admin can edit any order ------------------------------------------
do $$
declare n integer;
begin
  update orders set order_tax_amount = 0.95
   where order_identifier = 'e2e2e2e2-0000-0000-0000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 9: admin could not edit another staff member''s order'; end if;
  raise notice 'PASS 9: admin can edit any order';
end $$;

-- 10. an admin cannot delete orders either (no delete policy) -------------
do $$
declare n integer;
begin
  delete from orders where order_identifier = 'e2e2e2e2-0000-0000-0000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 10: admin deleted an order'; end if;
  raise notice 'PASS 10: orders cannot be deleted from the app, even by an admin';
end $$;

-- ── inactive account ─────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"d2d2d2d2-0000-0000-0000-00000000000d","role":"authenticated"}', true);

-- 11. a deactivated account cannot create orders --------------------------
do $$
begin
  begin
    insert into orders (order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
    values (5, 0.45, 5.45, 'd2d2d2d2-0000-0000-0000-00000000000d');
    raise exception 'FAIL 11: deactivated account created an order';
  exception when insufficient_privilege then
    raise notice 'PASS 11: deactivated account cannot create orders';
  end;
end $$;

-- ── signed out ───────────────────────────────────────────────────────────
reset role;
set local role anon;
select set_config('request.jwt.claims', '{}', true);

-- 12. signed-out users cannot read or create orders -----------------------
do $$
declare n integer;
begin
  select count(*) into n from orders;
  if n <> 0 then raise exception 'FAIL 12a: anon can see % orders', n; end if;
  begin
    insert into orders (order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
    values (5, 0.45, 5.45, 'a2a2a2a2-0000-0000-0000-00000000000a');
    raise exception 'FAIL 12b: anon created an order';
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'PASS 12: signed-out users cannot read or create orders';
end $$;

rollback;

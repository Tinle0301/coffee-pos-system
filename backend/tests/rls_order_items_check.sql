-- rls_order_items_check.sql — POS-40 checks for order_items RLS
--
-- Run against a database that has all migrations applied, for example in
-- the Supabase SQL editor or:
--   psql "<connection-string>" -f backend/tests/rls_order_items_check.sql
--
-- Everything runs inside one transaction and is rolled back at the end, so
-- it leaves no data behind. Each check prints PASS, or raises FAIL and stops.
--
-- Policies under test (0002_rls_policies.sql):
--   order_items_select_via_order  read items on your own orders, admins read all
--   order_items_write_via_order   insert/update/delete items on your own orders,
--                                 admins on any order

begin;

-- fixtures (run as the table owner) ---------------------------------------
insert into staff_accounts (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address, staff_account_status)
values
  ('a3a3a3a3-0000-0000-0000-00000000000a', 'RLS Barista A', 'Barista', 'rls.items.a@example.test', true),
  ('b3b3b3b3-0000-0000-0000-00000000000b', 'RLS Barista B', 'Barista', 'rls.items.b@example.test', true),
  ('c3c3c3c3-0000-0000-0000-00000000000c', 'RLS Admin',     'Admin',   'rls.items.admin@example.test', true);

insert into menu_items (menu_item_identifier, menu_item_name, menu_item_category_type, menu_item_price_amount)
values ('f3f3f3f3-0000-0000-0000-00000000000f', 'RLS Test Latte', 'Coffee', 4.50);

insert into orders (order_identifier, order_status_type, order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
values
  ('e3e3e3e3-0000-0000-0000-0000000000a1', 'Pending', 9, 0.81, 9.81, 'a3a3a3a3-0000-0000-0000-00000000000a'),
  ('e3e3e3e3-0000-0000-0000-0000000000b1', 'Pending', 9, 0.81, 9.81, 'b3b3b3b3-0000-0000-0000-00000000000b');

insert into order_items (order_item_identifier, associated_order_identifier, associated_menu_item_identifier, ordered_item_quantity, item_price_amount)
values
  ('13131313-0000-0000-0000-0000000000a1', 'e3e3e3e3-0000-0000-0000-0000000000a1', 'f3f3f3f3-0000-0000-0000-00000000000f', 2, 4.50),
  ('13131313-0000-0000-0000-0000000000b1', 'e3e3e3e3-0000-0000-0000-0000000000b1', 'f3f3f3f3-0000-0000-0000-00000000000f', 2, 4.50);

set local role authenticated;

-- ── barista A ────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a3a3a3a3-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1. a barista sees items on their own orders only ------------------------
do $$
declare mine integer; theirs integer;
begin
  select count(*) into mine from order_items
   where associated_order_identifier = 'e3e3e3e3-0000-0000-0000-0000000000a1';
  select count(*) into theirs from order_items
   where associated_order_identifier = 'e3e3e3e3-0000-0000-0000-0000000000b1';
  if mine <> 1 then raise exception 'FAIL 1a: barista sees % of 1 item on their own order', mine; end if;
  if theirs <> 0 then raise exception 'FAIL 1b: barista sees % items on another barista''s order', theirs; end if;
  raise notice 'PASS 1: barista sees items on their own orders only';
end $$;

-- 2. a barista can add an item to their own order -------------------------
insert into order_items (associated_order_identifier, associated_menu_item_identifier, ordered_item_quantity, item_price_amount)
values ('e3e3e3e3-0000-0000-0000-0000000000a1', 'f3f3f3f3-0000-0000-0000-00000000000f', 1, 4.50);
do $$ begin raise notice 'PASS 2: barista can add an item to their own order'; end $$;

-- 3. a barista cannot add an item to another barista's order --------------
do $$
begin
  begin
    insert into order_items (associated_order_identifier, associated_menu_item_identifier, ordered_item_quantity, item_price_amount)
    values ('e3e3e3e3-0000-0000-0000-0000000000b1', 'f3f3f3f3-0000-0000-0000-00000000000f', 1, 4.50);
    raise exception 'FAIL 3: barista added an item to another barista''s order';
  exception when insufficient_privilege then
    raise notice 'PASS 3: barista cannot add items to another barista''s order';
  end;
end $$;

-- 4. a barista can change an item on their own order ----------------------
do $$
declare n integer;
begin
  update order_items set ordered_item_quantity = 3
   where order_item_identifier = '13131313-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 4: barista could not change an item on their own order'; end if;
  raise notice 'PASS 4: barista can change items on their own order';
end $$;

-- 5. a barista cannot change an item on another barista's order -----------
do $$
declare n integer;
begin
  update order_items set item_price_amount = 0
   where order_item_identifier = '13131313-0000-0000-0000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 5: barista changed an item on another barista''s order'; end if;
  raise notice 'PASS 5: barista cannot change items on another barista''s order';
end $$;

-- 6. a barista cannot move their item onto another barista's order --------
do $$
begin
  begin
    update order_items set associated_order_identifier = 'e3e3e3e3-0000-0000-0000-0000000000b1'
     where order_item_identifier = '13131313-0000-0000-0000-0000000000a1';
    raise exception 'FAIL 6: barista moved an item onto another barista''s order';
  exception when insufficient_privilege then
    raise notice 'PASS 6: barista cannot move an item onto another barista''s order';
  end;
end $$;

-- 7. a barista cannot delete items on another barista's order -------------
do $$
declare n integer;
begin
  delete from order_items where order_item_identifier = '13131313-0000-0000-0000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 7: barista deleted an item on another barista''s order'; end if;
  raise notice 'PASS 7: barista cannot delete items on another barista''s order';
end $$;

-- 8. a barista can remove an item from their own order --------------------
do $$
declare n integer;
begin
  delete from order_items where order_item_identifier = '13131313-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 8: barista could not remove an item from their own order'; end if;
  raise notice 'PASS 8: barista can remove items from their own order';
end $$;

-- ── admin ────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"c3c3c3c3-0000-0000-0000-00000000000c","role":"authenticated"}', true);

-- 9. an admin sees and can change items on any order ----------------------
do $$
declare n integer;
begin
  select count(*) into n from order_items
   where associated_order_identifier = 'e3e3e3e3-0000-0000-0000-0000000000b1';
  if n <> 1 then raise exception 'FAIL 9a: admin sees % of 1 item on barista B''s order', n; end if;

  update order_items set ordered_item_quantity = 1
   where order_item_identifier = '13131313-0000-0000-0000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 9b: admin could not change an item on another order'; end if;
  raise notice 'PASS 9: admin can read and change items on any order';
end $$;

-- ── signed out ───────────────────────────────────────────────────────────
reset role;
set local role anon;
select set_config('request.jwt.claims', '{}', true);

-- 10. signed-out users cannot read or add order items ---------------------
do $$
declare n integer;
begin
  select count(*) into n from order_items;
  if n <> 0 then raise exception 'FAIL 10a: anon can see % order items', n; end if;
  begin
    insert into order_items (associated_order_identifier, associated_menu_item_identifier, ordered_item_quantity, item_price_amount)
    values ('e3e3e3e3-0000-0000-0000-0000000000a1', 'f3f3f3f3-0000-0000-0000-00000000000f', 1, 4.50);
    raise exception 'FAIL 10b: anon added an order item';
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'PASS 10: signed-out users cannot read or add order items';
end $$;

rollback;

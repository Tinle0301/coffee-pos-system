-- rls_signed_out_check.sql — POS-41 checks for signed-out (anon) users
--
-- Run against a database that has all migrations applied, for example in
-- the Supabase SQL editor or:
--   psql "<connection-string>" -f backend/tests/rls_signed_out_check.sql
--
-- Everything runs inside one transaction and is rolled back at the end, so
-- it leaves no data behind. Each check prints PASS, or raises FAIL and stops.
--
-- The browser holds the public (anon) key, so anyone can call the database
-- without logging in. This file checks that a signed-out caller gets
-- nothing: no rows from any table, no writes, and no database functions.

begin;

-- fixtures (run as the table owner): one row in every table ---------------
insert into staff_accounts (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address)
values ('a7a7a7a7-0000-0000-0000-00000000000a', 'RLS Barista', 'Barista', 'rls.anon.barista@example.test');

insert into menu_items (menu_item_identifier, menu_item_name, menu_item_category_type, menu_item_price_amount)
values ('f7f7f7f7-0000-0000-0000-00000000000f', 'RLS Anon Latte', 'Coffee', 4.50);

insert into inventory_items (inventory_item_identifier, inventory_item_name, available_quantity_value, minimum_stock_threshold)
values ('97979797-0000-0000-0000-00000000000a', 'RLS Anon Beans', 1, 5);

insert into menu_item_ingredients (menu_item_identifier, inventory_item_identifier, quantity_per_item_value)
values ('f7f7f7f7-0000-0000-0000-00000000000f', '97979797-0000-0000-0000-00000000000a', 0.04);

insert into orders (order_identifier, order_status_type, order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
values ('e7e7e7e7-0000-0000-0000-0000000000a1', 'Pending', 4.50, 0.41, 4.91, 'a7a7a7a7-0000-0000-0000-00000000000a');

insert into order_items (associated_order_identifier, associated_menu_item_identifier, ordered_item_quantity, item_price_amount)
values ('e7e7e7e7-0000-0000-0000-0000000000a1', 'f7f7f7f7-0000-0000-0000-00000000000f', 1, 4.50);

insert into queue_entries (associated_order_identifier, queue_entry_status_type)
values ('e7e7e7e7-0000-0000-0000-0000000000a1', 'Pending');

insert into payments (payment_transaction_identifier, associated_order_identifier, payment_method_type, payment_amount_value, payment_completion_status)
values ('17171717-0000-0000-0000-0000000000a1', 'e7e7e7e7-0000-0000-0000-0000000000a1', 'Cash', 4.91, 'Completed');

insert into refunds (associated_payment_identifier, refund_amount_value, refund_type_category)
values ('17171717-0000-0000-0000-0000000000a1', 1.00, 'Partial');

insert into transaction_logs (associated_order_identifier, transaction_type_category, performed_by_staff_identifier)
values ('e7e7e7e7-0000-0000-0000-0000000000a1', 'order_created', 'a7a7a7a7-0000-0000-0000-00000000000a');

insert into sales_reports (report_generation_type, report_start_date, report_end_date, total_revenue_amount)
values ('Daily', '2026-10-20', '2026-10-20', 4.91);

-- ── signed out ───────────────────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{}', true);

-- 1. a signed-out user cannot read any table ------------------------------
do $$
declare
  t text;
  n integer;
begin
  foreach t in array array[
    'staff_accounts', 'menu_items', 'inventory_items', 'menu_item_ingredients',
    'orders', 'order_items', 'queue_entries', 'payments', 'refunds',
    'transaction_logs', 'sales_reports'
  ] loop
    begin
      execute format('select count(*) from %I', t) into n;
    exception when insufficient_privilege then
      n := 0;  -- no table privilege at all is also a pass
    end;
    if n <> 0 then raise exception 'FAIL 1: signed-out user can see % rows in %', n, t; end if;
  end loop;
  raise notice 'PASS 1: signed-out user cannot read any of the 11 tables';
end $$;

-- 2. a signed-out user cannot write to any table --------------------------
do $$
declare
  stmt text;
begin
  foreach stmt in array array[
    $q$insert into staff_accounts (staff_full_name, staff_role_type, staff_email_address) values ('Hacker', 'Admin', 'rls.anon.hacker@example.test')$q$,
    $q$insert into menu_items (menu_item_name, menu_item_category_type, menu_item_price_amount) values ('Free Coffee', 'Coffee', 0)$q$,
    $q$insert into orders (order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier) values (1, 0, 1, 'a7a7a7a7-0000-0000-0000-00000000000a')$q$,
    $q$insert into payments (associated_order_identifier, payment_method_type, payment_amount_value, payment_completion_status) values ('e7e7e7e7-0000-0000-0000-0000000000a1', 'Cash', 4.91, 'Completed')$q$,
    $q$insert into refunds (associated_payment_identifier, refund_amount_value, refund_type_category) values ('17171717-0000-0000-0000-0000000000a1', 4.91, 'Full')$q$,
    $q$insert into transaction_logs (associated_order_identifier, transaction_type_category, performed_by_staff_identifier) values ('e7e7e7e7-0000-0000-0000-0000000000a1', 'fake', 'a7a7a7a7-0000-0000-0000-00000000000a')$q$,
    $q$insert into sales_reports (report_generation_type, report_start_date, report_end_date, total_revenue_amount) values ('Daily', '2026-10-21', '2026-10-21', 0)$q$
  ] loop
    begin
      execute stmt;
      raise exception 'FAIL 2: signed-out user ran: %', stmt;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
  raise notice 'PASS 2: signed-out user cannot insert into any table';
end $$;

-- 3. a signed-out user cannot change or delete existing rows --------------
do $$
declare
  stmt text;
  n integer;
begin
  foreach stmt in array array[
    $q$update staff_accounts set staff_role_type = 'Admin'$q$,
    $q$update menu_items set menu_item_price_amount = 0$q$,
    $q$update orders set order_total_amount = 0$q$,
    $q$delete from order_items$q$,
    $q$delete from queue_entries$q$,
    $q$delete from sales_reports$q$
  ] loop
    begin
      execute stmt;
      get diagnostics n = row_count;
    exception when insufficient_privilege then
      n := 0;
    end;
    if n <> 0 then raise exception 'FAIL 3: signed-out user changed % rows with: %', n, stmt; end if;
  end loop;
  raise notice 'PASS 3: signed-out user cannot change or delete rows';
end $$;

-- 4. a signed-out user cannot run any database function -------------------
do $$
declare
  stmt text;
begin
  foreach stmt in array array[
    $q$select create_order('[{"menu_item_id":"f7f7f7f7-0000-0000-0000-00000000000f","quantity":1,"price":4.50}]'::jsonb, 'a7a7a7a7-0000-0000-0000-00000000000a')$q$,
    $q$select checkout_order('e7e7e7e7-0000-0000-0000-0000000000a1', 'Cash', 4.91)$q$,
    $q$select process_refund('17171717-0000-0000-0000-0000000000a1', 'Full', 4.91)$q$,
    $q$select cancel_order('e7e7e7e7-0000-0000-0000-0000000000a1')$q$,
    $q$select update_order_status('e7e7e7e7-0000-0000-0000-0000000000a1', 'In Progress')$q$,
    $q$select can_change_order_status('a7a7a7a7-0000-0000-0000-00000000000a', 'Pending', 'Cancelled')$q$,
    $q$select * from list_low_stock_inventory()$q$
  ] loop
    begin
      execute stmt;
      raise exception 'FAIL 4: signed-out user ran: %', stmt;
    exception when others then
      if sqlstate <> '42501' and sqlerrm not like 'UNAUTHORIZED%' then
        raise exception 'FAIL 4: unexpected error for %: %', stmt, sqlerrm;
      end if;
    end;
  end loop;
  raise notice 'PASS 4: signed-out user cannot run any database function';
end $$;

rollback;

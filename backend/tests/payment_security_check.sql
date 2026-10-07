-- payment_security_check.sql — POS-16 checks
--
-- Run against a database that has migrations 0001–0005 applied, for example
-- in the Supabase SQL editor or:
--   psql "<connection-string>" -f backend/tests/payment_security_check.sql
--
-- Everything runs inside one transaction and is rolled back at the end, so
-- it leaves no data behind. Each check prints PASS, or raises FAIL and stops.

begin;

-- fixtures (run as the table owner) ---------------------------------------
insert into staff_accounts (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'Test Barista A', 'Barista', 'check.a@example.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'Test Barista B', 'Barista', 'check.b@example.test'),
  ('cccccccc-0000-0000-0000-00000000000c', 'Test Admin',     'Admin',   'check.admin@example.test');

insert into menu_items (menu_item_identifier, menu_item_name, menu_item_category_type, menu_item_price_amount, menu_item_availability_status)
values ('dddddddd-0000-0000-0000-00000000000d', 'Check Latte', 'Coffee', 4.50, true);

insert into orders (order_identifier, order_status_type, order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
values
  ('eeeeeeee-0000-0000-0000-0000000000a1', 'Pending', 10, 0.9, 10.9, 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('eeeeeeee-0000-0000-0000-0000000000b1', 'Pending', 10, 0.9, 10.9, 'bbbbbbbb-0000-0000-0000-00000000000b');

-- 1. a barista can pay for their OWN order ---------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into payments (payment_transaction_identifier, associated_order_identifier, payment_method_type, payment_amount_value, payment_completion_status)
values ('ffffffff-0000-0000-0000-0000000000a1', 'eeeeeeee-0000-0000-0000-0000000000a1', 'Cash', 10.9, 'Completed');
do $$ begin raise notice 'PASS 1: barista can insert a payment on their own order'; end $$;

-- 2. a barista cannot pay for SOMEONE ELSE'S order -------------------------
do $$
begin
  begin
    insert into payments (associated_order_identifier, payment_method_type, payment_amount_value, payment_completion_status)
    values ('eeeeeeee-0000-0000-0000-0000000000b1', 'Cash', 10.9, 'Completed');
    raise exception 'FAIL 2: barista inserted a payment on another barista''s order';
  exception when insufficient_privilege then
    raise notice 'PASS 2: payment on someone else''s order is rejected by RLS';
  end;
end $$;

-- 3. a barista cannot change a payment (RLS: no update policy) -------------
do $$
declare n integer;
begin
  update payments set payment_amount_value = 0.01
   where payment_transaction_identifier = 'ffffffff-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 3: barista updated % payment row(s)', n; end if;
  raise notice 'PASS 3: barista cannot update a payment';
end $$;

-- 4. a barista cannot delete a payment (privilege revoked) -----------------
do $$
begin
  begin
    delete from payments where payment_transaction_identifier = 'ffffffff-0000-0000-0000-0000000000a1';
    raise exception 'FAIL 4: barista deleted a payment';
  exception when insufficient_privilege then
    raise notice 'PASS 4: barista cannot delete a payment';
  end;
end $$;

-- 5. a barista cannot touch transaction logs --------------------------------
do $$
declare n integer;
begin
  begin
    delete from transaction_logs;
    raise exception 'FAIL 5a: barista deleted transaction logs';
  exception when insufficient_privilege then
    raise notice 'PASS 5a: barista cannot delete transaction logs';
  end;
  begin
    update transaction_logs set transaction_type_category = 'tampered';
    raise exception 'FAIL 5b: barista updated transaction logs';
  exception when insufficient_privilege then
    raise notice 'PASS 5b: barista cannot update transaction logs';
  end;
end $$;

-- 6. an admin cannot rewrite or delete a payment either --------------------
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
do $$
declare n integer;
begin
  update payments set payment_amount_value = 0.01
   where payment_transaction_identifier = 'ffffffff-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 6a: admin updated % payment row(s)', n; end if;
  raise notice 'PASS 6a: admin cannot update a payment through the client';
  begin
    delete from payments where payment_transaction_identifier = 'ffffffff-0000-0000-0000-0000000000a1';
    raise exception 'FAIL 6b: admin deleted a payment';
  exception when insufficient_privilege then
    raise notice 'PASS 6b: admin cannot delete a payment';
  end;
end $$;

-- 7. create_order still works and still writes its log entry ---------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$
declare v_id uuid; n integer;
begin
  v_id := create_order(
    '[{"menu_item_id":"dddddddd-0000-0000-0000-00000000000d","quantity":1,"price":4.50}]'::jsonb,
    'aaaaaaaa-0000-0000-0000-00000000000a');
  reset role;
  select count(*) into n from transaction_logs where associated_order_identifier = v_id;
  if n <> 1 then raise exception 'FAIL 7: create_order wrote % log rows, expected 1', n; end if;
  raise notice 'PASS 7: create_order still inserts a transaction log row';
end $$;

-- 8. even the table owner cannot edit or delete a log row -------------------
reset role;
do $$
begin
  begin
    update transaction_logs set transaction_type_category = 'tampered';
    raise exception 'FAIL 8a: transaction log update succeeded';
  exception when others then
    if sqlerrm not like 'IMMUTABLE_RECORD%' then raise; end if;
    raise notice 'PASS 8a: transaction log UPDATE is blocked by trigger';
  end;
  begin
    delete from transaction_logs;
    raise exception 'FAIL 8b: transaction log delete succeeded';
  exception when others then
    if sqlerrm not like 'IMMUTABLE_RECORD%' then raise; end if;
    raise notice 'PASS 8b: transaction log DELETE is blocked by trigger';
  end;
  begin
    truncate transaction_logs;
    raise exception 'FAIL 8c: transaction log truncate succeeded';
  exception when others then
    if sqlerrm not like 'IMMUTABLE_RECORD%' then raise; end if;
    raise notice 'PASS 8c: transaction log TRUNCATE is blocked by trigger';
  end;
end $$;

-- 9. payments: amount is frozen, status can still change (refund path) ----
do $$
begin
  begin
    update payments set payment_amount_value = 0.01
     where payment_transaction_identifier = 'ffffffff-0000-0000-0000-0000000000a1';
    raise exception 'FAIL 9a: payment amount was changed';
  exception when others then
    if sqlerrm not like 'IMMUTABLE_RECORD%' then raise; end if;
    raise notice 'PASS 9a: payment amount cannot be changed, even by the owner role';
  end;
  begin
    delete from payments where payment_transaction_identifier = 'ffffffff-0000-0000-0000-0000000000a1';
    raise exception 'FAIL 9b: payment was deleted';
  exception when others then
    if sqlerrm not like 'IMMUTABLE_RECORD%' then raise; end if;
    raise notice 'PASS 9b: payment cannot be deleted, even by the owner role';
  end;
  update payments set payment_completion_status = 'Refunded'
   where payment_transaction_identifier = 'ffffffff-0000-0000-0000-0000000000a1';
  raise notice 'PASS 9c: payment_completion_status can still change (for process_refund)';
end $$;

rollback;

-- cancel_order_check.sql — POS-37 checks
--
-- Run against a database that has all migrations applied (0001–0014), for
-- example in the Supabase SQL editor or:
--   psql "<connection-string>" -f backend/tests/cancel_order_check.sql
--
-- Everything runs inside one transaction and is rolled back at the end, so
-- it leaves no data behind. Each check prints PASS, or raises FAIL and stops.

begin;

-- fixtures (run as the table owner) ---------------------------------------
insert into staff_accounts (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'Test Barista A', 'Barista', 'cancel.a@example.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'Test Barista B', 'Barista', 'cancel.b@example.test'),
  ('cccccccc-0000-0000-0000-00000000000c', 'Test Admin',     'Admin',   'cancel.admin@example.test');

insert into orders (order_identifier, order_status_type, order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
values
  ('eeeeeeee-0000-0000-0000-0000000000a1', 'Pending',     10, 0.9, 10.9, 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('eeeeeeee-0000-0000-0000-0000000000a2', 'In Progress', 10, 0.9, 10.9, 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('eeeeeeee-0000-0000-0000-0000000000a3', 'Pending',     10, 0.9, 10.9, 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('eeeeeeee-0000-0000-0000-0000000000a4', 'Completed',   10, 0.9, 10.9, 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('eeeeeeee-0000-0000-0000-0000000000a5', 'Pending',     10, 0.9, 10.9, 'aaaaaaaa-0000-0000-0000-00000000000a');

insert into queue_entries (associated_order_identifier, queue_entry_status_type)
values
  ('eeeeeeee-0000-0000-0000-0000000000a1', 'Pending'),
  ('eeeeeeee-0000-0000-0000-0000000000a2', 'In Progress'),
  ('eeeeeeee-0000-0000-0000-0000000000a3', 'Pending'),
  ('eeeeeeee-0000-0000-0000-0000000000a5', 'Pending');

-- order a3 has been paid (pay first, then make: it is still Pending)
insert into payments (associated_order_identifier, payment_method_type, payment_amount_value, payment_completion_status)
values ('eeeeeeee-0000-0000-0000-0000000000a3', 'Cash', 10.9, 'Completed');

set local role authenticated;

-- 1. the creator can cancel their unpaid Pending order ---------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select cancel_order('eeeeeeee-0000-0000-0000-0000000000a1');
reset role;
do $$
begin
  if (select order_status_type from orders where order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a1') <> 'Cancelled' then
    raise exception 'FAIL 1a: order was not set to Cancelled';
  end if;
  if exists (select 1 from queue_entries where associated_order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a1') then
    raise exception 'FAIL 1b: order is still in the queue';
  end if;
  if not exists (select 1 from transaction_logs
                 where associated_order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a1'
                   and transaction_type_category = 'order_cancelled') then
    raise exception 'FAIL 1c: no order_cancelled log entry';
  end if;
  raise notice 'PASS 1: creator cancels unpaid order (status, queue and log updated)';
end $$;
set local role authenticated;

-- 2. an In Progress order can be cancelled too ------------------------------
select cancel_order('eeeeeeee-0000-0000-0000-0000000000a2');
do $$ begin raise notice 'PASS 2: unpaid In Progress order can be cancelled'; end $$;

-- 3. a paid order cannot be cancelled ---------------------------------------
do $$
begin
  begin
    perform cancel_order('eeeeeeee-0000-0000-0000-0000000000a3');
    raise exception 'FAIL 3: a paid order was cancelled';
  exception when others then
    if sqlerrm not like 'ALREADY_PAID%' then raise; end if;
    raise notice 'PASS 3: paid order is rejected with ALREADY_PAID';
  end;
end $$;

-- 4. a finished order cannot be cancelled -----------------------------------
do $$
begin
  begin
    perform cancel_order('eeeeeeee-0000-0000-0000-0000000000a4');
    raise exception 'FAIL 4: a Completed order was cancelled';
  exception when others then
    if sqlerrm not like 'INVALID_ORDER_STATUS%' then raise; end if;
    raise notice 'PASS 4: Completed order is rejected with INVALID_ORDER_STATUS';
  end;
end $$;

-- 5. cancelling twice is rejected -------------------------------------------
do $$
begin
  begin
    perform cancel_order('eeeeeeee-0000-0000-0000-0000000000a1');
    raise exception 'FAIL 5: an already cancelled order was cancelled again';
  exception when others then
    if sqlerrm not like 'INVALID_ORDER_STATUS%' then raise; end if;
    raise notice 'PASS 5: already cancelled order is rejected';
  end;
end $$;

-- 6. an unknown order is rejected -------------------------------------------
do $$
begin
  begin
    perform cancel_order('99999999-0000-0000-0000-000000000099');
    raise exception 'FAIL 6: unknown order was accepted';
  exception when others then
    if sqlerrm not like 'ORDER_NOT_FOUND%' then raise; end if;
    raise notice 'PASS 6: unknown order is rejected with ORDER_NOT_FOUND';
  end;
end $$;

-- 7. another barista cannot cancel someone else's order (POS-17 trigger) ----
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$
begin
  begin
    perform cancel_order('eeeeeeee-0000-0000-0000-0000000000a5');
    raise exception 'FAIL 7: barista B cancelled barista A''s order';
  exception when insufficient_privilege then
    raise notice 'PASS 7: another barista cannot cancel the order';
  end;
end $$;

-- 8. an admin can cancel anyone's unpaid order ------------------------------
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select cancel_order('eeeeeeee-0000-0000-0000-0000000000a5');
do $$ begin raise notice 'PASS 8: admin can cancel another staff member''s order'; end $$;

-- 9. signed-out users cannot call it ----------------------------------------
reset role;
set local role anon;
do $$
begin
  begin
    perform cancel_order('eeeeeeee-0000-0000-0000-0000000000a5');
    raise exception 'FAIL 9: anon called cancel_order';
  exception when insufficient_privilege then
    raise notice 'PASS 9: anon cannot call cancel_order';
  end;
end $$;

rollback;

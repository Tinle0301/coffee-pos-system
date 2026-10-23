-- rls_refunds_check.sql — POS-41 checks for refunds RLS
--
-- Run against a database that has all migrations applied, for example in
-- the Supabase SQL editor or:
--   psql "<connection-string>" -f backend/tests/rls_refunds_check.sql
--
-- Everything runs inside one transaction and is rolled back at the end, so
-- it leaves no data behind. Each check prints PASS, or raises FAIL and stops.
--
-- Rules under test:
--   refunds_admin_only (0002_rls_policies.sql)  only active admins read or write refunds
--   process_refund     (0009_process_refund.sql) only active admins can refund

begin;

-- fixtures (run as the table owner) ---------------------------------------
insert into staff_accounts (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address, staff_account_status)
values
  ('a4a4a4a4-0000-0000-0000-00000000000a', 'RLS Barista',   'Barista', 'rls.refunds.barista@example.test', true),
  ('c4c4c4c4-0000-0000-0000-00000000000c', 'RLS Admin',     'Admin',   'rls.refunds.admin@example.test', true),
  ('d4d4d4d4-0000-0000-0000-00000000000d', 'RLS Old Admin', 'Admin',   'rls.refunds.old@example.test', false);

insert into orders (order_identifier, order_status_type, order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
values
  ('e4e4e4e4-0000-0000-0000-0000000000a1', 'Completed', 10, 0.9, 10.9, 'a4a4a4a4-0000-0000-0000-00000000000a'),
  ('e4e4e4e4-0000-0000-0000-0000000000a2', 'Completed', 10, 0.9, 10.9, 'a4a4a4a4-0000-0000-0000-00000000000a');

insert into payments (payment_transaction_identifier, associated_order_identifier, payment_method_type, payment_amount_value, payment_completion_status)
values
  ('14141414-0000-0000-0000-0000000000a1', 'e4e4e4e4-0000-0000-0000-0000000000a1', 'Cash', 10.9, 'Refunded'),
  ('14141414-0000-0000-0000-0000000000a2', 'e4e4e4e4-0000-0000-0000-0000000000a2', 'Cash', 10.9, 'Completed');

insert into refunds (refund_transaction_identifier, associated_payment_identifier, refund_amount_value, refund_type_category)
values ('24242424-0000-0000-0000-0000000000a1', '14141414-0000-0000-0000-0000000000a1', 10.9, 'Full');

set local role authenticated;

-- ── barista ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a4a4a4a4-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1. a barista cannot see refunds, even on their own order ----------------
do $$
declare n integer;
begin
  select count(*) into n from refunds;
  if n <> 0 then raise exception 'FAIL 1: barista can see % refunds', n; end if;
  raise notice 'PASS 1: barista cannot read refunds';
end $$;

-- 2. a barista cannot write a refund row directly -------------------------
do $$
begin
  begin
    insert into refunds (associated_payment_identifier, refund_amount_value, refund_type_category)
    values ('14141414-0000-0000-0000-0000000000a2', 10.9, 'Full');
    raise exception 'FAIL 2: barista inserted a refund';
  exception when insufficient_privilege then
    raise notice 'PASS 2: barista cannot insert refunds';
  end;
end $$;

-- 3. a barista cannot change or delete a refund ---------------------------
do $$
declare n integer;
begin
  update refunds set refund_amount_value = 0
   where refund_transaction_identifier = '24242424-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 3a: barista changed a refund'; end if;
  delete from refunds where refund_transaction_identifier = '24242424-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 3b: barista deleted a refund'; end if;
  raise notice 'PASS 3: barista cannot change or delete refunds';
end $$;

-- 4. a barista cannot run process_refund ----------------------------------
do $$
begin
  begin
    perform process_refund('14141414-0000-0000-0000-0000000000a2', 'Full', 10.9);
    raise exception 'FAIL 4: barista processed a refund';
  exception when others then
    if sqlerrm not like 'UNAUTHORIZED%' and sqlstate <> '42501' then raise; end if;
    raise notice 'PASS 4: barista cannot process refunds';
  end;
end $$;

-- ── admin ────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"c4c4c4c4-0000-0000-0000-00000000000c","role":"authenticated"}', true);

-- 5. an admin can read refunds --------------------------------------------
do $$
begin
  if not exists (select 1 from refunds
                 where refund_transaction_identifier = '24242424-0000-0000-0000-0000000000a1') then
    raise exception 'FAIL 5: admin cannot read refunds';
  end if;
  raise notice 'PASS 5: admin can read refunds';
end $$;

-- 6. an admin can process a refund ----------------------------------------
do $$
begin
  perform process_refund('14141414-0000-0000-0000-0000000000a2', 'Partial', 2.00);
  if not exists (select 1 from refunds
                 where associated_payment_identifier = '14141414-0000-0000-0000-0000000000a2') then
    raise exception 'FAIL 6: admin refund did not create a refund row';
  end if;
  raise notice 'PASS 6: admin can process a refund';
end $$;

-- ── deactivated admin ────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"d4d4d4d4-0000-0000-0000-00000000000d","role":"authenticated"}', true);

-- 7. a deactivated admin loses refund access ------------------------------
do $$
declare n integer;
begin
  select count(*) into n from refunds;
  if n <> 0 then raise exception 'FAIL 7a: deactivated admin can see % refunds', n; end if;
  begin
    perform process_refund('14141414-0000-0000-0000-0000000000a1', 'Full', 10.9);
    raise exception 'FAIL 7b: deactivated admin processed a refund';
  exception when others then
    if sqlerrm not like 'UNAUTHORIZED%' and sqlstate <> '42501' then raise; end if;
  end;
  raise notice 'PASS 7: deactivated admin cannot read or process refunds';
end $$;

rollback;

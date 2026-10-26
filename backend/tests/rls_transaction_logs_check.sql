-- rls_transaction_logs_check.sql — POS-41 checks for transaction_logs access
--
-- Run against a database that has all migrations applied, for example in
-- the Supabase SQL editor or:
--   psql "<connection-string>" -f backend/tests/rls_transaction_logs_check.sql
--
-- Everything runs inside one transaction and is rolled back at the end, so
-- it leaves no data behind. Each check prints PASS, or raises FAIL and stops.
--
-- Rules under test:
--   transaction_logs_select_admin (0002)  only active admins read the log
--   no insert policy (0002)               nobody writes the log from the app;
--                                         only database functions do
--   revoke update/delete (0005)           nobody, not even an admin, edits or
--                                         deletes a log entry
-- Filtering is covered by transaction_logs_check.sql (POS-33).

begin;

-- fixtures (run as the table owner) ---------------------------------------
insert into staff_accounts (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address, staff_account_status)
values
  ('a6a6a6a6-0000-0000-0000-00000000000a', 'RLS Barista',   'Barista', 'rls.logs.barista@example.test', true),
  ('c6c6c6c6-0000-0000-0000-00000000000c', 'RLS Admin',     'Admin',   'rls.logs.admin@example.test', true),
  ('d6d6d6d6-0000-0000-0000-00000000000d', 'RLS Old Admin', 'Admin',   'rls.logs.old@example.test', false);

insert into orders (order_identifier, order_status_type, order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
values ('e6e6e6e6-0000-0000-0000-0000000000a1', 'Pending', 10, 0.9, 10.9, 'a6a6a6a6-0000-0000-0000-00000000000a');

insert into transaction_logs (transaction_log_identifier, associated_order_identifier, transaction_type_category, performed_by_staff_identifier)
values ('26262626-0000-0000-0000-0000000000a1', 'e6e6e6e6-0000-0000-0000-0000000000a1', 'order_created', 'a6a6a6a6-0000-0000-0000-00000000000a');

set local role authenticated;

-- ── barista ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a6a6a6a6-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1. a barista cannot read the log, even for their own order --------------
do $$
declare n integer;
begin
  select count(*) into n from transaction_logs;
  if n <> 0 then raise exception 'FAIL 1: barista can see % log entries', n; end if;
  raise notice 'PASS 1: barista cannot read the transaction log';
end $$;

-- 2. a barista cannot write a log entry directly --------------------------
do $$
begin
  begin
    insert into transaction_logs (associated_order_identifier, transaction_type_category, performed_by_staff_identifier)
    values ('e6e6e6e6-0000-0000-0000-0000000000a1', 'fake_entry', 'a6a6a6a6-0000-0000-0000-00000000000a');
    raise exception 'FAIL 2: barista wrote a log entry';
  exception when insufficient_privilege then
    raise notice 'PASS 2: barista cannot write log entries';
  end;
end $$;

-- 3. database functions still log for a barista ---------------------------
select cancel_order('e6e6e6e6-0000-0000-0000-0000000000a1');
reset role;
do $$
begin
  if not exists (select 1 from transaction_logs
                 where associated_order_identifier = 'e6e6e6e6-0000-0000-0000-0000000000a1'
                   and transaction_type_category = 'order_cancelled') then
    raise exception 'FAIL 3: cancel_order did not write a log entry';
  end if;
  raise notice 'PASS 3: database functions still write the log for a barista';
end $$;
set local role authenticated;

-- ── admin ────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"c6c6c6c6-0000-0000-0000-00000000000c","role":"authenticated"}', true);

-- 4. an admin can read the log --------------------------------------------
do $$
declare n integer;
begin
  select count(*) into n from transaction_logs
   where associated_order_identifier = 'e6e6e6e6-0000-0000-0000-0000000000a1';
  if n <> 2 then raise exception 'FAIL 4: admin sees % of 2 log entries', n; end if;
  raise notice 'PASS 4: admin can read the transaction log';
end $$;

-- 5. an admin cannot write a log entry directly either --------------------
do $$
begin
  begin
    insert into transaction_logs (associated_order_identifier, transaction_type_category, performed_by_staff_identifier)
    values ('e6e6e6e6-0000-0000-0000-0000000000a1', 'fake_entry', 'c6c6c6c6-0000-0000-0000-00000000000c');
    raise exception 'FAIL 5: admin wrote a log entry directly';
  exception when insufficient_privilege then
    raise notice 'PASS 5: admin cannot write log entries directly';
  end;
end $$;

-- 6. an admin cannot edit or delete a log entry ---------------------------
do $$
begin
  begin
    update transaction_logs set transaction_type_category = 'edited'
     where transaction_log_identifier = '26262626-0000-0000-0000-0000000000a1';
    raise exception 'FAIL 6a: admin edited a log entry';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from transaction_logs
     where transaction_log_identifier = '26262626-0000-0000-0000-0000000000a1';
    raise exception 'FAIL 6b: admin deleted a log entry';
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'PASS 6: admin cannot edit or delete log entries';
end $$;

-- ── deactivated admin ────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"d6d6d6d6-0000-0000-0000-00000000000d","role":"authenticated"}', true);

-- 7. a deactivated admin cannot read the log ------------------------------
do $$
declare n integer;
begin
  select count(*) into n from transaction_logs;
  if n <> 0 then raise exception 'FAIL 7: deactivated admin can see % log entries', n; end if;
  raise notice 'PASS 7: deactivated admin cannot read the transaction log';
end $$;

rollback;

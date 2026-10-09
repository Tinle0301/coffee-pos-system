-- status_role_check.sql — POS-17 checks
--
-- Run against a database that has migrations 0001–0006 applied, for example
-- in the Supabase SQL editor or:
--   psql "<connection-string>" -f backend/tests/status_role_check.sql
--
-- Everything runs inside one transaction and is rolled back at the end, so
-- it leaves no data behind. Each check prints PASS, or raises FAIL and stops.
--
-- "As a function" below means: the table owner role (which is what a
-- SECURITY DEFINER function such as update_order_status runs as) with a
-- logged-in user's JWT, exactly the state inside those functions.

begin;

-- fixtures (run as the table owner) ---------------------------------------
insert into staff_accounts (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address, staff_account_status)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'Test Barista A', 'Barista', 'status.a@example.test', true),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'Test Barista B', 'Barista', 'status.b@example.test', true),
  ('cccccccc-0000-0000-0000-00000000000c', 'Test Admin',     'Admin',   'status.admin@example.test', true),
  ('99999999-0000-0000-0000-000000000009', 'Inactive Barista','Barista','status.off@example.test', false);

insert into orders (order_identifier, order_status_type, order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
values
  ('eeeeeeee-0000-0000-0000-0000000000a1', 'Pending', 10, 0.9, 10.9, 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('eeeeeeee-0000-0000-0000-0000000000a2', 'Pending', 10, 0.9, 10.9, 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('eeeeeeee-0000-0000-0000-0000000000a3', 'Pending', 10, 0.9, 10.9, 'aaaaaaaa-0000-0000-0000-00000000000a');

-- ── direct updates from the app ──────────────────────────────────────────

-- 1. a barista cannot change status with a direct UPDATE -------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$
begin
  begin
    update orders set order_status_type = 'Completed'
     where order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a1';
    raise exception 'FAIL 1: barista changed status with a direct update';
  exception when insufficient_privilege then
    raise notice 'PASS 1: barista cannot change status with a direct update';
  end;
end $$;

-- 2. other order fields can still be updated directly (edits keep working) -
do $$
declare n integer;
begin
  update orders set order_tax_amount = 0.95
   where order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 2: barista could not edit their own order (% rows)', n; end if;
  raise notice 'PASS 2: barista can still edit non-status fields on their own order';
end $$;

-- 3. an admin cannot change status with a direct UPDATE either ------------
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
do $$
begin
  begin
    update orders set order_status_type = 'Cancelled'
     where order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a1';
    raise exception 'FAIL 3: admin changed status with a direct update';
  exception when insufficient_privilege then
    raise notice 'PASS 3: admin must also go through the database functions';
  end;
end $$;

-- 4. the app can ask the helper which buttons to show ----------------------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$
begin
  if not can_change_order_status('aaaaaaaa-0000-0000-0000-00000000000a', 'Pending', 'In Progress') then
    raise exception 'FAIL 4a: helper says barista B cannot start another barista''s order';
  end if;
  if can_change_order_status('aaaaaaaa-0000-0000-0000-00000000000a', 'Pending', 'Cancelled') then
    raise exception 'FAIL 4b: helper says barista B can cancel another barista''s order';
  end if;
  raise notice 'PASS 4: can_change_order_status answers correctly for a barista';
end $$;

reset role;

-- ── changes made inside the database functions ───────────────────────────

-- 5. any barista can move an order forward on the bar ----------------------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
update orders set order_status_type = 'In Progress' where order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a1';
update orders set order_status_type = 'Completed'   where order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a1';
do $$ begin raise notice 'PASS 5: barista B can move barista A''s order to In Progress and Completed'; end $$;

-- 6. a barista cannot cancel someone else's order --------------------------
do $$
begin
  begin
    update orders set order_status_type = 'Cancelled' where order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a2';
    raise exception 'FAIL 6: barista B cancelled barista A''s order';
  exception when insufficient_privilege then
    raise notice 'PASS 6: barista cannot cancel another barista''s order';
  end;
end $$;

-- 7. a barista can cancel their own order ----------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
update orders set order_status_type = 'Cancelled' where order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a2';
do $$ begin raise notice 'PASS 7: barista can cancel their own order'; end $$;

-- 8. a barista cannot reopen a Completed or Cancelled order ----------------
do $$
begin
  begin
    update orders set order_status_type = 'Pending' where order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a1';
    raise exception 'FAIL 8a: barista reopened a completed order';
  exception when insufficient_privilege then
    raise notice 'PASS 8a: barista cannot change a completed order';
  end;
  begin
    update orders set order_status_type = 'Pending' where order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a2';
    raise exception 'FAIL 8b: barista reopened a cancelled order';
  exception when insufficient_privilege then
    raise notice 'PASS 8b: barista cannot change a cancelled order';
  end;
end $$;

-- 9. an admin can change a finished order, and cancel anyone's order ------
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
update orders set order_status_type = 'Cancelled' where order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a1';
do $$ begin raise notice 'PASS 9: admin can change a completed order and cancel another staff member''s order'; end $$;

-- 10. an inactive account cannot change any status -------------------------
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}', true);
do $$
begin
  begin
    update orders set order_status_type = 'In Progress' where order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a3';
    raise exception 'FAIL 10: inactive account changed a status';
  exception when insufficient_privilege then
    raise notice 'PASS 10: inactive account cannot change a status';
  end;
end $$;

-- 11. no logged-in user (SQL editor / service role) is not blocked --------
select set_config('request.jwt.claims', '{}', true);
update orders set order_status_type = 'In Progress' where order_identifier = 'eeeeeeee-0000-0000-0000-0000000000a3';
do $$ begin raise notice 'PASS 11: SQL editor / service role can still fix a status by hand'; end $$;

-- 12. anon cannot call the helper ------------------------------------------
set local role anon;
do $$
begin
  begin
    perform can_change_order_status(null, 'Pending', 'In Progress');
    raise exception 'FAIL 12: anon called can_change_order_status';
  exception when insufficient_privilege then
    raise notice 'PASS 12: anon cannot call can_change_order_status';
  end;
end $$;

rollback;

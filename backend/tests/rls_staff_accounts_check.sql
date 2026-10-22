-- rls_staff_accounts_check.sql — POS-40 checks for staff_accounts RLS
--
-- Run against a database that has all migrations applied, for example in
-- the Supabase SQL editor or:
--   psql "<connection-string>" -f backend/tests/rls_staff_accounts_check.sql
--
-- Everything runs inside one transaction and is rolled back at the end, so
-- it leaves no data behind. Each check prints PASS, or raises FAIL and stops.
--
-- Policies under test (0002_rls_policies.sql):
--   staff_accounts_select_own_or_admin  staff read their own row, admins read all
--   staff_accounts_write_admin          only admins insert
--   staff_accounts_update_admin         only admins update
--   staff_accounts_delete_admin         only admins delete

begin;

-- fixtures (run as the table owner) ---------------------------------------
insert into staff_accounts (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address, staff_account_status)
values
  ('a1a1a1a1-0000-0000-0000-00000000000a', 'RLS Barista A',  'Barista', 'rls.staff.a@example.test', true),
  ('b1b1b1b1-0000-0000-0000-00000000000b', 'RLS Barista B',  'Barista', 'rls.staff.b@example.test', true),
  ('c1c1c1c1-0000-0000-0000-00000000000c', 'RLS Admin',      'Admin',   'rls.staff.admin@example.test', true),
  ('d1d1d1d1-0000-0000-0000-00000000000d', 'RLS Old Admin',  'Admin',   'rls.staff.old@example.test', false);

set local role authenticated;

-- ── barista ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1. a barista can read their own row (the login flow needs it) -----------
do $$
begin
  if not exists (select 1 from staff_accounts
                 where staff_account_identifier = 'a1a1a1a1-0000-0000-0000-00000000000a') then
    raise exception 'FAIL 1: barista cannot read their own staff row';
  end if;
  raise notice 'PASS 1: barista can read their own staff row';
end $$;

-- 2. a barista cannot read anyone else's row ------------------------------
do $$
declare n integer;
begin
  select count(*) into n from staff_accounts
   where staff_account_identifier <> 'a1a1a1a1-0000-0000-0000-00000000000a';
  if n <> 0 then raise exception 'FAIL 2: barista can see % other staff rows', n; end if;
  raise notice 'PASS 2: barista cannot read other staff rows';
end $$;

-- 3. a barista cannot make themselves an admin ----------------------------
do $$
declare n integer;
begin
  update staff_accounts set staff_role_type = 'Admin'
   where staff_account_identifier = 'a1a1a1a1-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 3: barista promoted themselves to Admin'; end if;
  raise notice 'PASS 3: barista cannot change their own role';
end $$;

-- 4. a barista cannot change another staff member's row -------------------
do $$
declare n integer;
begin
  update staff_accounts set staff_account_status = false
   where staff_account_identifier = 'b1b1b1b1-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 4: barista deactivated another staff member'; end if;
  raise notice 'PASS 4: barista cannot update another staff row';
end $$;

-- 5. a barista cannot create a staff account ------------------------------
do $$
begin
  begin
    insert into staff_accounts (staff_full_name, staff_role_type, staff_email_address)
    values ('Sneaky Admin', 'Admin', 'rls.staff.sneaky@example.test');
    raise exception 'FAIL 5: barista created a staff account';
  exception when insufficient_privilege then
    raise notice 'PASS 5: barista cannot create staff accounts';
  end;
end $$;

-- 6. a barista cannot delete a staff account ------------------------------
do $$
declare n integer;
begin
  delete from staff_accounts
   where staff_account_identifier = 'b1b1b1b1-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 6: barista deleted a staff account'; end if;
  raise notice 'PASS 6: barista cannot delete staff accounts';
end $$;

-- ── admin ────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"c1c1c1c1-0000-0000-0000-00000000000c","role":"authenticated"}', true);

-- 7. an admin can read every staff row ------------------------------------
do $$
declare n integer;
begin
  select count(*) into n from staff_accounts
   where staff_email_address like 'rls.staff.%@example.test';
  if n <> 4 then raise exception 'FAIL 7: admin sees % of 4 test staff rows', n; end if;
  raise notice 'PASS 7: admin can read every staff row';
end $$;

-- 8. an admin can create, update and deactivate staff ---------------------
do $$
declare n integer;
begin
  insert into staff_accounts (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address)
  values ('e1e1e1e1-0000-0000-0000-00000000000e', 'RLS New Hire', 'Barista', 'rls.staff.new@example.test');

  update staff_accounts set staff_account_status = false
   where staff_account_identifier = 'b1b1b1b1-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 8: admin could not deactivate a barista'; end if;
  raise notice 'PASS 8: admin can create and deactivate staff accounts';
end $$;

-- 9. an admin can delete a staff account ----------------------------------
do $$
declare n integer;
begin
  delete from staff_accounts
   where staff_account_identifier = 'e1e1e1e1-0000-0000-0000-00000000000e';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 9: admin could not delete a staff account'; end if;
  raise notice 'PASS 9: admin can delete staff accounts';
end $$;

-- ── inactive admin ───────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"d1d1d1d1-0000-0000-0000-00000000000d","role":"authenticated"}', true);

-- 10. a deactivated admin loses admin access ------------------------------
do $$
declare n integer;
begin
  select count(*) into n from staff_accounts
   where staff_account_identifier <> 'd1d1d1d1-0000-0000-0000-00000000000d';
  if n <> 0 then raise exception 'FAIL 10a: deactivated admin can still read % other rows', n; end if;

  update staff_accounts set staff_account_status = true
   where staff_account_identifier = 'd1d1d1d1-0000-0000-0000-00000000000d';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 10b: deactivated admin reactivated themselves'; end if;
  raise notice 'PASS 10: deactivated admin cannot read other staff or reactivate themselves';
end $$;

-- ── signed out ───────────────────────────────────────────────────────────
reset role;
set local role anon;
select set_config('request.jwt.claims', '{}', true);

-- 11. signed-out users see no staff rows ----------------------------------
do $$
declare n integer;
begin
  select count(*) into n from staff_accounts;
  if n <> 0 then raise exception 'FAIL 11: anon can see % staff rows', n; end if;
  raise notice 'PASS 11: signed-out users cannot read staff accounts';
end $$;

rollback;

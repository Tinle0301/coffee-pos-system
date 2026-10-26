-- staff_management_check.sql — POS-43 checks
--
-- Run against a database that has all migrations applied, for example in
-- the Supabase SQL editor or:
--   psql "<connection-string>" -f backend/tests/staff_management_check.sql
--
-- Everything runs inside one transaction and is rolled back at the end, so
-- it leaves no data behind. Each check prints PASS, or raises FAIL and stops.
--
-- Under test (0017_staff_management.sql):
--   set_staff_role, set_staff_active  admin only, clear errors
--   staff_accounts_safety trigger     nobody changes their own role or status

begin;

-- fixtures (run as the table owner) ---------------------------------------
insert into staff_accounts (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address, staff_account_status)
values
  ('a8a8a8a8-0000-0000-0000-00000000000a', 'Staff Barista A', 'Barista', 'staff.mgmt.a@example.test', true),
  ('b8b8b8b8-0000-0000-0000-00000000000b', 'Staff Barista B', 'Barista', 'staff.mgmt.b@example.test', true),
  ('c8c8c8c8-0000-0000-0000-00000000000c', 'Staff Admin',     'Admin',   'staff.mgmt.admin@example.test', true);

set local role authenticated;

-- ── barista ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a8a8a8a8-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1. a barista cannot change roles or deactivate anyone -------------------
do $$
begin
  begin
    perform set_staff_role('a8a8a8a8-0000-0000-0000-00000000000a', 'Admin');
    raise exception 'FAIL 1a: barista made themselves an admin';
  exception when others then
    if sqlerrm not like 'UNAUTHORIZED%' then raise; end if;
  end;
  begin
    perform set_staff_active('b8b8b8b8-0000-0000-0000-00000000000b', false);
    raise exception 'FAIL 1b: barista deactivated another barista';
  exception when others then
    if sqlerrm not like 'UNAUTHORIZED%' then raise; end if;
  end;
  raise notice 'PASS 1: barista cannot change roles or deactivate staff';
end $$;

-- ── admin ────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"c8c8c8c8-0000-0000-0000-00000000000c","role":"authenticated"}', true);

-- 2. an admin can promote a barista ---------------------------------------
do $$
declare v_role text;
begin
  select staff_role_type into v_role
    from set_staff_role('b8b8b8b8-0000-0000-0000-00000000000b', 'Admin');
  if v_role <> 'Admin' then raise exception 'FAIL 2: role is % after promotion', v_role; end if;
  raise notice 'PASS 2: admin can promote a barista to admin';
end $$;

-- 3. an admin can demote another admin when one admin stays ---------------
do $$
declare v_role text;
begin
  select staff_role_type into v_role
    from set_staff_role('b8b8b8b8-0000-0000-0000-00000000000b', 'Barista');
  if v_role <> 'Barista' then raise exception 'FAIL 3: role is % after demotion', v_role; end if;
  raise notice 'PASS 3: admin can demote another admin';
end $$;

-- 4. an admin can deactivate and reactivate a barista ---------------------
do $$
declare v_active boolean;
begin
  select staff_account_status into v_active
    from set_staff_active('a8a8a8a8-0000-0000-0000-00000000000a', false);
  if v_active then raise exception 'FAIL 4a: barista still active after deactivation'; end if;

  select staff_account_status into v_active
    from set_staff_active('a8a8a8a8-0000-0000-0000-00000000000a', true);
  if not v_active then raise exception 'FAIL 4b: barista not active after reactivation'; end if;
  raise notice 'PASS 4: admin can deactivate and reactivate a barista';
end $$;

-- 5. an admin cannot change their own role or deactivate themselves -------
do $$
begin
  begin
    perform set_staff_active('c8c8c8c8-0000-0000-0000-00000000000c', false);
    raise exception 'FAIL 5a: admin deactivated themselves';
  exception when others then
    if sqlerrm not like 'SELF_CHANGE%' then raise; end if;
  end;
  begin
    perform set_staff_role('c8c8c8c8-0000-0000-0000-00000000000c', 'Barista');
    raise exception 'FAIL 5b: admin demoted themselves';
  exception when others then
    if sqlerrm not like 'SELF_CHANGE%' then raise; end if;
  end;
  raise notice 'PASS 5: admin cannot change their own role or deactivate themselves';
end $$;

-- 6. the same rule holds for a direct UPDATE (not just the functions) -----
do $$
begin
  begin
    update staff_accounts set staff_role_type = 'Barista'
     where staff_account_identifier = 'c8c8c8c8-0000-0000-0000-00000000000c';
    raise exception 'FAIL 6: admin demoted themselves with a direct update';
  exception when others then
    if sqlerrm not like 'SELF_CHANGE%' then raise; end if;
  end;
  raise notice 'PASS 6: the safety rules also cover direct updates';
end $$;

-- 7. bad input gets a clear error -----------------------------------------
do $$
begin
  begin
    perform set_staff_role('a8a8a8a8-0000-0000-0000-00000000000a', 'Manager');
    raise exception 'FAIL 7a: unknown role accepted';
  exception when others then
    if sqlerrm not like 'INVALID_ROLE%' then raise; end if;
  end;
  begin
    perform set_staff_active('99999999-0000-0000-0000-000000000099', false);
    raise exception 'FAIL 7b: unknown staff id accepted';
  exception when others then
    if sqlerrm not like 'STAFF_NOT_FOUND%' then raise; end if;
  end;
  raise notice 'PASS 7: unknown role and unknown staff id are rejected';
end $$;

-- 8. signed-out users cannot call either function -------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{}', true);
do $$
begin
  begin
    perform set_staff_role('a8a8a8a8-0000-0000-0000-00000000000a', 'Admin');
    raise exception 'FAIL 8a: anon called set_staff_role';
  exception when insufficient_privilege then null;
  end;
  begin
    perform set_staff_active('a8a8a8a8-0000-0000-0000-00000000000a', false);
    raise exception 'FAIL 8b: anon called set_staff_active';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 8: signed-out users cannot call the staff functions';
end $$;

rollback;

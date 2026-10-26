-- 0017_staff_management.sql
-- POS-43: database functions for an admin to change a staff member's role
-- or deactivate / reactivate them, with safety rules checked in the
-- database.
--
-- What this adds:
--   1. set_staff_role(staff_id, new_role)      Barista <-> Admin
--   2. set_staff_active(staff_id, is_active)   deactivate or reactivate
--      Both are admin only (is_admin()) and raise 'CODE: message' errors
--      like the other functions, so the app can show a clear message.
--   3. A trigger on staff_accounts that keeps access safe on EVERY role or
--      status change, whether it comes from these functions or from a
--      direct UPDATE (0002 lets admins update staff_accounts directly):
--        - nobody can change their own role or deactivate themselves,
--          so an admin can't lock themselves out by mistake. This also
--          means the shop always keeps at least one admin: every change is
--          made by an active admin who isn't the one being changed, so that
--          admin is still there afterwards.
--      Changes with no logged-in user (SQL editor, migrations, service
--      role) are not checked, so data can still be repaired by hand.
--
-- Creating a staff member still happens in the Supabase dashboard
-- (Authentication > Add user, then a staff_accounts row; see docs/SETUP.md),
-- because creating a login needs the secret key, which the browser must
-- never have.

-- ── trigger: safety rules on every role / status change ───────────────
create or replace function enforce_staff_account_safety()
returns trigger
language plpgsql
security definer
as $$
begin
  -- no logged-in user (SQL editor, migrations, service role): allowed
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE'
     and new.staff_role_type is not distinct from old.staff_role_type
     and new.staff_account_status is not distinct from old.staff_account_status then
    return new;
  end if;

  -- nobody changes their own role or status
  if old.staff_account_identifier = auth.uid() then
    raise exception 'SELF_CHANGE: you cannot change your own role or deactivate your own account'
      using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists staff_accounts_safety on staff_accounts;
create trigger staff_accounts_safety
  before update of staff_role_type, staff_account_status or delete on staff_accounts
  for each row execute function enforce_staff_account_safety();

-- ── set_staff_role ──────────────────────────────────────────────────────
create or replace function set_staff_role(staff_id uuid, new_role text)
returns staff_accounts
language plpgsql
security definer
as $$
declare
  v_row staff_accounts;
begin
  if not is_admin() then
    raise exception 'UNAUTHORIZED: caller must be an active admin';
  end if;

  if new_role is null or new_role not in ('Barista', 'Admin') then
    raise exception 'INVALID_ROLE: role must be Barista or Admin';
  end if;

  update staff_accounts
     set staff_role_type = new_role
   where staff_account_identifier = staff_id
  returning * into v_row;

  if not found then
    raise exception 'STAFF_NOT_FOUND: staff account % does not exist', staff_id;
  end if;

  return v_row;
end;
$$;

-- ── set_staff_active ────────────────────────────────────────────────────
create or replace function set_staff_active(staff_id uuid, is_active boolean)
returns staff_accounts
language plpgsql
security definer
as $$
declare
  v_row staff_accounts;
begin
  if not is_admin() then
    raise exception 'UNAUTHORIZED: caller must be an active admin';
  end if;

  if is_active is null then
    raise exception 'INVALID_STATUS: is_active must be true or false';
  end if;

  update staff_accounts
     set staff_account_status = is_active
   where staff_account_identifier = staff_id
  returning * into v_row;

  if not found then
    raise exception 'STAFF_NOT_FOUND: staff account % does not exist', staff_id;
  end if;

  return v_row;
end;
$$;

revoke execute on function set_staff_role(uuid, text) from public, anon;
grant execute on function set_staff_role(uuid, text) to authenticated, service_role;

revoke execute on function set_staff_active(uuid, boolean) from public, anon;
grant execute on function set_staff_active(uuid, boolean) to authenticated, service_role;

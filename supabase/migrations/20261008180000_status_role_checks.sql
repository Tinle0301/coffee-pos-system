-- 0006_status_role_checks.sql
-- POS-17: role checks enforced on every order status change.
--
-- Goal: only authorized staff can move an order between statuses, and the
-- rule is checked in the database, not just in the UI.
--
-- What this adds on top of 0002_rls_policies.sql:
--   1. Clients (anon / authenticated) can no longer change
--      orders.order_status_type with a direct UPDATE. 0002 let a barista
--      set their own order to any status, for example 'Completed' without
--      paying. Status changes now have to go through the database
--      functions (update_order_status, cancel_order, checkout_order), which
--      also keep the queue and the transaction log in sync.
--   2. Inside those functions, the caller's role is checked on every status
--      change by a trigger, so each function gets the same rules without
--      having to repeat them:
--
--        change                                   who may do it
--        ---------------------------------------  ---------------------------
--        Pending -> In Progress -> Completed       any active staff (bar work)
--        any active order -> Cancelled             the staff member who
--                                                  created the order, or Admin
--        any change to a Completed or Cancelled    Admin only
--        order
--        anything, from an inactive account        nobody
--
--      This ticket checks WHO may change a status. WHICH transitions are
--      legal (no skipping, no going backwards) is validated inside
--      update_order_status (POS-21).
--   3. Calls with no logged-in user (auth.uid() is null), such as the
--      Supabase SQL editor, migrations or the service role, are not
--      checked, so admins can still repair data by hand.

-- ── helper: may the current user change this order to new_status? ──────
create or replace function can_change_order_status(
  p_created_by uuid,
  p_old_status text,
  p_new_status text
)
returns boolean
language sql
security definer
stable
as $$
  select case
    -- inactive or unknown accounts can never change a status
    when not is_authenticated_staff() then false
    -- admins may make any change
    when is_admin() then true
    -- finished orders are locked for everyone except admins
    when p_old_status in ('Completed', 'Cancelled') then false
    -- only the creator may cancel their own order
    when p_new_status = 'Cancelled' then p_created_by = auth.uid()
    -- moving an order forward on the bar: any active staff
    when p_new_status in ('In Progress', 'Completed') then true
    else false
  end;
$$;

-- ── trigger: run the checks on every status change ─────────────────────
create or replace function enforce_order_status_roles()
returns trigger
language plpgsql
as $$
begin
  if new.order_status_type is not distinct from old.order_status_type then
    return new;
  end if;

  -- 1. no direct status changes from the app; use the database functions
  if current_user in ('anon', 'authenticated') then
    raise exception 'Order status can only be changed through update_order_status, cancel_order or checkout_order'
      using errcode = '42501';
  end if;

  -- 3. no logged-in user (SQL editor, migrations, service role): allowed
  if auth.uid() is null then
    return new;
  end if;

  -- 2. role check for the logged-in staff member
  if not can_change_order_status(old.created_by_staff_identifier,
                                 old.order_status_type,
                                 new.order_status_type) then
    raise exception 'Not allowed to change order status from % to %',
      old.order_status_type, new.order_status_type
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_status_role_check on orders;
create trigger orders_status_role_check
  before update of order_status_type on orders
  for each row execute function enforce_order_status_roles();

-- the app may call the helper to decide which status buttons to show
revoke execute on function can_change_order_status(uuid, text, text) from public, anon;
grant execute on function can_change_order_status(uuid, text, text) to authenticated, service_role;

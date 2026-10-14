-- 0011_update_order_status.sql
-- POS-21: validate legal order status transitions and keep the queue/log in sync.

create or replace function update_order_status(
  order_id uuid,
  new_status text
)
returns void
language plpgsql
security definer
as $$
declare
  v_current_status text;
  v_is_paid boolean;
begin
  -- Only logged-in, active staff may use this RPC.
  -- POS-17 still handles the specific role/ownership rules.
  if not is_authenticated_staff() then
    raise exception 'UNAUTHORIZED: caller is not an authenticated staff member';
  end if;

  -- Find and lock the order while this status change is being processed.
  select order_status_type
    into v_current_status
    from orders
    where order_identifier = update_order_status.order_id
    for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND: order % does not exist',
      update_order_status.order_id;
  end if;

  -- Determine whether this order already has a completed payment.
  select exists (
    select 1
      from payments
      where associated_order_identifier = update_order_status.order_id
        and payment_completion_status = 'Completed'
  )
  into v_is_paid;

  -- Pending -> In Progress is always valid.
  if v_current_status = 'Pending'
     and new_status = 'In Progress' then

    null;

  -- In Progress -> Completed requires payment first.
  elsif v_current_status = 'In Progress'
        and new_status = 'Completed' then

    if not v_is_paid then
      raise exception 'NOT_PAID: order % must be paid before completion',
        update_order_status.order_id;
    end if;

  -- Pending/In Progress -> Cancelled is allowed only before payment.
  elsif v_current_status in ('Pending', 'In Progress')
        and new_status = 'Cancelled' then

    if v_is_paid then
      raise exception 'ALREADY_PAID: paid order % cannot be cancelled',
        update_order_status.order_id;
    end if;

  -- Skipping, reversing, reopening, same-status changes, etc.
  else
    raise exception 'INVALID_TRANSITION: cannot change order % from % to %',
      update_order_status.order_id,
      v_current_status,
      new_status;
  end if;

  -- POS-17's trigger performs role/ownership authorization here.
  update orders
    set order_status_type = new_status
    where order_identifier = update_order_status.order_id;

  -- Active orders remain in the queue.
  if new_status = 'In Progress' then
    update queue_entries
      set queue_entry_status_type = 'In Progress'
      where associated_order_identifier = update_order_status.order_id;

  -- Finished/cancelled orders leave the active queue.
  elsif new_status in ('Completed', 'Cancelled') then
    delete from queue_entries
      where associated_order_identifier = update_order_status.order_id;
  end if;

  -- Record the status change.
  insert into transaction_logs (
    associated_order_identifier,
    transaction_type_category,
    performed_by_staff_identifier
  )
  values (
    update_order_status.order_id,
    'status_updated',
    auth.uid()
  );
end;
$$;

revoke execute on function update_order_status(uuid, text) from public, anon;
grant execute on function update_order_status(uuid, text) to authenticated, service_role;
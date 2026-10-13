-- 0014_cancel_order.sql
-- POS-37: implement cancel_order() for real.
--
-- Supersedes the stub in 0003_functions.sql (same signature, so
-- `create or replace` replaces it). Numbered 0014 because 0011–0013 are
-- reserved for Ryan's POS-21, POS-20 and POS-22.
--
-- Pay first, then make (POS-39): a paid order stays open in the queue
-- until the bar completes it, so "is it paid?" is answered by the payments
-- table, not by the order status. A paid order can't be cancelled; it has
-- to be refunded instead (process_refund, POS-31).
--
-- In one transaction:
--   1. check the order exists and is still active (Pending or In Progress)
--   2. check it has no completed payment
--   3. set the order to 'Cancelled'
--   4. remove it from the active queue
--   5. write an 'order_cancelled' audit log entry
--
-- Who may cancel is not checked here: the POS-17 trigger
-- (orders_status_role_check, 0006) already allows only the staff member
-- who created the order, or an admin, to move it to Cancelled.

create or replace function cancel_order(order_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_status text;
begin
  if not is_authenticated_staff() then
    raise exception 'UNAUTHORIZED: caller is not an authenticated staff member';
  end if;

  select order_status_type into v_status
    from orders
    where order_identifier = cancel_order.order_id
    for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND: order % does not exist', cancel_order.order_id;
  end if;

  if v_status not in ('Pending', 'In Progress') then
    raise exception 'INVALID_ORDER_STATUS: order is % and cannot be cancelled', v_status;
  end if;

  if exists (
    select 1 from payments p
    where p.associated_order_identifier = cancel_order.order_id
      and p.payment_completion_status = 'Completed'
  ) then
    raise exception 'ALREADY_PAID: order % has been paid; refund it instead', cancel_order.order_id;
  end if;

  update orders
    set order_status_type = 'Cancelled'
    where order_identifier = cancel_order.order_id;

  delete from queue_entries
    where associated_order_identifier = cancel_order.order_id;

  insert into transaction_logs (
    associated_order_identifier, transaction_type_category, performed_by_staff_identifier
  ) values (
    cancel_order.order_id, 'order_cancelled', auth.uid()
  );
end;
$$;

revoke execute on function cancel_order(uuid) from public, anon;
grant execute on function cancel_order(uuid) to authenticated, service_role;

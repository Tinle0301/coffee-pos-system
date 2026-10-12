-- 0010_checkout_keeps_order_open.sql
-- POS-39: checkout_order no longer completes the order.
--
-- Pay first, then make: a payment at checkout no longer marks the order
-- 'Completed' or pulls it off the active queue — the barista still has to
-- make the drink after it's paid for. Recreates checkout_order
-- (0007_checkout_order.sql) with:
--   1. No more `update orders set order_status_type = 'Completed'`.
--   2. No more `delete from queue_entries`.
--   3. A new guard, right before the payment insert: raise ALREADY_PAID if
--      the order already has a payment with status 'Completed'. This
--      replaces the role that order_status_type = 'Completed' used to play
--      in stopping a second checkout of the same order — without it,
--      nothing would stop the same order being paid for twice now that
--      checkout doesn't change its status.
--   4. Unchanged: the payment insert, the inventory decrement, and the
--      payment_processed transaction log.
create or replace function checkout_order(
  order_id uuid,
  payment_method text,
  amount numeric,
  inventory_consumption jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_payment_id uuid;
  v_order_status text;
  v_order_total numeric(10, 2);
  v_item jsonb;
  v_inventory_item_id uuid;
  v_quantity_consumed numeric(10, 2);
  v_available numeric(10, 2);
begin
  if not is_authenticated_staff() then
    raise exception 'UNAUTHORIZED: caller is not an authenticated staff member';
  end if;

  select order_status_type, order_total_amount
    into v_order_status, v_order_total
    from orders
    where order_identifier = order_id;

  if not found then
    raise exception 'ORDER_NOT_FOUND: order % does not exist', order_id;
  end if;

  if v_order_status not in ('Pending', 'In Progress') then
    raise exception 'INVALID_ORDER_STATUS: order is % and cannot be checked out', v_order_status;
  end if;

  if payment_method not in ('Cash', 'Credit/Debit', 'Mobile Pay') then
    raise exception 'INVALID_PAYMENT_METHOD: % is not a supported payment method', payment_method;
  end if;

  if round(amount, 2) is distinct from v_order_total then
    raise exception 'AMOUNT_MISMATCH: payment amount % does not match order total %', amount, v_order_total;
  end if;

  if inventory_consumption is null or jsonb_typeof(inventory_consumption) <> 'array' then
    raise exception 'INVALID_INVENTORY_CONSUMPTION: inventory_consumption must be a jsonb array';
  end if;

  -- Validate every inventory line before writing anything.
  for v_item in select * from jsonb_array_elements(inventory_consumption)
  loop
    v_inventory_item_id := nullif(v_item ->> 'inventory_item_id', '')::uuid;
    v_quantity_consumed := nullif(v_item ->> 'quantity_consumed', '')::numeric;

    if v_inventory_item_id is null or v_quantity_consumed is null or v_quantity_consumed <= 0 then
      raise exception 'INVALID_INVENTORY_CONSUMPTION: each entry needs an inventory_item_id and a positive quantity_consumed';
    end if;

    select available_quantity_value into v_available
      from inventory_items
      where inventory_item_identifier = v_inventory_item_id;

    if not found then
      raise exception 'INVENTORY_ITEM_NOT_FOUND: inventory item % does not exist', v_inventory_item_id;
    end if;

    if v_available < v_quantity_consumed then
      raise exception 'INSUFFICIENT_INVENTORY: inventory item % has % available, % requested',
        v_inventory_item_id, v_available, v_quantity_consumed;
    end if;
  end loop;

  if exists (
    select 1 from payments
    where associated_order_identifier = order_id
      and payment_completion_status = 'Completed'
  ) then
    raise exception 'ALREADY_PAID: order % already has a completed payment', order_id;
  end if;

  insert into payments (
    associated_order_identifier, payment_method_type, payment_amount_value,
    payment_completion_status
  ) values (
    order_id, payment_method, amount, 'Completed'
  )
  returning payment_transaction_identifier into v_payment_id;

  for v_item in select * from jsonb_array_elements(inventory_consumption)
  loop
    v_inventory_item_id := (v_item ->> 'inventory_item_id')::uuid;
    v_quantity_consumed := (v_item ->> 'quantity_consumed')::numeric;

    update inventory_items
      set available_quantity_value = available_quantity_value - v_quantity_consumed,
          inventory_last_updated_timestamp = now()
      where inventory_item_identifier = v_inventory_item_id;
  end loop;

  insert into transaction_logs (
    associated_order_identifier, transaction_type_category, performed_by_staff_identifier
  ) values (
    order_id, 'payment_processed', auth.uid()
  );

  return v_payment_id;
end;
$$;

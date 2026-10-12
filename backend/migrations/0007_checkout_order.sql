-- 0007_checkout_order.sql
-- POS-18: implement checkout_order() for real.
--
-- Originally written as 0005_checkout_order.sql; renumbered to 0007 because
-- 0005 (POS-16, payment security) and 0006 (POS-17, status role checks)
-- landed on main first. Verified compatible with both: POS-16's
-- payments_insert_own_order RLS and immutability triggers only restrict
-- direct client writes/updates — this function's INSERT runs as
-- security definer and only ever inserts, never updates/deletes, a
-- payment. POS-17's status-change trigger explicitly allows "any active
-- staff" to move an order to Completed (not just its creator), which is
-- exactly what this function's Pending/In Progress -> Completed step does.
--
-- Supersedes the stub in 0003_functions.sql. Records the payment, completes
-- the order, decrements inventory, and writes the audit log in one plpgsql
-- transaction — if any step fails, everything rolls back, so money and
-- stock never disagree.
--
-- Deviations from the 0003_functions.sql stub comment, and why:
--   1. Added `inventory_consumption jsonb` (default '[]'). There is no
--      menu_item -> inventory_item mapping anywhere in the schema —
--      docs/DATA_MODEL.md explicitly documents that as "a services-layer
--      concern" — so this function has no way to compute ingredient
--      consumption itself. The caller supplies
--      [{ "inventory_item_id": uuid, "quantity_consumed": numeric }, ...]
--      and this function applies it atomically alongside everything else.
--      An empty/omitted array just means nothing is decremented.
--   2. Also deletes the order's queue_entries row(s). The stub's step list
--      didn't mention this, but queue_entries.queue_entry_status_type only
--      allows ('Pending', 'In Progress') — added after the stub comment
--      was written — so a Completed order has no legal status to sit in
--      the queue with. Removed here, same as cancel_order's documented
--      step 3.
--   3. Returns the new payment_transaction_identifier instead of void, so
--      backend/services/payments.js's processPayment() can look up and
--      return the full Payment row — mirrors how CreateNewOrder uses
--      create_order's return value.
--   4. Validates payment_method against the same values as the
--      payments.payment_method_type check constraint, and that amount
--      matches the order's total, so a payment can't be recorded against
--      the wrong amount.
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

  insert into payments (
    associated_order_identifier, payment_method_type, payment_amount_value,
    payment_completion_status
  ) values (
    order_id, payment_method, amount, 'Completed'
  )
  returning payment_transaction_identifier into v_payment_id;

  update orders set order_status_type = 'Completed' where order_identifier = order_id;

  delete from queue_entries where associated_order_identifier = order_id;

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

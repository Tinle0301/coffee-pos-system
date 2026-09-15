-- 0003_functions.sql
-- Coffee POS System — atomic database operations (plpgsql RPC)
--
-- With no application server, any work touching multiple tables must be
-- atomic at the database level. These are STUB signatures only — the body
-- is a comment describing the transaction. Fill in the real logic in a
-- follow-up migration; do not implement application features here yet.
--
-- All of these should be created SECURITY DEFINER so they can write to
-- transaction_logs and queue_entries (which have no direct client write
-- policy — see 0002_rls_policies.sql), while still being callable only by
-- authenticated staff. Add an is_authenticated_staff() / is_admin() check
-- inside each body before doing any writes.

-- create_order(items jsonb, staff_id uuid) -> orders.order_identifier
-- Transaction:
--   1. insert into orders (status = 'Pending', computed subtotal/tax/total
--      from items, created_by_staff_identifier = staff_id)
--   2. insert into order_items, one row per element of items
--   3. insert into queue_entries (status = 'Pending') for the new order
--   4. insert into transaction_logs (type = 'order_created')
--   5. return the new order_identifier
create or replace function create_order(items jsonb, staff_id uuid)
returns uuid
language plpgsql
security definer
as $$
begin
  raise exception 'create_order: not implemented';
end;
$$;

-- checkout_order(order_id uuid, payment_method text, amount numeric) -> void
-- Transaction:
--   1. insert into payments (method, amount, status = 'Completed')
--   2. update orders set order_status_type = 'Completed'
--   3. decrement inventory_items.available_quantity_value for each
--      ingredient consumed by the order's order_items
--   4. insert into transaction_logs (type = 'payment_processed')
create or replace function checkout_order(order_id uuid, payment_method text, amount numeric)
returns void
language plpgsql
security definer
as $$
begin
  raise exception 'checkout_order: not implemented';
end;
$$;

-- process_refund(payment_id uuid, refund_type text, amount numeric) -> uuid
-- Transaction:
--   1. insert into refunds (associated_payment_identifier = payment_id,
--      refund_type_category = refund_type, refund_amount_value = amount)
--   2. update payments set payment_completion_status = 'Refunded'
--   3. insert into transaction_logs (type = 'refund_processed')
--   4. return the new refund_transaction_identifier
create or replace function process_refund(payment_id uuid, refund_type text, amount numeric)
returns uuid
language plpgsql
security definer
as $$
begin
  raise exception 'process_refund: not implemented';
end;
$$;

-- cancel_order(order_id uuid) -> void
-- Transaction:
--   1. verify the order has no completed payment (raise exception if paid —
--      use process_refund instead)
--   2. update orders set order_status_type = 'Cancelled'
--   3. remove the order's row(s) from queue_entries
--   4. insert into transaction_logs (type = 'order_cancelled')
create or replace function cancel_order(order_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  raise exception 'cancel_order: not implemented';
end;
$$;

-- update_order_status(order_id uuid, new_status text) -> void
-- Transaction:
--   1. validate new_status is a legal transition from the current status
--      (Pending -> In Progress -> Completed; Pending/In Progress -> Cancelled)
--   2. update orders set order_status_type = new_status
--   3. update the corresponding queue_entries.queue_entry_status_type
--   4. insert into transaction_logs (type = 'status_updated')
create or replace function update_order_status(order_id uuid, new_status text)
returns void
language plpgsql
security definer
as $$
begin
  raise exception 'update_order_status: not implemented';
end;
$$;

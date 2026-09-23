-- 0004_create_order.sql
-- POS-8: implement create_order() for real.
--
-- Supersedes the stub in 0003_functions.sql (create or replace keeps the
-- same signature). Writes the order, its order_items, and its queue entry
-- in a single plpgsql function body, which Postgres already runs as one
-- transaction — if any step raises, every prior write in this call rolls
-- back, so an order is never left half-saved.
--
-- items shape (per guides/BACKEND-GUIDE-Sprint1.md Story #6):
--   [{ "menu_item_id": uuid, "quantity": int, "customization": text?,
--      "price": numeric }, ...]
-- price is supplied by the caller and used as-is for pricing the order;
-- menu_item_id is still checked against menu_items so a bad id fails with
-- a clear MENU_ITEM_UNAVAILABLE error instead of a raw FK violation.
--
-- Tax rate: no configured rate exists yet anywhere in the schema/docs.
-- 9% is backed out from the worked example in docs/DATA_MODEL.md /
-- docs/API_CONTRACT.md (7.25 subtotal -> 0.65 tax, and 7.25 * 0.09 = 0.6525
-- rounds to 0.65). Replace v_tax_rate with a real configured rate once one
-- exists.
create or replace function create_order(items jsonb, staff_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tax_rate constant numeric := 0.09;
  v_order_id uuid;
  v_item jsonb;
  v_menu_item_id uuid;
  v_quantity integer;
  v_customization text;
  v_price numeric(10, 2);
  v_subtotal numeric(10, 2) := 0;
  v_tax numeric(10, 2);
  v_total numeric(10, 2);
begin
  if not is_authenticated_staff() then
    raise exception 'UNAUTHORIZED: caller is not an authenticated staff member';
  end if;

  if staff_id is distinct from auth.uid() then
    raise exception 'UNAUTHORIZED: staff_id must match the authenticated caller';
  end if;

  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'INVALID_ORDER: order must contain at least one item';
  end if;

  -- Validate every line and price the order before writing anything.
  for v_item in select * from jsonb_array_elements(items)
  loop
    v_quantity := nullif(v_item ->> 'quantity', '')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'INVALID_QUANTITY: item quantity must be greater than zero';
    end if;

    v_price := nullif(v_item ->> 'price', '')::numeric;
    if v_price is null or v_price < 0 then
      raise exception 'INVALID_ORDER: item price must be a non-negative number';
    end if;

    if not exists (
      select 1 from menu_items
      where menu_item_identifier = (v_item ->> 'menu_item_id')::uuid
        and menu_item_availability_status = true
    ) then
      raise exception 'MENU_ITEM_UNAVAILABLE: menu item % does not exist or is unavailable',
        v_item ->> 'menu_item_id';
    end if;

    v_subtotal := v_subtotal + (v_price * v_quantity);
  end loop;

  v_tax := round(v_subtotal * v_tax_rate, 2);
  v_total := v_subtotal + v_tax;

  insert into orders (
    order_status_type, order_subtotal_amount, order_tax_amount,
    order_total_amount, created_by_staff_identifier
  ) values (
    'Pending', v_subtotal, v_tax, v_total, staff_id
  )
  returning order_identifier into v_order_id;

  for v_item in select * from jsonb_array_elements(items)
  loop
    v_menu_item_id := (v_item ->> 'menu_item_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_customization := v_item ->> 'customization';
    v_price := (v_item ->> 'price')::numeric;

    insert into order_items (
      associated_order_identifier, associated_menu_item_identifier,
      ordered_item_quantity, item_customization_description, item_price_amount
    ) values (
      v_order_id, v_menu_item_id, v_quantity, v_customization, v_price
    );
  end loop;

  insert into queue_entries (associated_order_identifier, queue_entry_status_type)
  values (v_order_id, 'Pending');

  insert into transaction_logs (
    associated_order_identifier, transaction_type_category, performed_by_staff_identifier
  ) values (
    v_order_id, 'order_created', staff_id
  );

  return v_order_id;
end;
$$;
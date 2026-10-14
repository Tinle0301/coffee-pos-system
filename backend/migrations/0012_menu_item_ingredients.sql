-- 0012_menu_item_ingredients.sql
-- POS-20: automatically calculate and deduct inventory when an order is paid.
--
-- Each menu item can consume one or more inventory items.
-- Customization-specific consumption is intentionally out of scope for
-- POS-20 and will be handled by a future story.

create table menu_item_ingredients (
  menu_item_identifier uuid not null
    references menu_items (menu_item_identifier) on delete cascade,

  inventory_item_identifier uuid not null
    references inventory_items (inventory_item_identifier),

  quantity_per_item_value numeric(10, 2) not null
    check (quantity_per_item_value > 0),

  primary key (
    menu_item_identifier,
    inventory_item_identifier
  )
);

-- POS-20: staff may read recipe mappings, but only admins may modify them.
alter table menu_item_ingredients enable row level security;

create policy menu_item_ingredients_staff_read
  on menu_item_ingredients
  for select
  using (is_authenticated_staff());

create policy menu_item_ingredients_admin_write
  on menu_item_ingredients
  for all
  using (is_admin())
  with check (is_admin());

-- POS-20: base recipe mappings for the sample menu items.
-- Look up the existing rows by name so the live migration does not depend
-- on the UUIDs used by local seed data.

insert into menu_item_ingredients (
  menu_item_identifier,
  inventory_item_identifier,
  quantity_per_item_value
)
select
  m.menu_item_identifier,
  i.inventory_item_identifier,
  0.04
from menu_items m
cross join inventory_items i
where m.menu_item_name = 'Drip Coffee'
  and i.inventory_item_name = 'Espresso Beans (lb)'
on conflict (menu_item_identifier, inventory_item_identifier)
do nothing;

insert into menu_item_ingredients (
  menu_item_identifier,
  inventory_item_identifier,
  quantity_per_item_value
)
select
  m.menu_item_identifier,
  i.inventory_item_identifier,
  0.04
from menu_items m
cross join inventory_items i
where m.menu_item_name = 'Latte'
  and i.inventory_item_name = 'Espresso Beans (lb)'
on conflict (menu_item_identifier, inventory_item_identifier)
do nothing;

insert into menu_item_ingredients (
  menu_item_identifier,
  inventory_item_identifier,
  quantity_per_item_value
)
select
  m.menu_item_identifier,
  i.inventory_item_identifier,
  0.10
from menu_items m
cross join inventory_items i
where m.menu_item_name = 'Latte'
  and i.inventory_item_name = 'Whole Milk (gal)'
on conflict (menu_item_identifier, inventory_item_identifier)
do nothing;

insert into menu_item_ingredients (
  menu_item_identifier,
  inventory_item_identifier,
  quantity_per_item_value
)
select
  m.menu_item_identifier,
  i.inventory_item_identifier,
  1.00
from menu_items m
cross join inventory_items i
where m.menu_item_name = 'Blueberry Muffin'
  and i.inventory_item_name = 'Blueberry Muffins (each)'
on conflict (menu_item_identifier, inventory_item_identifier)
do nothing;

-- Calculates the total inventory required for all items in one order.
--
-- Example:
--   2 Lattes where each Latte requires 0.04 lb of beans
--   becomes:
--   { "inventory_item_id": "...", "quantity_consumed": 0.08 }
create or replace function order_inventory_consumption(order_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'inventory_item_id', consumption.inventory_item_identifier,
        'quantity_consumed', consumption.quantity_consumed
      )
      order by consumption.inventory_item_identifier
    ),
    '[]'::jsonb
  )
  from (
    select
      ingredients.inventory_item_identifier,
      sum(
        ingredients.quantity_per_item_value
        * items.ordered_item_quantity
      ) as quantity_consumed
    from order_items items
    join menu_item_ingredients ingredients
      on ingredients.menu_item_identifier =
         items.associated_menu_item_identifier
    where items.associated_order_identifier = order_id
    group by ingredients.inventory_item_identifier
  ) consumption;
$$;

-- Remove the obsolete three-argument checkout_order stub from 0003_functions.sql.
drop function if exists checkout_order(uuid, text, numeric);

-- Recreate checkout_order so an empty inventory_consumption array
-- automatically uses the order's configured ingredient requirements.
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
    raise exception 'AMOUNT_MISMATCH: payment amount % does not match order total %',
      amount, v_order_total;
  end if;

  if inventory_consumption is null
     or jsonb_typeof(inventory_consumption) <> 'array' then
    raise exception
      'INVALID_INVENTORY_CONSUMPTION: inventory_consumption must be a jsonb array';
  end if;

  -- POS-20:
  -- The payment service currently sends an empty array.
  -- When that happens, calculate stock consumption from the order's
  -- menu items and the menu_item_ingredients recipe table.
  if jsonb_array_length(inventory_consumption) = 0 then
    inventory_consumption := order_inventory_consumption(order_id);
  end if;

  -- Validate every inventory line before writing anything.
  for v_item in
    select * from jsonb_array_elements(inventory_consumption)
  loop
    v_inventory_item_id :=
      nullif(v_item ->> 'inventory_item_id', '')::uuid;

    v_quantity_consumed :=
      nullif(v_item ->> 'quantity_consumed', '')::numeric;

    if v_inventory_item_id is null
       or v_quantity_consumed is null
       or v_quantity_consumed <= 0 then
      raise exception
        'INVALID_INVENTORY_CONSUMPTION: each entry needs an inventory_item_id and a positive quantity_consumed';
    end if;

    select available_quantity_value
      into v_available
      from inventory_items
      where inventory_item_identifier = v_inventory_item_id;

    if not found then
      raise exception
        'INVENTORY_ITEM_NOT_FOUND: inventory item % does not exist',
        v_inventory_item_id;
    end if;

    if v_available < v_quantity_consumed then
      raise exception
        'INSUFFICIENT_INVENTORY: inventory item % has % available, % requested',
        v_inventory_item_id,
        v_available,
        v_quantity_consumed;
    end if;
  end loop;

  if exists (
    select 1
      from payments
      where associated_order_identifier = order_id
        and payment_completion_status = 'Completed'
  ) then
    raise exception
      'ALREADY_PAID: order % already has a completed payment',
      order_id;
  end if;

  insert into payments (
    associated_order_identifier,
    payment_method_type,
    payment_amount_value,
    payment_completion_status
  )
  values (
    order_id,
    payment_method,
    amount,
    'Completed'
  )
  returning payment_transaction_identifier
    into v_payment_id;

  for v_item in
    select * from jsonb_array_elements(inventory_consumption)
  loop
    v_inventory_item_id :=
      (v_item ->> 'inventory_item_id')::uuid;

    v_quantity_consumed :=
      (v_item ->> 'quantity_consumed')::numeric;

    update inventory_items
      set available_quantity_value =
            available_quantity_value - v_quantity_consumed,
          inventory_last_updated_timestamp = now()
      where inventory_item_identifier = v_inventory_item_id;
  end loop;

  insert into transaction_logs (
    associated_order_identifier,
    transaction_type_category,
    performed_by_staff_identifier
  )
  values (
    order_id,
    'payment_processed',
    auth.uid()
  );

  return v_payment_id;
end;
$$;

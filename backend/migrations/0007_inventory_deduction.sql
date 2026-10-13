-- 0007_inventory_deduction.sql
-- POS-20: store structured customization data for inventory deduction.

-- Adds structured customization data to the existing order_items table.
alter table order_items
add column item_customization_data jsonb
check (
  item_customization_data is null
  or jsonb_typeof(item_customization_data) = 'object'
);

-- POS-20: Maps one base menu item to the inventory quantities it consumes.
create table menu_item_inventory_requirements (
  menu_item_identifier uuid not null
    references menu_items (menu_item_identifier) on delete cascade,
  inventory_item_identifier uuid not null
    references inventory_items (inventory_item_identifier),
  quantity_required_value numeric(10, 2) not null
    check (quantity_required_value > 0),
  primary key (menu_item_identifier, inventory_item_identifier)
);

-- POS-20: Defines how a customization changes a menu item's base recipe.
create table menu_item_modifier_effects (
  menu_item_identifier uuid not null
    references menu_items (menu_item_identifier) on delete cascade,

  modifier_category text not null
    check (modifier_category in ('size', 'milk', 'addon')),

  modifier_identifier text not null,

  effect_type text not null
    check (effect_type in ('ADD', 'REPLACE', 'SCALE')),

  inventory_item_identifier uuid not null
    references inventory_items (inventory_item_identifier),

  replacement_inventory_item_identifier uuid
    references inventory_items (inventory_item_identifier),

  effect_value numeric(10, 4),

  primary key (
    menu_item_identifier,
    modifier_category,
    modifier_identifier,
    inventory_item_identifier
  ),

  check (
    (effect_type = 'ADD'
        and effect_value is not null
        and effect_value > 0
        and replacement_inventory_item_identifier is null)

    or

    (effect_type = 'SCALE'
        and effect_value is not null
        and effect_value > 0
        and replacement_inventory_item_identifier is null)

    or

    (effect_type = 'REPLACE'
        and effect_value is null
        and replacement_inventory_item_identifier is not null
        and replacement_inventory_item_identifier <> inventory_item_identifier)
  )
);

-- Reusing 0004_create_order.sql's create_order function, but adding a new column for customization data.
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
  v_customization_data jsonb;
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
    v_customization_data := nullif(v_item -> 'customization_data', 'null'::jsonb);
    v_price := (v_item ->> 'price')::numeric;

    insert into order_items (
        associated_order_identifier,
        associated_menu_item_identifier,
        ordered_item_quantity,
        item_customization_description,
        item_customization_data,
        item_price_amount
    ) values (
        v_order_id,
        v_menu_item_id,
        v_quantity,
        v_customization,
        v_customization_data,
        v_price
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
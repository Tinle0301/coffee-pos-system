-- 0016_restock_inventory.sql
-- POS-58: allow an Admin to restock inventory while recording
-- every restock in an immutable inventory stock log.

create table inventory_stock_logs (
  inventory_stock_log_identifier uuid primary key default gen_random_uuid(),

  inventory_item_identifier uuid not null
    references inventory_items (inventory_item_identifier),

  quantity_before_value numeric(10, 2) not null
    check (quantity_before_value >= 0),

  quantity_change_value numeric(10, 2) not null
    check (quantity_change_value > 0),

  quantity_after_value numeric(10, 2) not null
    check (quantity_after_value >= 0),

  inventory_stock_log_timestamp timestamptz not null default now(),

  performed_by_staff_identifier uuid not null
    references staff_accounts (staff_account_identifier)
);

-- Inventory stock logs are audit records.
-- Admins may read them, but clients cannot directly insert/update/delete them.
alter table inventory_stock_logs enable row level security;

create policy inventory_stock_logs_select_admin
  on inventory_stock_logs
  for select
  using (is_admin());

create or replace function restock_inventory(
  inventory_item_id uuid,
  quantity_to_add numeric
)
returns table (
  inventory_item_identifier uuid,
  inventory_item_name text,
  available_quantity_value numeric(10, 2),
  minimum_stock_threshold numeric(10, 2),
  inventory_last_updated_timestamp timestamptz
)
language plpgsql
security definer
as $$
declare
  v_quantity_before numeric(10, 2);
begin
  if not is_admin() then
    raise exception
      'UNAUTHORIZED: caller must be an active admin';
  end if;

  if quantity_to_add is null or quantity_to_add <= 0 then
    raise exception
      'INVALID_QUANTITY: restock quantity must be greater than zero';
  end if;

  select i.available_quantity_value
    into v_quantity_before
    from inventory_items i
    where i.inventory_item_identifier = inventory_item_id
    for update;

  if not found then
    raise exception
      'INVENTORY_ITEM_NOT_FOUND: inventory item % does not exist',
      inventory_item_id;
  end if;

  update inventory_items i
    set available_quantity_value =
          i.available_quantity_value + quantity_to_add,
        inventory_last_updated_timestamp = now()
    where i.inventory_item_identifier = inventory_item_id;

  insert into inventory_stock_logs (
    inventory_item_identifier,
    quantity_before_value,
    quantity_change_value,
    quantity_after_value,
    performed_by_staff_identifier
  )
  values (
    inventory_item_id,
    v_quantity_before,
    quantity_to_add,
    v_quantity_before + quantity_to_add,
    auth.uid()
  );

  return query
  select
    i.inventory_item_identifier,
    i.inventory_item_name,
    i.available_quantity_value,
    i.minimum_stock_threshold,
    i.inventory_last_updated_timestamp
  from inventory_items i
  where i.inventory_item_identifier = inventory_item_id;
end;
$$;

revoke execute on function restock_inventory(uuid, numeric)
  from public, anon;

grant execute on function restock_inventory(uuid, numeric)
  to authenticated, service_role;

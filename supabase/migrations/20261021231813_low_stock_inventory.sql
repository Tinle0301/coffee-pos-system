-- 0015_low_stock_inventory.sql
-- POS-57: list inventory items that have reached or fallen below
-- their configured minimum stock threshold.

create or replace function list_low_stock_inventory()
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
begin
  -- POS-57 is an Admin inventory-management operation.
  if not is_admin() then
    raise exception
      'UNAUTHORIZED: caller must be an active admin';
  end if;

  return query
  select
    i.inventory_item_identifier,
    i.inventory_item_name,
    i.available_quantity_value,
    i.minimum_stock_threshold,
    i.inventory_last_updated_timestamp
  from inventory_items i
  where i.available_quantity_value <= i.minimum_stock_threshold
  order by
    i.available_quantity_value asc,
    i.inventory_item_name asc;
end;
$$;

revoke execute on function list_low_stock_inventory()
  from public, anon;

grant execute on function list_low_stock_inventory()
  to authenticated, service_role;

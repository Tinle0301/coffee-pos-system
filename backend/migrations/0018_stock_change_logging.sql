-- 0018_stock_change_logging.sql
-- POS-63: log every inventory quantity change in inventory_stock_logs.

-- POS-58 originally only allowed positive changes because it handled restocks.
-- POS-63 also needs negative changes for checkout deductions.
alter table inventory_stock_logs
  drop constraint if exists
    inventory_stock_logs_quantity_change_value_check;

alter table inventory_stock_logs
  add constraint inventory_stock_logs_quantity_change_value_check
  check (quantity_change_value <> 0);

-- Stock changes made outside an authenticated app session, such as through
-- the Supabase Dashboard / SQL Editor, do not have an auth.uid().
-- Allow those changes to still be recorded in the audit log.
alter table inventory_stock_logs
  alter column performed_by_staff_identifier drop not null;


-- POS-63 centralizes inventory audit logging here.
-- Any real change to available_quantity_value creates one audit row.
create or replace function log_inventory_stock_change()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into inventory_stock_logs (
    inventory_item_identifier,
    quantity_before_value,
    quantity_change_value,
    quantity_after_value,
    performed_by_staff_identifier
  )
  values (
    new.inventory_item_identifier,
    old.available_quantity_value,
    new.available_quantity_value - old.available_quantity_value,
    new.available_quantity_value,
    auth.uid()
  );

  return new;
end;
$$;


drop trigger if exists inventory_items_log_stock_change
  on inventory_items;

create trigger inventory_items_log_stock_change
after update of available_quantity_value
on inventory_items
for each row
when (
  new.available_quantity_value is distinct from
  old.available_quantity_value
)
execute function log_inventory_stock_change();


-- POS-58 used to manually write its audit row.
-- The new table-level trigger now owns that responsibility so restocks
-- are logged exactly once.
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
begin
  if not is_admin() then
    raise exception
      'UNAUTHORIZED: caller must be an active admin';
  end if;

  if quantity_to_add is null or quantity_to_add <= 0 then
    raise exception
      'INVALID_QUANTITY: restock quantity must be greater than zero';
  end if;

  perform 1
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

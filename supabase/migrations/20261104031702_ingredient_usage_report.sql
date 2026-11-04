-- 0020_ingredient_usage_report.sql
-- POS-78: report how much of each ingredient was used during a date range.
--
-- Usage is calculated from paid orders and their menu-item recipe mappings.
-- Manual inventory adjustments are intentionally excluded because they are
-- stock corrections, not ingredient consumption from customer orders.

create or replace function ingredient_usage_report(
  range_start date,
  range_end date
)
returns table (
  inventory_item_identifier uuid,
  inventory_item_name text,
  quantity_used_value numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception
      'UNAUTHORIZED: caller must be an active admin';
  end if;

  if range_start is null
     or range_end is null
     or range_start > range_end then
    raise exception
      'INVALID_DATE_RANGE: start date must not be after end date';
  end if;

  return query
  with usage_totals as (
    select
      ingredients.inventory_item_identifier,
      sum(
        ingredients.quantity_per_item_value
        * items.ordered_item_quantity
      )::numeric as quantity_used_value

    from order_items items

    join menu_item_ingredients ingredients
      on ingredients.menu_item_identifier =
         items.associated_menu_item_identifier

    where exists (
      select 1
      from payments payment
      where payment.associated_order_identifier =
            items.associated_order_identifier
        and payment.payment_completion_status
            in ('Completed', 'Refunded')
        and (
          payment.payment_processing_timestamp
          at time zone 'America/Los_Angeles'
        )::date between range_start and range_end
    )

    group by
      ingredients.inventory_item_identifier
  )

  select
    inventory.inventory_item_identifier,
    inventory.inventory_item_name,
    coalesce(
      usage.quantity_used_value,
      0
    )::numeric as quantity_used_value

  from inventory_items inventory

  left join usage_totals usage
    on usage.inventory_item_identifier =
       inventory.inventory_item_identifier

  order by
    coalesce(usage.quantity_used_value, 0) desc,
    inventory.inventory_item_name asc;
end;
$$;

revoke execute on function ingredient_usage_report(date, date)
  from public, anon;

grant execute on function ingredient_usage_report(date, date)
  to authenticated, service_role;

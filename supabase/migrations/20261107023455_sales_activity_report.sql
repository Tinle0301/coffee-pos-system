-- 0021_sales_activity_report
-- POS-64: Best-selling items and busiest checkout hours.
--
-- Only paid/refunded orders count.
-- Reporting dates use America/Los_Angeles.

create or replace function best_selling_items_report(
  range_start date,
  range_end date
)
returns table (
  menu_item_identifier uuid,
  menu_item_name text,
  quantity_sold bigint,
  gross_item_revenue numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Authorization: only active admins may run reports.
  if not is_admin() then
    raise exception
      'UNAUTHORIZED: caller must be an active admin';
  end if;

  -- Prevent reversed or missing date ranges.
  if range_start is null
     or range_end is null
     or range_start > range_end then
    raise exception
      'INVALID_DATE_RANGE: start must not be after end';
  end if;

  return query
  select
    menu.menu_item_identifier,
    menu.menu_item_name,

    -- Count actual quantities, not order-item rows.
    sum(items.ordered_item_quantity)::bigint
      as quantity_sold,

    -- Use the price stored when the order was created.
    sum(
      items.ordered_item_quantity * items.item_price_amount
    )::numeric as gross_item_revenue

  from order_items items

  join menu_items menu
    on menu.menu_item_identifier =
       items.associated_menu_item_identifier

  -- Count an order only on its FIRST successful checkout date.
  -- Multiple qualifying payments cannot place it on two dates.
  where exists (
    select 1
    from payments payment

    where payment.associated_order_identifier =
          items.associated_order_identifier

      and payment.payment_completion_status
          in ('Completed', 'Refunded')

    group by payment.associated_order_identifier

    having (
      min(payment.payment_processing_timestamp)
        at time zone 'America/Los_Angeles'
    )::date between range_start and range_end
  )

  group by
    menu.menu_item_identifier,
    menu.menu_item_name

  -- Highest quantity first; stable tie-breaking.
  order by
    sum(items.ordered_item_quantity) desc,
    menu.menu_item_name asc,
    menu.menu_item_identifier asc

  limit 10;
end;
$$;

create or replace function busiest_hours_report(
  range_start date,
  range_end date
)
returns table (
  hour_of_day integer,
  order_count bigint
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
      'INVALID_DATE_RANGE: start must not be after end';
  end if;

  return query

  -- One checkout per order, even with multiple payments.
  with eligible_orders as (
    select
      payment.associated_order_identifier,
      min(payment.payment_processing_timestamp) as paid_at

    from payments payment

    where payment.payment_completion_status
          in ('Completed', 'Refunded')

    group by payment.associated_order_identifier

    -- Filter AFTER finding the first successful payment.
    having (
      min(payment.payment_processing_timestamp)
        at time zone 'America/Los_Angeles'
    )::date between range_start and range_end
  ),

  -- Group checkouts by their Pacific local hour.
  hourly_counts as (
    select
      extract(
        hour from paid_at
          at time zone 'America/Los_Angeles'
      )::integer as local_hour,

      count(*)::bigint as sales_count

    from eligible_orders
    group by 1
  )

  -- Generate all 24 hours, including zero-sale hours.
  select
    hours.hour_of_day,
    coalesce(counts.sales_count, 0)::bigint
      as order_count

  from generate_series(0, 23) as hours(hour_of_day)

  left join hourly_counts counts
    on counts.local_hour = hours.hour_of_day

  order by hours.hour_of_day;
end;
$$;

revoke execute on function
  best_selling_items_report(date, date)
  from public, anon;

revoke execute on function
  busiest_hours_report(date, date)
  from public, anon;

grant execute on function
  best_selling_items_report(date, date)
  to authenticated, service_role;

grant execute on function
  busiest_hours_report(date, date)
  to authenticated, service_role;

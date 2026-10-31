-- stock_change_logging_check.sql — POS-63 checks

begin;

insert into staff_accounts (
  staff_account_identifier,
  staff_full_name,
  staff_role_type,
  staff_email_address,
  staff_account_status
)
values (
  '63636363-0000-0000-0000-00000000000a',
  'POS-63 Test Admin',
  'Admin',
  'pos63.admin@example.test',
  true
);

insert into inventory_items (
  inventory_item_identifier,
  inventory_item_name,
  available_quantity_value,
  minimum_stock_threshold
)
values (
  '63000000-0000-0000-0000-000000000001',
  'POS-63 Test Inventory',
  10.00,
  2.00
);

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"63636363-0000-0000-0000-00000000000a","role":"authenticated"}',
  true
);

-- 1. Direct deduction creates a negative audit row.
update inventory_items
set available_quantity_value = 7.00
where inventory_item_identifier =
  '63000000-0000-0000-0000-000000000001';

do $$
declare
  v_before numeric(10, 2);
  v_change numeric(10, 2);
  v_after numeric(10, 2);
begin
  select
    quantity_before_value,
    quantity_change_value,
    quantity_after_value
  into
    v_before,
    v_change,
    v_after
  from inventory_stock_logs
  where inventory_item_identifier =
    '63000000-0000-0000-0000-000000000001'
  order by inventory_stock_log_timestamp desc
  limit 1;

  if v_before <> 10.00
     or v_change <> -3.00
     or v_after <> 7.00 then
    raise exception
      'FAIL 1: deduction audit values were incorrect';
  end if;

  raise notice
    'PASS 1: inventory deduction creates the correct stock log';
end $$;


-- 2. Restock still works.
select *
from restock_inventory(
  '63000000-0000-0000-0000-000000000001',
  2.00
);

do $$
declare
  v_available numeric(10, 2);
begin
  select available_quantity_value
  into v_available
  from inventory_items
  where inventory_item_identifier =
    '63000000-0000-0000-0000-000000000001';

  if v_available <> 9.00 then
    raise exception
      'FAIL 2: expected quantity 9.00 after restock, got %',
      v_available;
  end if;

  raise notice
    'PASS 2: restock still updates inventory';
end $$;


-- 3. Restock creates exactly one positive audit row.
do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from inventory_stock_logs
  where inventory_item_identifier =
    '63000000-0000-0000-0000-000000000001'
    and quantity_change_value > 0;

  if v_count <> 1 then
    raise exception
      'FAIL 3: expected 1 positive restock log, found %',
      v_count;
  end if;

  raise notice
    'PASS 3: restock creates exactly one audit row';
end $$;


-- 4. Both increase and decrease are now logged.
do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from inventory_stock_logs
  where inventory_item_identifier =
    '63000000-0000-0000-0000-000000000001';

  if v_count <> 2 then
    raise exception
      'FAIL 4: expected 2 total stock logs, found %',
      v_count;
  end if;

  raise notice
    'PASS 4: positive and negative stock changes are both logged';
end $$;


-- 5. Updating another column does not create a stock log.
update inventory_items
set inventory_last_updated_timestamp = now()
where inventory_item_identifier =
  '63000000-0000-0000-0000-000000000001';

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from inventory_stock_logs
  where inventory_item_identifier =
    '63000000-0000-0000-0000-000000000001';

  if v_count <> 2 then
    raise exception
      'FAIL 5: non-stock update created an audit row';
  end if;

  raise notice
    'PASS 5: non-stock updates do not create audit rows';
end $$;

rollback;

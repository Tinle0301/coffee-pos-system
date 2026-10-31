-- stock_change_logging_check.sql — POS-63 checks
--
-- Verifies that inventory quantity changes are written to
-- inventory_stock_logs, including real checkout deductions.
--
-- Everything runs inside one transaction and rolls back at the end.

begin;

-- -------------------------------------------------------------------------
-- Fixtures
-- -------------------------------------------------------------------------

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

insert into menu_items (
  menu_item_identifier,
  menu_item_name,
  menu_item_category_type,
  menu_item_description_text,
  menu_item_price_amount,
  menu_item_availability_status
)
values (
  '63000000-0000-0000-0000-000000000001',
  'POS-63 Test Drink',
  'Coffee',
  'POS-63 stock logging test item',
  5.00,
  true
);

insert into inventory_items (
  inventory_item_identifier,
  inventory_item_name,
  available_quantity_value,
  minimum_stock_threshold
)
values (
  '63000000-0000-0000-0000-000000000002',
  'POS-63 Test Ingredient',
  10.00,
  2.00
);

-- Each drink uses 1.50 units of the test ingredient.
insert into menu_item_ingredients (
  menu_item_identifier,
  inventory_item_identifier,
  quantity_per_item_value
)
values (
  '63000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000002',
  1.50
);

-- Order contains two drinks.
-- Expected inventory consumption:
-- 2 * 1.50 = 3.00 units.
insert into orders (
  order_identifier,
  order_status_type,
  order_subtotal_amount,
  order_tax_amount,
  order_total_amount,
  created_by_staff_identifier
)
values (
  '63000000-0000-0000-0000-000000000003',
  'Pending',
  10.00,
  0.00,
  10.00,
  '63636363-0000-0000-0000-00000000000a'
);

insert into order_items (
  associated_order_identifier,
  associated_menu_item_identifier,
  ordered_item_quantity,
  item_price_amount
)
values (
  '63000000-0000-0000-0000-000000000003',
  '63000000-0000-0000-0000-000000000001',
  2,
  5.00
);


-- -------------------------------------------------------------------------
-- Authenticate test Admin
-- -------------------------------------------------------------------------

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"63636363-0000-0000-0000-00000000000a","role":"authenticated"}',
  true
);


-- -------------------------------------------------------------------------
-- 1. Real checkout deducts calculated inventory
-- -------------------------------------------------------------------------

select checkout_order(
  '63000000-0000-0000-0000-000000000003',
  'Cash',
  10.00,
  '[]'::jsonb
);

do $$
declare
  v_available numeric(10, 2);
begin
  select available_quantity_value
    into v_available
    from inventory_items
    where inventory_item_identifier =
      '63000000-0000-0000-0000-000000000002';

  if v_available is distinct from 7.00 then
    raise exception
      'FAIL 1: expected inventory quantity 7.00 after checkout, got %',
      v_available;
  end if;

  raise notice
    'PASS 1: checkout deducts inventory';
end $$;


-- -------------------------------------------------------------------------
-- 2. Checkout deduction creates the correct stock audit row
-- -------------------------------------------------------------------------

do $$
declare
  v_before numeric(10, 2);
  v_change numeric(10, 2);
  v_after numeric(10, 2);
  v_staff uuid;
begin
  select
    quantity_before_value,
    quantity_change_value,
    quantity_after_value,
    performed_by_staff_identifier
  into
    v_before,
    v_change,
    v_after,
    v_staff
  from inventory_stock_logs
  where inventory_item_identifier =
    '63000000-0000-0000-0000-000000000002'
    and quantity_change_value < 0
  order by inventory_stock_log_timestamp desc
  limit 1;

  if v_before is distinct from 10.00
     or v_change is distinct from -3.00
     or v_after is distinct from 7.00
     or v_staff is distinct from
       '63636363-0000-0000-0000-00000000000a'::uuid then
    raise exception
      'FAIL 2: checkout stock log values were incorrect';
  end if;

  raise notice
    'PASS 2: checkout deduction creates the correct stock log';
end $$;


-- -------------------------------------------------------------------------
-- 3. Restock still works and creates exactly one positive log
-- -------------------------------------------------------------------------

select *
from restock_inventory(
  '63000000-0000-0000-0000-000000000002',
  2.00
);

do $$
declare
  v_available numeric(10, 2);
  v_positive_count integer;
begin
  select available_quantity_value
    into v_available
    from inventory_items
    where inventory_item_identifier =
      '63000000-0000-0000-0000-000000000002';

  if v_available is distinct from 9.00 then
    raise exception
      'FAIL 3a: expected inventory quantity 9.00 after restock, got %',
      v_available;
  end if;

  select count(*)
    into v_positive_count
    from inventory_stock_logs
    where inventory_item_identifier =
      '63000000-0000-0000-0000-000000000002'
      and quantity_change_value > 0;

  if v_positive_count <> 1 then
    raise exception
      'FAIL 3b: expected exactly 1 positive restock log, found %',
      v_positive_count;
  end if;

  if not exists (
    select 1
    from inventory_stock_logs
    where inventory_item_identifier =
      '63000000-0000-0000-0000-000000000002'
      and quantity_before_value = 7.00
      and quantity_change_value = 2.00
      and quantity_after_value = 9.00
      and performed_by_staff_identifier =
        '63636363-0000-0000-0000-00000000000a'::uuid
  ) then
    raise exception
      'FAIL 3c: restock audit values were incorrect';
  end if;

  raise notice
    'PASS 3: restock creates exactly one correct stock log';
end $$;


-- -------------------------------------------------------------------------
-- 4. Other inventory quantity changes are automatically logged
-- -------------------------------------------------------------------------

update inventory_items
set available_quantity_value = 8.50
where inventory_item_identifier =
  '63000000-0000-0000-0000-000000000002';

do $$
begin
  if not exists (
    select 1
    from inventory_stock_logs
    where inventory_item_identifier =
      '63000000-0000-0000-0000-000000000002'
      and quantity_before_value = 9.00
      and quantity_change_value = -0.50
      and quantity_after_value = 8.50
      and performed_by_staff_identifier =
        '63636363-0000-0000-0000-00000000000a'::uuid
  ) then
    raise exception
      'FAIL 4: direct inventory quantity change was not logged correctly';
  end if;

  raise notice
    'PASS 4: other inventory quantity changes are automatically logged';
end $$;


-- -------------------------------------------------------------------------
-- 5. Positive and negative stock changes coexist in the same audit log
-- -------------------------------------------------------------------------

do $$
declare
  v_total_count integer;
  v_positive_count integer;
  v_negative_count integer;
begin
  select count(*)
    into v_total_count
    from inventory_stock_logs
    where inventory_item_identifier =
      '63000000-0000-0000-0000-000000000002';

  select count(*)
    into v_positive_count
    from inventory_stock_logs
    where inventory_item_identifier =
      '63000000-0000-0000-0000-000000000002'
      and quantity_change_value > 0;

  select count(*)
    into v_negative_count
    from inventory_stock_logs
    where inventory_item_identifier =
      '63000000-0000-0000-0000-000000000002'
      and quantity_change_value < 0;

  if v_total_count <> 3
     or v_positive_count <> 1
     or v_negative_count <> 2 then
    raise exception
      'FAIL 5: expected 3 logs (1 positive, 2 negative), got total %, positive %, negative %',
      v_total_count,
      v_positive_count,
      v_negative_count;
  end if;

  raise notice
    'PASS 5: positive and negative stock changes coexist in the stock log';
end $$;


-- -------------------------------------------------------------------------
-- 6. Updating a non-stock column does not create another audit row
-- -------------------------------------------------------------------------

update inventory_items
set inventory_last_updated_timestamp = now()
where inventory_item_identifier =
  '63000000-0000-0000-0000-000000000002';

do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from inventory_stock_logs
    where inventory_item_identifier =
      '63000000-0000-0000-0000-000000000002';

  if v_count <> 3 then
    raise exception
      'FAIL 6: non-stock update created an audit row; expected 3 logs, found %',
      v_count;
  end if;

  raise notice
    'PASS 6: non-stock updates do not create stock logs';
end $$;


rollback;

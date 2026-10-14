-- inventory_deduction_check.sql — POS-20 checks
--
-- Tests recipe calculation and automatic stock deduction during checkout.
-- Everything runs in one transaction and rolls back at the end.

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
  'cccccccc-2000-0000-0000-00000000000c',
  'POS-20 Test Admin',
  'Admin',
  'pos20.admin@example.test',
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
values
  (
    '12000000-0000-0000-0000-000000000001',
    'POS-20 Drip Coffee',
    'Coffee',
    'Test coffee',
    2.75,
    true
  ),
  (
    '12000000-0000-0000-0000-000000000002',
    'POS-20 Latte',
    'Coffee',
    'Test latte',
    4.50,
    true
  ),
  (
    '12000000-0000-0000-0000-000000000003',
    'POS-20 Muffin',
    'Pastry',
    'Test muffin',
    3.25,
    true
  );

insert into inventory_items (
  inventory_item_identifier,
  inventory_item_name,
  available_quantity_value,
  minimum_stock_threshold
)
values
  (
    '22000000-0000-0000-0000-000000000001',
    'POS-20 Espresso Beans',
    10.00,
    1.00
  ),
  (
    '22000000-0000-0000-0000-000000000002',
    'POS-20 Whole Milk',
    10.00,
    1.00
  ),
  (
    '22000000-0000-0000-0000-000000000003',
    'POS-20 Muffins',
    10.00,
    1.00
  );

-- Base recipes.
insert into menu_item_ingredients (
  menu_item_identifier,
  inventory_item_identifier,
  quantity_per_item_value
)
values
  -- Drip Coffee -> beans
  (
    '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    0.04
  ),

  -- Latte -> beans + milk
  (
    '12000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-000000000001',
    0.04
  ),
  (
    '12000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-000000000002',
    0.10
  ),

  -- Muffin -> one muffin
  (
    '12000000-0000-0000-0000-000000000003',
    '22000000-0000-0000-0000-000000000003',
    1.00
  );

-- One order:
--   1 Drip Coffee
--   2 Lattes
--   3 Muffins
--
-- Expected inventory consumption:
--   Beans   = 0.04 + (2 * 0.04) = 0.12
--   Milk    = 2 * 0.10          = 0.20
--   Muffins = 3 * 1.00          = 3.00
insert into orders (
  order_identifier,
  order_status_type,
  order_subtotal_amount,
  order_tax_amount,
  order_total_amount,
  created_by_staff_identifier
)
values (
  '32000000-0000-0000-0000-000000000001',
  'Pending',
  21.50,
  1.94,
  23.44,
  'cccccccc-2000-0000-0000-00000000000c'
);

insert into order_items (
  associated_order_identifier,
  associated_menu_item_identifier,
  ordered_item_quantity,
  item_price_amount
)
values
  (
    '32000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    1,
    2.75
  ),
  (
    '32000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000002',
    2,
    4.50
  ),
  (
    '32000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000003',
    3,
    3.25
  );

insert into queue_entries (
  associated_order_identifier,
  queue_entry_status_type
)
values (
  '32000000-0000-0000-0000-000000000001',
  'Pending'
);


-- -------------------------------------------------------------------------
-- 1. Recipe calculation
-- -------------------------------------------------------------------------

do $$
declare
  v_consumption jsonb;
  v_beans numeric;
  v_milk numeric;
  v_muffins numeric;
begin
  v_consumption :=
    order_inventory_consumption(
      '32000000-0000-0000-0000-000000000001'
    );

  select (item ->> 'quantity_consumed')::numeric
    into v_beans
    from jsonb_array_elements(v_consumption) item
    where item ->> 'inventory_item_id' =
      '22000000-0000-0000-0000-000000000001';

  select (item ->> 'quantity_consumed')::numeric
    into v_milk
    from jsonb_array_elements(v_consumption) item
    where item ->> 'inventory_item_id' =
      '22000000-0000-0000-0000-000000000002';

  select (item ->> 'quantity_consumed')::numeric
    into v_muffins
    from jsonb_array_elements(v_consumption) item
    where item ->> 'inventory_item_id' =
      '22000000-0000-0000-0000-000000000003';

  if v_beans is distinct from 0.12 then
    raise exception
      'FAIL 1a: expected 0.12 beans, got %', v_beans;
  end if;

  if v_milk is distinct from 0.20 then
    raise exception
      'FAIL 1b: expected 0.20 milk, got %', v_milk;
  end if;

  if v_muffins is distinct from 3.00 then
    raise exception
      'FAIL 1c: expected 3 muffins, got %', v_muffins;
  end if;

  raise notice
    'PASS 1: order_inventory_consumption calculates and combines recipe quantities';
end $$;


-- -------------------------------------------------------------------------
-- Authenticate the test admin for checkout_order()
-- -------------------------------------------------------------------------

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-2000-0000-0000-00000000000c","role":"authenticated"}',
  true
);


-- -------------------------------------------------------------------------
-- 2. Checkout with [] automatically deducts calculated inventory
-- -------------------------------------------------------------------------

select checkout_order(
  '32000000-0000-0000-0000-000000000001',
  'Cash',
  23.44,
  '[]'::jsonb
);

reset role;

do $$
declare
  v_beans numeric;
  v_milk numeric;
  v_muffins numeric;
begin
  select available_quantity_value
    into v_beans
    from inventory_items
    where inventory_item_identifier =
      '22000000-0000-0000-0000-000000000001';

  select available_quantity_value
    into v_milk
    from inventory_items
    where inventory_item_identifier =
      '22000000-0000-0000-0000-000000000002';

  select available_quantity_value
    into v_muffins
    from inventory_items
    where inventory_item_identifier =
      '22000000-0000-0000-0000-000000000003';

  if v_beans is distinct from 9.88 then
    raise exception
      'FAIL 2a: expected beans stock 9.88, got %', v_beans;
  end if;

  if v_milk is distinct from 9.80 then
    raise exception
      'FAIL 2b: expected milk stock 9.80, got %', v_milk;
  end if;

  if v_muffins is distinct from 7.00 then
    raise exception
      'FAIL 2c: expected muffin stock 7.00, got %', v_muffins;
  end if;

  raise notice
    'PASS 2: checkout with empty inventory array automatically deducts stock';
end $$;


-- -------------------------------------------------------------------------
-- 3. Payment was recorded
-- -------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
      from payments
      where associated_order_identifier =
        '32000000-0000-0000-0000-000000000001'
        and payment_completion_status = 'Completed'
        and payment_amount_value = 23.44
  ) then
    raise exception
      'FAIL 3: completed payment was not recorded';
  end if;

  raise notice
    'PASS 3: checkout records the completed payment';
end $$;


-- -------------------------------------------------------------------------
-- 4. Pay-first flow keeps the order open and in the queue
-- -------------------------------------------------------------------------

do $$
begin
  if (
    select order_status_type
      from orders
      where order_identifier =
        '32000000-0000-0000-0000-000000000001'
  ) <> 'Pending' then
    raise exception
      'FAIL 4a: checkout changed the order status';
  end if;

  if not exists (
    select 1
      from queue_entries
      where associated_order_identifier =
        '32000000-0000-0000-0000-000000000001'
        and queue_entry_status_type = 'Pending'
  ) then
    raise exception
      'FAIL 4b: paid order was removed from the queue';
  end if;

  raise notice
    'PASS 4: checkout deducts inventory without completing/removing the order';
end $$;


-- -------------------------------------------------------------------------
-- 5. Audit log was written
-- -------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
      from transaction_logs
      where associated_order_identifier =
        '32000000-0000-0000-0000-000000000001'
        and transaction_type_category = 'payment_processed'
        and performed_by_staff_identifier =
          'cccccccc-2000-0000-0000-00000000000c'
  ) then
    raise exception
      'FAIL 5: payment_processed transaction log was not written';
  end if;

  raise notice
    'PASS 5: checkout writes payment_processed audit log';
end $$;


rollback;
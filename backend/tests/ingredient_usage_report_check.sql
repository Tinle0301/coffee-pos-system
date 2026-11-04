-- ingredient_usage_report_check.sql — POS-78 checks
--
-- Tests the Admin-only ingredient usage report for a date range.
--
-- Everything runs inside one transaction and rolls back at the end.

begin;

-- -------------------------------------------------------------------------
-- Staff fixtures
-- -------------------------------------------------------------------------

insert into staff_accounts (
  staff_account_identifier,
  staff_full_name,
  staff_role_type,
  staff_email_address,
  staff_account_status
)
values
  (
    '78787878-0000-0000-0000-00000000000a',
    'POS-78 Test Admin',
    'Admin',
    'pos78.admin@example.test',
    true
  ),
  (
    '78787878-0000-0000-0000-00000000000b',
    'POS-78 Test Barista',
    'Barista',
    'pos78.barista@example.test',
    true
  );


-- -------------------------------------------------------------------------
-- Menu fixtures
-- -------------------------------------------------------------------------

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
    '78000000-0000-0000-0000-000000000001',
    'POS-78 Latte',
    'Coffee',
    'POS-78 usage test latte',
    5.00,
    true
  ),
  (
    '78000000-0000-0000-0000-000000000002',
    'POS-78 Drip Coffee',
    'Coffee',
    'POS-78 usage test drip coffee',
    3.00,
    true
  );


-- -------------------------------------------------------------------------
-- Inventory fixtures
-- -------------------------------------------------------------------------

insert into inventory_items (
  inventory_item_identifier,
  inventory_item_name,
  available_quantity_value,
  minimum_stock_threshold
)
values
  (
    '78000000-0000-0000-0000-000000000011',
    'POS-78 Espresso Beans',
    100.00,
    5.00
  ),
  (
    '78000000-0000-0000-0000-000000000012',
    'POS-78 Whole Milk',
    100.00,
    5.00
  ),
  (
    '78000000-0000-0000-0000-000000000013',
    'POS-78 Unused Ingredient',
    100.00,
    5.00
  );


-- -------------------------------------------------------------------------
-- Recipe fixtures
-- -------------------------------------------------------------------------

insert into menu_item_ingredients (
  menu_item_identifier,
  inventory_item_identifier,
  quantity_per_item_value
)
values
  (
    '78000000-0000-0000-0000-000000000001',
    '78000000-0000-0000-0000-000000000011',
    0.04
  ),
  (
    '78000000-0000-0000-0000-000000000001',
    '78000000-0000-0000-0000-000000000012',
    0.10
  ),
  (
    '78000000-0000-0000-0000-000000000002',
    '78000000-0000-0000-0000-000000000011',
    0.04
  );


-- -------------------------------------------------------------------------
-- Order 1: paid inside range
-- 2 Lattes -> 0.08 beans + 0.20 milk
-- -------------------------------------------------------------------------

insert into orders (
  order_identifier,
  order_status_type,
  order_subtotal_amount,
  order_tax_amount,
  order_total_amount,
  created_by_staff_identifier
)
values (
  '78000000-0000-0000-0000-000000000021',
  'Pending',
  10.00,
  0.00,
  10.00,
  '78787878-0000-0000-0000-00000000000a'
);

insert into order_items (
  associated_order_identifier,
  associated_menu_item_identifier,
  ordered_item_quantity,
  item_price_amount
)
values (
  '78000000-0000-0000-0000-000000000021',
  '78000000-0000-0000-0000-000000000001',
  2,
  5.00
);

insert into payments (
  associated_order_identifier,
  payment_method_type,
  payment_amount_value,
  payment_completion_status,
  payment_processing_timestamp
)
values (
  '78000000-0000-0000-0000-000000000021',
  'Cash',
  10.00,
  'Completed',
  '2026-11-01 10:00:00+00'
);


-- -------------------------------------------------------------------------
-- Order 2: paid on end date
-- 1 Drip Coffee -> 0.04 beans
--
-- Refunded still counts because the ingredient was physically consumed.
-- -------------------------------------------------------------------------

insert into orders (
  order_identifier,
  order_status_type,
  order_subtotal_amount,
  order_tax_amount,
  order_total_amount,
  created_by_staff_identifier
)
values (
  '78000000-0000-0000-0000-000000000022',
  'Pending',
  3.00,
  0.00,
  3.00,
  '78787878-0000-0000-0000-00000000000a'
);

insert into order_items (
  associated_order_identifier,
  associated_menu_item_identifier,
  ordered_item_quantity,
  item_price_amount
)
values (
  '78000000-0000-0000-0000-000000000022',
  '78000000-0000-0000-0000-000000000002',
  1,
  3.00
);

insert into payments (
  associated_order_identifier,
  payment_method_type,
  payment_amount_value,
  payment_completion_status,
  payment_processing_timestamp
)
values (
  '78000000-0000-0000-0000-000000000022',
  'Credit/Debit',
  3.00,
  'Refunded',
  '2026-11-03 04:00:00+00'
);


-- -------------------------------------------------------------------------
-- Order 3: outside requested range
-- Must not count.
-- -------------------------------------------------------------------------

insert into orders (
  order_identifier,
  order_status_type,
  order_subtotal_amount,
  order_tax_amount,
  order_total_amount,
  created_by_staff_identifier
)
values (
  '78000000-0000-0000-0000-000000000023',
  'Pending',
  25.00,
  0.00,
  25.00,
  '78787878-0000-0000-0000-00000000000a'
);

insert into order_items (
  associated_order_identifier,
  associated_menu_item_identifier,
  ordered_item_quantity,
  item_price_amount
)
values (
  '78000000-0000-0000-0000-000000000023',
  '78000000-0000-0000-0000-000000000001',
  5,
  5.00
);

insert into payments (
  associated_order_identifier,
  payment_method_type,
  payment_amount_value,
  payment_completion_status,
  payment_processing_timestamp
)
values (
  '78000000-0000-0000-0000-000000000023',
  'Cash',
  25.00,
  'Completed',
  '2026-11-03 12:00:00+00'
);


-- -------------------------------------------------------------------------
-- Order 4: unpaid order inside range
-- Must not count.
-- -------------------------------------------------------------------------

insert into orders (
  order_identifier,
  order_status_type,
  order_subtotal_amount,
  order_tax_amount,
  order_total_amount,
  created_by_staff_identifier
)
values (
  '78000000-0000-0000-0000-000000000024',
  'Pending',
  15.00,
  0.00,
  15.00,
  '78787878-0000-0000-0000-00000000000a'
);

insert into order_items (
  associated_order_identifier,
  associated_menu_item_identifier,
  ordered_item_quantity,
  item_price_amount
)
values (
  '78000000-0000-0000-0000-000000000024',
  '78000000-0000-0000-0000-000000000001',
  3,
  5.00
);


-- -------------------------------------------------------------------------
-- Authenticate Admin
-- -------------------------------------------------------------------------

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"78787878-0000-0000-0000-00000000000a","role":"authenticated"}',
  true
);


-- -------------------------------------------------------------------------
-- 1. Beans are aggregated across multiple paid orders
-- -------------------------------------------------------------------------

do $$
declare
  v_quantity numeric;
begin
  select quantity_used_value
    into v_quantity
    from ingredient_usage_report(
      '2026-11-01',
      '2026-11-02'
    )
    where inventory_item_identifier =
      '78000000-0000-0000-0000-000000000011';

  if v_quantity is distinct from 0.12 then
    raise exception
      'FAIL 1: expected bean usage 0.12, got %',
      v_quantity;
  end if;

  raise notice
    'PASS 1: ingredient usage aggregates across paid orders';
end $$;


-- -------------------------------------------------------------------------
-- 2. A second ingredient is calculated correctly
-- -------------------------------------------------------------------------

do $$
declare
  v_quantity numeric;
begin
  select quantity_used_value
    into v_quantity
    from ingredient_usage_report(
      '2026-11-01',
      '2026-11-02'
    )
    where inventory_item_identifier =
      '78000000-0000-0000-0000-000000000012';

  if v_quantity is distinct from 0.20 then
    raise exception
      'FAIL 2: expected milk usage 0.20, got %',
      v_quantity;
  end if;

  raise notice
    'PASS 2: usage is calculated correctly for each ingredient';
end $$;


-- -------------------------------------------------------------------------
-- 3. Unused ingredients are returned with zero usage
-- -------------------------------------------------------------------------

do $$
declare
  v_quantity numeric;
begin
  select quantity_used_value
    into v_quantity
    from ingredient_usage_report(
      '2026-11-01',
      '2026-11-02'
    )
    where inventory_item_identifier =
      '78000000-0000-0000-0000-000000000013';

  if v_quantity is distinct from 0 then
    raise exception
      'FAIL 3: expected unused ingredient usage 0, got %',
      v_quantity;
  end if;

  raise notice
    'PASS 3: unused ingredients are returned with zero usage';
end $$;


-- -------------------------------------------------------------------------
-- 4. Unpaid and out-of-range orders are excluded
-- -------------------------------------------------------------------------

do $$
declare
  v_beans numeric;
  v_milk numeric;
begin
  select quantity_used_value
    into v_beans
    from ingredient_usage_report(
      '2026-11-01',
      '2026-11-02'
    )
    where inventory_item_identifier =
      '78000000-0000-0000-0000-000000000011';

  select quantity_used_value
    into v_milk
    from ingredient_usage_report(
      '2026-11-01',
      '2026-11-02'
    )
    where inventory_item_identifier =
      '78000000-0000-0000-0000-000000000012';

  if v_beans is distinct from 0.12
     or v_milk is distinct from 0.20 then
    raise exception
      'FAIL 4: unpaid or out-of-range order affected usage';
  end if;

  raise notice
    'PASS 4: unpaid and out-of-range orders are excluded';
end $$;


-- -------------------------------------------------------------------------
-- 5. An 8 PM Los Angeles payment counts on its local calendar date
-- -------------------------------------------------------------------------

do $$
declare
  v_quantity numeric;
begin
  select quantity_used_value
    into v_quantity
    from ingredient_usage_report(
      '2026-11-02',
      '2026-11-02'
    )
    where inventory_item_identifier =
      '78000000-0000-0000-0000-000000000011';

  if v_quantity is distinct from 0.04 then
    raise exception
      'FAIL 5: expected 8 PM Los Angeles payment to produce 0.04 bean usage, got %',
      v_quantity;
  end if;

  raise notice
    'PASS 5: 8 PM Los Angeles payment counts on its local date';
end $$;


-- -------------------------------------------------------------------------
-- 6. Invalid date ranges are rejected
-- -------------------------------------------------------------------------

do $$
begin
  perform *
  from ingredient_usage_report(
    '2026-11-03',
    '2026-11-01'
  );

  raise exception
    'FAIL 6: invalid date range was accepted';

exception
  when others then
    if sqlerrm like 'INVALID_DATE_RANGE:%' then
      raise notice
        'PASS 6: invalid date range is rejected';
    else
      raise;
    end if;
end $$;


-- -------------------------------------------------------------------------
-- Authenticate Barista
-- -------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"78787878-0000-0000-0000-00000000000b","role":"authenticated"}',
  true
);


-- -------------------------------------------------------------------------
-- 7. Baristas cannot run the Admin report
-- -------------------------------------------------------------------------

do $$
begin
  perform *
  from ingredient_usage_report(
    '2026-11-01',
    '2026-11-02'
  );

  raise exception
    'FAIL 7: barista was allowed to run ingredient usage report';

exception
  when others then
    if sqlerrm like 'UNAUTHORIZED:%' then
      raise notice
        'PASS 7: barista cannot run ingredient usage report';
    else
      raise;
    end if;
end $$;


rollback;

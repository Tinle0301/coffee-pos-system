-- low_stock_inventory_check.sql — POS-57 checks
--
-- Tests the Admin-only database function for listing inventory items
-- that are at or below their configured minimum stock threshold.
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
values
  (
    '57575757-0000-0000-0000-00000000000a',
    'POS-57 Test Admin',
    'Admin',
    'pos57.admin@example.test',
    true
  ),
  (
    '57575757-0000-0000-0000-00000000000b',
    'POS-57 Test Barista',
    'Barista',
    'pos57.barista@example.test',
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
    '57000000-0000-0000-0000-000000000001',
    'POS-57 Below Threshold',
    2.00,
    5.00
  ),
  (
    '57000000-0000-0000-0000-000000000002',
    'POS-57 At Threshold',
    5.00,
    5.00
  ),
  (
    '57000000-0000-0000-0000-000000000003',
    'POS-57 Healthy Stock',
    10.00,
    5.00
  );

-- -------------------------------------------------------------------------
-- Admin checks
-- -------------------------------------------------------------------------

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"57575757-0000-0000-0000-00000000000a","role":"authenticated"}',
  true
);

-- 1. An item below its threshold is returned.
do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from list_low_stock_inventory()
    where inventory_item_identifier =
      '57000000-0000-0000-0000-000000000001';

  if v_count <> 1 then
    raise exception
      'FAIL 1: below-threshold inventory item was not returned';
  end if;

  raise notice
    'PASS 1: below-threshold inventory item is returned';
end $$;

-- 2. An item exactly at its threshold is also returned.
do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from list_low_stock_inventory()
    where inventory_item_identifier =
      '57000000-0000-0000-0000-000000000002';

  if v_count <> 1 then
    raise exception
      'FAIL 2: at-threshold inventory item was not returned';
  end if;

  raise notice
    'PASS 2: at-threshold inventory item is returned';
end $$;

-- 3. Healthy inventory is not returned.
do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from list_low_stock_inventory()
    where inventory_item_identifier =
      '57000000-0000-0000-0000-000000000003';

  if v_count <> 0 then
    raise exception
      'FAIL 3: healthy inventory item was incorrectly returned';
  end if;

  raise notice
    'PASS 3: healthy inventory item is excluded';
end $$;

-- 4. Returned values contain the expected stock information.
do $$
declare
  v_available numeric(10, 2);
  v_threshold numeric(10, 2);
begin
  select
    available_quantity_value,
    minimum_stock_threshold
  into
    v_available,
    v_threshold
  from list_low_stock_inventory()
  where inventory_item_identifier =
    '57000000-0000-0000-0000-000000000001';

  if v_available <> 2.00 or v_threshold <> 5.00 then
    raise exception
      'FAIL 4: returned stock values were incorrect';
  end if;

  raise notice
    'PASS 4: function returns the expected inventory values';
end $$;

-- -------------------------------------------------------------------------
-- Barista authorization check
-- -------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"57575757-0000-0000-0000-00000000000b","role":"authenticated"}',
  true
);

-- 5. A Barista cannot call the Admin-only function.
do $$
begin
  perform *
    from list_low_stock_inventory();

  raise exception
    'FAIL 5: barista was allowed to list low-stock inventory';

exception
  when others then
    if sqlerrm like 'UNAUTHORIZED:%' then
      raise notice
        'PASS 5: barista cannot list low-stock inventory';
    else
      raise;
    end if;
end $$;

rollback;

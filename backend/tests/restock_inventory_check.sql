-- restock_inventory_check.sql — POS-58 checks
--
-- Tests the Admin-only inventory restock function and verifies
-- that each successful restock writes an inventory stock audit log.
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
    '58585858-0000-0000-0000-00000000000a',
    'POS-58 Test Admin',
    'Admin',
    'pos58.admin@example.test',
    true
  ),
  (
    '58585858-0000-0000-0000-00000000000b',
    'POS-58 Test Barista',
    'Barista',
    'pos58.barista@example.test',
    true
  );

insert into inventory_items (
  inventory_item_identifier,
  inventory_item_name,
  available_quantity_value,
  minimum_stock_threshold,
  inventory_last_updated_timestamp
)
values (
  '58000000-0000-0000-0000-000000000001',
  'POS-58 Test Inventory',
  4.00,
  2.00,
  '2026-01-01 00:00:00+00'
);

-- -------------------------------------------------------------------------
-- Admin restock checks
-- -------------------------------------------------------------------------

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"58585858-0000-0000-0000-00000000000a","role":"authenticated"}',
  true
);

-- 1. Admin can restock an existing inventory item.
do $$
declare
  v_available numeric(10, 2);
begin
  select available_quantity_value
    into v_available
    from restock_inventory(
      '58000000-0000-0000-0000-000000000001',
      3.00
    );

  if v_available <> 7.00 then
    raise exception
      'FAIL 1: expected available quantity 7.00, got %',
      v_available;
  end if;

  raise notice
    'PASS 1: admin can restock an existing inventory item';
end $$;

-- 2. Inventory quantity was persisted correctly.
do $$
declare
  v_available numeric(10, 2);
begin
  select available_quantity_value
    into v_available
    from inventory_items
    where inventory_item_identifier =
      '58000000-0000-0000-0000-000000000001';

  if v_available <> 7.00 then
    raise exception
      'FAIL 2: inventory quantity was not updated correctly';
  end if;

  raise notice
    'PASS 2: inventory quantity increases by the requested amount';
end $$;

-- 3. Restocking updates the inventory timestamp.
do $$
declare
  v_updated timestamptz;
begin
  select inventory_last_updated_timestamp
    into v_updated
    from inventory_items
    where inventory_item_identifier =
      '58000000-0000-0000-0000-000000000001';

  if v_updated <= '2026-01-01 00:00:00+00'::timestamptz then
    raise exception
      'FAIL 3: inventory timestamp was not updated';
  end if;

  raise notice
    'PASS 3: restocking updates the inventory timestamp';
end $$;

-- 4. Successful restock writes the correct audit log.
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
    '58000000-0000-0000-0000-000000000001'
  order by inventory_stock_log_timestamp desc
  limit 1;

  if v_before <> 4.00
     or v_change <> 3.00
     or v_after <> 7.00
     or v_staff <>
       '58585858-0000-0000-0000-00000000000a'::uuid then
    raise exception
      'FAIL 4: inventory stock log values were incorrect';
  end if;

  raise notice
    'PASS 4: successful restock writes the correct stock audit log';
end $$;

-- -------------------------------------------------------------------------
-- Invalid quantity checks
-- -------------------------------------------------------------------------

-- 5. Zero restock quantity is rejected.
do $$
begin
  perform *
  from restock_inventory(
    '58000000-0000-0000-0000-000000000001',
    0
  );

  raise exception
    'FAIL 5: zero restock quantity was accepted';

exception
  when others then
    if sqlerrm like 'INVALID_QUANTITY:%' then
      raise notice
        'PASS 5: zero restock quantity is rejected';
    else
      raise;
    end if;
end $$;

-- 6. Negative restock quantity is rejected.
do $$
begin
  perform *
  from restock_inventory(
    '58000000-0000-0000-0000-000000000001',
    -1
  );

  raise exception
    'FAIL 6: negative restock quantity was accepted';

exception
  when others then
    if sqlerrm like 'INVALID_QUANTITY:%' then
      raise notice
        'PASS 6: negative restock quantity is rejected';
    else
      raise;
    end if;
end $$;

-- 7. Missing inventory item is rejected.
do $$
begin
  perform *
  from restock_inventory(
    '58000000-0000-0000-0000-000000000099',
    2.00
  );

  raise exception
    'FAIL 7: missing inventory item was accepted';

exception
  when others then
    if sqlerrm like 'INVENTORY_ITEM_NOT_FOUND:%' then
      raise notice
        'PASS 7: missing inventory item is rejected';
    else
      raise;
    end if;
end $$;

-- -------------------------------------------------------------------------
-- Barista authorization check
-- -------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"58585858-0000-0000-0000-00000000000b","role":"authenticated"}',
  true
);

-- 8. Barista cannot restock inventory.
do $$
begin
  perform *
  from restock_inventory(
    '58000000-0000-0000-0000-000000000001',
    2.00
  );

  raise exception
    'FAIL 8: barista was allowed to restock inventory';

exception
  when others then
    if sqlerrm like 'UNAUTHORIZED:%' then
      raise notice
        'PASS 8: barista cannot restock inventory';
    else
      raise;
    end if;
end $$;

-- Switch back to Admin so the audit log can be inspected.
select set_config(
  'request.jwt.claims',
  '{"sub":"58585858-0000-0000-0000-00000000000a","role":"authenticated"}',
  true
);

-- 9. Failed restocks did not create additional audit rows.
do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from inventory_stock_logs
    where inventory_item_identifier =
      '58000000-0000-0000-0000-000000000001';

  if v_count <> 1 then
    raise exception
      'FAIL 9: expected exactly 1 successful restock log, found %',
      v_count;
  end if;

  raise notice
    'PASS 9: failed restocks do not create audit rows';
end $$;

rollback;

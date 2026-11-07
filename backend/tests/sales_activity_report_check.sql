-- sales_activity_report_check.sql
-- POS-64 database integration and security tests.
--
-- Run only against the disposable local test database.
-- All test data is rolled back at the end.

begin;

-- =====================================================
-- PART 1: CREATE TEST STAFF AND MENU ITEMS
-- =====================================================

insert into staff_accounts (
  staff_account_identifier,
  staff_full_name,
  staff_role_type,
  staff_email_address,
  staff_account_status
)
values
  ('64646464-0000-0000-0000-00000000000a',
   'POS64 Admin', 'Admin', 'pos64.admin@test.invalid', true),

  ('64646464-0000-0000-0000-00000000000b',
   'POS64 Barista', 'Barista', 'pos64.barista@test.invalid', true),

  ('64646464-0000-0000-0000-00000000000c',
   'POS64 Inactive', 'Admin', 'pos64.inactive@test.invalid', false);


insert into menu_items (
  menu_item_identifier,
  menu_item_name,
  menu_item_category_type,
  menu_item_price_amount
)
values
  ('64000000-0000-0000-0000-000000000001',
   'POS64 Latte', 'Coffee', 5.00),

  ('64000000-0000-0000-0000-000000000002',
   'POS64 Drip', 'Coffee', 3.00),

  ('64000000-0000-0000-0000-000000000003',
   'POS64 Muffin', 'Food', 4.00);


-- =====================================================
-- PART 2: CREATE TEST ORDERS
-- =====================================================
--
-- A: paid June 15, second payment June 16
-- B: paid June 15
-- C: refunded, June 16 Pacific Time
-- D: unpaid
-- E: paid June 17, outside report range

insert into orders (
  order_identifier,
  created_by_staff_identifier,
  order_subtotal_amount,
  order_tax_amount,
  order_total_amount
)
select
  v.id,
  '64646464-0000-0000-0000-00000000000a'::uuid,
  20, 0, 20
from (values
  ('64000000-0000-0000-0000-000000000011'::uuid),
  ('64000000-0000-0000-0000-000000000012'::uuid),
  ('64000000-0000-0000-0000-000000000013'::uuid),
  ('64000000-0000-0000-0000-000000000014'::uuid),
  ('64000000-0000-0000-0000-000000000015'::uuid)
) as v(id);


insert into order_items (
  associated_order_identifier,
  associated_menu_item_identifier,
  ordered_item_quantity,
  item_price_amount
)
values
  -- Order A: 2 lattes, 1 muffin
  ('64000000-0000-0000-0000-000000000011',
   '64000000-0000-0000-0000-000000000001', 2, 5.00),

  ('64000000-0000-0000-0000-000000000011',
   '64000000-0000-0000-0000-000000000003', 1, 4.00),

  -- Order B: 1 latte, 4 drips
  ('64000000-0000-0000-0000-000000000012',
   '64000000-0000-0000-0000-000000000001', 1, 5.00),

  ('64000000-0000-0000-0000-000000000012',
   '64000000-0000-0000-0000-000000000002', 4, 3.00),

  -- Order C: 3 refunded lattes
  ('64000000-0000-0000-0000-000000000013',
   '64000000-0000-0000-0000-000000000001', 3, 5.00),

  -- Order D: 99 unpaid lattes, should NOT count
  ('64000000-0000-0000-0000-000000000014',
   '64000000-0000-0000-0000-000000000001', 99, 5.00),

  -- Order E: 99 drips outside range, should NOT count
  ('64000000-0000-0000-0000-000000000015',
   '64000000-0000-0000-0000-000000000002', 99, 3.00);


-- =====================================================
-- PART 3: CREATE PAYMENTS
-- =====================================================

insert into payments (
  associated_order_identifier,
  payment_method_type,
  payment_amount_value,
  payment_completion_status,
  payment_processing_timestamp
)
values
  -- Order A: June 15 at 09:05 PDT
  ('64000000-0000-0000-0000-000000000011',
   'Cash', 14, 'Completed', '2024-06-15 16:05:00+00'),

  -- Order A: another payment on June 16 at 15:00 PDT
  -- Must NOT cause the order to count again on June 16.
  ('64000000-0000-0000-0000-000000000011',
   'Cash', 1, 'Completed', '2024-06-16 22:00:00+00'),

  -- Order B: June 15 at 10:05 PDT
  ('64000000-0000-0000-0000-000000000012',
   'Cash', 17, 'Completed', '2024-06-15 17:05:00+00'),

  -- Order C: June 16 at 19:45 PDT
  -- The UTC calendar date is June 17.
  ('64000000-0000-0000-0000-000000000013',
   'Cash', 15, 'Refunded', '2024-06-17 02:45:00+00'),

  -- Order E: June 17 at 10:00 PDT
  ('64000000-0000-0000-0000-000000000015',
   'Cash', 297, 'Completed', '2024-06-17 17:00:00+00');


-- =====================================================
-- PART 4: TEST AS AN ADMIN
-- =====================================================

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"64646464-0000-0000-0000-00000000000a","role":"authenticated"}',
  true
);


-- TEST 1: Check quantities and item revenue.
do $$
declare
  latte record;
  drip record;
  muffin record;
begin
  select * into latte
  from best_selling_items_report('2024-06-15', '2024-06-16')
  where menu_item_name = 'POS64 Latte';

  select * into drip
  from best_selling_items_report('2024-06-15', '2024-06-16')
  where menu_item_name = 'POS64 Drip';

  select * into muffin
  from best_selling_items_report('2024-06-15', '2024-06-16')
  where menu_item_name = 'POS64 Muffin';

  if latte.quantity_sold is distinct from 6
     or latte.gross_item_revenue is distinct from 30
     or drip.quantity_sold is distinct from 4
     or drip.gross_item_revenue is distinct from 12
     or muffin.quantity_sold is distinct from 1 then
    raise exception 'FAIL 1: wrong item totals';
  end if;

  raise notice 'PASS 1: item quantities and gross revenue';
end $$;


-- TEST 2: Unpaid and out-of-range orders excluded.
do $$
declare
  n integer;
  top_item text;
begin
  select count(*) into n
  from best_selling_items_report('2024-06-15', '2024-06-16');

  select menu_item_name into top_item
  from best_selling_items_report('2024-06-15', '2024-06-16')
  limit 1;

  if n <> 3 or top_item <> 'POS64 Latte' then
    raise exception 'FAIL 2: incorrect items or ranking';
  end if;

  raise notice 'PASS 2: best-seller ranking and exclusions';
end $$;


-- TEST 3: Hourly order counting, not payment counting.
do $$
declare
  n bigint;
begin
  select order_count into n
  from busiest_hours_report('2024-06-15', '2024-06-15')
  where hour_of_day = 9;

  if n is distinct from 1 then
    raise exception 'FAIL 3: incorrect 9 AM count';
  end if;

  select order_count into n
  from busiest_hours_report('2024-06-15', '2024-06-15')
  where hour_of_day = 10;

  if n is distinct from 1 then
    raise exception 'FAIL 3: incorrect 10 AM count';
  end if;

  raise notice 'PASS 3: checkout hours count distinct orders';
end $$;


-- TEST 4: Cross-day payment must not repeat a sale.
do $$
declare
  total bigint;
  afternoon bigint;
begin
  select sum(order_count) into total
  from busiest_hours_report('2024-06-16', '2024-06-16');

  select order_count into afternoon
  from busiest_hours_report('2024-06-16', '2024-06-16')
  where hour_of_day = 15;

  if total is distinct from 1 or afternoon is distinct from 0 then
    raise exception 'FAIL 4: order repeated on second payment date';
  end if;

  raise notice 'PASS 4: cross-day duplicate payments excluded';
end $$;


-- TEST 5: Best sellers also use first payment date.
do $$
declare
  qty bigint;
  n integer;
begin
  select quantity_sold into qty
  from best_selling_items_report('2024-06-16', '2024-06-16')
  where menu_item_name = 'POS64 Latte';

  select count(*) into n
  from best_selling_items_report('2024-06-16', '2024-06-16');

  if qty is distinct from 3 or n <> 1 then
    raise exception 'FAIL 5: wrong daily best-seller totals';
  end if;

  raise notice 'PASS 5: daily best sellers use first checkout date';
end $$;


-- TEST 6: Pacific timezone boundary.
do $$
declare
  n bigint;
begin
  select order_count into n
  from busiest_hours_report('2024-06-16', '2024-06-16')
  where hour_of_day = 19;

  if n is distinct from 1 then
    raise exception 'FAIL 6: Pacific date boundary';
  end if;

  raise notice 'PASS 6: Pacific timezone boundaries';
end $$;


-- TEST 7: All 24 hours returned.
do $$
declare
  n integer;
  total bigint;
begin
  select count(*), sum(order_count)
    into n, total
  from busiest_hours_report('2024-06-15', '2024-06-16');

  if n <> 24 or total <> 3 then
    raise exception 'FAIL 7: hourly buckets/counts';
  end if;

  raise notice 'PASS 7: 24 hours and correct order total';
end $$;


-- TEST 8: Empty date ranges.
do $$
declare
  n integer;
  total bigint;
begin
  select count(*) into n
  from best_selling_items_report('2020-01-01', '2020-01-01');

  select sum(order_count) into total
  from busiest_hours_report('2020-01-01', '2020-01-01');

  if n <> 0 or total <> 0 then
    raise exception 'FAIL 8: empty range incorrect';
  end if;

  raise notice 'PASS 8: empty date ranges';
end $$;


-- TEST 9: Invalid date ranges rejected.
do $$
begin
  begin
    perform * from best_selling_items_report(
      '2024-06-17', '2024-06-15'
    );
    raise exception 'FAIL 9: reversed dates accepted';

  exception when others then
    if sqlerrm not like 'INVALID_DATE_RANGE:%' then
      raise;
    end if;
  end;

  begin
    perform * from busiest_hours_report(
      null, '2024-06-15'
    );
    raise exception 'FAIL 9: null date accepted';

  exception when others then
    if sqlerrm not like 'INVALID_DATE_RANGE:%' then
      raise;
    end if;
  end;

  raise notice 'PASS 9: invalid ranges rejected';
end $$;


-- =====================================================
-- PART 5: TEST AUTHORIZATION
-- =====================================================

-- Switch identity to Barista.
select set_config(
  'request.jwt.claims',
  '{"sub":"64646464-0000-0000-0000-00000000000b","role":"authenticated"}',
  true
);

-- TEST 10: Barista cannot run either report.
do $$
begin
  begin
    perform * from best_selling_items_report(
      '2024-06-15', '2024-06-16'
    );
    raise exception 'FAIL 10: barista accessed items';

  exception when others then
    if sqlerrm not like 'UNAUTHORIZED:%' then raise; end if;
  end;

  begin
    perform * from busiest_hours_report(
      '2024-06-15', '2024-06-16'
    );
    raise exception 'FAIL 10: barista accessed hours';

  exception when others then
    if sqlerrm not like 'UNAUTHORIZED:%' then raise; end if;
  end;

  raise notice 'PASS 10: Barista access denied';
end $$;


-- Switch identity to inactive Admin.
select set_config(
  'request.jwt.claims',
  '{"sub":"64646464-0000-0000-0000-00000000000c","role":"authenticated"}',
  true
);

-- TEST 11: Inactive admins denied.
do $$
begin
  begin
    perform * from best_selling_items_report(
      '2024-06-15', '2024-06-16'
    );
    raise exception 'FAIL 11: inactive admin accessed items';

  exception when others then
    if sqlerrm not like 'UNAUTHORIZED:%' then raise; end if;
  end;

  begin
    perform * from busiest_hours_report(
      '2024-06-15', '2024-06-16'
    );
    raise exception 'FAIL 11: inactive admin accessed hours';

  exception when others then
    if sqlerrm not like 'UNAUTHORIZED:%' then raise; end if;
  end;

  raise notice 'PASS 11: inactive Admin access denied';
end $$;


-- TEST 12: Anonymous role cannot execute functions.
set local role anon;

do $$
begin
  begin
    perform * from best_selling_items_report(
      '2024-06-15', '2024-06-16'
    );
    raise exception 'FAIL 12: anon accessed items';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform * from busiest_hours_report(
      '2024-06-15', '2024-06-16'
    );
    raise exception 'FAIL 12: anon accessed hours';
  exception when insufficient_privilege then
    null;
  end;

  raise notice 'PASS 12: anonymous execution denied';
end $$;


-- =====================================================
-- CLEANUP: discard all fixtures.
-- =====================================================

rollback;

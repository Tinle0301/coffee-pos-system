-- transaction_logs_check.sql — POS-33 checks
--
-- Tests admin transaction-log access plus filtering by order and date.
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
    '33333333-0000-0000-0000-00000000000a',
    'POS-33 Test Admin',
    'Admin',
    'pos33.admin@example.test',
    true
  ),
  (
    '33333333-0000-0000-0000-00000000000b',
    'POS-33 Test Barista',
    'Barista',
    'pos33.barista@example.test',
    true
  );

insert into orders (
  order_identifier,
  order_status_type,
  order_subtotal_amount,
  order_tax_amount,
  order_total_amount,
  created_by_staff_identifier
)
values
  (
    '33000000-0000-0000-0000-000000000001',
    'Completed',
    10.00,
    0.90,
    10.90,
    '33333333-0000-0000-0000-00000000000a'
  ),
  (
    '33000000-0000-0000-0000-000000000002',
    'Completed',
    5.00,
    0.45,
    5.45,
    '33333333-0000-0000-0000-00000000000a'
  );

insert into transaction_logs (
  transaction_log_identifier,
  associated_order_identifier,
  transaction_type_category,
  transaction_timestamp,
  performed_by_staff_identifier
)
values
  (
    '33100000-0000-0000-0000-000000000001',
    '33000000-0000-0000-0000-000000000001',
    'order_created',
    '2026-10-10 10:00:00+00',
    '33333333-0000-0000-0000-00000000000a'
  ),
  (
    '33100000-0000-0000-0000-000000000002',
    '33000000-0000-0000-0000-000000000001',
    'status_updated',
    '2026-10-11 12:00:00+00',
    '33333333-0000-0000-0000-00000000000a'
  ),
  (
    '33100000-0000-0000-0000-000000000003',
    '33000000-0000-0000-0000-000000000002',
    'order_created',
    '2026-10-12 09:00:00+00',
    '33333333-0000-0000-0000-00000000000a'
  ),
  (
    '33100000-0000-0000-0000-000000000004',
    '33000000-0000-0000-0000-000000000001',
    'payment_processed',
    '2026-10-13 15:00:00+00',
    '33333333-0000-0000-0000-00000000000a'
  );

-- Simulate an authenticated admin.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-0000-0000-0000-00000000000a","role":"authenticated"}',
  true
);

-- -------------------------------------------------------------------------
-- Admin checks
-- -------------------------------------------------------------------------

-- 1. Admin can read transaction logs.
do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from transaction_logs
    where transaction_log_identifier::text like '33100000-%';

  if v_count <> 4 then
    raise exception
      'FAIL 1: admin sees % of 4 transaction logs',
      v_count;
  end if;

  raise notice
    'PASS 1: admin can read transaction logs';
end $$;

-- 2. Filter by order identifier.
do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from transaction_logs
    where associated_order_identifier =
      '33000000-0000-0000-0000-000000000001';

  if v_count <> 3 then
    raise exception
      'FAIL 2: order filter returned % rows, expected 3',
      v_count;
  end if;

  raise notice
    'PASS 2: transaction logs can be filtered by order';
end $$;

-- 3. Filter from a starting timestamp.
do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from transaction_logs
    where transaction_log_identifier::text like '33100000-%'
      and transaction_timestamp >=
        '2026-10-12 00:00:00+00';

  if v_count <> 2 then
    raise exception
      'FAIL 3: from filter returned % rows, expected 2',
      v_count;
  end if;

  raise notice
    'PASS 3: transaction logs can be filtered from a date';
end $$;

-- 4. Filter through an ending timestamp.
do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from transaction_logs
    where transaction_log_identifier::text like '33100000-%'
      and transaction_timestamp <=
        '2026-10-11 23:59:59+00';

  if v_count <> 2 then
    raise exception
      'FAIL 4: to filter returned % rows, expected 2',
      v_count;
  end if;

  raise notice
    'PASS 4: transaction logs can be filtered through a date';
end $$;

-- 5. Newest transaction appears first when ordered descending.
do $$
declare
  v_type text;
begin
  select transaction_type_category
    into v_type
    from transaction_logs
    where transaction_log_identifier::text like '33100000-%'
    order by transaction_timestamp desc
    limit 1;

  if v_type <> 'payment_processed' then
    raise exception
      'FAIL 5: newest transaction was %, expected payment_processed',
      v_type;
  end if;

  raise notice
    'PASS 5: transaction logs sort newest first';
end $$;

-- -------------------------------------------------------------------------
-- Barista access check
-- -------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-0000-0000-0000-00000000000b","role":"authenticated"}',
  true
);

-- 6. Baristas cannot read transaction logs.
do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from transaction_logs
    where transaction_log_identifier::text like '33100000-%';

  if v_count <> 0 then
    raise exception
      'FAIL 6: barista can read % transaction logs',
      v_count;
  end if;

  raise notice
    'PASS 6: barista cannot read transaction logs';
end $$;

rollback;
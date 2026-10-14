-- order_status_check.sql — POS-21 checks
--
-- Tests update_order_status transition rules, payment requirements,
-- queue synchronization, and transaction logging.
--
-- Everything runs inside one transaction and rolls back at the end.

begin;

-- -------------------------------------------------------------------------
-- Fixtures
-- -------------------------------------------------------------------------

-- Use an admin for this test so RLS does not hide transaction_logs.
-- POS-17 has its own separate tests for role/ownership authorization.
insert into staff_accounts (
  staff_account_identifier,
  staff_full_name,
  staff_role_type,
  staff_email_address,
  staff_account_status
)
values (
  'cccccccc-0000-0000-0000-00000000000c',
  'POS-21 Test Admin',
  'Admin',
  'pos21.admin@example.test',
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
  -- 1. Pending -> In Progress
  ('21000000-0000-0000-0000-000000000001',
   'Pending', 10, 0.90, 10.90,
   'cccccccc-0000-0000-0000-00000000000c'),

  -- 2. In Progress -> Completed, paid
  ('21000000-0000-0000-0000-000000000002',
   'In Progress', 10, 0.90, 10.90,
   'cccccccc-0000-0000-0000-00000000000c'),

  -- 3. Pending -> Cancelled, unpaid
  ('21000000-0000-0000-0000-000000000003',
   'Pending', 10, 0.90, 10.90,
   'cccccccc-0000-0000-0000-00000000000c'),

  -- 4. In Progress -> Cancelled, unpaid
  ('21000000-0000-0000-0000-000000000004',
   'In Progress', 10, 0.90, 10.90,
   'cccccccc-0000-0000-0000-00000000000c'),

  -- 5. In Progress -> Completed, unpaid (blocked)
  ('21000000-0000-0000-0000-000000000005',
   'In Progress', 10, 0.90, 10.90,
   'cccccccc-0000-0000-0000-00000000000c'),

  -- 6. Pending -> Cancelled, paid (blocked)
  ('21000000-0000-0000-0000-000000000006',
   'Pending', 10, 0.90, 10.90,
   'cccccccc-0000-0000-0000-00000000000c'),

  -- 7. In Progress -> Cancelled, paid (blocked)
  ('21000000-0000-0000-0000-000000000007',
   'In Progress', 10, 0.90, 10.90,
   'cccccccc-0000-0000-0000-00000000000c'),

  -- 8. Pending -> Completed (skip, blocked)
  ('21000000-0000-0000-0000-000000000008',
   'Pending', 10, 0.90, 10.90,
   'cccccccc-0000-0000-0000-00000000000c'),

  -- 9. In Progress -> Pending (reverse, blocked)
  ('21000000-0000-0000-0000-000000000009',
   'In Progress', 10, 0.90, 10.90,
   'cccccccc-0000-0000-0000-00000000000c'),

  -- 10. Completed -> Pending (reopen, blocked)
  ('21000000-0000-0000-0000-000000000010',
   'Completed', 10, 0.90, 10.90,
   'cccccccc-0000-0000-0000-00000000000c'),

  -- 11. Cancelled -> Pending (reopen, blocked)
  ('21000000-0000-0000-0000-000000000011',
   'Cancelled', 10, 0.90, 10.90,
   'cccccccc-0000-0000-0000-00000000000c');


-- Active orders need queue rows.
insert into queue_entries (
  associated_order_identifier,
  queue_entry_status_type
)
values
  ('21000000-0000-0000-0000-000000000001', 'Pending'),
  ('21000000-0000-0000-0000-000000000002', 'In Progress'),
  ('21000000-0000-0000-0000-000000000003', 'Pending'),
  ('21000000-0000-0000-0000-000000000004', 'In Progress'),
  ('21000000-0000-0000-0000-000000000005', 'In Progress'),
  ('21000000-0000-0000-0000-000000000006', 'Pending'),
  ('21000000-0000-0000-0000-000000000007', 'In Progress'),
  ('21000000-0000-0000-0000-000000000008', 'Pending'),
  ('21000000-0000-0000-0000-000000000009', 'In Progress');


-- Paid fixtures.
insert into payments (
  payment_transaction_identifier,
  associated_order_identifier,
  payment_method_type,
  payment_amount_value,
  payment_completion_status
)
values
  ('22000000-0000-0000-0000-000000000002',
   '21000000-0000-0000-0000-000000000002',
   'Cash', 10.90, 'Completed'),

  ('22000000-0000-0000-0000-000000000006',
   '21000000-0000-0000-0000-000000000006',
   'Cash', 10.90, 'Completed'),

  ('22000000-0000-0000-0000-000000000007',
   '21000000-0000-0000-0000-000000000007',
   'Cash', 10.90, 'Completed');


-- Simulate an authenticated admin using the RPC.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}',
  true
);


-- -------------------------------------------------------------------------
-- Allowed transitions
-- -------------------------------------------------------------------------

-- 1. Pending -> In Progress -----------------------------------------------
select update_order_status(
  '21000000-0000-0000-0000-000000000001',
  'In Progress'
);

do $$
declare
  v_status text;
  v_queue_status text;
  v_log_count integer;
begin
  select order_status_type
    into v_status
    from orders
    where order_identifier =
      '21000000-0000-0000-0000-000000000001';

  select queue_entry_status_type
    into v_queue_status
    from queue_entries
    where associated_order_identifier =
      '21000000-0000-0000-0000-000000000001';

  select count(*)
    into v_log_count
    from transaction_logs
    where associated_order_identifier =
            '21000000-0000-0000-0000-000000000001'
      and transaction_type_category = 'status_updated'
      and performed_by_staff_identifier =
            'cccccccc-0000-0000-0000-00000000000c';

  if v_status <> 'In Progress' then
    raise exception 'FAIL 1: order status is %, expected In Progress',
      v_status;
  end if;

  if v_queue_status <> 'In Progress' then
    raise exception 'FAIL 1: queue status is %, expected In Progress',
      v_queue_status;
  end if;

  if v_log_count <> 1 then
    raise exception 'FAIL 1: expected one status_updated log, found %',
      v_log_count;
  end if;

  raise notice
    'PASS 1: Pending -> In Progress updates order, queue, and log';
end $$;


-- 2. Paid In Progress -> Completed ----------------------------------------
select update_order_status(
  '21000000-0000-0000-0000-000000000002',
  'Completed'
);

do $$
declare
  v_status text;
  v_log_count integer;
begin
  select order_status_type
    into v_status
    from orders
    where order_identifier =
      '21000000-0000-0000-0000-000000000002';

  select count(*)
    into v_log_count
    from transaction_logs
    where associated_order_identifier =
            '21000000-0000-0000-0000-000000000002'
      and transaction_type_category = 'status_updated';

  if v_status <> 'Completed' then
    raise exception 'FAIL 2: expected Completed, found %', v_status;
  end if;

  if exists (
    select 1
      from queue_entries
      where associated_order_identifier =
        '21000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'FAIL 2: completed order remained in queue';
  end if;

  if v_log_count <> 1 then
    raise exception 'FAIL 2: expected one status_updated log, found %',
      v_log_count;
  end if;

  raise notice
    'PASS 2: paid In Progress -> Completed removes queue row and logs';
end $$;


-- 3. Unpaid Pending -> Cancelled ------------------------------------------
select update_order_status(
  '21000000-0000-0000-0000-000000000003',
  'Cancelled'
);

do $$
begin
  if (
    select order_status_type
      from orders
      where order_identifier =
        '21000000-0000-0000-0000-000000000003'
  ) <> 'Cancelled' then
    raise exception 'FAIL 3: order was not cancelled';
  end if;

  if exists (
    select 1
      from queue_entries
      where associated_order_identifier =
        '21000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'FAIL 3: cancelled order remained in queue';
  end if;

  raise notice
    'PASS 3: unpaid Pending -> Cancelled succeeds and leaves queue';
end $$;


-- 4. Unpaid In Progress -> Cancelled --------------------------------------
select update_order_status(
  '21000000-0000-0000-0000-000000000004',
  'Cancelled'
);

do $$
begin
  if (
    select order_status_type
      from orders
      where order_identifier =
        '21000000-0000-0000-0000-000000000004'
  ) <> 'Cancelled' then
    raise exception 'FAIL 4: In Progress order was not cancelled';
  end if;

  if exists (
    select 1
      from queue_entries
      where associated_order_identifier =
        '21000000-0000-0000-0000-000000000004'
  ) then
    raise exception 'FAIL 4: cancelled order remained in queue';
  end if;

  raise notice
    'PASS 4: unpaid In Progress -> Cancelled succeeds';
end $$;


-- -------------------------------------------------------------------------
-- Blocked transitions
-- -------------------------------------------------------------------------

-- 5. Unpaid In Progress -> Completed must fail with NOT_PAID --------------
do $$
begin
  begin
    perform update_order_status(
      '21000000-0000-0000-0000-000000000005',
      'Completed'
    );

    raise exception
      'FAIL 5: unpaid In Progress order was completed';

  exception when others then
    if position('NOT_PAID' in sqlerrm) = 0 then
      raise exception
        'FAIL 5: expected NOT_PAID, got %', sqlerrm;
    end if;

    raise notice
      'PASS 5: unpaid In Progress -> Completed raises NOT_PAID';
  end;
end $$;


-- 6. Paid Pending -> Cancelled must fail with ALREADY_PAID ----------------
do $$
begin
  begin
    perform update_order_status(
      '21000000-0000-0000-0000-000000000006',
      'Cancelled'
    );

    raise exception
      'FAIL 6: paid Pending order was cancelled';

  exception when others then
    if position('ALREADY_PAID' in sqlerrm) = 0 then
      raise exception
        'FAIL 6: expected ALREADY_PAID, got %', sqlerrm;
    end if;

    raise notice
      'PASS 6: paid Pending -> Cancelled raises ALREADY_PAID';
  end;
end $$;


-- 7. Paid In Progress -> Cancelled must fail with ALREADY_PAID -----------
do $$
begin
  begin
    perform update_order_status(
      '21000000-0000-0000-0000-000000000007',
      'Cancelled'
    );

    raise exception
      'FAIL 7: paid In Progress order was cancelled';

  exception when others then
    if position('ALREADY_PAID' in sqlerrm) = 0 then
      raise exception
        'FAIL 7: expected ALREADY_PAID, got %', sqlerrm;
    end if;

    raise notice
      'PASS 7: paid In Progress -> Cancelled raises ALREADY_PAID';
  end;
end $$;


-- 8. Pending -> Completed cannot skip In Progress -------------------------
do $$
begin
  begin
    perform update_order_status(
      '21000000-0000-0000-0000-000000000008',
      'Completed'
    );

    raise exception
      'FAIL 8: Pending order skipped directly to Completed';

  exception when others then
    if position('INVALID_TRANSITION' in sqlerrm) = 0 then
      raise exception
        'FAIL 8: expected INVALID_TRANSITION, got %', sqlerrm;
    end if;

    raise notice
      'PASS 8: Pending -> Completed raises INVALID_TRANSITION';
  end;
end $$;


-- 9. In Progress -> Pending cannot move backward --------------------------
do $$
begin
  begin
    perform update_order_status(
      '21000000-0000-0000-0000-000000000009',
      'Pending'
    );

    raise exception
      'FAIL 9: In Progress order moved backward to Pending';

  exception when others then
    if position('INVALID_TRANSITION' in sqlerrm) = 0 then
      raise exception
        'FAIL 9: expected INVALID_TRANSITION, got %', sqlerrm;
    end if;

    raise notice
      'PASS 9: In Progress -> Pending raises INVALID_TRANSITION';
  end;
end $$;


-- 10. Completed order cannot be reopened ---------------------------------
do $$
begin
  begin
    perform update_order_status(
      '21000000-0000-0000-0000-000000000010',
      'Pending'
    );

    raise exception
      'FAIL 10: Completed order was reopened';

  exception when others then
    if position('INVALID_TRANSITION' in sqlerrm) = 0 then
      raise exception
        'FAIL 10: expected INVALID_TRANSITION, got %', sqlerrm;
    end if;

    raise notice
      'PASS 10: Completed -> Pending raises INVALID_TRANSITION';
  end;
end $$;


-- 11. Cancelled order cannot be reopened ---------------------------------
do $$
begin
  begin
    perform update_order_status(
      '21000000-0000-0000-0000-000000000011',
      'Pending'
    );

    raise exception
      'FAIL 11: Cancelled order was reopened';

  exception when others then
    if position('INVALID_TRANSITION' in sqlerrm) = 0 then
      raise exception
        'FAIL 11: expected INVALID_TRANSITION, got %', sqlerrm;
    end if;

    raise notice
      'PASS 11: Cancelled -> Pending raises INVALID_TRANSITION';
  end;
end $$;


-- 12. Missing order must raise ORDER_NOT_FOUND ----------------------------
do $$
begin
  begin
    perform update_order_status(
      '21000000-0000-0000-0000-999999999999',
      'In Progress'
    );

    raise exception
      'FAIL 12: nonexistent order was accepted';

  exception when others then
    if position('ORDER_NOT_FOUND' in sqlerrm) = 0 then
      raise exception
        'FAIL 12: expected ORDER_NOT_FOUND, got %', sqlerrm;
    end if;

    raise notice
      'PASS 12: nonexistent order raises ORDER_NOT_FOUND';
  end;
end $$;


rollback;
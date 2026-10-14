-- queue_indexes_check.sql — POS-22 checks
--
-- Verifies that the queue and transaction-log indexes required by POS-22
-- exist with the expected indexed columns.

begin;

-- -------------------------------------------------------------------------
-- 1. Queue status + timestamp index
-- -------------------------------------------------------------------------

do $$
declare
  v_definition text;
begin
  select indexdef
    into v_definition
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'queue_entries'
      and indexname = 'idx_queue_status_time';

  if v_definition is null then
    raise exception
      'FAIL 1: idx_queue_status_time does not exist';
  end if;

  if position(
    '(queue_entry_status_type, queue_entry_timestamp)'
    in v_definition
  ) = 0 then
    raise exception
      'FAIL 1: idx_queue_status_time has unexpected definition: %',
      v_definition;
  end if;

  raise notice
    'PASS 1: idx_queue_status_time exists with status + timestamp columns';
end $$;


-- -------------------------------------------------------------------------
-- 2. Queue order index
-- -------------------------------------------------------------------------

do $$
declare
  v_definition text;
begin
  select indexdef
    into v_definition
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'queue_entries'
      and indexname = 'idx_queue_order';

  if v_definition is null then
    raise exception
      'FAIL 2: idx_queue_order does not exist';
  end if;

  if position(
    '(associated_order_identifier)'
    in v_definition
  ) = 0 then
    raise exception
      'FAIL 2: idx_queue_order has unexpected definition: %',
      v_definition;
  end if;

  raise notice
    'PASS 2: idx_queue_order exists on associated_order_identifier';
end $$;


-- -------------------------------------------------------------------------
-- 3. Transaction-log order index
-- -------------------------------------------------------------------------

do $$
declare
  v_definition text;
begin
  select indexdef
    into v_definition
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'transaction_logs'
      and indexname = 'idx_logs_order';

  if v_definition is null then
    raise exception
      'FAIL 3: idx_logs_order does not exist';
  end if;

  if position(
    '(associated_order_identifier)'
    in v_definition
  ) = 0 then
    raise exception
      'FAIL 3: idx_logs_order has unexpected definition: %',
      v_definition;
  end if;

  raise notice
    'PASS 3: idx_logs_order exists on associated_order_identifier';
end $$;


-- -------------------------------------------------------------------------
-- 4. Transaction-log timestamp index
-- -------------------------------------------------------------------------

do $$
declare
  v_definition text;
begin
  select indexdef
    into v_definition
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'transaction_logs'
      and indexname = 'idx_logs_time';

  if v_definition is null then
    raise exception
      'FAIL 4: idx_logs_time does not exist';
  end if;

  if position(
    '(transaction_timestamp)'
    in v_definition
  ) = 0 then
    raise exception
      'FAIL 4: idx_logs_time has unexpected definition: %',
      v_definition;
  end if;

  raise notice
    'PASS 4: idx_logs_time exists on transaction_timestamp';
end $$;


rollback;
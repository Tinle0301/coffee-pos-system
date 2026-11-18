#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="$(
  docker ps --format '{{.Names}}' |
  grep '^supabase_db_' |
  head -n 1 || true
)"

if [[ -z "${DB_CONTAINER}" ]]; then
  echo "FAIL: local Supabase database container is not running."
  exit 1
fi

echo "Using local database container: ${DB_CONTAINER}"

EXISTING="$(
  docker exec -i "${DB_CONTAINER}" \
    psql -At -U postgres -d postgres -c "
      select
        (select count(*) from staff_accounts
         where staff_account_identifier::text like
           '65000000-0000-0000-0001-%')
        +
        (select count(*) from menu_items
         where menu_item_identifier =
           '65000000-0000-0000-0002-000000000001');
    "
)"

if [[ "${EXISTING}" != "0" ]]; then
  echo "FAIL: POS-65 benchmark data already exists."
  echo "Run 'supabase db reset' before rerunning this benchmark."
  exit 1
fi

echo
echo "Setting up POS-65 benchmark fixtures..."

docker exec -i "${DB_CONTAINER}" \
  psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'

insert into staff_accounts (
  staff_account_identifier,
  staff_full_name,
  staff_role_type,
  staff_email_address,
  staff_account_status
)
select
  (
    '65000000-0000-0000-0001-' ||
    lpad(n::text, 12, '0')
  )::uuid,
  'POS-65 Benchmark Barista ' || lpad(n::text, 3, '0'),
  'Barista',
  'pos65-benchmark-' || lpad(n::text, 3, '0') || '@example.test',
  true
from generate_series(1, 100) as benchmark(n);

insert into menu_items (
  menu_item_identifier,
  menu_item_name,
  menu_item_category_type,
  menu_item_description_text,
  menu_item_price_amount,
  menu_item_availability_status
)
values (
  '65000000-0000-0000-0002-000000000001',
  'POS-65 Benchmark Coffee',
  'Coffee',
  'Local POS-65 performance benchmark item',
  4.50,
  true
);

SQL

docker cp \
  scripts/order-creation-benchmark.pgbench \
  "${DB_CONTAINER}:/tmp/order-creation-benchmark.pgbench"

echo
echo "======================================================"
echo "BASELINE: 1 client, 10 order creations"
echo "SRS latency limit: 2000 ms"
echo "======================================================"

docker exec "${DB_CONTAINER}" \
  pgbench \
  -n \
  -U postgres \
  -c 1 \
  -j 1 \
  -t 10 \
  -D staff_offset=100 \
  --latency-limit=2000 \
  -f /tmp/order-creation-benchmark.pgbench \
  postgres

echo
echo "======================================================"
echo "CONCURRENCY/CAPACITY: 10 clients x 10 orders"
echo "Expected result: 100 active orders"
echo "======================================================"

docker exec "${DB_CONTAINER}" \
  pgbench \
  -n \
  -U postgres \
  -c 10 \
  -j 10 \
  -t 10 \
  -D staff_offset=1 \
  --latency-limit=2000 \
  -f /tmp/order-creation-benchmark.pgbench \
  postgres

echo
echo "======================================================"
echo "VERIFYING 100 CONCURRENT ACTIVE ORDERS"
echo "======================================================"

docker exec -i "${DB_CONTAINER}" \
  psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'

do $$
declare
  v_orders integer;
  v_pending integer;
  v_items integer;
  v_queue integer;
  v_logs integer;
  v_staff integer;
begin
  select count(*)
  into v_orders
  from orders
  where right(created_by_staff_identifier::text, 12)::bigint
        between 1 and 10
    and created_by_staff_identifier::text like
        '65000000-0000-0000-0001-%';

  select count(*)
  into v_pending
  from orders
  where right(created_by_staff_identifier::text, 12)::bigint
        between 1 and 10
    and created_by_staff_identifier::text like
        '65000000-0000-0000-0001-%'
    and order_status_type = 'Pending';

  select count(*)
  into v_items
  from order_items oi
  join orders o
    on o.order_identifier = oi.associated_order_identifier
  where right(o.created_by_staff_identifier::text, 12)::bigint
        between 1 and 10
    and o.created_by_staff_identifier::text like
        '65000000-0000-0000-0001-%';

  select count(*)
  into v_queue
  from queue_entries q
  join orders o
    on o.order_identifier = q.associated_order_identifier
  where right(o.created_by_staff_identifier::text, 12)::bigint
        between 1 and 10
    and o.created_by_staff_identifier::text like
        '65000000-0000-0000-0001-%';

  select count(*)
  into v_logs
  from transaction_logs t
  join orders o
    on o.order_identifier = t.associated_order_identifier
  where right(o.created_by_staff_identifier::text, 12)::bigint
        between 1 and 10
    and o.created_by_staff_identifier::text like
        '65000000-0000-0000-0001-%'
    and t.transaction_type_category = 'order_created';

  select count(distinct created_by_staff_identifier)
  into v_staff
  from orders
  where right(created_by_staff_identifier::text, 12)::bigint
        between 1 and 10
    and created_by_staff_identifier::text like
        '65000000-0000-0000-0001-%';

  raise notice 'Orders: % / 100', v_orders;
  raise notice 'Pending orders: % / 100', v_pending;
  raise notice 'Order items: % / 100', v_items;
  raise notice 'Queue entries: % / 100', v_queue;
  raise notice 'Order-created logs: % / 100', v_logs;
  raise notice 'Concurrent staff used: % / 10', v_staff;

  if v_orders <> 100
     or v_pending <> 100
     or v_items <> 100
     or v_queue <> 100
     or v_logs <> 100
     or v_staff <> 10 then
    raise exception 'FAIL: POS-65 capacity verification failed';
  end if;

  raise notice
    'PASS: 100 active orders created by 10 concurrent staff without data conflicts';
end $$;

SQL

echo
echo "POS-65 benchmark complete."
echo "Run 'supabase db reset' afterward to remove benchmark data."

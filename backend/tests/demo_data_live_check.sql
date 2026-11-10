-- demo_data_live_check.sql — POS-62 checks
--
-- Runs scripts/demo-data-live.sql twice on the test database and checks
-- that it loads a complete, consistent batch and that the second run adds
-- nothing. Run from the repo root (scripts/run-sql-checks.sh does):
--   psql "<connection-string>" -f backend/tests/demo_data_live_check.sql
-- Everything runs inside one transaction and is rolled back at the end.

begin;

-- ids of today's batch, the same way the script makes them
create temp table demo_ids as
select n,
       md5('pos62-' || to_char(now() at time zone 'America/Los_Angeles', 'YYYY-MM-DD') || '-order-' || n)::uuid as order_id
from generate_series(1, 14) n;

-- yesterday's batch left an unpaid demo order on the queue
insert into orders (order_identifier, order_status_type, order_subtotal_amount, order_tax_amount,
                    order_total_amount, order_creation_timestamp, created_by_staff_identifier)
select md5('pos62-' || to_char((now() at time zone 'America/Los_Angeles')::date - 1, 'YYYY-MM-DD') || '-order-13')::uuid,
       'Pending', 8.75, 0.79, 9.54, now() - interval '1 day', staff_account_identifier
from staff_accounts where staff_role_type = 'Barista' and staff_account_status limit 1;

insert into queue_entries (associated_order_identifier, queue_entry_status_type)
values (md5('pos62-' || to_char((now() at time zone 'America/Los_Angeles')::date - 1, 'YYYY-MM-DD') || '-order-13')::uuid, 'Pending');

\i scripts/demo-data-live.sql

-- 1. a full batch: 14 orders with the right statuses --------------------------
do $$
declare
  v_counts text;
begin
  select string_agg(order_status_type || '=' || c, ', ' order by order_status_type) into v_counts
  from (select o.order_status_type, count(*) c
        from orders o join demo_ids d on d.order_id = o.order_identifier
        group by 1) s;
  if v_counts is distinct from 'Cancelled=1, Completed=11, In Progress=1, Pending=1' then
    raise exception 'FAIL 1: expected 11 Completed, 1 Cancelled, 1 Pending, 1 In Progress, got %', v_counts;
  end if;
  raise notice 'PASS 1: 14 demo orders with the right statuses';
end $$;

-- 2. every paid order has exactly one payment equal to its total --------------
do $$
declare
  v_paid integer;
  v_bad  integer;
begin
  select count(*) into v_paid
  from payments p join demo_ids d on d.order_id = p.associated_order_identifier;

  select count(*) into v_bad
  from orders o
  join demo_ids d on d.order_id = o.order_identifier
  join payments p on p.associated_order_identifier = o.order_identifier
  where p.payment_amount_value <> o.order_total_amount;

  if v_paid <> 12 or v_bad <> 0 then
    raise exception 'FAIL 2: expected 12 payments matching their order totals, got % payments, % wrong', v_paid, v_bad;
  end if;
  raise notice 'PASS 2: 12 payments, each equal to its order total';
end $$;

-- 3. order totals add up from the items, with 9% tax --------------------------
do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from orders o
  join demo_ids d on d.order_id = o.order_identifier
  where o.order_subtotal_amount <> (select sum(i.ordered_item_quantity * i.item_price_amount)
                                    from order_items i where i.associated_order_identifier = o.order_identifier)
     or o.order_tax_amount <> round(o.order_subtotal_amount * 0.09, 2)
     or o.order_total_amount <> o.order_subtotal_amount + o.order_tax_amount;
  if v_bad <> 0 then
    raise exception 'FAIL 3: % demo orders have totals that do not add up', v_bad;
  end if;
  raise notice 'PASS 3: every demo order total adds up from its items plus 9%% tax';
end $$;

-- 4. one Partial and one Full refund, and those payments show Refunded --------
do $$
declare
  v_refunds text;
  v_flagged integer;
begin
  select string_agg(r.refund_type_category, ',' order by r.refund_type_category) into v_refunds
  from refunds r
  join payments p on p.payment_transaction_identifier = r.associated_payment_identifier
  join demo_ids d on d.order_id = p.associated_order_identifier;

  select count(*) into v_flagged
  from payments p join demo_ids d on d.order_id = p.associated_order_identifier
  where p.payment_completion_status = 'Refunded';

  if v_refunds is distinct from 'Full,Partial' or v_flagged <> 2 then
    raise exception 'FAIL 4: expected a Full and a Partial refund on 2 Refunded payments, got % on %', v_refunds, v_flagged;
  end if;
  raise notice 'PASS 4: one Partial and one Full refund';
end $$;

-- 5. only today's live orders are on the queue --------------------------------
do $$
declare
  v_queue text;
begin
  select string_agg(q.queue_entry_status_type, ',' order by q.queue_entry_status_type) into v_queue
  from queue_entries q join demo_ids d on d.order_id = q.associated_order_identifier;
  if v_queue is distinct from 'In Progress,Pending' then
    raise exception 'FAIL 5: expected the Pending and In Progress orders on the queue, got %', v_queue;
  end if;
  raise notice 'PASS 5: the Pending and In Progress orders are on the queue';
end $$;

-- 6. every demo order has a transaction log trail ------------------------------
do $$
declare
  v_missing integer;
  v_logs    integer;
begin
  select count(*) into v_missing
  from demo_ids d
  where not exists (select 1 from transaction_logs l
                    where l.associated_order_identifier = d.order_id
                      and l.transaction_type_category = 'order_created');
  select count(*) into v_logs
  from transaction_logs l join demo_ids d on d.order_id = l.associated_order_identifier;
  if v_missing <> 0 or v_logs <> 41 then
    raise exception 'FAIL 6: expected 41 log entries with order_created on every order, got % (% missing)', v_logs, v_missing;
  end if;
  raise notice 'PASS 6: 41 transaction log entries, every order has order_created';
end $$;

-- 7. it uses existing menu items and staff, and doesn't touch stock ----------
do $$
declare
  v_menu  integer;
  v_staff integer;
begin
  select count(*) into v_menu from menu_items where lower(menu_item_name) = 'latte';
  select count(distinct o.created_by_staff_identifier) into v_staff
  from orders o join demo_ids d on d.order_id = o.order_identifier
  join staff_accounts s on s.staff_account_identifier = o.created_by_staff_identifier
  where s.staff_account_status;
  if v_menu <> 1 or v_staff <> 2 then
    raise exception 'FAIL 7: expected 1 Latte menu item and 2 real staff, got % and %', v_menu, v_staff;
  end if;
  if exists (select 1 from inventory_stock_logs) then
    raise exception 'FAIL 7: the demo data changed stock levels';
  end if;
  raise notice 'PASS 7: uses the existing menu and staff, stock untouched';
end $$;

-- 9. yesterday's open demo order was closed and left the queue ----------------
do $$
declare
  v_id uuid := md5('pos62-' || to_char((now() at time zone 'America/Los_Angeles')::date - 1, 'YYYY-MM-DD') || '-order-13')::uuid;
begin
  if (select order_status_type from orders where order_identifier = v_id) <> 'Cancelled'
     or exists (select 1 from queue_entries where associated_order_identifier = v_id) then
    raise exception 'FAIL 9: yesterday''s unpaid demo order was not cancelled and taken off the queue';
  end if;
  raise notice 'PASS 9: yesterday''s open demo order is closed, only today''s are on the queue';
end $$;

-- 8. running it a second time adds nothing ------------------------------------
create temp table before_counts as
select (select count(*) from orders) o, (select count(*) from payments) p,
       (select count(*) from transaction_logs) l, (select count(*) from menu_items) m;

\i scripts/demo-data-live.sql

do $$
declare
  b record;
begin
  select * into b from before_counts;
  if (select count(*) from orders) <> b.o or (select count(*) from payments) <> b.p
     or (select count(*) from transaction_logs) <> b.l or (select count(*) from menu_items) <> b.m then
    raise exception 'FAIL 8: running the script a second time added rows';
  end if;
  raise notice 'PASS 8: running it again on the same day adds nothing';
end $$;

rollback;

-- security_hardening_check.sql — POS-61 checks
--
-- Looks at EVERY table and function in the public schema, not a fixed
-- list, so a new table or function added later fails here until it is
-- locked down the same way (see 0022_security_hardening.sql).
--
-- Run against a database that has all migrations applied:
--   psql "<connection-string>" -f backend/tests/security_hardening_check.sql
-- Everything runs inside one transaction and is rolled back at the end.

begin;

-- 1. every table has RLS on and at least one policy ------------------------
do $$
declare
  bad text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and (not c.relrowsecurity
         or not exists (select 1 from pg_policy p where p.polrelid = c.oid));
  if bad is not null then
    raise exception 'FAIL 1: tables without RLS or without a policy: %', bad;
  end if;
  raise notice 'PASS 1: every table has RLS on and at least one policy';
end $$;

-- 2. signed-out callers have no privilege on any table ---------------------
do $$
declare
  bad text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm')
    and has_table_privilege('anon', c.oid,
          'select, insert, update, delete, truncate, references, trigger');
  if bad is not null then
    raise exception 'FAIL 2: signed-out (anon) still has privileges on: %', bad;
  end if;
  raise notice 'PASS 2: signed-out callers have no privilege on any table';
end $$;

-- 3. signed-out callers can only run the two RLS helper functions ----------
do $$
declare
  bad text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname) into bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'execute')
    and p.proname not in ('is_admin', 'is_authenticated_staff');
  if bad is not null then
    raise exception 'FAIL 3: signed-out (anon) can still run: %', bad;
  end if;
  raise notice 'PASS 3: signed-out callers can only run is_admin and is_authenticated_staff';
end $$;

-- 4. nobody can call a trigger function directly ---------------------------
do $$
declare
  bad text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname) into bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prorettype = 'trigger'::regtype
    and (has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute'));
  if bad is not null then
    raise exception 'FAIL 4: trigger functions callable by app users: %', bad;
  end if;
  raise notice 'PASS 4: trigger functions are not callable by app users';
end $$;

-- 5. every SECURITY DEFINER function has a fixed search_path ---------------
do $$
declare
  bad text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname) into bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'
    );
  if bad is not null then
    raise exception 'FAIL 5: SECURITY DEFINER functions without a fixed search_path: %', bad;
  end if;
  raise notice 'PASS 5: every SECURITY DEFINER function has a fixed search_path';
end $$;

-- 6. signed-in staff can still run the functions the app calls ------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'create_order(jsonb, uuid)',
    'checkout_order(uuid, text, numeric, jsonb)',
    'process_refund(uuid, text, numeric)',
    'cancel_order(uuid)',
    'update_order_status(uuid, text)',
    'order_inventory_consumption(uuid)',
    'list_low_stock_inventory()',
    'restock_inventory(uuid, numeric)',
    'set_staff_role(uuid, text)',
    'set_staff_active(uuid, boolean)',
    'ingredient_usage_report(date, date)',
    'best_selling_items_report(date, date)',
    'busiest_hours_report(date, date)'
  ] loop
    if not has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'FAIL 6: signed-in staff can no longer run %', fn;
    end if;
  end loop;
  raise notice 'PASS 6: signed-in staff can still run every function the app calls';
end $$;

-- 7. signed-in staff can still use the tables (RLS decides the rows) -------
do $$
declare
  t text;
begin
  foreach t in array array[
    'staff_accounts', 'menu_items', 'inventory_items', 'menu_item_ingredients',
    'orders', 'order_items', 'queue_entries', 'payments', 'refunds',
    'transaction_logs', 'sales_reports', 'inventory_stock_logs'
  ] loop
    if not has_table_privilege('authenticated', t, 'select') then
      raise exception 'FAIL 7: signed-in staff lost access to %', t;
    end if;
  end loop;
  raise notice 'PASS 7: signed-in staff can still read every table (RLS decides which rows)';
end $$;

-- 8. a signed-out caller is refused by the newer functions and tables ------
set local role anon;
select set_config('request.jwt.claims', '{}', true);

do $$
declare
  stmt text;
begin
  foreach stmt in array array[
    $q$select count(*) from inventory_stock_logs$q$,
    $q$select order_inventory_consumption('00000000-0000-0000-0000-000000000001')$q$,
    $q$select * from restock_inventory('00000000-0000-0000-0000-000000000001', 5)$q$,
    $q$select set_staff_role('00000000-0000-0000-0000-000000000001', 'Admin')$q$,
    $q$select set_staff_active('00000000-0000-0000-0000-000000000001', true)$q$,
    $q$select * from ingredient_usage_report('2026-11-01', '2026-11-07')$q$,
    $q$select * from best_selling_items_report('2026-11-01', '2026-11-07')$q$,
    $q$select * from busiest_hours_report('2026-11-01', '2026-11-07')$q$
  ] loop
    begin
      execute stmt;
      raise exception 'FAIL 8: signed-out user ran: %', stmt;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
  raise notice 'PASS 8: signed-out caller is refused by the stock log, restock, staff and report functions';
end $$;

reset role;

rollback;

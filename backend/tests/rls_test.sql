-- rls_test.sql
-- Row Level Security tests for the Coffee POS System.
--
-- RLS is the ONLY authorization layer in this system: there is no application
-- server, the publishable key ships in the browser, and the repo is public.
-- If a policy is wrong, a barista can reach admin data. These tests are how we
-- know they are right.
--
-- Run order (plain Postgres / CI):
--   ci_auth_shim.sql -> migrations -> seed.sql -> grant_api_roles.sql -> this file
-- Any failure raises an exception, which makes psql exit non-zero and fails CI.
--
-- Seeded identities (see seed.sql):
--   Barista  00000000-0000-0000-0000-000000000001
--   Admin    00000000-0000-0000-0000-000000000002
--   Barista2 00000000-0000-0000-0000-000000000003

\set ON_ERROR_STOP on
\set BARISTA  '00000000-0000-0000-0000-000000000001'
\set ADMIN    '00000000-0000-0000-0000-000000000002'

\echo '── RLS TESTS ──────────────────────────────────────────────'

-- TEST 1 — an anonymous client can read nothing.
begin;
  set local role anon;
  do $$
  declare c int;
  begin
    select count(*) into c from menu_items;
    if c <> 0 then
      raise exception 'FAIL 1: anon read % menu_items rows — expected 0. The menu is readable without logging in.', c;
    end if;
    raise notice 'PASS 1: anon cannot read menu_items';
  end
  $$;
rollback;

-- TEST 2 — a signed-in barista CAN read the menu.
begin;
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'BARISTA'), true) \g /dev/null
  set local role authenticated;
  do $$
  declare c int;
  begin
    select count(*) into c from menu_items;
    if c = 0 then
      raise exception 'FAIL 2: barista read 0 menu_items — a SELECT policy is missing, or seed data did not load.';
    end if;
    raise notice 'PASS 2: barista reads menu_items (% rows)', c;
  end
  $$;
rollback;

-- TEST 3 — a barista can create an order in their own name.
begin;
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'BARISTA'), true) \g /dev/null
  set local role authenticated;
  do $$
  begin
    insert into orders (order_status_type, order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
    values ('Pending', 4.00, 0.41, 4.41, '00000000-0000-0000-0000-000000000001');
    raise notice 'PASS 3: barista can insert their own order';
  exception when insufficient_privilege or check_violation then
    raise exception 'FAIL 3: barista could not insert an order — the insert policy is too strict.';
  end
  $$;
rollback;

-- TEST 4 — a barista CANNOT create an order attributed to someone else.
begin;
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'BARISTA'), true) \g /dev/null
  set local role authenticated;
  do $$
  begin
    insert into orders (order_status_type, order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
    values ('Pending', 4.00, 0.41, 4.41, '00000000-0000-0000-0000-000000000003');
    raise exception 'FAIL 4: barista created an order in ANOTHER staff member''s name.';
  exception when insufficient_privilege then
    raise notice 'PASS 4: barista cannot create an order for another staff member';
  end
  $$;
rollback;

-- TEST 5 — a barista CANNOT change the menu.
begin;
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'BARISTA'), true) \g /dev/null
  set local role authenticated;
  do $$
  declare n int;
  begin
    update menu_items set menu_item_price_amount = 0.01;
    get diagnostics n = row_count;
    if n <> 0 then
      raise exception 'FAIL 5: barista updated % menu_items rows — they can change prices.', n;
    end if;
    raise notice 'PASS 5: barista cannot update menu_items';
  exception when insufficient_privilege then
    raise notice 'PASS 5: barista cannot update menu_items (denied outright)';
  end
  $$;
rollback;

-- TEST 6 — a barista CANNOT read staff accounts (no self-promotion path).
begin;
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'BARISTA'), true) \g /dev/null
  set local role authenticated;
  do $$
  declare c int;
  begin
    select count(*) into c from staff_accounts;
    if c <> 0 then
      raise exception 'FAIL 6: barista read % staff_accounts rows — expected 0.', c;
    end if;
    raise notice 'PASS 6: barista cannot read staff_accounts';
  end
  $$;
rollback;

-- TEST 7 — an admin CAN change the menu.
begin;
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'ADMIN'), true) \g /dev/null
  set local role authenticated;
  do $$
  declare n int;
  begin
    update menu_items set menu_item_description_text = 'edited by admin in test';
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'FAIL 7: admin updated 0 menu_items rows — the admin write policy is not working.';
    end if;
    raise notice 'PASS 7: admin can update menu_items (% rows)', n;
  end
  $$;
rollback;

-- TEST 8 — audit records are immutable, even for an admin.
begin;
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'ADMIN'), true) \g /dev/null
  set local role authenticated;
  do $$
  declare n int;
  begin
    update transaction_logs set transaction_type_category = 'tampered';
    get diagnostics n = row_count;
    if n <> 0 then
      raise exception 'FAIL 8: % transaction_logs rows were updated — the audit trail is not immutable.', n;
    end if;
    raise notice 'PASS 8: transaction_logs cannot be updated';
  exception when insufficient_privilege then
    raise notice 'PASS 8: transaction_logs cannot be updated (denied outright)';
  end
  $$;
rollback;

\echo '── ALL RLS TESTS PASSED ───────────────────────────────────'

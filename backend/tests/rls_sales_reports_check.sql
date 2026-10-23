-- rls_sales_reports_check.sql — POS-41 checks for sales_reports RLS
--
-- Run against a database that has all migrations applied, for example in
-- the Supabase SQL editor or:
--   psql "<connection-string>" -f backend/tests/rls_sales_reports_check.sql
--
-- Everything runs inside one transaction and is rolled back at the end, so
-- it leaves no data behind. Each check prints PASS, or raises FAIL and stops.
--
-- Rule under test:
--   sales_reports_admin_only (0002_rls_policies.sql)  only active admins read or write reports

begin;

-- fixtures (run as the table owner) ---------------------------------------
insert into staff_accounts (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address, staff_account_status)
values
  ('a5a5a5a5-0000-0000-0000-00000000000a', 'RLS Barista',   'Barista', 'rls.reports.barista@example.test', true),
  ('c5c5c5c5-0000-0000-0000-00000000000c', 'RLS Admin',     'Admin',   'rls.reports.admin@example.test', true),
  ('d5d5d5d5-0000-0000-0000-00000000000d', 'RLS Old Admin', 'Admin',   'rls.reports.old@example.test', false);

insert into sales_reports (report_identifier, report_generation_type, report_start_date, report_end_date, total_revenue_amount)
values ('25252525-0000-0000-0000-0000000000a1', 'Daily', '2026-10-20', '2026-10-20', 123.45);

set local role authenticated;

-- ── barista ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a5a5a5a5-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1. a barista cannot see sales reports -----------------------------------
do $$
declare n integer;
begin
  select count(*) into n from sales_reports;
  if n <> 0 then raise exception 'FAIL 1: barista can see % sales reports', n; end if;
  raise notice 'PASS 1: barista cannot read sales reports';
end $$;

-- 2. a barista cannot create a sales report -------------------------------
do $$
begin
  begin
    insert into sales_reports (report_generation_type, report_start_date, report_end_date, total_revenue_amount)
    values ('Daily', '2026-10-21', '2026-10-21', 999);
    raise exception 'FAIL 2: barista created a sales report';
  exception when insufficient_privilege then
    raise notice 'PASS 2: barista cannot create sales reports';
  end;
end $$;

-- 3. a barista cannot change or delete a sales report ---------------------
do $$
declare n integer;
begin
  update sales_reports set total_revenue_amount = 0
   where report_identifier = '25252525-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 3a: barista changed a sales report'; end if;
  delete from sales_reports where report_identifier = '25252525-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 3b: barista deleted a sales report'; end if;
  raise notice 'PASS 3: barista cannot change or delete sales reports';
end $$;

-- ── admin ────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"c5c5c5c5-0000-0000-0000-00000000000c","role":"authenticated"}', true);

-- 4. an admin can read sales reports --------------------------------------
do $$
begin
  if not exists (select 1 from sales_reports
                 where report_identifier = '25252525-0000-0000-0000-0000000000a1') then
    raise exception 'FAIL 4: admin cannot read sales reports';
  end if;
  raise notice 'PASS 4: admin can read sales reports';
end $$;

-- 5. an admin can create a sales report (generateSalesReport does this) ---
do $$
begin
  insert into sales_reports (report_identifier, report_generation_type, report_start_date, report_end_date, total_revenue_amount)
  values ('25252525-0000-0000-0000-0000000000a2', 'Weekly', '2026-10-12', '2026-10-18', 456.78);
  raise notice 'PASS 5: admin can create sales reports';
end $$;

-- ── deactivated admin ────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"d5d5d5d5-0000-0000-0000-00000000000d","role":"authenticated"}', true);

-- 6. a deactivated admin loses report access ------------------------------
do $$
declare n integer;
begin
  select count(*) into n from sales_reports;
  if n <> 0 then raise exception 'FAIL 6a: deactivated admin can see % sales reports', n; end if;
  begin
    insert into sales_reports (report_generation_type, report_start_date, report_end_date, total_revenue_amount)
    values ('Daily', '2026-10-22', '2026-10-22', 1);
    raise exception 'FAIL 6b: deactivated admin created a sales report';
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'PASS 6: deactivated admin cannot read or create sales reports';
end $$;

rollback;

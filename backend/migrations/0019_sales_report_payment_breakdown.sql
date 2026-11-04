-- 0019_sales_report_payment_breakdown.sql
-- POS-66: sales reports include order count and totals by payment method.
--
-- Two additive columns on sales_reports — existing rows get sane defaults
-- (0 and {}), so this doesn't need a backfill:
--   order_count: the number of distinct orders whose payment counted
--     toward total_revenue_amount in that report's date range.
--   payment_method_totals: gross revenue broken down by
--     payment_method_type, as a jsonb object with one key per payment
--     method ('Cash', 'Credit/Debit', 'Mobile Pay'). Same scope as
--     total_revenue_amount — Completed and Refunded payments, not net of
--     refunds (see the comment at the top of reports.js) — so the three
--     totals always add up to total_revenue_amount.
alter table sales_reports
  add column order_count integer not null default 0
    check (order_count >= 0),
  add column payment_method_totals jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payment_method_totals) = 'object');

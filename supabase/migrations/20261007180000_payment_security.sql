-- 0005_payment_security.sql
-- POS-16: row level security on payments and immutable transaction logs.
--
-- Goal: once a payment or a transaction log entry is saved, nobody can
-- quietly change or remove it. Money records double as the audit trail.
--
-- What this adds on top of 0002_rls_policies.sql:
--   1. Payments can only be inserted for the caller's own orders (admins
--      for any order). 0002 let ANY staff member insert a payment for ANY
--      order.
--   2. Clients can no longer UPDATE payments at all. The one legitimate
--      change, payment_completion_status (for example 'Refunded'), is made
--      by SECURITY DEFINER functions such as process_refund.
--   3. A trigger blocks DELETE on payments and blocks changing anything on
--      a payment except payment_completion_status. It also fires for
--      SECURITY DEFINER functions, which bypass RLS, so a bug in a later
--      function cannot rewrite a payment's amount.
--   4. Triggers make transaction_logs append-only: no UPDATE, DELETE or
--      TRUNCATE, for any role. Inserts still work, so create_order and
--      later functions keep logging.
--   5. Table privileges for UPDATE/DELETE/TRUNCATE are revoked from the
--      client roles as a second layer of defense.

-- ── 1 + 2. payments policies ────────────────────────────────────────────
drop policy if exists payments_insert_staff on payments;
drop policy if exists payments_write_admin on payments;
drop policy if exists payments_insert_own_order on payments;

create policy payments_insert_own_order on payments
  for insert with check (
    is_authenticated_staff() and (
      is_admin() or exists (
        select 1 from orders o
        where o.order_identifier = payments.associated_order_identifier
          and o.created_by_staff_identifier = auth.uid()
      )
    )
  );

-- No UPDATE or DELETE policy on purpose: with RLS enabled and no policy,
-- client updates and deletes are denied.

-- ── 3. payments are immutable except for their status ──────────────────
create or replace function prevent_payment_tampering()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD: payments cannot be deleted';
  end if;

  if new.payment_transaction_identifier is distinct from old.payment_transaction_identifier
     or new.associated_order_identifier is distinct from old.associated_order_identifier
     or new.payment_method_type is distinct from old.payment_method_type
     or new.payment_amount_value is distinct from old.payment_amount_value
     or new.payment_processing_timestamp is distinct from old.payment_processing_timestamp then
    raise exception 'IMMUTABLE_RECORD: only payment_completion_status may change on a payment';
  end if;

  return new;
end;
$$;

drop trigger if exists payments_immutable on payments;
create trigger payments_immutable
  before update or delete on payments
  for each row execute function prevent_payment_tampering();

-- ── 4. transaction_logs are append-only ────────────────────────────────
create or replace function prevent_transaction_log_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'IMMUTABLE_RECORD: transaction logs are append-only (% blocked)', tg_op;
end;
$$;

drop trigger if exists transaction_logs_no_update_delete on transaction_logs;
create trigger transaction_logs_no_update_delete
  before update or delete on transaction_logs
  for each row execute function prevent_transaction_log_changes();

drop trigger if exists transaction_logs_no_truncate on transaction_logs;
create trigger transaction_logs_no_truncate
  before truncate on transaction_logs
  for each statement execute function prevent_transaction_log_changes();

-- ── 5. second layer: take the privileges away from client roles ────────
revoke update, delete, truncate on transaction_logs from anon, authenticated;
revoke delete, truncate on payments from anon, authenticated;

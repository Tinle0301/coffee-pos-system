-- 0009_process_refund.sql
-- POS-31: implement process_refund() for real.
--
-- Supersedes the stub in 0003_functions.sql. Validates the payment, then
-- writes the refund row, flips the payment to 'Refunded', and writes the
-- audit log in one plpgsql transaction — if any step fails, everything
-- rolls back, so a refund can never leave money and records out of sync.
--
-- Decisions beyond the stub's literal 4-step list, and why:
--   1. Admin only (is_admin(), not just is_authenticated_staff()). The
--      refunds table is already admin-only under RLS
--      (refunds_admin_only in 0002_rls_policies.sql) — this just applies
--      the same rule inside the function, since security definer would
--      otherwise bypass it entirely for any authenticated staff member.
--   2. A payment can only be refunded once. The stub's step 2
--      unconditionally sets payment_completion_status = 'Refunded' with
--      no notion of a remaining balance across multiple partial refunds,
--      so once a payment is 'Refunded' it's done — a second call is
--      rejected with ALREADY_REFUNDED rather than silently layering a
--      second refund row on top of a payment that's already marked
--      refunded.
--   3. refund_type/amount validated against the payment before writing:
--      'Full' must refund the exact payment_amount_value; 'Partial' must
--      be greater than zero and strictly less than it. This is what
--      "validates the payment" in the ticket actually means in practice —
--      otherwise refund_type and amount could contradict each other or
--      the real payment amount, which is exactly the "money and records
--      out of sync" this ticket exists to prevent.
create or replace function process_refund(payment_id uuid, refund_type text, amount numeric)
returns uuid
language plpgsql
security definer
as $$
declare
  v_refund_id uuid;
  v_payment_amount numeric(10, 2);
  v_payment_status text;
  v_order_id uuid;
  v_amount numeric(10, 2);
begin
  if not is_admin() then
    raise exception 'UNAUTHORIZED: caller is not an admin';
  end if;

  select payment_amount_value, payment_completion_status, associated_order_identifier
    into v_payment_amount, v_payment_status, v_order_id
    from payments
    where payment_transaction_identifier = payment_id;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND: payment % does not exist', payment_id;
  end if;

  if v_payment_status = 'Refunded' then
    raise exception 'ALREADY_REFUNDED: payment % has already been refunded', payment_id;
  end if;

  if v_payment_status <> 'Completed' then
    raise exception 'INVALID_PAYMENT_STATUS: payment % is % and cannot be refunded',
      payment_id, v_payment_status;
  end if;

  if refund_type not in ('Full', 'Partial') then
    raise exception 'INVALID_REFUND_TYPE: % is not a supported refund type', refund_type;
  end if;

  v_amount := round(amount, 2);

  if v_amount is null or v_amount <= 0 then
    raise exception 'INVALID_REFUND_AMOUNT: refund amount must be greater than zero';
  end if;

  if refund_type = 'Full' and v_amount <> v_payment_amount then
    raise exception 'AMOUNT_MISMATCH: a Full refund must equal the payment amount % (got %)',
      v_payment_amount, v_amount;
  end if;

  if refund_type = 'Partial' and v_amount >= v_payment_amount then
    raise exception 'INVALID_REFUND_AMOUNT: a Partial refund must be less than the payment amount %',
      v_payment_amount;
  end if;

  insert into refunds (
    associated_payment_identifier, refund_amount_value, refund_type_category
  ) values (
    payment_id, v_amount, refund_type
  )
  returning refund_transaction_identifier into v_refund_id;

  update payments set payment_completion_status = 'Refunded'
    where payment_transaction_identifier = payment_id;

  insert into transaction_logs (
    associated_order_identifier, transaction_type_category, performed_by_staff_identifier
  ) values (
    v_order_id, 'refund_processed', auth.uid()
  );

  return v_refund_id;
end;
$$;

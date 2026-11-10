// refunds.js — refund processing (admin only)
//
// Every function returns { data, error } — never throws (see
// docs/API_CONTRACT.md and backend/services/auth.js for the contract).
//
// processRefund calls the process_refund() database function (POS-31),
// the same way payments.js's processPayment wraps checkout_order(). The
// Refund screen currently calls supabase.rpc('process_refund', ...)
// directly from frontend/src/refund-api.js — POS-68 is this one tested
// function so that screen has a real backend/services/ module to call
// instead, per the "never call Supabase directly" rule in frontend/README.md.

import { supabase } from '../supabase-client.js';

/** @typedef {{ code: string, message: string }} ServiceError */

const VALID_REFUND_TYPES = ['Full', 'Partial'];

/**
 * @param {string} paymentId
 * @param {'Full'|'Partial'} refundType
 * @param {number} amount
 * @returns {Promise<{ data: import('../models/refund.js').Refund | null, error: ServiceError | null }>}
 */
export async function processRefund(paymentId, refundType, amount) {
  if (!paymentId) {
    return { data: null, error: { code: 'PAYMENT_NOT_FOUND', message: 'No payment found with that ID.' } };
  }
  if (!VALID_REFUND_TYPES.includes(refundType)) {
    return { data: null, error: { code: 'INVALID_REFUND_TYPE', message: 'Choose a full or partial refund.' } };
  }
  if (amount == null || amount <= 0) {
    return { data: null, error: { code: 'INVALID_REFUND_AMOUNT', message: "That refund amount isn't valid for this payment." } };
  }

  const { data: refundId, error: rpcError } = await supabase.rpc('process_refund', {
    payment_id: paymentId,
    refund_type: refundType,
    amount,
  });

  if (rpcError) {
    return { data: null, error: mapProcessRefundError(rpcError) };
  }

  return await getRefund(refundId);
}

/**
 * @param {string} refundId
 * @returns {Promise<{ data: import('../models/refund.js').Refund | null, error: ServiceError | null }>}
 */
export async function getRefund(refundId) {
  const { data, error } = await supabase
    .from('refunds')
    .select('*')
    .eq('refund_transaction_identifier', refundId)
    .maybeSingle();

  if (error) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load the refund.' } };
  }
  if (!data) {
    return { data: null, error: { code: 'REFUND_NOT_FOUND', message: 'Refund not found.' } };
  }

  return { data: toRefund(data), error: null };
}

/**
 * process_refund raises exceptions shaped like 'CODE: message' (see
 * backend/migrations/0009_process_refund.sql) — same unpacking as
 * payments.js's mapCheckoutOrderError. Messages here match
 * frontend/src/refund-errors.js's wording so switching the Refund screen
 * over to this function doesn't change what an admin sees, except
 * AMOUNT_MISMATCH: that database code exists (a Full refund whose amount
 * doesn't equal the payment) but refund-errors.js has no entry for it, so
 * it currently falls through to a generic message — fixed here instead of
 * carried over.
 */
function mapProcessRefundError(rpcError) {
  const raised = rpcError.message || '';
  const separatorIndex = raised.indexOf(':');
  const code = separatorIndex === -1 ? '' : raised.slice(0, separatorIndex);
  const knownMessages = {
    UNAUTHORIZED: 'Only an admin can issue refunds.',
    PAYMENT_NOT_FOUND: 'No payment found with that ID.',
    ALREADY_REFUNDED: 'This payment has already been refunded.',
    INVALID_PAYMENT_STATUS: "This payment isn't completed, so it can't be refunded.",
    INVALID_REFUND_TYPE: 'Choose a full or partial refund.',
    INVALID_REFUND_AMOUNT: "That refund amount isn't valid for this payment.",
    AMOUNT_MISMATCH: "That amount doesn't match the payment amount for a Full refund.",
  };

  if (knownMessages[code]) {
    return { code, message: knownMessages[code] };
  }

  return { code: 'REFUND_FAILED', message: 'The refund could not be processed. Try again.' };
}

function toRefund(row) {
  return {
    refundTransactionIdentifier: row.refund_transaction_identifier,
    associatedPaymentIdentifier: row.associated_payment_identifier,
    refundAmountValue: row.refund_amount_value,
    refundTypeCategory: row.refund_type_category,
    refundProcessingTimestamp: row.refund_processing_timestamp,
  };
}

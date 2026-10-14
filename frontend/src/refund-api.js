// refund-api.js — the Refund screen's only door to the backend.
//
// Every function returns { data, error } and never throws, like the services
// in ./backend/services/. Authorization is enforced by RLS (refunds_admin_only)
// and by process_refund() itself (admin only), not by the UI hiding the screen.
import { supabase } from './backend/supabase-client.js';
import { getPayment } from './backend/services/payments.js';
import { mapRefundError } from './refund-errors.js';

/** @typedef {{ code: string, message: string }} ServiceError */
/** @typedef {{ paymentTransactionIdentifier: string, associatedOrderIdentifier: string, paymentMethodType: string,
 *   paymentAmountValue: number, paymentCompletionStatus: string, paymentProcessingTimestamp: string }} Payment */

function toPayment(row) {
  return {
    paymentTransactionIdentifier: row.payment_transaction_identifier ?? row.paymentTransactionIdentifier,
    associatedOrderIdentifier: row.associated_order_identifier ?? row.associatedOrderIdentifier,
    paymentMethodType: row.payment_method_type ?? row.paymentMethodType,
    paymentAmountValue: Number(row.payment_amount_value ?? row.paymentAmountValue),
    paymentCompletionStatus: row.payment_completion_status ?? row.paymentCompletionStatus,
    paymentProcessingTimestamp: row.payment_processing_timestamp ?? row.paymentProcessingTimestamp,
  };
}

/** @returns {Promise<{ data: Payment | null, error: ServiceError | null }>} */
export async function lookUpPayment(paymentId) {
  try {
    const { data, error } = await getPayment(paymentId);
    if (error || !data) {
      return { data: null, error: error ?? { code: 'PAYMENT_NOT_FOUND', message: 'No payment found with that ID.' } };
    }
    return { data: toPayment(data), error: null };
  } catch {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not look up that payment.' } };
  }
}

/**
 * The most recent completed (refundable) payments, newest first, so an admin
 * can pick one instead of typing a long ID.
 * @returns {Promise<{ data: Payment[] | null, error: ServiceError | null }>}
 */
export async function listRecentPayments(limit = 20) {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('payment_transaction_identifier, associated_order_identifier, payment_method_type, payment_amount_value, payment_completion_status, payment_processing_timestamp')
      .eq('payment_completion_status', 'Completed')
      .order('payment_processing_timestamp', { ascending: false })
      .limit(limit);
    if (error) return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load recent payments.' } };
    return { data: (data ?? []).map(toPayment), error: null };
  } catch {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load recent payments.' } };
  }
}

/**
 * @param {string} paymentId
 * @param {'Full'|'Partial'} refundType
 * @param {number} amount
 * @returns {Promise<{ data: { refundTransactionIdentifier: string } | null, error: ServiceError | null }>}
 */
export async function submitRefund(paymentId, refundType, amount) {
  try {
    const { data, error } = await supabase.rpc('process_refund', {
      payment_id: paymentId,
      refund_type: refundType,
      amount,
    });
    if (error) return { data: null, error: mapRefundError(error) };
    return { data: { refundTransactionIdentifier: data }, error: null };
  } catch {
    return { data: null, error: { code: 'REFUND_FAILED', message: 'Could not reach the server. Try again.' } };
  }
}

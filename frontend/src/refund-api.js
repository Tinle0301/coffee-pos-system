// refund-api.js — the Refund screen's only door to the backend.
//
// Every function returns { data, error } and never throws, like the services
// in ./backend/services/. This is a thin adapter over the database: when the
// backend team publishes getPayment / processRefund in backend/services/
// (payments.js, refunds.js), swap the bodies below for those imports — the
// screen (refund.js) won't need to change.
//
// Authorization is enforced by RLS (refunds_admin_only) and the
// process_refund() database function, not by the UI hiding the screen.
import { supabase } from './backend/supabase-client.js';

/** @typedef {{ code: string, message: string }} ServiceError */

/**
 * @param {string} paymentId  payments.payment_transaction_identifier (uuid)
 * @returns {Promise<{ data: { paymentTransactionIdentifier: string, paymentMethodType: string,
 *   paymentAmountValue: number, paymentCompletionStatus: string,
 *   paymentProcessingTimestamp: string } | null, error: ServiceError | null }>}
 */
export async function lookUpPayment(paymentId) {
  const { data, error } = await supabase
    .from('payments')
    .select('payment_transaction_identifier, payment_method_type, payment_amount_value, payment_completion_status, payment_processing_timestamp')
    .eq('payment_transaction_identifier', paymentId)
    .maybeSingle();

  if (error) return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not look up that payment.' } };
  if (!data) return { data: null, error: { code: 'PAYMENT_NOT_FOUND', message: 'No payment found with that ID.' } };

  return {
    data: {
      paymentTransactionIdentifier: data.payment_transaction_identifier,
      paymentMethodType: data.payment_method_type,
      paymentAmountValue: Number(data.payment_amount_value),
      paymentCompletionStatus: data.payment_completion_status,
      paymentProcessingTimestamp: data.payment_processing_timestamp,
    },
    error: null,
  };
}

/**
 * @param {string} paymentId
 * @param {'Full'|'Partial'} refundType
 * @param {number} amount
 * @returns {Promise<{ data: { refundTransactionIdentifier: string } | null, error: ServiceError | null }>}
 */
export async function submitRefund(paymentId, refundType, amount) {
  const { data, error } = await supabase.rpc('process_refund', {
    payment_id: paymentId,
    refund_type: refundType,
    amount,
  });
  if (error) {
    return { data: null, error: { code: 'REFUND_FAILED', message: 'The refund could not be processed.' } };
  }
  return { data: { refundTransactionIdentifier: data }, error: null };
}

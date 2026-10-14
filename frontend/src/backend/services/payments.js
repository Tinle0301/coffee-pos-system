// payments.js — payment processing (checkout)
//
// Every function returns { data, error } — never throws (see
// docs/API_CONTRACT.md and backend/services/auth.js for the contract).
//
// processPayment calls the checkout_order() database function (POS-18).
//
// KNOWN GAP, carried over from POS-18: checkout_order takes an
// inventory_consumption list so it can decrement stock, but there is still
// no menu_item -> inventory_item mapping anywhere in the schema
// (docs/DATA_MODEL.md documents that as "a services-layer concern," and
// nothing has built it yet). Until that mapping exists, this always sends
// an empty list — checkout succeeds and completes the order, but no
// inventory is actually decremented. Flag this the same way the POS-18 tax
// rate mismatch was flagged, before anyone relies on inventory numbers
// being accurate after a checkout.

import { supabase } from '../supabase-client.js';

/** @typedef {{ code: string, message: string }} ServiceError */

/**
 * @param {string} orderId
 * @param {string} paymentMethod
 * @param {number} amount
 * @returns {Promise<{ data: import('../models/payment.js').Payment | null, error: ServiceError | null }>}
 */
export async function processPayment(orderId, paymentMethod, amount) {
  if (!orderId) {
    return { data: null, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found.' } };
  }
  if (!paymentMethod) {
    return { data: null, error: { code: 'INVALID_PAYMENT_METHOD', message: 'A payment method is required.' } };
  }
  if (amount == null || amount < 0) {
    return { data: null, error: { code: 'AMOUNT_MISMATCH', message: 'Payment amount must be a non-negative number.' } };
  }

  const { data: paymentId, error: rpcError } = await supabase.rpc('checkout_order', {
    order_id: orderId,
    payment_method: paymentMethod,
    amount,
    inventory_consumption: [], // POS-20: empty array tells checkout_order to calculate from recipes
  });

  if (rpcError) {
    return { data: null, error: mapCheckoutOrderError(rpcError) };
  }

  return await getPayment(paymentId);
}

/**
 * @param {string} paymentId
 * @returns {Promise<{ data: import('../models/payment.js').Payment | null, error: ServiceError | null }>}
 */
export async function getPayment(paymentId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('payment_transaction_identifier', paymentId)
    .maybeSingle();

  if (error) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load the payment.' } };
  }
  if (!data) {
    return { data: null, error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' } };
  }

  return { data: toPayment(data), error: null };
}

/**
 * checkout_order raises exceptions shaped like
 * 'CODE: message'. Same unpacking as orders.js's mapCreateOrderError — if
 * the database function's message format ever changes, this must change
 * with it.
 */
function mapCheckoutOrderError(rpcError) {
  const raised = rpcError.message || '';
  const separatorIndex = raised.indexOf(':');
  const code = separatorIndex === -1 ? '' : raised.slice(0, separatorIndex);
  const knownCodes = [
    'UNAUTHORIZED',
    'ORDER_NOT_FOUND',
    'INVALID_ORDER_STATUS',
    'INVALID_PAYMENT_METHOD',
    'AMOUNT_MISMATCH',
    'INVALID_INVENTORY_CONSUMPTION',
    'INVENTORY_ITEM_NOT_FOUND',
    'INSUFFICIENT_INVENTORY',
  ];

  if (knownCodes.includes(code)) {
    return { code, message: raised.slice(separatorIndex + 1).trim() || raised };
  }

  return { code: 'CHECKOUT_FAILED', message: 'Could not process this payment.' };
}

function toPayment(row) {
  return {
    paymentTransactionIdentifier: row.payment_transaction_identifier,
    associatedOrderIdentifier: row.associated_order_identifier,
    paymentMethodType: row.payment_method_type,
    paymentAmountValue: row.payment_amount_value,
    paymentCompletionStatus: row.payment_completion_status,
    paymentProcessingTimestamp: row.payment_processing_timestamp,
  };
}

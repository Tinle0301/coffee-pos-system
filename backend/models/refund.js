// refund.js — shape definition + validator for `refunds` (maps to 491A Refund)
// Columns: refund_transaction_identifier, associated_payment_identifier,
// refund_amount_value, refund_type_category, refund_processing_timestamp.

/**
 * @typedef {Object} Refund
 * @property {string} refundTransactionIdentifier
 * @property {string} associatedPaymentIdentifier
 * @property {number} refundAmountValue
 * @property {'Full'|'Partial'} refundTypeCategory
 * @property {string} refundProcessingTimestamp
 */

/**
 * @param {unknown} value
 * @returns {value is Refund}
 */
export function isValidRefund(value) {
  throw new Error('isValidRefund: not implemented');
}

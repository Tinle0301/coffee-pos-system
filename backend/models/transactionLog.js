// transactionLog.js — shape definition + validator for `transaction_logs`
// (maps to 491A TransactionLog). Columns: transaction_log_identifier,
// associated_order_identifier, transaction_type_category,
// transaction_timestamp, performed_by_user_identifier.
// Audit records — immutable once written (see backend RLS policies).

/**
 * @typedef {Object} TransactionLog
 * @property {string} transactionLogIdentifier
 * @property {string} associatedOrderIdentifier
 * @property {string} transactionTypeCategory
 * @property {string} transactionTimestamp
 * @property {string} performedByUserIdentifier
 */

/**
 * @param {unknown} value
 * @returns {value is TransactionLog}
 */
export function isValidTransactionLog(value) {
  throw new Error('isValidTransactionLog: not implemented');
}

// order.js — shape definition + validator for `orders` (maps to 491A Order)
// Columns: order_identifier, order_status_type, order_subtotal_amount,
// order_tax_amount, order_total_amount, order_creation_timestamp,
// created_by_staff_identifier.

/**
 * @typedef {Object} Order
 * @property {string} orderIdentifier
 * @property {'Pending'|'In Progress'|'Completed'|'Cancelled'} orderStatusType
 * @property {number} orderSubtotalAmount
 * @property {number} orderTaxAmount
 * @property {number} orderTotalAmount
 * @property {string} orderCreationTimestamp
 * @property {string} createdByStaffIdentifier
 */

/**
 * @param {unknown} value
 * @returns {value is Order}
 */
export function isValidOrder(value) {
  throw new Error('isValidOrder: not implemented');
}

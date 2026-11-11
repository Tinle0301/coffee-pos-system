// salesReport.js — shape definition + validator for `sales_reports`
// (maps to 491A SalesReport). Columns: report_identifier,
// report_generation_type, report_start_date, report_end_date,
// total_revenue_amount, report_generated_timestamp, plus order_count and
// payment_method_totals (POS-66 — additive beyond the original 491A
// SalesReport entity).

/**
 * @typedef {Object} SalesReport
 * @property {string} reportIdentifier
 * @property {'Daily'|'Weekly'|'Monthly'} reportGenerationType
 * @property {string} reportStartDate
 * @property {string} reportEndDate
 * @property {number} totalRevenueAmount
 * @property {number} orderCount
 * @property {{ 'Cash': number, 'Credit/Debit': number, 'Mobile Pay': number }} paymentMethodTotals
 * @property {string} reportGeneratedTimestamp
 */

/**
 * @param {unknown} value
 * @returns {value is SalesReport}
 */
export function isValidSalesReport(value) {
  throw new Error('isValidSalesReport: not implemented');
}

// reports.js — ReportsController (admin only)

/**
 * @param {string} reportGenerationType
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<import('../models/salesReport.js').SalesReport>}
 */
export async function generateSalesReport(reportGenerationType, startDate, endDate) {}

/**
 * @returns {Promise<import('../models/salesReport.js').SalesReport[]>}
 */
export async function listSalesReports() {}

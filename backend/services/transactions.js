// transactions.js — read access to the immutable audit log (admin only)

/**
 * @param {{ orderId?: string, from?: string, to?: string }} [filters]
 * @returns {Promise<import('../models/transactionLog.js').TransactionLog[]>}
 */
export async function listTransactionLogs(filters) {}

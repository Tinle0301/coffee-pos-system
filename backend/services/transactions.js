// transactions.js — read access to the immutable audit log (admin only)
//
// transaction_logs is protected by RLS. Only admins may read it, and
// audit records cannot be modified or deleted by clients.

import { supabase } from '../supabase-client.js';

/** @typedef {{ code: string, message: string }} ServiceError */

/**
 * @param {{ orderId?: string, from?: string, to?: string }} [filters]
 * @returns {Promise<{
 *   data: import('../models/transactionLog.js').TransactionLog[] | null,
 *   error: ServiceError | null
 * }>}
 */
export async function listTransactionLogs(filters = {}) {
  let query = supabase
    .from('transaction_logs')
    .select('*');

  if (filters.orderId) {
    query = query.eq(
      'associated_order_identifier',
      filters.orderId
    );
  }

  if (filters.from) {
    query = query.gte(
      'transaction_timestamp',
      filters.from
    );
  }

  if (filters.to) {
    query = query.lte(
      'transaction_timestamp',
      filters.to
    );
  }

  const { data, error } = await query.order(
    'transaction_timestamp',
    { ascending: false }
  );

  if (error) {
    return {
      data: null,
      error: {
        code: 'LOOKUP_FAILED',
        message: 'Could not load transaction logs.',
      },
    };
  }

  return {
    data: data.map(toTransactionLog),
    error: null,
  };
}

function toTransactionLog(row) {
  return {
    transactionLogIdentifier:
      row.transaction_log_identifier,
    associatedOrderIdentifier:
      row.associated_order_identifier,
    transactionTypeCategory:
      row.transaction_type_category,
    transactionTimestamp:
      row.transaction_timestamp,
    performedByStaffIdentifier:
      row.performed_by_staff_identifier,
  };
}

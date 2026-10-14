// orderStatus.js — OrderStatusController
import { supabase } from '../supabase-client.js';

/**
 * @param {string} orderId
 * @param {'Pending'|'In Progress'|'Completed'|'Cancelled'} newStatus
 * @returns {Promise<{ data: object | null, error: object | null }>}
 */
export async function UpdateOrderStatus(orderId, newStatus) {
  const { error } = await supabase.rpc('update_order_status', {
    order_id: orderId,
    new_status: newStatus,
  });

  if (error) {
    return {
      data: null,
      error: mapUpdateOrderStatusError(error),
    };
  }

  return {
    data: {
      orderIdentifier: orderId,
      orderStatusType: newStatus,
    },
    error: null,
  };
}

/**
 * @param {string} orderId
 * @returns {Promise<void>}
 */
export async function MarkOrderAsInProgress(orderId) {}

function mapUpdateOrderStatusError(rpcError) {
  const raised = rpcError.message || '';
  const separatorIndex = raised.indexOf(':');

  if (separatorIndex !== -1) {
    const code = raised.slice(0, separatorIndex);
    const message = raised.slice(separatorIndex + 1).trim() || raised;

    const knownCodes = [
      'UNAUTHORIZED',
      'ORDER_NOT_FOUND',
      'NOT_PAID',
      'ALREADY_PAID',
      'INVALID_TRANSITION',
    ];

    if (knownCodes.includes(code)) {
      return { code, message };
    }
  }

  return {
    code: 'STATUS_UPDATE_FAILED',
    message: 'Could not update the order status.',
  };
}
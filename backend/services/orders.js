// orders.js — OrderController
//
// Every function returns { data, error } — never throws (see
// docs/API_CONTRACT.md and backend/services/auth.js for the contract).
//
// CreateNewOrder is an adapter: the published contract for `items` is
// camelCase with no price ({ menuItemIdentifier, quantity, customization? }),
// but the create_order database function (POS-8) takes the sprint-guide
// shape — snake_case plus a caller-supplied price — so the frontend never
// has to know about that. This function looks up each item's current price
// itself, converts, then calls the RPC.

import { supabase } from '../supabase-client.js';

/** @typedef {{ code: string, message: string }} ServiceError */

/**
 * @param {{ menuItemIdentifier: string, quantity: number, customization?: string }[]} items
 * @param {string} staffId
 * @returns {Promise<{ data: import('../models/order.js').Order | null, error: ServiceError | null }>}
 */
export async function CreateNewOrder(items, staffId) {
  if (!Array.isArray(items) || items.length === 0) {
    return { data: null, error: { code: 'INVALID_ORDER', message: 'Order must contain at least one item.' } };
  }

  for (const item of items) {
    if (!item?.menuItemIdentifier || !item.quantity || item.quantity <= 0) {
      return { data: null, error: { code: 'INVALID_QUANTITY', message: 'Each item needs a menu item and a quantity greater than zero.' } };
    }
  }

  const menuItemIds = [...new Set(items.map((item) => item.menuItemIdentifier))];
  const { data: menuItems, error: menuError } = await supabase
    .from('menu_items')
    .select('menu_item_identifier, menu_item_price_amount')
    .in('menu_item_identifier', menuItemIds)
    .eq('menu_item_availability_status', true);

  if (menuError) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not look up menu items.' } };
  }

  const priceById = new Map(menuItems.map((row) => [row.menu_item_identifier, row.menu_item_price_amount]));
  const rpcItems = [];
  for (const item of items) {
    const price = priceById.get(item.menuItemIdentifier);
    if (price == null) {
      return { data: null, error: { code: 'MENU_ITEM_UNAVAILABLE', message: 'A menu item in this order does not exist or is unavailable.' } };
    }
    rpcItems.push({
      menu_item_id: item.menuItemIdentifier,
      quantity: item.quantity,
      customization: item.customization ?? null,
      price,
    });
  }

  const { data: orderId, error: rpcError } = await supabase.rpc('create_order', {
    items: rpcItems,
    staff_id: staffId,
  });

  if (rpcError) {
    return { data: null, error: mapCreateOrderError(rpcError) };
  }

  return await RetrieveOrderByIdentifier(orderId);
}

/**
 * NOTE: intentionally not implemented yet. Order-level fields worth
 * changing after creation don't have settled semantics: item changes go
 * through orderItems.js (AddOrderItem / UpdateOrderItemQuantity /
 * RemoveOrderItem), and status changes go through orderStatus.js's
 * update_order_status. What "changes" is legal to pass here — and whether
 * it needs to recompute subtotal/tax/total — needs a decision before this
 * is filled in.
 *
 * @param {string} orderId
 * @param {object} changes
 * @returns {Promise<{ data: import('../models/order.js').Order | null, error: ServiceError | null }>}
 */
export async function ModifyExistingOrder(orderId, changes) {
  throw new Error('ModifyExistingOrder: not implemented — see comment above');
}

/**
 * @param {string} orderId
 * @returns {Promise<{ data: null, error: ServiceError | null }>}
 */
export async function CancelExistingOrder(orderId) {
  const { error } = await supabase.rpc('cancel_order', { order_id: orderId });

  if (error) {
    return { data: null, error: { code: 'CANCEL_FAILED', message: 'Could not cancel this order.' } };
  }

  return { data: null, error: null };
}

/**
 * @param {string} orderId
 * @returns {Promise<{ data: import('../models/order.js').Order | null, error: ServiceError | null }>}
 */
export async function RetrieveOrderByIdentifier(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_identifier', orderId)
    .maybeSingle();

  if (error) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load the order.' } };
  }
  if (!data) {
    return { data: null, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found.' } };
  }

  return { data: toOrder(data), error: null };
}

/**
 * create_order (0004_create_order.sql) raises exceptions shaped like
 * 'CODE: message' for every error it can produce. This unpacks that into
 * the { code, message } shape the rest of the contract uses. If the
 * database function's message format ever changes, this must change with
 * it — the two aren't otherwise checked against each other.
 */
function mapCreateOrderError(rpcError) {
  const raised = rpcError.message || '';
  const separatorIndex = raised.indexOf(':');
  const code = separatorIndex === -1 ? '' : raised.slice(0, separatorIndex);
  const knownCodes = ['UNAUTHORIZED', 'INVALID_ORDER', 'INVALID_QUANTITY', 'MENU_ITEM_UNAVAILABLE'];

  if (knownCodes.includes(code)) {
    return { code, message: raised.slice(separatorIndex + 1).trim() || raised };
  }

  return { code: 'ORDER_CREATION_FAILED', message: 'Could not create the order.' };
}

function toOrder(row) {
  return {
    orderIdentifier: row.order_identifier,
    orderStatusType: row.order_status_type,
    orderSubtotalAmount: row.order_subtotal_amount,
    orderTaxAmount: row.order_tax_amount,
    orderTotalAmount: row.order_total_amount,
    orderCreationTimestamp: row.order_creation_timestamp,
    createdByStaffIdentifier: row.created_by_staff_identifier,
  };
}

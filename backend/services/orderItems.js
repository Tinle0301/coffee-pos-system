// orderItems.js — order item operations within an order
//
// Every function returns { data, error } — never throws (see
// docs/API_CONTRACT.md and backend/services/auth.js for the contract).
// Ownership is enforced by RLS (order_items_write_via_order in
// 0002_rls_policies.sql); the Pending-only rule below is a business rule on
// top of that, matching AddOrderItem's documented error in API_CONTRACT.md.

import { supabase } from '../supabase-client.js';

/** @typedef {{ code: string, message: string }} ServiceError */

/**
 * @param {string} orderId
 * @param {{ menuItemIdentifier: string, quantity: number, customization?: string }} item
 * @returns {Promise<{ data: import('../models/orderItem.js').OrderItem | null, error: ServiceError | null }>}
 */
export async function AddOrderItem(orderId, item) {
  if (!item?.quantity || item.quantity <= 0) {
    return { data: null, error: { code: 'INVALID_QUANTITY', message: 'Quantity must be greater than zero.' } };
  }

  const modifiable = await assertOrderIsModifiable(orderId);
  if (modifiable.error) return modifiable;

  const { data: menuItem, error: menuError } = await supabase
    .from('menu_items')
    .select('menu_item_price_amount')
    .eq('menu_item_identifier', item.menuItemIdentifier)
    .eq('menu_item_availability_status', true)
    .maybeSingle();

  if (menuError) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not look up the menu item.' } };
  }
  if (!menuItem) {
    return { data: null, error: { code: 'MENU_ITEM_UNAVAILABLE', message: 'That menu item does not exist or is unavailable.' } };
  }

  const { data, error } = await supabase
    .from('order_items')
    .insert({
      associated_order_identifier: orderId,
      associated_menu_item_identifier: item.menuItemIdentifier,
      ordered_item_quantity: item.quantity,
      item_customization_description: item.customization ?? null,
      item_price_amount: menuItem.menu_item_price_amount,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Could not add this item to the order.' } };
  }

  return { data: toOrderItem(data), error: null };
}

/**
 * @param {string} orderItemId
 * @param {number} quantity
 * @returns {Promise<{ data: import('../models/orderItem.js').OrderItem | null, error: ServiceError | null }>}
 */
export async function UpdateOrderItemQuantity(orderItemId, quantity) {
  if (!quantity || quantity <= 0) {
    return { data: null, error: { code: 'INVALID_QUANTITY', message: 'Quantity must be greater than zero.' } };
  }

  const { data: existing, error: lookupError } = await supabase
    .from('order_items')
    .select('associated_order_identifier')
    .eq('order_item_identifier', orderItemId)
    .maybeSingle();

  if (lookupError) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not look up this item.' } };
  }
  if (!existing) {
    return { data: null, error: { code: 'ORDER_ITEM_NOT_FOUND', message: 'Order item not found.' } };
  }

  const modifiable = await assertOrderIsModifiable(existing.associated_order_identifier);
  if (modifiable.error) return modifiable;

  const { data, error } = await supabase
    .from('order_items')
    .update({ ordered_item_quantity: quantity })
    .eq('order_item_identifier', orderItemId)
    .select()
    .single();

  if (error) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Could not update this item.' } };
  }

  return { data: toOrderItem(data), error: null };
}

/**
 * @param {string} orderItemId
 * @returns {Promise<{ data: null, error: ServiceError | null }>}
 */
export async function RemoveOrderItem(orderItemId) {
  const { data: existing, error: lookupError } = await supabase
    .from('order_items')
    .select('associated_order_identifier')
    .eq('order_item_identifier', orderItemId)
    .maybeSingle();

  if (lookupError) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not look up this item.' } };
  }
  if (!existing) {
    return { data: null, error: { code: 'ORDER_ITEM_NOT_FOUND', message: 'Order item not found.' } };
  }

  const modifiable = await assertOrderIsModifiable(existing.associated_order_identifier);
  if (modifiable.error) return modifiable;

  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('order_item_identifier', orderItemId);

  if (error) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Could not remove this item.' } };
  }

  return { data: null, error: null };
}

/**
 * @param {string} orderId
 * @returns {Promise<{ data: import('../models/orderItem.js').OrderItem[] | null, error: ServiceError | null }>}
 */
export async function ViewOrderItems(orderId) {
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('associated_order_identifier', orderId);

  if (error) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load order items.' } };
  }

  return { data: data.map(toOrderItem), error: null };
}

/**
 * @param {string} orderId
 * @returns {Promise<{ error: ServiceError | null }>}
 */
async function assertOrderIsModifiable(orderId) {
  const { data: order, error } = await supabase
    .from('orders')
    .select('order_status_type')
    .eq('order_identifier', orderId)
    .maybeSingle();

  if (error) {
    return { error: { code: 'LOOKUP_FAILED', message: 'Could not load the order.' } };
  }
  if (!order) {
    return { error: { code: 'ORDER_NOT_FOUND', message: 'Order not found.' } };
  }
  if (order.order_status_type !== 'Pending') {
    return { error: { code: 'ORDER_NOT_MODIFIABLE', message: 'Only pending orders can be changed.' } };
  }

  return { error: null };
}

function toOrderItem(row) {
  return {
    orderItemIdentifier: row.order_item_identifier,
    associatedOrderIdentifier: row.associated_order_identifier,
    associatedMenuItemIdentifier: row.associated_menu_item_identifier,
    orderedItemQuantity: row.ordered_item_quantity,
    itemCustomizationDescription: row.item_customization_description,
    itemPriceAmount: row.item_price_amount,
  };
}

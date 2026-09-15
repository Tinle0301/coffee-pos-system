// orderItems.js — order item operations within an order

/**
 * @param {string} orderId
 * @param {{ menuItemIdentifier: string, quantity: number, customization?: string }} item
 * @returns {Promise<import('../models/orderItem.js').OrderItem>}
 */
export async function AddOrderItem(orderId, item) {}

/**
 * @param {string} orderItemId
 * @param {number} quantity
 * @returns {Promise<import('../models/orderItem.js').OrderItem>}
 */
export async function UpdateOrderItemQuantity(orderItemId, quantity) {}

/**
 * @param {string} orderItemId
 * @returns {Promise<void>}
 */
export async function RemoveOrderItem(orderItemId) {}

/**
 * @param {string} orderId
 * @returns {Promise<import('../models/orderItem.js').OrderItem[]>}
 */
export async function ViewOrderItems(orderId) {}

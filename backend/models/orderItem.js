// orderItem.js — shape definition + validator for `order_items`
// (maps to 491A OrderItem). Columns: order_item_identifier,
// associated_order_identifier, associated_menu_item_identifier,
// ordered_item_quantity, item_customization_description, item_price_amount.

/**
 * @typedef {Object} OrderItem
 * @property {string} orderItemIdentifier
 * @property {string} associatedOrderIdentifier
 * @property {string} associatedMenuItemIdentifier
 * @property {number} orderedItemQuantity
 * @property {string|null} itemCustomizationDescription
 * @property {number} itemPriceAmount
 */

/**
 * @param {unknown} value
 * @returns {value is OrderItem}
 */
export function isValidOrderItem(value) {
  throw new Error('isValidOrderItem: not implemented');
}

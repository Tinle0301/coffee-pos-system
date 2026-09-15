// menuItem.js — shape definition + validator for `menu_items`
// (maps to 491A MenuItem). Columns: menu_item_identifier, menu_item_name,
// menu_item_category_type, menu_item_description_text,
// menu_item_price_amount, menu_item_availability_status.

/**
 * @typedef {Object} MenuItem
 * @property {string} menuItemIdentifier
 * @property {string} menuItemName
 * @property {string} menuItemCategoryType
 * @property {string|null} menuItemDescriptionText
 * @property {number} menuItemPriceAmount
 * @property {boolean} menuItemAvailabilityStatus
 */

/**
 * @param {unknown} value
 * @returns {value is MenuItem}
 */
export function isValidMenuItem(value) {
  throw new Error('isValidMenuItem: not implemented');
}

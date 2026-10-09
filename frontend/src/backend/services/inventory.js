// inventory.js — InventoryController (view for all staff, write for admin only)

/**
 * @returns {Promise<import('../models/inventoryItem.js').InventoryItem[]>}
 */
export async function listInventoryItems() {}

/**
 * @param {import('../models/inventoryItem.js').InventoryItem} item
 * @returns {Promise<import('../models/inventoryItem.js').InventoryItem>}
 */
export async function createInventoryItem(item) {}

/**
 * @param {string} inventoryItemId
 * @param {Partial<import('../models/inventoryItem.js').InventoryItem>} updates
 * @returns {Promise<import('../models/inventoryItem.js').InventoryItem>}
 */
export async function updateInventoryItem(inventoryItemId, updates) {}

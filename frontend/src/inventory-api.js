// inventory-api.js — the Inventory screen's only door to the backend.
//
// POS-44 provides the inventory service. This adapter preserves the
// listInventory() function expected by the existing Inventory screen.

import {
  listInventoryItems,
  restockInventoryItem,
} from './backend/services/inventory.js';

/**
 * Load all inventory items through the POS-44 inventory service.
 *
 * @returns {ReturnType<typeof listInventoryItems>}
 */
export async function listInventory() {
  return listInventoryItems();
}

/**
 * Add stock to one item (POS-58 restock function: updates the quantity and
 * writes the audit log). Resolves to { data: updatedItem, error } — the
 * error messages are already safe to show to the person.
 *
 * @param {string} inventoryItemId
 * @param {number} quantityToAdd
 * @returns {ReturnType<typeof restockInventoryItem>}
 */
export async function restockInventory(inventoryItemId, quantityToAdd) {
  return restockInventoryItem(inventoryItemId, quantityToAdd);
}

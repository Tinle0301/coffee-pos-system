// inventory-api.js — the Inventory screen's only door to the backend.
//
// POS-44 provides the inventory service. This adapter preserves the
// listInventory() function expected by the existing Inventory screen.

import {
  listInventoryItems,
} from './backend/services/inventory.js';

/**
 * Load all inventory items through the POS-44 inventory service.
 *
 * @returns {ReturnType<typeof listInventoryItems>}
 */
export async function listInventory() {
  return listInventoryItems();
}

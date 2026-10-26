// inventory-api.js — the Inventory screen's only door to the backend.
//
// Reads the inventory_items table directly (RLS inventory_items_select_staff
// lets any signed-in staff member read it). Returns { data, error } and never
// throws, like the services in ./backend/services/. When the backend team
// implements backend/services/inventory.js, swap the body of listInventory()
// for it — the screen only depends on this function's return shape.
import { supabase } from './backend/supabase-client.js';

/** @typedef {{ code: string, message: string }} ServiceError */
/** @typedef {{ inventoryItemIdentifier: string, inventoryItemName: string, availableQuantityValue: number,
 *   minimumStockThreshold: number, inventoryLastUpdatedTimestamp: string }} InventoryItem */

function toInventoryItem(row) {
  return {
    inventoryItemIdentifier: row.inventory_item_identifier,
    inventoryItemName: row.inventory_item_name,
    availableQuantityValue: Number(row.available_quantity_value),
    minimumStockThreshold: Number(row.minimum_stock_threshold),
    inventoryLastUpdatedTimestamp: row.inventory_last_updated_timestamp,
  };
}

/** @returns {Promise<{ data: InventoryItem[] | null, error: ServiceError | null }>} */
export async function listInventory() {
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('inventory_item_name');
    if (error) {
      return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load inventory.' } };
    }
    return { data: (data || []).map(toInventoryItem), error: null };
  } catch {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load inventory.' } };
  }
}

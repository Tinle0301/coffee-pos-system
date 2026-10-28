// inventory.js — InventoryController
// POS-44: list inventory, identify low-stock items, and restock inventory.
//
// Reads use inventory_items directly. Low-stock checks and stock changes use
// the POS-57 / POS-58 database functions so the service does not duplicate
// those rules or bypass restock audit logging.

import { supabase } from '../supabase-client.js';

/** @typedef {{ code: string, message: string }} ServiceError */

/**
 * List all inventory items, ordered by name.
 *
 * @returns {Promise<{
 *   data: import('../models/inventoryItem.js').InventoryItem[] | null,
 *   error: ServiceError | null
 * }>}
 */
export async function listInventoryItems() {
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('inventory_item_name', { ascending: true });

    if (error) {
      return {
        data: null,
        error: {
          code: 'LOOKUP_FAILED',
          message: 'Could not load inventory.',
        },
      };
    }

    return {
      data: (data ?? []).map(toInventoryItem),
      error: null,
    };
  } catch {
    return {
      data: null,
      error: {
        code: 'LOOKUP_FAILED',
        message: 'Could not load inventory.',
      },
    };
  }
}

/**
 * List only items whose available quantity is at or below their configured
 * minimum stock threshold. The database owns this rule (POS-57).
 *
 * @returns {Promise<{
 *   data: import('../models/inventoryItem.js').InventoryItem[] | null,
 *   error: ServiceError | null
 * }>}
 */
export async function listLowStockInventoryItems() {
  try {
    const { data, error } = await supabase.rpc(
      'list_low_stock_inventory'
    );

    if (error) {
      return {
        data: null,
        error: mapInventoryError(
          error,
          'LOOKUP_FAILED',
          'Could not load low-stock inventory.'
        ),
      };
    }

    return {
      data: (data ?? []).map(toInventoryItem),
      error: null,
    };
  } catch {
    return {
      data: null,
      error: {
        code: 'LOOKUP_FAILED',
        message: 'Could not load low-stock inventory.',
      },
    };
  }
}

/**
 * Add stock to one inventory item. The POS-58 database function performs the
 * update and writes the immutable inventory stock audit record.
 *
 * @param {string} inventoryItemId
 * @param {number} quantityToAdd
 * @returns {Promise<{
 *   data: import('../models/inventoryItem.js').InventoryItem | null,
 *   error: ServiceError | null
 * }>}
 */
export async function restockInventoryItem(
  inventoryItemId,
  quantityToAdd
) {
  const quantity = Number(quantityToAdd);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return {
      data: null,
      error: {
        code: 'INVALID_QUANTITY',
        message: 'Restock quantity must be greater than zero.',
      },
    };
  }

  try {
    const { data, error } = await supabase.rpc(
      'restock_inventory',
      {
        inventory_item_id: inventoryItemId,
        quantity_to_add: quantity,
      }
    );

    if (error) {
      return {
        data: null,
        error: mapInventoryError(
          error,
          'UPDATE_FAILED',
          'Could not restock the inventory item.'
        ),
      };
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return {
        data: null,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Could not restock the inventory item.',
        },
      };
    }

    return {
      data: toInventoryItem(row),
      error: null,
    };
  } catch {
    return {
      data: null,
      error: {
        code: 'UPDATE_FAILED',
        message: 'Could not restock the inventory item.',
      },
    };
  }
}

function toInventoryItem(row) {
  return {
    inventoryItemIdentifier:
      row.inventory_item_identifier,
    inventoryItemName:
      row.inventory_item_name,
    availableQuantityValue:
      Number(row.available_quantity_value),
    minimumStockThreshold:
      Number(row.minimum_stock_threshold),
    inventoryLastUpdatedTimestamp:
      row.inventory_last_updated_timestamp,
  };
}

const KNOWN_CODES = [
  'UNAUTHORIZED',
  'INVALID_QUANTITY',
  'INVENTORY_ITEM_NOT_FOUND',
];

function mapInventoryError(
  error,
  fallbackCode,
  fallbackMessage
) {
  const message = error?.message ?? '';
  const match = message.match(/^([A-Z_]+):\s*(.*)$/);

  if (match && KNOWN_CODES.includes(match[1])) {
    return {
      code: match[1],
      message: friendlyInventoryMessage(
        match[1],
        match[2]
      ),
    };
  }

  return {
    code: fallbackCode,
    message: fallbackMessage,
  };
}

function friendlyInventoryMessage(code, fallback) {
  switch (code) {
    case 'UNAUTHORIZED':
      return 'Only an admin can manage inventory stock.';

    case 'INVALID_QUANTITY':
      return 'Restock quantity must be greater than zero.';

    case 'INVENTORY_ITEM_NOT_FOUND':
      return 'Inventory item not found.';

    default:
      return fallback;
  }
}

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

/**
 * Add a new stock item (POS-85). Admin only: the inventory_items_write_admin
 * policy lets only an active admin insert, so no new database function is
 * needed. The starting quantity is not written to the stock audit log (that
 * log records later changes to an existing item's quantity).
 *
 * @param {{ inventoryItemName: string, availableQuantityValue: number, minimumStockThreshold: number }} item
 * @returns {Promise<{
 *   data: import('../models/inventoryItem.js').InventoryItem | null,
 *   error: ServiceError | null
 * }>}
 */
export async function createInventoryItem(item) {
  const name = String(item?.inventoryItemName ?? '').trim();
  const quantity = Number(item?.availableQuantityValue);
  const minimum = Number(item?.minimumStockThreshold);

  if (!name) {
    return {
      data: null,
      error: { code: 'INVALID_INVENTORY_ITEM', message: 'Item name is required.' },
    };
  }
  if (
    !Number.isFinite(quantity) || !Number.isFinite(minimum) ||
    quantity < 0 || minimum < 0
  ) {
    return {
      data: null,
      error: {
        code: 'INVALID_INVENTORY_ITEM',
        message: 'Quantity and reorder level must be zero or more.',
      },
    };
  }

  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        inventory_item_name: name,
        available_quantity_value: quantity,
        minimum_stock_threshold: minimum,
      })
      .select()
      .single();

    if (error || !data) {
      const denied =
        error?.code === '42501' ||
        /row-level security|permission denied/i.test(error?.message ?? '');
      return {
        data: null,
        error: denied
          ? { code: 'UNAUTHORIZED', message: 'Only an admin can add inventory items.' }
          : { code: 'CREATE_FAILED', message: 'Could not add the inventory item.' },
      };
    }

    return { data: toInventoryItem(data), error: null };
  } catch {
    return {
      data: null,
      error: { code: 'CREATE_FAILED', message: 'Could not add the inventory item.' },
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

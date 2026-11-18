// inventory-service.test.js — POS-44
// Tests the inventory service used by the Admin Inventory screen.

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest';

const rpc = vi.fn();

const query = {
  select: vi.fn(() => query),
  order: vi.fn(),
};

const from = vi.fn(() => query);

// Node cannot load the CDN-based Supabase client during unit tests,
// so replace it with controllable mocks.
vi.mock('./backend/supabase-client.js', () => ({
  supabase: {
    from: (...args) => from(...args),
    rpc: (...args) => rpc(...args),
  },
}));

const {
  listInventoryItems,
  listLowStockInventoryItems,
  restockInventoryItem,
  createInventoryItem,
} = await import('./backend/services/inventory.js');

const inventoryRow = {
  inventory_item_identifier: 'item-1',
  inventory_item_name: 'Espresso Beans',
  available_quantity_value: '25.00',
  minimum_stock_threshold: '5.00',
  inventory_last_updated_timestamp:
    '2026-10-20T12:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// -------------------------------------------------------------------------
// listInventoryItems
// -------------------------------------------------------------------------

describe('listInventoryItems', () => {
  it('lists inventory ordered by name and maps rows to camelCase', async () => {
    query.order.mockResolvedValue({
      data: [inventoryRow],
      error: null,
    });

    const { data, error } = await listInventoryItems();

    expect(from).toHaveBeenCalledWith('inventory_items');

    expect(query.order).toHaveBeenCalledWith(
      'inventory_item_name',
      { ascending: true }
    );

    expect(error).toBeNull();

    expect(data).toEqual([
      {
        inventoryItemIdentifier: 'item-1',
        inventoryItemName: 'Espresso Beans',
        availableQuantityValue: 25,
        minimumStockThreshold: 5,
        inventoryLastUpdatedTimestamp:
          '2026-10-20T12:00:00Z',
      },
    ]);
  });

  it('returns LOOKUP_FAILED when inventory cannot be loaded', async () => {
    query.order.mockResolvedValue({
      data: null,
      error: { message: 'database error' },
    });

    const { data, error } = await listInventoryItems();

    expect(data).toBeNull();

    expect(error).toEqual({
      code: 'LOOKUP_FAILED',
      message: 'Could not load inventory.',
    });
  });
});

// -------------------------------------------------------------------------
// listLowStockInventoryItems
// -------------------------------------------------------------------------

describe('listLowStockInventoryItems', () => {
  it('uses the POS-57 low-stock database function', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          ...inventoryRow,
          available_quantity_value: '5.00',
        },
      ],
      error: null,
    });

    const { data, error } =
      await listLowStockInventoryItems();

    expect(rpc).toHaveBeenCalledWith(
      'list_low_stock_inventory'
    );

    expect(error).toBeNull();

    expect(data[0]).toEqual({
      inventoryItemIdentifier: 'item-1',
      inventoryItemName: 'Espresso Beans',
      availableQuantityValue: 5,
      minimumStockThreshold: 5,
      inventoryLastUpdatedTimestamp:
        '2026-10-20T12:00:00Z',
    });
  });

  it('preserves the known UNAUTHORIZED error', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message:
          'UNAUTHORIZED: caller must be an active admin',
      },
    });

    const { data, error } =
      await listLowStockInventoryItems();

    expect(data).toBeNull();

    expect(error).toEqual({
      code: 'UNAUTHORIZED',
      message:
        'Only an admin can manage inventory stock.',
    });
  });

  it('hides unknown database errors behind LOOKUP_FAILED', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'internal database error' },
    });

    const { data, error } =
      await listLowStockInventoryItems();

    expect(data).toBeNull();

    expect(error).toEqual({
      code: 'LOOKUP_FAILED',
      message: 'Could not load low-stock inventory.',
    });
  });
});

// -------------------------------------------------------------------------
// restockInventoryItem
// -------------------------------------------------------------------------

describe('restockInventoryItem', () => {
  it('uses the POS-58 restock function and returns the updated item', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          ...inventoryRow,
          available_quantity_value: '30.00',
        },
      ],
      error: null,
    });

    const { data, error } =
      await restockInventoryItem('item-1', 5);

    expect(rpc).toHaveBeenCalledWith(
      'restock_inventory',
      {
        inventory_item_id: 'item-1',
        quantity_to_add: 5,
      }
    );

    expect(error).toBeNull();

    expect(data.availableQuantityValue).toBe(30);
  });

  it('rejects zero or negative quantities before calling the database', async () => {
    const zeroResult =
      await restockInventoryItem('item-1', 0);

    expect(zeroResult.error.code).toBe(
      'INVALID_QUANTITY'
    );

    const negativeResult =
      await restockInventoryItem('item-1', -2);

    expect(negativeResult.error.code).toBe(
      'INVALID_QUANTITY'
    );

    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps a missing inventory item to INVENTORY_ITEM_NOT_FOUND', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message:
          'INVENTORY_ITEM_NOT_FOUND: inventory item does not exist',
      },
    });

    const { data, error } =
      await restockInventoryItem('missing-item', 5);

    expect(data).toBeNull();

    expect(error).toEqual({
      code: 'INVENTORY_ITEM_NOT_FOUND',
      message: 'Inventory item not found.',
    });
  });

  it('hides unknown restock errors behind UPDATE_FAILED', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'something unexpected' },
    });

    const { data, error } =
      await restockInventoryItem('item-1', 5);

    expect(data).toBeNull();

    expect(error).toEqual({
      code: 'UPDATE_FAILED',
      message: 'Could not restock the inventory item.',
    });
  });
});

// -------------------------------------------------------------------------
// createInventoryItem (POS-85)
// -------------------------------------------------------------------------

describe('createInventoryItem', () => {
  const input = {
    inventoryItemName: '  Oat Milk  ',
    availableQuantityValue: 20,
    minimumStockThreshold: 5,
  };

  beforeEach(() => {
    query.insert = vi.fn(() => query);
    query.single = vi.fn();
  });

  it('inserts a trimmed name and the quantities, and returns the new item', async () => {
    query.single.mockResolvedValue({
      data: { ...inventoryRow, inventory_item_name: 'Oat Milk', available_quantity_value: '20.00' },
      error: null,
    });

    const { data, error } = await createInventoryItem(input);

    expect(from).toHaveBeenCalledWith('inventory_items');
    expect(query.insert).toHaveBeenCalledWith({
      inventory_item_name: 'Oat Milk',
      available_quantity_value: 20,
      minimum_stock_threshold: 5,
    });
    expect(error).toBeNull();
    expect(data.inventoryItemName).toBe('Oat Milk');
    expect(data.availableQuantityValue).toBe(20);
  });

  it('allows zero stock and a zero reorder level', async () => {
    query.single.mockResolvedValue({ data: inventoryRow, error: null });
    const { error } = await createInventoryItem({ ...input, availableQuantityValue: 0, minimumStockThreshold: 0 });
    expect(error).toBeNull();
  });

  it('rejects a blank name without calling the database', async () => {
    const { data, error } = await createInventoryItem({ ...input, inventoryItemName: '   ' });
    expect(data).toBeNull();
    expect(error.code).toBe('INVALID_INVENTORY_ITEM');
    expect(query.insert).not.toHaveBeenCalled();
  });

  it.each([-1, NaN, 'abc'])('rejects a bad quantity (%s) without calling the database', async (bad) => {
    const { error } = await createInventoryItem({ ...input, availableQuantityValue: bad });
    expect(error.code).toBe('INVALID_INVENTORY_ITEM');
    expect(query.insert).not.toHaveBeenCalled();
  });

  it('rejects a negative reorder level', async () => {
    const { error } = await createInventoryItem({ ...input, minimumStockThreshold: -2 });
    expect(error.code).toBe('INVALID_INVENTORY_ITEM');
    expect(query.insert).not.toHaveBeenCalled();
  });

  it('turns a row-level-security refusal into UNAUTHORIZED', async () => {
    query.single.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'new row violates row-level security policy for table "inventory_items"' },
    });
    const { data, error } = await createInventoryItem(input);
    expect(data).toBeNull();
    expect(error).toEqual({ code: 'UNAUTHORIZED', message: 'Only an admin can add inventory items.' });
  });

  it('hides unknown database errors behind CREATE_FAILED', async () => {
    query.single.mockResolvedValue({ data: null, error: { message: 'connection reset by peer' } });
    const { error } = await createInventoryItem(input);
    expect(error).toEqual({ code: 'CREATE_FAILED', message: 'Could not add the inventory item.' });
  });

  it('never throws', async () => {
    query.single.mockRejectedValue(new Error('network down'));
    const { data, error } = await createInventoryItem(input);
    expect(data).toBeNull();
    expect(error.code).toBe('CREATE_FAILED');
  });
});

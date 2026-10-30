import { describe, it, expect, vi } from 'vitest';
import { listInventory, restockInventory } from './inventory-api.js';
import { supabase } from './backend/supabase-client.js';

vi.mock('./backend/supabase-client.js', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));

const chain = (result) => ({ select: () => ({ order: () => Promise.resolve(result) }) });

describe('listInventory', () => {
  it('maps database columns to camelCase and numbers', async () => {
    supabase.from.mockReturnValue(chain({ data: [{
      inventory_item_identifier: 'u1', inventory_item_name: 'Beans',
      available_quantity_value: '25.00', minimum_stock_threshold: 5,
      inventory_last_updated_timestamp: '2026-10-20T12:00:00Z',
    }], error: null }));
    const { data, error } = await listInventory();
    expect(supabase.from).toHaveBeenCalledWith('inventory_items');
    expect(error).toBeNull();
    expect(data[0]).toEqual({
      inventoryItemIdentifier: 'u1', inventoryItemName: 'Beans',
      availableQuantityValue: 25, minimumStockThreshold: 5,
      inventoryLastUpdatedTimestamp: '2026-10-20T12:00:00Z',
    });
  });

  it('returns a safe message instead of the raw database error', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: { message: 'relation "x" does not exist' } }));
    const { data, error } = await listInventory();
    expect(data).toBeNull();
    expect(error.message).toBe('Could not load inventory.');
  });

  it('never throws', async () => {
    supabase.from.mockImplementation(() => { throw new Error('boom'); });
    const { error } = await listInventory();
    expect(error.code).toBe('LOOKUP_FAILED');
  });
});

describe('restockInventory', () => {
  it('calls the POS-58 restock function and returns the updated item', async () => {
    supabase.rpc.mockResolvedValue({ data: [{
      inventory_item_identifier: 'u1', inventory_item_name: 'Beans',
      available_quantity_value: '30.00', minimum_stock_threshold: '5.00',
      inventory_last_updated_timestamp: '2026-10-30T12:00:00Z',
    }], error: null });
    const { data, error } = await restockInventory('u1', 5);
    expect(supabase.rpc).toHaveBeenCalledWith('restock_inventory', { inventory_item_id: 'u1', quantity_to_add: 5 });
    expect(error).toBeNull();
    expect(data.availableQuantityValue).toBe(30);
  });

  it('rejects a zero quantity without calling the database', async () => {
    supabase.rpc.mockClear();
    const { error } = await restockInventory('u1', 0);
    expect(error.code).toBe('INVALID_QUANTITY');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inventoryScreen, stockLevel, sortBySeverity, countByLevel } from './inventory.js';
import { listInventory } from './inventory-api.js';

vi.mock('./inventory-api.js', () => ({ listInventory: vi.fn() }));

const item = (id, name, qty, min) => ({
  inventoryItemIdentifier: id, inventoryItemName: name,
  availableQuantityValue: qty, minimumStockThreshold: min,
  inventoryLastUpdatedTimestamp: '2026-10-20T12:00:00Z',
});
const makeItems = () => [
  item('1', 'Espresso Beans (lb)', 25, 5),
  item('2', 'Whole Milk (gal)', 2, 2),     // at threshold -> low
  item('3', 'Blueberry Muffins (each)', 0, 3), // out
  item('4', 'Oat Milk (gal)', 1.5, 2),     // low
];

describe('stock level rules', () => {
  it('is out at zero, low at or below the threshold, ok above it', () => {
    expect(stockLevel(item('a', 'A', 0, 3))).toBe('out');
    expect(stockLevel(item('a', 'A', 3, 3))).toBe('low');
    expect(stockLevel(item('a', 'A', 2.99, 3))).toBe('low');
    expect(stockLevel(item('a', 'A', 3.01, 3))).toBe('ok');
  });

  it('treats a threshold of 0 as ok while anything is in stock', () => {
    expect(stockLevel(item('a', 'A', 1, 0))).toBe('ok');
    expect(stockLevel(item('a', 'A', 0, 0))).toBe('out');
  });

  it('sorts out first, then low, then ok, by name within a level', () => {
    expect(sortBySeverity(makeItems()).map((i) => i.inventoryItemName)).toEqual([
      'Blueberry Muffins (each)', 'Oat Milk (gal)', 'Whole Milk (gal)', 'Espresso Beans (lb)',
    ]);
  });

  it('counts items per level', () => {
    expect(countByLevel(makeItems())).toEqual({ out: 1, low: 2, ok: 1 });
  });
});

describe('Inventory screen', () => {
  const $ = (s) => document.querySelector(s);
  const tick = () => new Promise((r) => setTimeout(r, 0));
  let navigate;

  async function mount() {
    document.body.innerHTML = inventoryScreen.render();
    navigate = vi.fn();
    await inventoryScreen.init(navigate);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    listInventory.mockResolvedValue({ data: makeItems(), error: null });
  });

  it('shows out / low / in-stock counts', async () => {
    await mount();
    const nums = [...document.querySelectorAll('.inventory-count-num')].map((n) => n.textContent);
    expect(nums).toEqual(['1', '2', '1']);
  });

  it('lists the worst items first and marks each with a badge', async () => {
    await mount();
    const rows = [...document.querySelectorAll('.inventory-row')];
    expect(rows.map((r) => r.querySelector('.inventory-name').textContent)).toEqual([
      'Blueberry Muffins (each)', 'Oat Milk (gal)', 'Whole Milk (gal)', 'Espresso Beans (lb)',
    ]);
    expect(rows[0].classList.contains('inventory-row--out')).toBe(true);
    expect(rows[1].classList.contains('inventory-row--low')).toBe(true);
    expect(rows[3].classList.contains('inventory-row--ok')).toBe(true);
    expect(rows[0].querySelector('.inventory-badge').textContent).toBe('Out of stock');
  });

  it('shows quantity and reorder level', async () => {
    await mount();
    expect(document.body.textContent).toContain('25 on hand');
    expect(document.body.textContent).toContain('1.5 on hand');
    expect(document.body.textContent).toContain('Reorder at 5');
  });

  it('"Needs attention" hides items that are in stock', async () => {
    await mount();
    document.querySelector('[data-filter="attention"]').click();
    const names = [...document.querySelectorAll('.inventory-name')].map((n) => n.textContent);
    expect(names).not.toContain('Espresso Beans (lb)');
    expect(names).toHaveLength(3);
    expect(document.querySelector('[data-filter="attention"]').getAttribute('aria-pressed')).toBe('true');
    document.querySelector('[data-filter="all"]').click();
    expect(document.querySelectorAll('.inventory-row')).toHaveLength(4);
  });

  it('says everything is stocked when nothing needs attention', async () => {
    listInventory.mockResolvedValue({ data: [item('1', 'Beans', 25, 5)], error: null });
    await mount();
    document.querySelector('[data-filter="attention"]').click();
    expect($('.inventory-allgood').textContent).toContain('Nothing needs attention');
  });

  it('shows a friendly message when loading fails', async () => {
    listInventory.mockResolvedValue({ data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load inventory.' } });
    await mount();
    expect($('#inventory-list').textContent).toContain('Could not load inventory.');
  });

  it('Refresh reloads the data and ignores taps while loading', async () => {
    await mount();
    let finish;
    listInventory.mockReturnValue(new Promise((r) => { finish = r; }));
    const refresh = $('#inventory-refresh-btn');
    refresh.click();
    refresh.click();
    expect(listInventory).toHaveBeenCalledTimes(2); // initial load + one refresh
    expect(refresh.disabled).toBe(true);
    finish({ data: [item('9', 'Cups', 100, 20)], error: null });
    await tick();
    expect($('.inventory-name').textContent).toBe('Cups');
  });

  it('escapes item names', async () => {
    listInventory.mockResolvedValue({ data: [item('1', '<img src=x onerror=alert(1)>', 5, 1)], error: null });
    await mount();
    expect($('#inventory-list img')).toBeNull();
  });

  it('goes back to Admin Home', async () => {
    await mount();
    $('#inventory-back-btn').click();
    expect(navigate).toHaveBeenCalledWith('admin');
  });
});

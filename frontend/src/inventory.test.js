// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inventoryScreen, stockLevel, sortBySeverity, countByLevel, validateRestockAmount } from './inventory.js';
import { listInventory, restockInventory } from './inventory-api.js';

vi.mock('./inventory-api.js', () => ({ listInventory: vi.fn(), restockInventory: vi.fn() }));

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

describe('validateRestockAmount', () => {
  it('accepts positive numbers with up to two decimals', () => {
    expect(validateRestockAmount('10')).toEqual({ value: 10 });
    expect(validateRestockAmount(' 2.5 ')).toEqual({ value: 2.5 });
    expect(validateRestockAmount('0.25')).toEqual({ value: 0.25 });
  });

  it.each(['', '  ', 'abc', '-5', '1,000', '1.234', '1e3'])('rejects "%s"', (raw) => {
    expect(validateRestockAmount(raw).error).toBeTruthy();
  });

  it('rejects zero and absurdly large amounts', () => {
    expect(validateRestockAmount('0').error).toContain('greater than zero');
    expect(validateRestockAmount('10000').error).toContain('too much');
    expect(validateRestockAmount('9999.99').value).toBe(9999.99);
  });
});

describe('Inventory screen Restock', () => {
  const $ = (s) => document.querySelector(s);
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const submit = () => $('#restock-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  const type = (v) => { $('#restock-amount').value = v; $('#restock-amount').dispatchEvent(new Event('input')); };

  async function mount() {
    document.body.innerHTML = inventoryScreen.render();
    await inventoryScreen.init(vi.fn());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    listInventory.mockResolvedValue({ data: makeItems(), error: null });
  });

  it('has a Restock button on every row', async () => {
    await mount();
    expect(document.querySelectorAll('.inventory-restock-btn')).toHaveLength(4);
  });

  it('opens a dialog for the chosen item showing what is on hand', async () => {
    await mount();
    $('.inventory-restock-btn[data-item-id="3"]').click();
    expect($('#restock-modal').hidden).toBe(false);
    expect($('#restock-title').textContent).toBe('Restock Blueberry Muffins (each)');
    expect($('#restock-current').textContent).toContain('0 on hand');
  });

  it('previews the new total while typing', async () => {
    await mount();
    $('.inventory-restock-btn[data-item-id="4"]').click(); // Oat Milk 1.5
    type('10');
    expect($('#restock-preview').textContent).toBe('New total: 11.5');
    type('abc');
    expect($('#restock-preview').textContent).toBe('');
  });

  it('restocks through the service and updates the row, counts and message', async () => {
    restockInventory.mockResolvedValue({ data: item('3', 'Blueberry Muffins (each)', 12, 3), error: null });
    await mount();
    $('.inventory-restock-btn[data-item-id="3"]').click();
    type('12');
    submit();
    await tick();
    expect(restockInventory).toHaveBeenCalledWith('3', 12);
    expect($('#restock-modal').hidden).toBe(true);
    expect($('#inventory-message').textContent).toBe('Added 12 to Blueberry Muffins (each). Now 12 on hand.');
    const nums = [...document.querySelectorAll('.inventory-count-num')].map((n) => n.textContent);
    expect(nums).toEqual(['0', '2', '2']); // the out-of-stock item is now fine
  });

  it('shows an error under the box and does not call the service for bad input', async () => {
    await mount();
    $('.inventory-restock-btn[data-item-id="1"]').click();
    type('-3');
    submit();
    await tick();
    expect(restockInventory).not.toHaveBeenCalled();
    expect($('#restock-amount-error').textContent).toBeTruthy();
    expect($('#restock-modal').hidden).toBe(false);
  });

  it('ignores a second submit while saving', async () => {
    let finish;
    restockInventory.mockReturnValue(new Promise((r) => { finish = r; }));
    await mount();
    $('.inventory-restock-btn[data-item-id="1"]').click();
    type('5');
    submit();
    submit();
    expect(restockInventory).toHaveBeenCalledTimes(1);
    expect($('#restock-save').disabled).toBe(true);
    finish({ data: item('1', 'Espresso Beans (lb)', 30, 5), error: null });
    await tick();
    expect($('#restock-modal').hidden).toBe(true);
  });

  it('keeps the dialog open with the service message when restocking fails', async () => {
    restockInventory.mockResolvedValue({ data: null, error: { code: 'UNAUTHORIZED', message: 'Only an admin can restock inventory.' } });
    await mount();
    $('.inventory-restock-btn[data-item-id="1"]').click();
    type('5');
    submit();
    await tick();
    expect($('#restock-modal').hidden).toBe(false);
    expect($('#restock-error').textContent).toBe('Only an admin can restock inventory.');
    expect($('#restock-amount').value).toBe('5');
    expect($('#restock-save').disabled).toBe(false);
    // the list is unchanged
    expect(document.body.textContent).toContain('25 on hand');
  });

  it('Cancel closes the dialog without restocking', async () => {
    await mount();
    $('.inventory-restock-btn[data-item-id="1"]').click();
    $('#restock-cancel').click();
    expect($('#restock-modal').hidden).toBe(true);
    expect(restockInventory).not.toHaveBeenCalled();
  });
});

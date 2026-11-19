// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inventoryScreen, stockLevel, sortBySeverity, countByLevel, validateRestockAmount, validateNewItem } from './inventory.js';
import { listInventory, restockInventory, addInventoryItem } from './inventory-api.js';

vi.mock('./inventory-api.js', () => ({ listInventory: vi.fn(), restockInventory: vi.fn(), addInventoryItem: vi.fn() }));

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

// ---------- POS-85: Add item ----------
describe('validateNewItem', () => {
  const ok = { name: 'Oat Milk', quantity: '20', minimum: '5' };

  it('accepts a good form and trims the name', () => {
    expect(validateNewItem({ ...ok, name: '  Oat   Syrup ' }).value).toEqual({
      inventoryItemName: 'Oat Syrup', availableQuantityValue: 20, minimumStockThreshold: 5,
    });
  });

  it('allows 0 for the starting amount and the reorder level', () => {
    expect(validateNewItem({ ...ok, quantity: '0', minimum: '0' }).value).toMatchObject({
      availableQuantityValue: 0, minimumStockThreshold: 0,
    });
  });

  it('asks for each missing field', () => {
    const { errors } = validateNewItem({ name: '', quantity: '', minimum: '' });
    expect(errors.name).toBe('Enter the item name.');
    expect(errors.quantity).toMatch(/starting amount/);
    expect(errors.minimum).toMatch(/reorder level/);
  });

  it.each(['-1', 'abc', '1.234', '1e3'])('rejects the number "%s"', (bad) => {
    expect(validateNewItem({ ...ok, quantity: bad }).errors.quantity).toBe('Use a number like 10 or 2.5.');
  });

  it('caps very large numbers', () => {
    expect(validateNewItem({ ...ok, minimum: '10000' }).errors.minimum).toMatch(/9,999.99/);
  });

  it('rejects a name that already exists (ignoring case and spacing)', () => {
    const existing = [item('1', 'Whole Milk (gal)', 2, 2)];
    expect(validateNewItem({ ...ok, name: ' whole milk (GAL) ' }, existing).errors.name).toMatch(/already exists/);
  });

  it('rejects a name that is too long', () => {
    expect(validateNewItem({ ...ok, name: 'x'.repeat(81) }).errors.name).toMatch(/80 characters/);
  });
});

describe('Inventory screen: Add item', () => {
  const $ = (s) => document.querySelector(s);
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const fill = (name, quantity, minimum) => {
    $('#add-item-name').value = name;
    $('#add-item-quantity').value = quantity;
    $('#add-item-minimum').value = minimum;
  };
  const submit = () => $('#add-item-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

  async function mount() {
    document.body.innerHTML = inventoryScreen.render();
    await inventoryScreen.init(vi.fn());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    listInventory.mockResolvedValue({ data: makeItems(), error: null });
    addInventoryItem.mockResolvedValue({ data: item('9', 'Vanilla Syrup', 8, 2), error: null });
  });

  it('shows an "+ Add item" button and a closed form', async () => {
    await mount();
    expect($('#inventory-add-btn').textContent).toBe('+ Add item');
    expect($('#add-item-modal').hidden).toBe(true);
  });

  it('opens an empty form with the cursor in the name box', async () => {
    await mount();
    $('#inventory-add-btn').click();
    expect($('#add-item-modal').hidden).toBe(false);
    expect($('#add-item-name').value).toBe('');
    expect(document.activeElement).toBe($('#add-item-name'));
  });

  it('shows errors and sends nothing when the form is empty', async () => {
    await mount();
    $('#inventory-add-btn').click();
    submit();
    await tick();
    expect($('#add-item-name-error').textContent).toBe('Enter the item name.');
    expect($('#add-item-quantity-error').textContent).not.toBe('');
    expect(addInventoryItem).not.toHaveBeenCalled();
    expect($('#add-item-modal').hidden).toBe(false);
  });

  it('blocks a duplicate name before calling the service', async () => {
    await mount();
    $('#inventory-add-btn').click();
    fill('whole milk (gal)', '5', '2');
    submit();
    await tick();
    expect($('#add-item-name-error').textContent).toMatch(/already exists/);
    expect(addInventoryItem).not.toHaveBeenCalled();
  });

  it('adds the item, closes the form, shows a message and lists the new row', async () => {
    await mount();
    $('#inventory-add-btn').click();
    fill('Vanilla Syrup', '8', '2');
    submit();
    await tick();
    expect(addInventoryItem).toHaveBeenCalledWith({
      inventoryItemName: 'Vanilla Syrup', availableQuantityValue: 8, minimumStockThreshold: 2,
    });
    expect($('#add-item-modal').hidden).toBe(true);
    expect($('#inventory-message').textContent).toBe('Added Vanilla Syrup with 8 on hand.');
    const names = [...document.querySelectorAll('.inventory-name')].map((n) => n.textContent);
    expect(names).toContain('Vanilla Syrup');
    expect(document.querySelectorAll('.inventory-row')).toHaveLength(5);
  });

  it('keeps the form open with a friendly message when the service fails', async () => {
    addInventoryItem.mockResolvedValue({ data: null, error: { code: 'UNAUTHORIZED', message: 'Only an admin can add inventory items.' } });
    await mount();
    $('#inventory-add-btn').click();
    fill('Vanilla Syrup', '8', '2');
    submit();
    await tick();
    expect($('#add-item-error').textContent).toBe('Only an admin can add inventory items.');
    expect($('#add-item-modal').hidden).toBe(false);
    expect($('#add-item-name').value).toBe('Vanilla Syrup'); // what they typed is kept
    expect(document.querySelectorAll('.inventory-row')).toHaveLength(4);
  });

  it('ignores a second tap while the first is still saving', async () => {
    let release;
    addInventoryItem.mockReturnValue(new Promise((r) => { release = r; }));
    await mount();
    $('#inventory-add-btn').click();
    fill('Vanilla Syrup', '8', '2');
    submit();
    submit();
    await tick();
    expect(addInventoryItem).toHaveBeenCalledTimes(1);
    expect($('#add-item-save').disabled).toBe(true);
    release({ data: item('9', 'Vanilla Syrup', 8, 2), error: null });
    await tick();
    expect($('#add-item-save').disabled).toBe(false);
  });

  it('closes with Cancel and with Escape without saving', async () => {
    await mount();
    $('#inventory-add-btn').click();
    $('#add-item-cancel').click();
    expect($('#add-item-modal').hidden).toBe(true);
    $('#inventory-add-btn').click();
    $('#add-item-modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect($('#add-item-modal').hidden).toBe(true);
    expect(addInventoryItem).not.toHaveBeenCalled();
  });

  it('shows a new low item as needing attention', async () => {
    addInventoryItem.mockResolvedValue({ data: item('9', 'Vanilla Syrup', 1, 2), error: null });
    await mount();
    $('#inventory-add-btn').click();
    fill('Vanilla Syrup', '1', '2');
    submit();
    await tick();
    const row = [...document.querySelectorAll('.inventory-row')].find((r) => r.textContent.includes('Vanilla Syrup'));
    expect(row.classList.contains('inventory-row--low')).toBe(true);
  });
});

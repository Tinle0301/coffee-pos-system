// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminHomeScreen, ADMIN_SECTIONS, inventoryAlert } from './admin-home.js';
import { listInventory } from './inventory-api.js';

vi.mock('./inventory-api.js', () => ({ listInventory: vi.fn() }));

const admin = { staffRole: 'Admin', staffName: 'Ada Admin' };

function mount(state) {
  document.body.innerHTML = `<main id="app-content">${adminHomeScreen.render(state)}</main>`;
}

describe('admin home screen', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    listInventory.mockResolvedValue({ data: [], error: null });
  });

  it('renders a tile for every configured admin screen', () => {
    mount(admin);
    const total = ADMIN_SECTIONS.reduce((n, s) => n + s.tiles.length, 0);
    expect(document.querySelectorAll('.admin-tile')).toHaveLength(total);
    expect(document.body.textContent).toContain('Refunds');
    expect(document.body.textContent).toContain('Active Orders');
    expect(document.body.textContent).toContain('Menu Management');
  });

  it('every tile opens a screen now (no "Coming soon" tiles left)', () => {
    mount(admin);
    expect(document.querySelectorAll('.admin-tile--soon').length).toBe(0);
    const routes = [...document.querySelectorAll('.admin-tile')].map((t) => t.dataset.route);
    expect(routes).toEqual(expect.arrayContaining(['transactions', 'staff', 'sales-report']));
    routes.forEach((r) => expect(r).toBeTruthy());
  });

  it('navigates to the tile route on click', () => {
    mount(admin);
    const navigate = vi.fn();
    adminHomeScreen.init(navigate);
    document.querySelector('[data-route="refund"]').click();
    document.querySelector('[data-route="queue"]').click();
    expect(navigate).toHaveBeenNthCalledWith(1, 'refund');
    expect(navigate).toHaveBeenNthCalledWith(2, 'queue');
  });

  it('shows an admins-only panel to non-admins', () => {
    mount({ staffRole: 'Barista' });
    expect(document.querySelectorAll('.admin-tile')).toHaveLength(0);
    expect(document.body.textContent).toContain('Admins only');
  });

  it('escapes the staff name', () => {
    mount({ staffRole: 'Admin', staffName: '<img src=x onerror=alert(1)>' });
    expect(document.querySelector('.admin-home img')).toBeNull();
  });
});

describe('Inventory tile low-stock badge', () => {
  const item = (name, qty, min) => ({ inventoryItemName: name, availableQuantityValue: qty, minimumStockThreshold: min });
  const badge = () => document.querySelector('[data-alert="inventory"]');

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  async function open(items, state = admin) {
    listInventory.mockResolvedValue(items instanceof Error ? { data: null, error: { code: 'X', message: 'nope' } } : { data: items, error: null });
    document.body.innerHTML = `<main id="app-content">${adminHomeScreen.render(state)}</main>`;
    await adminHomeScreen.init(vi.fn());
  }

  it('words the badge for each situation', () => {
    expect(inventoryAlert([item('a', 25, 5)])).toEqual({ text: 'All stocked', level: 'ok' });
    expect(inventoryAlert([item('a', 2, 5), item('b', 5, 5), item('c', 9, 5)])).toEqual({ text: '2 low', level: 'low' });
    expect(inventoryAlert([item('a', 0, 5), item('b', 2, 5)])).toEqual({ text: '2 low \u00b7 1 out', level: 'out' });
    expect(inventoryAlert([])).toEqual({ text: 'All stocked', level: 'ok' });
  });

  it('only the Inventory tile has a badge, hidden until the stock levels arrive', () => {
    document.body.innerHTML = `<main>${adminHomeScreen.render(admin)}</main>`;
    expect(document.querySelectorAll('.admin-tile-alert')).toHaveLength(1);
    expect(badge().hidden).toBe(true);
    expect(badge().closest('.admin-tile').dataset.route).toBe('inventory');
  });

  it('shows how many items are low as soon as Admin Home opens', async () => {
    await open([item('Beans', 2, 5), item('Milk', 1, 2), item('Muffins', 12, 3)]);
    expect(badge().hidden).toBe(false);
    expect(badge().textContent).toBe('2 low');
    expect(badge().classList.contains('is-low')).toBe(true);
  });

  it('turns red and counts items that are out', async () => {
    await open([item('Beans', 0, 5), item('Milk', 1, 2)]);
    expect(badge().textContent).toBe('2 low \u00b7 1 out');
    expect(badge().classList.contains('is-out')).toBe(true);
  });

  it('says everything is stocked when nothing is low', async () => {
    await open([item('Beans', 25, 5)]);
    expect(badge().textContent).toBe('All stocked');
    expect(badge().classList.contains('is-ok')).toBe(true);
  });

  it('stays hidden, without breaking the page, when stock cannot be loaded', async () => {
    await open(new Error('x'));
    expect(badge().hidden).toBe(true);
    expect(document.querySelectorAll('.admin-tile').length).toBeGreaterThan(0);
  });

  it('survives the inventory call throwing', async () => {
    listInventory.mockRejectedValue(new Error('network'));
    document.body.innerHTML = `<main>${adminHomeScreen.render(admin)}</main>`;
    await expect(adminHomeScreen.init(vi.fn())).resolves.toBeUndefined();
    expect(badge().hidden).toBe(true);
  });

  it('does not ask for inventory when a non-admin sees the denied panel', async () => {
    await open([item('Beans', 0, 5)], { staffRole: 'Barista' });
    expect(listInventory).not.toHaveBeenCalled();
  });
});

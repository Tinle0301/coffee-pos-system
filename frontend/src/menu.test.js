// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { menuScreen } from './menu.js';
import { listMenuItems, updateMenuItem } from './backend/services/menu.js';

vi.mock('./backend/services/menu.js', () => ({
  listMenuItems: vi.fn(),
  updateMenuItem: vi.fn(),
}));

// camelCase — matches the real backend/services/menu.js contract.
const makeItems = () => [
  { menuItemIdentifier: '1', menuItemName: 'Latte', menuItemCategoryType: 'Espresso', menuItemPriceAmount: 4.5, menuItemAvailabilityStatus: true },
  { menuItemIdentifier: '2', menuItemName: 'Cold Brew', menuItemCategoryType: 'Brewed', menuItemPriceAmount: 3.75, menuItemAvailabilityStatus: false },
];

describe('Browse menu by category', () => {
  it('groups items by category', () => {
    const grouped = menuScreen.groupByCategory(makeItems());
    expect(grouped.Espresso).toHaveLength(1);
    expect(grouped.Brewed[0].menuItemName).toBe('Cold Brew');
  });

  it('renders a switch per item with its on/off state', () => {
    const html = menuScreen.generateMenuHTML(menuScreen.groupByCategory(makeItems()));
    document.body.innerHTML = html;
    const switches = document.querySelectorAll('.menu-toggle');
    expect(switches).toHaveLength(2);
    expect(document.querySelector('[data-item-id="1"]').getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('[data-item-id="2"]').getAttribute('aria-checked')).toBe('false');
    expect(html).toContain('Sold out');
  });

  it('escapes item names', () => {
    const html = menuScreen.generateMenuHTML({ X: [{ menuItemIdentifier: '9', menuItemName: '<b>Hack</b>', menuItemCategoryType: 'X', menuItemPriceAmount: 1, menuItemAvailabilityStatus: true }] });
    expect(html).not.toContain('<b>Hack</b>');
  });
});

describe('Menu screen on/off toggling', () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  let navigate;

  async function mount() {
    document.body.innerHTML = menuScreen.render();
    navigate = vi.fn();
    await menuScreen.init(navigate);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    listMenuItems.mockResolvedValue({ data: makeItems(), error: null });
  });

  it('lists items and shows how many are on', async () => {
    await mount();
    expect(document.querySelectorAll('.menu-admin-row')).toHaveLength(2);
    expect(document.getElementById('menu-admin-summary').textContent).toBe('1 of 2 items on');
  });

  it('turns an item off through the service and updates the screen', async () => {
    updateMenuItem.mockResolvedValue({ data: { menuItemIdentifier: '1' }, error: null });
    await mount();
    document.querySelector('[data-item-id="1"]').click();
    await tick();
    expect(updateMenuItem).toHaveBeenCalledWith('1', { menuItemAvailabilityStatus: false });
    expect(document.querySelector('[data-item-id="1"]').getAttribute('aria-checked')).toBe('false');
    expect(document.getElementById('menu-admin-summary').textContent).toBe('0 of 2 items on');
    expect(document.getElementById('menu-admin-message').textContent).toContain('sold out');
  });

  it('turns a sold-out item back on', async () => {
    updateMenuItem.mockResolvedValue({ data: { menuItemIdentifier: '2' }, error: null });
    await mount();
    document.querySelector('[data-item-id="2"]').click();
    await tick();
    expect(updateMenuItem).toHaveBeenCalledWith('2', { menuItemAvailabilityStatus: true });
    expect(document.querySelector('[data-item-id="2"]').getAttribute('aria-checked')).toBe('true');
  });

  it('ignores a second tap while the first request is still running', async () => {
    let finish;
    updateMenuItem.mockReturnValue(new Promise((r) => { finish = r; }));
    await mount();
    const btn = document.querySelector('[data-item-id="1"]');
    btn.click();
    btn.click();
    expect(updateMenuItem).toHaveBeenCalledTimes(1);
    expect(btn.disabled).toBe(true);
    finish({ data: {}, error: null });
    await tick();
  });

  it('shows a friendly message and keeps the old state when the update fails', async () => {
    updateMenuItem.mockResolvedValue({ data: null, error: { code: 'UNAUTHORIZED', message: 'Could not update the menu item.' } });
    await mount();
    document.querySelector('[data-item-id="1"]').click();
    await tick();
    const msg = document.getElementById('menu-admin-message');
    expect(msg.textContent).toContain("Couldn't update Latte");
    expect(msg.classList.contains('is-error')).toBe(true);
    expect(document.querySelector('[data-item-id="1"]').getAttribute('aria-checked')).toBe('true');
  });

  it('shows the load error instead of a list', async () => {
    listMenuItems.mockResolvedValue({ data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load the menu.' } });
    await mount();
    expect(document.getElementById('menu-categories').textContent).toContain('Could not load the menu.');
  });

  it('goes back to Admin Home', async () => {
    await mount();
    document.getElementById('menu-back-btn').click();
    expect(navigate).toHaveBeenCalledWith('admin');
  });
});

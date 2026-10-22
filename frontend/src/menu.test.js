// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { menuScreen, validateMenuItemForm } from './menu.js';
import { listMenuItems, createMenuItem, updateMenuItem } from './backend/services/menu.js';

vi.mock('./backend/services/menu.js', () => ({
  listMenuItems: vi.fn(),
  createMenuItem: vi.fn(),
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
    expect(document.querySelector('.menu-toggle[data-item-id="1"]').getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('.menu-toggle[data-item-id="2"]').getAttribute('aria-checked')).toBe('false');
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
    document.querySelector('.menu-toggle[data-item-id="1"]').click();
    await tick();
    expect(updateMenuItem).toHaveBeenCalledWith('1', { menuItemAvailabilityStatus: false });
    expect(document.querySelector('.menu-toggle[data-item-id="1"]').getAttribute('aria-checked')).toBe('false');
    expect(document.getElementById('menu-admin-summary').textContent).toBe('0 of 2 items on');
    expect(document.getElementById('menu-admin-message').textContent).toContain('sold out');
  });

  it('turns a sold-out item back on', async () => {
    updateMenuItem.mockResolvedValue({ data: { menuItemIdentifier: '2' }, error: null });
    await mount();
    document.querySelector('.menu-toggle[data-item-id="2"]').click();
    await tick();
    expect(updateMenuItem).toHaveBeenCalledWith('2', { menuItemAvailabilityStatus: true });
    expect(document.querySelector('.menu-toggle[data-item-id="2"]').getAttribute('aria-checked')).toBe('true');
  });

  it('ignores a second tap while the first request is still running', async () => {
    let finish;
    updateMenuItem.mockReturnValue(new Promise((r) => { finish = r; }));
    await mount();
    const btn = document.querySelector('.menu-toggle[data-item-id="1"]');
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
    document.querySelector('.menu-toggle[data-item-id="1"]').click();
    await tick();
    const msg = document.getElementById('menu-admin-message');
    expect(msg.textContent).toContain("Couldn't update Latte");
    expect(msg.classList.contains('is-error')).toBe(true);
    expect(document.querySelector('.menu-toggle[data-item-id="1"]').getAttribute('aria-checked')).toBe('true');
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

describe('validateMenuItemForm', () => {
  const others = makeItems();

  it('accepts a good item and rounds the price', () => {
    const { errors, values } = validateMenuItemForm({ name: ' Mocha ', category: 'Espresso', price: '$5.5' }, others);
    expect(errors).toEqual({});
    expect(values).toEqual({ name: 'Mocha', category: 'Espresso', price: 5.5 });
  });

  it('requires a name, category and price', () => {
    const { errors } = validateMenuItemForm({ name: '  ', category: '', price: '' }, others);
    expect(Object.keys(errors).sort()).toEqual(['category', 'name', 'price']);
  });

  it.each(['abc', '-1', '4.567', '1,000', '1000'])('rejects the price "%s"', (price) => {
    expect(validateMenuItemForm({ name: 'X', category: 'Espresso', price }, others).errors.price).toBeTruthy();
  });

  it('allows a free item (0.00)', () => {
    expect(validateMenuItemForm({ name: 'Water', category: 'Espresso', price: '0' }, others).errors.price).toBeUndefined();
  });

  it('rejects a duplicate name in the same category, ignoring case', () => {
    const { errors } = validateMenuItemForm({ name: 'latte', category: 'espresso', price: '4' }, others);
    expect(errors.name).toContain('already');
  });

  it('allows the same name in a different category', () => {
    expect(validateMenuItemForm({ name: 'Latte', category: 'Brewed', price: '4' }, others).errors.name).toBeUndefined();
  });
});

describe('Menu screen add and edit form', () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const $ = (sel) => document.querySelector(sel);
  const submit = () => $('#menu-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

  async function mount() {
    document.body.innerHTML = menuScreen.render();
    await menuScreen.init(vi.fn());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    listMenuItems.mockResolvedValue({ data: makeItems(), error: null });
  });

  it('opens an empty add form', async () => {
    await mount();
    expect($('#menu-form-modal').hidden).toBe(true);
    $('#menu-add-btn').click();
    expect($('#menu-form-modal').hidden).toBe(false);
    expect($('#menu-form-title').textContent).toBe('Add menu item');
    expect($('#menu-form-name').value).toBe('');
  });

  it('adds an item through the service and shows it in the list', async () => {
    createMenuItem.mockResolvedValue({ data: { menuItemIdentifier: '3', menuItemName: 'Mocha', menuItemCategoryType: 'Espresso', menuItemPriceAmount: 5.25, menuItemAvailabilityStatus: true }, error: null });
    await mount();
    $('#menu-add-btn').click();
    $('#menu-form-name').value = 'Mocha';
    $('#menu-form-category').value = 'Espresso';
    $('#menu-form-price').value = '5.25';
    submit();
    await tick();
    expect(createMenuItem).toHaveBeenCalledWith({ menuItemName: 'Mocha', menuItemCategoryType: 'Espresso', menuItemPriceAmount: 5.25, menuItemAvailabilityStatus: true });
    expect($('#menu-form-modal').hidden).toBe(true);
    expect(document.body.textContent).toContain('Mocha');
    expect($('#menu-admin-summary').textContent).toBe('2 of 3 items on');
  });

  it('creates a new category from the "New category" option', async () => {
    createMenuItem.mockResolvedValue({ data: { menuItemIdentifier: '4', menuItemName: 'Bagel', menuItemCategoryType: 'Bakery', menuItemPriceAmount: 3, menuItemAvailabilityStatus: true }, error: null });
    await mount();
    $('#menu-add-btn').click();
    $('#menu-form-category').value = '__new__';
    $('#menu-form-category').dispatchEvent(new Event('change'));
    expect($('#menu-form-new-category').hidden).toBe(false);
    $('#menu-form-new-category').value = 'Bakery';
    $('#menu-form-name').value = 'Bagel';
    $('#menu-form-price').value = '3';
    submit();
    await tick();
    expect(createMenuItem.mock.calls[0][0].menuItemCategoryType).toBe('Bakery');
  });

  it('shows field errors and does not call the service when the form is invalid', async () => {
    await mount();
    $('#menu-add-btn').click();
    $('#menu-form-price').value = 'free';
    submit();
    await tick();
    expect(createMenuItem).not.toHaveBeenCalled();
    expect($('#menu-form-name-error').textContent).toBeTruthy();
    expect($('#menu-form-price-error').textContent).toBeTruthy();
    expect($('#menu-form-modal').hidden).toBe(false);
  });

  it('prefills the edit form and sends only the changed fields', async () => {
    updateMenuItem.mockResolvedValue({ data: { menuItemIdentifier: '1', menuItemName: 'Latte', menuItemCategoryType: 'Espresso', menuItemPriceAmount: 4.75, menuItemAvailabilityStatus: true }, error: null });
    await mount();
    $('.menu-edit-btn[data-item-id="1"]').click();
    expect($('#menu-form-title').textContent).toBe('Edit Latte');
    expect($('#menu-form-name').value).toBe('Latte');
    expect($('#menu-form-price').value).toBe('4.50');
    $('#menu-form-price').value = '4.75';
    submit();
    await tick();
    expect(updateMenuItem).toHaveBeenCalledWith('1', { menuItemPriceAmount: 4.75 });
    expect(document.body.textContent).toContain('$4.75');
  });

  it('closes without a request when nothing changed', async () => {
    await mount();
    $('.menu-edit-btn[data-item-id="1"]').click();
    submit();
    await tick();
    expect(updateMenuItem).not.toHaveBeenCalled();
    expect($('#menu-form-modal').hidden).toBe(true);
  });

  it('ignores a second submit while saving', async () => {
    let finish;
    createMenuItem.mockReturnValue(new Promise((r) => { finish = r; }));
    await mount();
    $('#menu-add-btn').click();
    $('#menu-form-name').value = 'Mocha';
    $('#menu-form-category').value = 'Espresso';
    $('#menu-form-price').value = '5';
    submit();
    submit();
    expect(createMenuItem).toHaveBeenCalledTimes(1);
    expect($('#menu-form-save').disabled).toBe(true);
    finish({ data: null, error: { code: 'X', message: 'Could not create the menu item.' } });
    await tick();
  });

  it('keeps the form open and shows a friendly error when saving fails', async () => {
    createMenuItem.mockResolvedValue({ data: null, error: { code: 'UNAUTHORIZED', message: 'Could not create the menu item.' } });
    await mount();
    $('#menu-add-btn').click();
    $('#menu-form-name').value = 'Mocha';
    $('#menu-form-category').value = 'Espresso';
    $('#menu-form-price').value = '5';
    submit();
    await tick();
    expect($('#menu-form-modal').hidden).toBe(false);
    expect($('#menu-form-error').textContent).toBe('Could not create the menu item.');
    expect($('#menu-form-name').value).toBe('Mocha');
    expect($('#menu-form-save').disabled).toBe(false);
  });

  it('Cancel closes the form without saving', async () => {
    await mount();
    $('#menu-add-btn').click();
    $('#menu-form-cancel').click();
    expect($('#menu-form-modal').hidden).toBe(true);
    expect(createMenuItem).not.toHaveBeenCalled();
  });
});

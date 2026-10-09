import { describe, it, expect, vi, beforeEach } from 'vitest';
import { newOrderScreen } from './new-order.js';
import { confirmScreen } from './confirm.js';

// Node can't load the CDN-based supabase-client.js chain, so mock the services.
vi.mock('./backend/services/menu.js', () => ({ listMenuItems: vi.fn() }));
vi.mock('./backend/services/orders.js', () => ({ CreateNewOrder: vi.fn() }));

import { listMenuItems } from './backend/services/menu.js';

// camelCase — matches the real backend/services/menu.js contract
const mockItems = [
  { menuItemIdentifier: '1', menuItemName: 'Latte', menuItemCategoryType: 'Espresso', menuItemPriceAmount: 4.50, menuItemAvailabilityStatus: true },
  { menuItemIdentifier: '2', menuItemName: 'Croissant', menuItemCategoryType: 'Bakery', menuItemPriceAmount: 3.25, menuItemAvailabilityStatus: true },
  { menuItemIdentifier: '3', menuItemName: 'Cortado', menuItemCategoryType: 'Espresso', menuItemPriceAmount: 4.00, menuItemAvailabilityStatus: false },
];

describe('newOrderScreen', () => {
  let container;
  let currentOrder;
  let navigate;

  const $ = (selector) => container.querySelector(selector);
  const totals = () => ['#order-subtotal', '#order-tax', '#order-total'].map((s) => $(s).textContent);

  beforeEach(() => {
    document.body.innerHTML = '<div id="app-content"></div>';
    container = document.getElementById('app-content');
    currentOrder = [];
    navigate = vi.fn();
    listMenuItems.mockResolvedValue({ data: mockItems, error: null });
  });

  async function mount() {
    container.innerHTML = newOrderScreen.render();
    await newOrderScreen.init(navigate, currentOrder, 'staff-1');
  }

  function openTab(name) {
    [...container.querySelectorAll('.category-tab')].find((t) => t.textContent === name).click();
  }

  function addButtonFor(itemName) {
    return [...container.querySelectorAll('.menu-row-name')]
      .find((el) => el.textContent === itemName).closest('tr').querySelector('.add-btn');
  }

  function pick(name, value) {
    $(`input[name="${name}"][value="${value}"]`).click();
  }

  // --- POS-11: build the order -------------------------------------------

  it('renders a category tab per category', async () => {
    await mount();
    const tabs = [...container.querySelectorAll('.category-tab')].map((t) => t.textContent);
    expect(tabs).toEqual(['Espresso', 'Bakery']);
  });

  it('marks the first tab active and switches the menu rows when another tab is clicked', async () => {
    await mount();
    expect($('.category-tab.active').textContent).toBe('Espresso');
    expect([...container.querySelectorAll('.menu-row-name')].map((el) => el.textContent)).toEqual(['Latte', 'Cortado']);

    openTab('Bakery');
    expect($('.category-tab.active').textContent).toBe('Bakery');
    expect([...container.querySelectorAll('.menu-row-name')].map((el) => el.textContent)).toEqual(['Croissant']);
  });

  it('disables the Add button for unavailable items and shows "Unavailable" instead of a price', async () => {
    await mount();
    const cortadoRow = addButtonFor('Cortado').closest('tr');
    expect(addButtonFor('Cortado').disabled).toBe(true);
    expect(cortadoRow.classList.contains('menu-row-unavailable')).toBe(true);
    expect(cortadoRow.querySelector('.menu-row-price').textContent).toBe('Unavailable');
    expect(addButtonFor('Latte').disabled).toBe(false);
  });

  it('adds bakery items directly, without the milk/add-on modal', async () => {
    await mount();
    openTab('Bakery');
    addButtonFor('Croissant').click();

    expect($('#customize-modal').hidden).toBe(true);
    expect(currentOrder).toHaveLength(1);
    expect(currentOrder[0].lineTotal).toBe(3.25);
  });

  it('starts the modal on Small, Whole milk and no add-ons', async () => {
    await mount();
    addButtonFor('Latte').click();

    expect($('input[name="size"]:checked').value).toBe('small');
    expect($('input[name="milk"]:checked').value).toBe('whole');
    expect(container.querySelectorAll('input[name="addon"]:checked')).toHaveLength(0);
  });

  it('adds an item with default modal selections and updates subtotal/tax/total', async () => {
    await mount();
    openTab('Bakery');
    addButtonFor('Croissant').click();

    expect(currentOrder).toHaveLength(1);
    expect(currentOrder[0].menuItem.menu_item_identifier).toBe('2');
    expect(currentOrder[0].lineTotal).toBe(3.25);
    expect(totals()).toEqual(['$3.25', '$0.33', '$3.58']);
  });

  it('prices size, milk and add-on choices into the line', async () => {
    await mount();
    addButtonFor('Latte').click();
    pick('size', 'large');
    pick('milk', 'oat');
    pick('addon', 'extra_shot');
    $('#modal-add').click();

    expect(currentOrder[0].lineTotal).toBe(6.85); // 4.50 + 1.00 + 0.60 + 0.75
    expect(currentOrder[0].customization).toBe('Large, Oat milk, Extra shot');
    expect($('.order-line-detail').textContent).toBe('Large, Oat milk, Extra shot');
  });

  it('adds nothing when the modal is cancelled or the backdrop is clicked', async () => {
    await mount();
    addButtonFor('Latte').click();
    $('#modal-cancel').click();
    expect($('#customize-modal').hidden).toBe(true);

    addButtonFor('Latte').click();
    $('#customize-modal').click(); // click on the dark overlay itself
    expect($('#customize-modal').hidden).toBe(true);

    expect(currentOrder).toHaveLength(0);
  });

  it('removes an item before confirming', async () => {
    await mount();
    addButtonFor('Latte').click();
    $('#modal-add').click();
    expect($('#order-empty').hidden).toBe(true);

    $('.order-line-remove').click();
    expect(currentOrder).toHaveLength(0);
    expect($('#order-empty').hidden).toBe(false);
    expect(totals()).toEqual(['$0.00', '$0.00', '$0.00']);
  });

  it('removes the right line when there are several', async () => {
    await mount();
    addButtonFor('Latte').click();
    $('#modal-add').click();
    openTab('Bakery');
    addButtonFor('Croissant').click();

    container.querySelectorAll('.order-line-remove')[0].click(); // remove the Latte
    expect(currentOrder.map((line) => line.menuItem.menu_item_name)).toEqual(['Croissant']);
  });

  // --- POS-12: running totals ----------------------------------------------

  it('starts at $0.00 with the empty-order message', async () => {
    await mount();
    expect(totals()).toEqual(['$0.00', '$0.00', '$0.00']);
    expect($('#order-empty').hidden).toBe(false);
  });

  it('recalculates subtotal, tax and total on every add and remove', async () => {
    await mount();
    addButtonFor('Latte').click();
    pick('size', 'large');
    pick('milk', 'oat');
    pick('addon', 'extra_shot');
    $('#modal-add').click();
    expect(totals()).toEqual(['$6.85', '$0.70', '$7.55']);

    openTab('Bakery');
    addButtonFor('Croissant').click();
    expect(totals()).toEqual(['$10.10', '$1.04', '$11.14']);

    container.querySelectorAll('.order-line-remove')[0].click();
    expect(totals()).toEqual(['$3.25', '$0.33', '$3.58']);
  });

  // --- Hand-off to the rest of the app ------------------------------------

  it('"Proceed to Confirmation" navigates to the confirm screen', async () => {
    await mount();
    $('#go-to-confirm-btn').click();
    expect(navigate).toHaveBeenCalledWith('confirm');
  });

  it('builds lines that confirm.js turns into the orders.js payload', async () => {
    await mount();
    addButtonFor('Latte').click();
    pick('size', 'medium');
    $('#modal-add').click();

    expect(confirmScreen.preparePayload(currentOrder)).toEqual([
      { menuItemIdentifier: '1', quantity: 1, customization: 'Medium, Whole milk' },
    ]);
  });

  it('shows an order already in progress when the screen is shown again', async () => {
    await mount();
    addButtonFor('Latte').click();
    $('#modal-add').click();

    await mount(); // same currentOrder array, fresh screen
    expect(container.querySelectorAll('.order-line')).toHaveLength(1);
    expect(totals()[0]).toBe('$4.50');
  });

  it('shows the backend error message if the menu cannot load', async () => {
    listMenuItems.mockResolvedValue({ data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load the menu.' } });
    await mount();
    expect($('#menu-rows .error').textContent).toBe('Could not load the menu.');
  });

  // --- Edit an order before payment ---------------------------------------

  const addLatte = () => { addButtonFor('Latte').click(); $('#modal-add').click(); };

  it('changes quantity with + and −, repricing the line and totals', async () => {
    await mount();
    addLatte(); // $4.50
    $('[aria-label="Increase Latte"]').click();
    $('[aria-label="Increase Latte"]').click();

    expect(currentOrder[0].quantity).toBe(3);
    expect(currentOrder[0].lineTotal).toBe(13.5);
    expect(totals()).toEqual(['$13.50', '$1.38', '$14.88']);

    $('[aria-label="Decrease Latte"]').click();
    expect(currentOrder[0].quantity).toBe(2);
    expect(totals()[0]).toBe('$9.00');
  });

  it('cannot decrease below 1 (use remove instead)', async () => {
    await mount();
    addLatte();
    expect($('[aria-label="Decrease Latte"]').disabled).toBe(true);
  });

  it('edits size, milk and add-ons in place, prefilled, keeping quantity', async () => {
    await mount();
    addLatte();
    $('[aria-label="Increase Latte"]').click(); // qty 2

    $('.order-line-edit').click();
    expect($('#customize-modal').hidden).toBe(false);
    expect($('#modal-add').textContent).toBe('Save changes');
    expect($('input[name="size"]:checked').value).toBe('small');

    pick('size', 'large');
    pick('milk', 'oat');
    pick('addon', 'extra_shot');
    $('#modal-add').click();

    expect(currentOrder).toHaveLength(1); // edited, not duplicated
    expect(currentOrder[0].quantity).toBe(2);
    expect(currentOrder[0].customization).toBe('Large, Oat milk, Extra shot');
    expect(currentOrder[0].lineTotal).toBe(13.7); // 6.85 x 2
    expect(totals()[0]).toBe('$13.70');

    // reopening shows the saved choices
    $('.order-line-edit').click();
    expect($('input[name="size"]:checked').value).toBe('large');
    expect($('input[name="addon"][value="extra_shot"]').checked).toBe(true);
  });

  it('cancelling an edit leaves the line unchanged and the next add starts fresh', async () => {
    await mount();
    addLatte();
    $('.order-line-edit').click();
    pick('size', 'large');
    $('#modal-cancel').click();
    expect(currentOrder[0].customization).toBe('Small, Whole milk');

    addButtonFor('Latte').click();
    expect($('#modal-add').textContent).toBe('Add to order');
    $('#modal-add').click();
    expect(currentOrder).toHaveLength(2);
  });

  it('bakery lines get quantity controls but no Edit button', async () => {
    await mount();
    openTab('Bakery');
    addButtonFor('Croissant').click();
    expect($('.order-line-edit')).toBeNull();
    $('[aria-label="Increase Croissant"]').click();
    expect(totals()[0]).toBe('$6.50');
  });

  it('edited lines still produce the orders.js payload with the new quantity', async () => {
    await mount();
    addLatte();
    $('[aria-label="Increase Latte"]').click();
    expect(confirmScreen.preparePayload(currentOrder)).toEqual([
      { menuItemIdentifier: '1', quantity: 2, customization: 'Small, Whole milk' },
    ]);
  });

  it('clicking the order line itself opens the same options popup, prefilled', async () => {
    await mount();
    addButtonFor('Latte').click();
    pick('size', 'medium');
    pick('addon', 'extra_shot');
    $('#modal-add').click();

    $('.order-line-info').click();
    expect($('#customize-modal').hidden).toBe(false);
    expect($('input[name="size"]:checked').value).toBe('medium');
    expect($('input[name="addon"][value="extra_shot"]').checked).toBe(true);
    pick('milk', 'oat');
    $('#modal-add').click();
    expect(currentOrder).toHaveLength(1);
    expect(currentOrder[0].customization).toBe('Medium, Oat milk, Extra shot');
  });

  it('pastry lines are not clickable for editing', async () => {
    await mount();
    openTab('Bakery');
    addButtonFor('Croissant').click();
    expect($('.order-line-info.editable')).toBeNull();
  });
});

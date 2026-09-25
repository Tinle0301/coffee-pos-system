import { describe, it, expect, vi, beforeEach } from 'vitest';
import { newOrderScreen } from './new-order.js';

vi.mock('../../backend/services/menu.js', () => ({
  listMenuItems: vi.fn()
}));

import { listMenuItems } from '../../backend/services/menu.js';

const mockItems = [
  { menuItemIdentifier: '1', menuItemName: 'Latte', menuItemCategoryType: 'Espresso', menuItemPriceAmount: 4.50, menuItemAvailabilityStatus: true },
  { menuItemIdentifier: '2', menuItemName: 'Croissant', menuItemCategoryType: 'Bakery', menuItemPriceAmount: 3.25, menuItemAvailabilityStatus: true },
  { menuItemIdentifier: '3', menuItemName: 'Cortado', menuItemCategoryType: 'Espresso', menuItemPriceAmount: 4.00, menuItemAvailabilityStatus: false },
];

describe('newOrderScreen', () => {
  let container;
  let currentOrder;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app-content"></div>';
    container = document.getElementById('app-content');
    currentOrder = [];
    listMenuItems.mockResolvedValue({ data: mockItems, error: null });
  });

  async function mount() {
    container.innerHTML = newOrderScreen.render();
    await newOrderScreen.init(() => {}, currentOrder, 'staff-1');
  }

  it('renders a category tab per category', async () => {
    await mount();
    const tabs = [...container.querySelectorAll('.category-tab')].map((t) => t.textContent);
    expect(tabs).toEqual(['Espresso', 'Bakery']);
  });

  it('opens the customize modal for every item, including bakery items', async () => {
    await mount();
    [...container.querySelectorAll('.category-tab')].find((t) => t.textContent === 'Bakery').click();
    container.querySelector('.add-btn').click();

    expect(container.querySelector('#customize-modal').hidden).toBe(false);
    expect(container.querySelector('#customize-title').textContent).toBe('Croissant');
  });

  it('adds an item with default modal selections and updates subtotal/tax/total', async () => {
    await mount();
    [...container.querySelectorAll('.category-tab')].find((t) => t.textContent === 'Bakery').click();
    container.querySelector('.add-btn').click();
    container.querySelector('#modal-add').click();

    expect(currentOrder).toHaveLength(1);
    expect(currentOrder[0].menuItem.menu_item_identifier).toBe('2');
    expect(currentOrder[0].lineTotal).toBe(3.25);

    expect(container.querySelector('#order-subtotal').textContent).toBe('$3.25');
    expect(container.querySelector('#order-tax').textContent).toBe('$0.33');
    expect(container.querySelector('#order-total').textContent).toBe('$3.58');
  });

  it('disables the Add button for unavailable items', async () => {
    await mount();
    const cortadoRow = [...container.querySelectorAll('.menu-row-name')]
      .find((el) => el.textContent === 'Cortado').closest('tr');
    expect(cortadoRow.querySelector('.add-btn').disabled).toBe(true);
  });
});
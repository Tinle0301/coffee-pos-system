// src/new-order.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { renderNewOrderScreen } from './new-order.js';

describe('renderNewOrderScreen', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.getElementById('app');
  });

  it('renders a category tab per category, defaulting to the first as active', async () => {
    renderNewOrderScreen(container);
    await new Promise((r) => setTimeout(r, 350)); // stub has a ~300ms delay

    const tabs = [...container.querySelectorAll('.category-tab')].map((t) => t.textContent);
    expect(tabs).toEqual(['Espresso', 'Tea', 'Bakery']);
    expect(container.querySelector('.category-tab.active').textContent).toBe('Espresso');
  });

  it('switches the visible rows when a different tab is clicked', async () => {
    renderNewOrderScreen(container);
    await new Promise((r) => setTimeout(r, 350));

    const bakeryTab = [...container.querySelectorAll('.category-tab')].find((t) => t.textContent === 'Bakery');
    bakeryTab.click();

    const rowNames = [...container.querySelectorAll('.menu-row-name')].map((el) => el.textContent);
    expect(rowNames).toContain('Croissant');
    expect(rowNames).not.toContain('Latte');
  });

  it('adds a non-customizable item straight to the order and updates totals', async () => {
    renderNewOrderScreen(container);
    await new Promise((r) => setTimeout(r, 350));

    container.querySelector('.category-tab.active'); // Espresso is active; switch to Bakery
    [...container.querySelectorAll('.category-tab')].find((t) => t.textContent === 'Bakery').click();
    [...container.querySelectorAll('.add-btn')][0].click(); // Croissant, $3.25

    expect(container.querySelector('#order-list').textContent).toContain('Croissant');
    expect(container.querySelector('#order-subtotal').textContent).toBe('$3.25');
    expect(container.querySelector('#order-total').textContent).not.toBe('$0.00');
  });

  it('disables the Add button for unavailable items', async () => {
    renderNewOrderScreen(container);
    await new Promise((r) => setTimeout(r, 350));

    const cortadoRow = [...container.querySelectorAll('.menu-row-name')].find((el) => el.textContent === 'Cortado')
      .closest('tr');
    expect(cortadoRow.querySelector('.add-btn').disabled).toBe(true);
  });
});
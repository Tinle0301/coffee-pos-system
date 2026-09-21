// src/new-order.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { renderNewOrderScreen } from './new-order.js';

describe('renderNewOrderScreen', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.getElementById('app');
  });

  it('renders menu categories from the stub data', async () => {
    renderNewOrderScreen(container);
    await new Promise((r) => setTimeout(r, 350)); // stub has a ~300ms delay

    const headings = [...container.querySelectorAll('.category-section h3')].map((h) => h.textContent);
    expect(headings).toContain('Espresso');
    expect(headings).toContain('Bakery');
  });

  it('adds a non-customizable item (bakery) straight to the order', async () => {
    renderNewOrderScreen(container);
    await new Promise((r) => setTimeout(r, 350));

    const croissantBtn = [...container.querySelectorAll('.menu-item-btn')].find((btn) =>
      btn.textContent.includes('Croissant')
    );
    croissantBtn.click();

    const orderList = container.querySelector('#order-list');
    expect(orderList.textContent).toContain('Croissant');
    expect(container.querySelector('#order-empty').hidden).toBe(true);
  });

  it('disables unavailable items', async () => {
    renderNewOrderScreen(container);
    await new Promise((r) => setTimeout(r, 350));

    const cortadoBtn = [...container.querySelectorAll('.menu-item-btn')].find((btn) =>
      btn.textContent.includes('Cortado')
    );
    expect(cortadoBtn.disabled).toBe(true);
  });
});

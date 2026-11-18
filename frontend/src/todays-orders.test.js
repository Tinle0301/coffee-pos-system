import { describe, it, expect, vi } from 'vitest';
import { todaysOrdersScreen } from './todays-orders.js';
import * as ordersService from './backend/services/orders.js';
import { ViewOrderItems } from './backend/services/orderItems.js';
import { listMenuItems } from './backend/services/menu.js';

// Mock the backend services (Node can't load the CDN-based supabase-client.js chain)
vi.mock('./backend/services/orders.js', () => ({ listOrders: vi.fn() }));
vi.mock('./backend/services/orderItems.js', () => ({ ViewOrderItems: vi.fn() }));
vi.mock('./backend/services/menu.js', () => ({ listMenuItems: vi.fn() }));

const $ = (selector) => document.querySelector(selector);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const paidOrder = {
  orderIdentifier: '1041', orderStatusType: 'Completed', orderTotalAmount: 7.9,
  orderCreationTimestamp: '2026-11-03T09:00:00Z',
  payment: { paymentMethodType: 'Credit/Debit', paymentAmountValue: 7.9, paymentCompletionStatus: 'Completed' }
};
const unpaidOrder = {
  orderIdentifier: '1042', orderStatusType: 'Pending', orderTotalAmount: 4.5,
  orderCreationTimestamp: '2026-11-03T10:00:00Z', payment: null
};

async function open() {
  document.body.innerHTML = todaysOrdersScreen.render();
  await todaysOrdersScreen.init();
}

describe('POS-77: Today\'s orders with their status and payment', () => {
  it('should ask for today only and show each order with its status and payment', async () => {
    ordersService.listOrders.mockResolvedValue({ data: [paidOrder, unpaidOrder], error: null });
    await open();

    const { from, to } = ordersService.listOrders.mock.calls[0][0];
    expect(new Date(from).getHours()).toBe(0);              // starts at local midnight
    expect(new Date(to) > new Date(from)).toBe(true);       // and ends the next midnight

    const rows = [...document.querySelectorAll('.order-line')];
    expect(rows.map((row) => row.dataset.orderId)).toEqual(['1042', '1041']); // newest first
    expect(rows[0].textContent).toContain('Pending');
    expect(rows[0].textContent).toContain('Unpaid');
    expect(rows[1].textContent).toContain('Completed');
    expect(rows[1].textContent).toContain('Paid · Credit/Debit · $7.90');
  });

  it('should say it is not available yet when the backend has no listOrders', async () => {
    ordersService.listOrders.mockReturnValue(undefined); // an empty placeholder returns nothing
    await open();
    expect($('#todays-status').textContent).toBe("Today's orders isn’t available yet.");
  });
});

describe('POS-86: Tap an order to see its items, customizations and payment', () => {
  it('should show the items with their customizations and the payment when an order is tapped', async () => {
    ordersService.listOrders.mockResolvedValue({ data: [paidOrder], error: null });
    listMenuItems.mockResolvedValue({ data: [{ menuItemIdentifier: 'm1', menuItemName: 'Latte' }], error: null });
    ViewOrderItems.mockResolvedValue({
      data: [
        { orderedItemQuantity: 2, associatedMenuItemIdentifier: 'm1', itemCustomizationDescription: 'oat milk', itemPriceAmount: 3.95 },
        { orderedItemQuantity: 1, associatedMenuItemIdentifier: 'm1', itemCustomizationDescription: null, itemPriceAmount: 0 }
      ], error: null
    });
    await open();
    expect($('.order-detail')).toBeNull(); // nothing open until the barista taps

    $('[data-order-id="1041"] .order-line-info').click();
    await flush();

    expect(ViewOrderItems).toHaveBeenCalledWith('1041');
    const text = $('.order-detail').textContent;
    expect(text).toContain('2 × Latte');
    expect(text).toContain('oat milk');
    expect(text).toContain('$7.90');                         // 2 x $3.95, worked out in cents
    expect(text).toContain('No customizations');
    expect(text).toContain('Payment: Paid · Credit/Debit · $7.90');

    $('[data-order-id="1041"] .order-line-info').click();    // a second tap closes it
    expect($('.order-detail')).toBeNull();
  });
});
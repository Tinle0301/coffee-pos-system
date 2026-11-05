import { describe, it, expect, vi } from 'vitest';
import { todaysOrdersScreen } from './todays-orders.js';
import * as ordersService from './backend/services/orders.js';

// Mock the backend service (Node can't load the CDN-based supabase-client.js chain)
vi.mock('./backend/services/orders.js', () => ({ listOrders: vi.fn() }));

const $ = (selector) => document.querySelector(selector);

async function open() {
  document.body.innerHTML = todaysOrdersScreen.render();
  await todaysOrdersScreen.init();
}

describe('POS-77: Today\'s orders with their status and payment', () => {
  it('should ask for today only and show each order with its status and payment', async () => {
    ordersService.listOrders.mockResolvedValue({
      data: [
        { orderIdentifier: '1041', orderStatusType: 'Completed', orderTotalAmount: 7.9,
          orderCreationTimestamp: '2026-11-03T09:00:00Z',
          payment: { paymentMethodType: 'Credit/Debit', paymentAmountValue: 7.9, paymentCompletionStatus: 'Completed' } },
        { orderIdentifier: '1042', orderStatusType: 'Pending', orderTotalAmount: 4.5,
          orderCreationTimestamp: '2026-11-03T10:00:00Z', payment: null }
      ], error: null
    });
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

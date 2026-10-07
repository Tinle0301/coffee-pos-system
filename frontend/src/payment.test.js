import { describe, it, expect, vi } from 'vitest';
import { paymentScreen } from './payment.js';
import { processPayment } from './backend/services/payments.js';

// Mock the backend service (Node can't load the CDN-based supabase-client.js chain)
vi.mock('./backend/services/payments.js', () => ({
  processPayment: vi.fn(() => Promise.resolve({ data: {}, error: null }))
}));

describe('Payment: select a method, confirm the amount, complete the sale', () => {
  const $ = (selector) => document.querySelector(selector);

  function mount() {
    const state = {
      currentOrder: [{ menuItem: { menu_item_identifier: '1' }, quantity: 1 }],
      lastOrder: { orderIdentifier: 'ord-1042', orderSubtotalAmount: 10.10, orderTaxAmount: 1.04, orderTotalAmount: 11.14 }
    };
    document.body.innerHTML = paymentScreen.render(state);
    paymentScreen.init(vi.fn(), state.currentOrder, 'staff-1', state);
    return state;
  }

  function chooseMethod(method) {
    const radio = $(`input[name="payment-method"][value="${method}"]`);
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('should require a payment method before the sale can be completed', () => {
    mount();
    expect($('#complete-sale-btn').disabled).toBe(true);

    chooseMethod('Card');
    expect($('#complete-sale-btn').disabled).toBe(false);
  });

  it('should show the amount due and the change for a cash payment', () => {
    mount();
    expect($('#payment-total').textContent).toBe('$11.14');

    chooseMethod('Cash');
    $('#cash-received').value = '20';
    $('#cash-received').dispatchEvent(new Event('input'));

    expect($('#change-due').textContent).toBe('$8.86');
  });

  it('should complete the sale for the order total and clear the order', async () => {
    const state = mount();
    chooseMethod('Card');
    $('#complete-sale-btn').click();
    await new Promise(process.nextTick);

    expect(processPayment).toHaveBeenCalledWith('ord-1042', 'Card', 11.14);
    expect($('#payment-status').textContent).toBe('Sale complete.');
    expect(state.currentOrder).toHaveLength(0);
  });
});
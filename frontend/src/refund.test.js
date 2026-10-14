import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refundScreen, parseAmount, isRefundable } from './refund.js';

// Node can't load the CDN-based supabase client, so mock the adapter.
vi.mock('./refund-api.js', () => ({ lookUpPayment: vi.fn(), submitRefund: vi.fn(), listRecentPayments: vi.fn() }));
import { lookUpPayment, submitRefund, listRecentPayments } from './refund-api.js';
import { mapRefundError } from './refund-errors.js';

const payment = {
  paymentTransactionIdentifier: 'pay-1',
  associatedOrderIdentifier: 'abcdef12-0000-0000-0000-000000000000',
  paymentMethodType: 'Credit/Debit',
  paymentAmountValue: 12.5,
  paymentCompletionStatus: 'Completed',
  paymentProcessingTimestamp: '2026-10-08T12:00:00Z',
};

describe('refundScreen (Admin refund)', () => {
  let container;
  let navigate;
  const $ = (s) => container.querySelector(s);
  const flush = () => new Promise((r) => setTimeout(r, 0));

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="app-content"></div>';
    container = document.getElementById('app-content');
    navigate = vi.fn();
    listRecentPayments.mockResolvedValue({ data: [], error: null });
    container.innerHTML = refundScreen.render();
    refundScreen.init(navigate);
    lookUpPayment.mockResolvedValue({ data: payment, error: null });
    submitRefund.mockResolvedValue({ data: { refundTransactionIdentifier: 'ref-1' }, error: null });
  });

  async function lookup(id = 'pay-1') {
    $('#refund-payment-id').value = id;
    $('#refund-lookup-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
  }

  it('parses amounts strictly', () => {
    expect(parseAmount('2.5')).toBe(2.5);
    expect(parseAmount('$3')).toBe(3);
    expect(parseAmount('-1')).toBeNull();
    expect(parseAmount('1.234')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });

  it('only completed payments are refundable', () => {
    expect(isRefundable({ paymentCompletionStatus: 'Completed' })).toBe(true);
    expect(isRefundable({ paymentCompletionStatus: 'Refunded' })).toBe(false);
    expect(isRefundable({ paymentCompletionStatus: 'Pending' })).toBe(false);
  });

  it('asks for a payment ID before looking anything up', async () => {
    await lookup('');
    expect(lookUpPayment).not.toHaveBeenCalled();
    expect($('#refund-lookup-msg').textContent).toBe('Enter a payment ID.');
  });

  it('shows the payment details after a successful lookup', async () => {
    await lookup();
    expect($('#refund-details').hidden).toBe(false);
    expect($('#refund-paid').textContent).toBe('$12.50');
    expect($('#refund-method').textContent).toBe('Credit/Debit');
  });

  it('shows a friendly message when the payment is not found', async () => {
    lookUpPayment.mockResolvedValue({ data: null, error: { code: 'PAYMENT_NOT_FOUND', message: 'No payment found with that ID.' } });
    await lookup('nope');
    expect($('#refund-details').hidden).toBe(true);
    expect($('#refund-lookup-msg').textContent).toBe('No payment found with that ID.');
  });

  it('refuses a payment that was already refunded', async () => {
    lookUpPayment.mockResolvedValue({ data: { ...payment, paymentCompletionStatus: 'Refunded' }, error: null });
    await lookup();
    expect($('#refund-details').hidden).toBe(true);
    expect($('#refund-lookup-msg').textContent).toContain("can't be refunded");
  });

  it('full refund: review, then confirm sends the whole amount as Full', async () => {
    await lookup();
    $('#refund-review-btn').click();
    expect($('#refund-confirm').hidden).toBe(false);
    expect($('#refund-confirm-text').textContent).toContain('Refund $12.50 of $12.50');
    expect(submitRefund).not.toHaveBeenCalled(); // nothing sent until confirmed

    $('#refund-confirm-go').click();
    await flush();
    expect(submitRefund).toHaveBeenCalledWith('pay-1', 'Full', 12.5);
    expect($('#refund-result').textContent).toContain('Refunded $12.50');
    expect($('#refund-details').hidden).toBe(true);
  });

  it('partial refund sends the typed amount as Partial', async () => {
    await lookup();
    $('input[name="refund-type"][value="Partial"]').click();
    expect($('#refund-amount-row').hidden).toBe(false);
    $('#refund-amount').value = '2.50';
    $('#refund-review-btn').click();
    $('#refund-confirm-go').click();
    await flush();
    expect(submitRefund).toHaveBeenCalledWith('pay-1', 'Partial', 2.5);
  });

  it('a "partial" for the full amount is sent as Full', async () => {
    await lookup();
    $('input[name="refund-type"][value="Partial"]').click();
    $('#refund-amount').value = '12.50';
    $('#refund-review-btn').click();
    $('#refund-confirm-go').click();
    await flush();
    expect(submitRefund).toHaveBeenCalledWith('pay-1', 'Full', 12.5);
  });

  it.each([['0'], ['-3'], ['abc'], ['1.999'], ['12.51'], ['']])('rejects an invalid partial amount "%s"', async (value) => {
    await lookup();
    $('input[name="refund-type"][value="Partial"]').click();
    $('#refund-amount').value = value;
    $('#refund-review-btn').click();
    expect($('#refund-confirm').hidden).toBe(true);
    expect($('#refund-form-msg').textContent).not.toBe('');
    expect(submitRefund).not.toHaveBeenCalled();
  });

  it('Back on the confirm step cancels without refunding', async () => {
    await lookup();
    $('#refund-review-btn').click();
    $('#refund-confirm-back').click();
    expect($('#refund-confirm').hidden).toBe(true);
    expect(submitRefund).not.toHaveBeenCalled();
  });

  it('ignores a second tap on Confirm while the first is in flight', async () => {
    let release;
    submitRefund.mockReturnValue(new Promise((r) => { release = r; }));
    await lookup();
    $('#refund-review-btn').click();
    $('#refund-confirm-go').click();
    $('#refund-confirm-go').click();
    expect(submitRefund).toHaveBeenCalledTimes(1);
    release({ data: { refundTransactionIdentifier: 'ref-1' }, error: null });
    await flush();
  });

  it('shows the error message and does not retry if the refund fails', async () => {
    submitRefund.mockResolvedValue({ data: null, error: { code: 'REFUND_FAILED', message: 'The refund could not be processed.' } });
    await lookup();
    $('#refund-review-btn').click();
    $('#refund-confirm-go').click();
    await flush();
    expect(submitRefund).toHaveBeenCalledTimes(1);
    expect($('#refund-result').textContent).toBe('The refund could not be processed.');
  });

  it('Back to orders returns to the New Order screen', () => {
    $('#refund-back').click();
    expect(navigate).toHaveBeenCalledWith('new-order');
  });

  // --- Pick from recent payments (no typing a UUID) ------------------------

  async function mountWithRecent(list) {
    document.body.innerHTML = '<div id="app-content"></div>';
    container = document.getElementById('app-content');
    listRecentPayments.mockResolvedValue({ data: list, error: null });
    container.innerHTML = refundScreen.render();
    refundScreen.init(navigate);
    await flush();
  }

  it('lists recent completed payments by order number, amount and method', async () => {
    await mountWithRecent([payment, { ...payment, paymentTransactionIdentifier: 'pay-2', associatedOrderIdentifier: '99999999-x', paymentAmountValue: 4, paymentMethodType: 'Cash' }]);
    const lines = [...container.querySelectorAll('.refund-recent-line .order-line-name')].map((e) => e.textContent);
    expect(lines).toEqual(['Order #abcdef12 · $12.50', 'Order #99999999 · $4.00']);
  });

  it('skips payments that are not refundable in the recent list', async () => {
    await mountWithRecent([{ ...payment, paymentCompletionStatus: 'Refunded' }]);
    expect(container.querySelectorAll('.refund-recent-line')).toHaveLength(0);
    expect($('#refund-recent-msg').textContent).toBe('No completed payments to refund yet.');
  });

  it('tapping Refund on a recent payment opens it ready to refund', async () => {
    await mountWithRecent([payment]);
    $('.refund-select-btn').click();
    expect($('#refund-details').hidden).toBe(false);
    expect($('#refund-paid').textContent).toBe('$12.50');
    $('#refund-review-btn').click();
    $('#refund-confirm-go').click();
    await flush();
    expect(submitRefund).toHaveBeenCalledWith('pay-1', 'Full', 12.5);
  });

  it('reloads the recent list after a successful refund', async () => {
    await mountWithRecent([payment]);
    $('.refund-select-btn').click();
    $('#refund-review-btn').click();
    listRecentPayments.mockClear();
    $('#refund-confirm-go').click();
    await flush();
    expect(listRecentPayments).toHaveBeenCalledTimes(1);
  });

  it('shows a message if the recent payments cannot be loaded', async () => {
    document.body.innerHTML = '<div id="app-content"></div>';
    container = document.getElementById('app-content');
    listRecentPayments.mockResolvedValue({ data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load recent payments.' } });
    container.innerHTML = refundScreen.render();
    refundScreen.init(navigate);
    await flush();
    expect($('#refund-recent-msg').textContent).toBe('Could not load recent payments.');
  });
});

describe('mapRefundError', () => {
  it.each([
    ['ALREADY_REFUNDED: payment x has already been refunded', 'This payment has already been refunded.'],
    ['UNAUTHORIZED: caller is not an admin', 'Only an admin can issue refunds.'],
    ['INVALID_REFUND_AMOUNT: too much', "That refund amount isn't valid for this payment."],
    ['INVALID_PAYMENT_STATUS: p is Pending', "This payment isn't completed, so it can't be refunded."],
  ])('maps "%s"', (raised, expected) => {
    expect(mapRefundError({ message: raised }).message).toBe(expected);
  });

  it('never leaks raw database text for unknown errors', () => {
    const result = mapRefundError({ message: 'duplicate key value violates unique constraint "x"' });
    expect(result.code).toBe('REFUND_FAILED');
    expect(result.message).not.toContain('duplicate');
  });
});

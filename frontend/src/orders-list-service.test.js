// orders-list-service.test.js — POS-77
// Tests listOrders, the service behind the Today's Orders screen
// (frontend/src/backend/services/orders.js, synced from backend/services/).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = {
  select: vi.fn(() => query),
  gte: vi.fn(() => query),
  lt: vi.fn(() => query),
  order: vi.fn(),
};
const from = vi.fn(() => query);

// Node can't load the CDN-based supabase client, so mock it.
vi.mock('./backend/supabase-client.js', () => ({ supabase: { from: (...a) => from(...a) } }));

const { listOrders } = await import('./backend/services/orders.js');

const range = { from: '2026-11-05T08:00:00.000Z', to: '2026-11-06T08:00:00.000Z' };

function orderRow(id, payments = []) {
  return {
    order_identifier: id,
    order_status_type: 'Completed',
    order_subtotal_amount: 7.25,
    order_tax_amount: 0.65,
    order_total_amount: 7.9,
    order_creation_timestamp: '2026-11-05T17:00:00Z',
    created_by_staff_identifier: 'barista-1',
    payments,
  };
}

const payment = (status, at, method = 'Cash') => ({
  payment_method_type: method,
  payment_amount_value: 7.9,
  payment_completion_status: status,
  payment_processing_timestamp: at,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listOrders', () => {
  it('asks for orders in the range, newest first, with their payments', async () => {
    query.order.mockResolvedValue({ data: [], error: null });
    const { data, error } = await listOrders(range);

    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(from).toHaveBeenCalledWith('orders');
    expect(query.select.mock.calls[0][0]).toContain('payments(');
    expect(query.gte).toHaveBeenCalledWith('order_creation_timestamp', range.from);
    expect(query.lt).toHaveBeenCalledWith('order_creation_timestamp', range.to);
    expect(query.order).toHaveBeenCalledWith('order_creation_timestamp', { ascending: false });
  });

  it('maps each order to camelCase with its payment', async () => {
    query.order.mockResolvedValue({
      data: [orderRow('o-1', [payment('Completed', '2026-11-05T17:01:00Z', 'Credit/Debit')])],
      error: null,
    });
    const { data } = await listOrders(range);

    expect(data).toEqual([{
      orderIdentifier: 'o-1',
      orderStatusType: 'Completed',
      orderSubtotalAmount: 7.25,
      orderTaxAmount: 0.65,
      orderTotalAmount: 7.9,
      orderCreationTimestamp: '2026-11-05T17:00:00Z',
      createdByStaffIdentifier: 'barista-1',
      payment: {
        paymentMethodType: 'Credit/Debit',
        paymentAmountValue: 7.9,
        paymentCompletionStatus: 'Completed',
        paymentProcessingTimestamp: '2026-11-05T17:01:00Z',
      },
    }]);
  });

  it('gives payment: null for an unpaid order', async () => {
    query.order.mockResolvedValue({ data: [orderRow('o-2', [])], error: null });
    const { data } = await listOrders(range);
    expect(data[0].payment).toBeNull();
  });

  it('shows the payment that counts when an order has more than one', async () => {
    query.order.mockResolvedValue({
      data: [orderRow('o-3', [
        payment('Completed', '2026-11-05T17:01:00Z', 'Cash'),
        payment('Failed', '2026-11-05T17:05:00Z', 'Credit/Debit'),
      ])],
      error: null,
    });
    const { data } = await listOrders(range);
    expect(data[0].payment.paymentCompletionStatus).toBe('Completed');
    expect(data[0].payment.paymentMethodType).toBe('Cash');
  });

  it('rejects a missing or backwards range without calling the database', async () => {
    expect((await listOrders()).error.code).toBe('INVALID_DATE_RANGE');
    expect((await listOrders({ from: 'nope', to: range.to })).error.code).toBe('INVALID_DATE_RANGE');
    expect((await listOrders({ from: range.to, to: range.from })).error.code).toBe('INVALID_DATE_RANGE');
    expect(from).not.toHaveBeenCalled();
  });

  it('returns LOOKUP_FAILED when the query fails', async () => {
    query.order.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { data, error } = await listOrders(range);
    expect(data).toBeNull();
    expect(error.code).toBe('LOOKUP_FAILED');
  });
});

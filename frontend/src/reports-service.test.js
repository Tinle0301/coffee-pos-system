// reports-service.test.js -- POS-66, POS-83
// Tests generateSalesReport's order-count and payment-method breakdown,
// and getSalesActivity (POS-64's best sellers / busiest hours).

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest';

const paymentsQuery = {
  select: vi.fn(() => paymentsQuery),
  in: vi.fn(() => paymentsQuery),
  gte: vi.fn(() => paymentsQuery),
  lt: vi.fn(),
};

const salesReportsQuery = {
  insert: vi.fn(() => salesReportsQuery),
  select: vi.fn(() => salesReportsQuery),
  single: vi.fn(),
};

const from = vi.fn((table) =>
  table === 'payments' ? paymentsQuery : salesReportsQuery
);

const rpc = vi.fn();

// Node cannot load the CDN-based Supabase client during unit tests,
// so replace it with controllable mocks.
vi.mock('./backend/supabase-client.js', () => ({
  supabase: {
    from: (...args) => from(...args),
    rpc: (...args) => rpc(...args),
  },
}));

const { generateSalesReport, getSalesActivity } = await import(
  './backend/services/reports.js'
);

beforeEach(() => {
  vi.clearAllMocks();
  paymentsQuery.select.mockReturnValue(paymentsQuery);
  paymentsQuery.in.mockReturnValue(paymentsQuery);
  paymentsQuery.gte.mockReturnValue(paymentsQuery);
  salesReportsQuery.insert.mockReturnValue(salesReportsQuery);
  salesReportsQuery.select.mockReturnValue(salesReportsQuery);
  salesReportsQuery.single.mockResolvedValue({
    data: {
      report_identifier: 'report-1',
      report_generation_type: 'Daily',
      report_start_date: '2026-10-01',
      report_end_date: '2026-10-01',
      total_revenue_amount: 35,
      order_count: 2,
      payment_method_totals: { Cash: 30, 'Credit/Debit': 5, 'Mobile Pay': 0 },
      report_generated_timestamp: '2026-10-02T03:00:00Z',
    },
    error: null,
  });
});

describe('generateSalesReport — order count and payment method totals', () => {
  it('counts distinct orders, not payment rows — two payments on the same order count once', async () => {
    paymentsQuery.lt.mockResolvedValue({
      data: [
        // Two payments on order-1 (mixed methods), one on order-2.
        { payment_amount_value: 10, payment_method_type: 'Cash', associated_order_identifier: 'order-1' },
        { payment_amount_value: 5, payment_method_type: 'Credit/Debit', associated_order_identifier: 'order-1' },
        { payment_amount_value: 20, payment_method_type: 'Cash', associated_order_identifier: 'order-2' },
      ],
      error: null,
    });

    await generateSalesReport('Daily', '2026-10-01', '2026-10-01');

    const insertedRow = salesReportsQuery.insert.mock.calls[0][0];

    // 3 payment rows, but only 2 distinct orders.
    expect(insertedRow.order_count).toBe(2);
  });

  it('includes all three payment method keys, 0 for one with no transactions', async () => {
    paymentsQuery.lt.mockResolvedValue({
      data: [
        { payment_amount_value: 10, payment_method_type: 'Cash', associated_order_identifier: 'order-1' },
        { payment_amount_value: 5, payment_method_type: 'Credit/Debit', associated_order_identifier: 'order-1' },
        { payment_amount_value: 20, payment_method_type: 'Cash', associated_order_identifier: 'order-2' },
      ],
      error: null,
    });

    await generateSalesReport('Daily', '2026-10-01', '2026-10-01');

    const insertedRow = salesReportsQuery.insert.mock.calls[0][0];

    // No Mobile Pay payment in this range — the key must still be present, at 0.
    expect(insertedRow.payment_method_totals).toEqual({
      Cash: 30,
      'Credit/Debit': 5,
      'Mobile Pay': 0,
    });
  });

  it('the three payment method totals always sum to total_revenue_amount', async () => {
    paymentsQuery.lt.mockResolvedValue({
      data: [
        { payment_amount_value: 10, payment_method_type: 'Cash', associated_order_identifier: 'order-1' },
        { payment_amount_value: 5, payment_method_type: 'Credit/Debit', associated_order_identifier: 'order-1' },
        { payment_amount_value: 20, payment_method_type: 'Cash', associated_order_identifier: 'order-2' },
      ],
      error: null,
    });

    await generateSalesReport('Daily', '2026-10-01', '2026-10-01');

    const insertedRow = salesReportsQuery.insert.mock.calls[0][0];
    const methodSum = Object.values(insertedRow.payment_method_totals).reduce((sum, v) => sum + v, 0);

    expect(methodSum).toBe(insertedRow.total_revenue_amount);
    expect(insertedRow.total_revenue_amount).toBe(35);
  });

  it('returns all 0s and an empty-but-complete breakdown when there are no payments in range', async () => {
    paymentsQuery.lt.mockResolvedValue({ data: [], error: null });

    await generateSalesReport('Daily', '2026-10-01', '2026-10-01');

    const insertedRow = salesReportsQuery.insert.mock.calls[0][0];

    expect(insertedRow.order_count).toBe(0);
    expect(insertedRow.total_revenue_amount).toBe(0);
    expect(insertedRow.payment_method_totals).toEqual({
      Cash: 0,
      'Credit/Debit': 0,
      'Mobile Pay': 0,
    });
  });
});

// -------------------------------------------------------------------------
// getSalesActivity — POS-83
// -------------------------------------------------------------------------

describe('getSalesActivity — input validation (no round trip to the database)', () => {
  it('rejects a malformed date', async () => {
    const { data, error } = await getSalesActivity('10-01-2026', '2026-10-07');

    expect(data).toBeNull();
    expect(error.code).toBe('INVALID_DATE_RANGE');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a calendar date that does not exist', async () => {
    // isCalendarDate round-trips through Date and rejects Feb 30.
    const { data, error } = await getSalesActivity('2026-02-30', '2026-03-01');

    expect(data).toBeNull();
    expect(error.code).toBe('INVALID_DATE_RANGE');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects startDate after endDate', async () => {
    const { data, error } = await getSalesActivity('2026-10-07', '2026-10-01');

    expect(data).toBeNull();
    expect(error.code).toBe('INVALID_DATE_RANGE');
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('getSalesActivity — success', () => {
  it('calls both report functions with the date range and maps rows to camelCase numbers', async () => {
    rpc.mockImplementation((fn) => {
      if (fn === 'best_selling_items_report') {
        return Promise.resolve({
          data: [
            { menu_item_identifier: 'item-1', menu_item_name: 'Latte', quantity_sold: '12', gross_item_revenue: '54.00' },
          ],
          error: null,
        });
      }
      if (fn === 'busiest_hours_report') {
        return Promise.resolve({
          data: [{ hour_of_day: '9', order_count: '4' }],
          error: null,
        });
      }
      throw new Error(`unexpected rpc: ${fn}`);
    });

    const { data, error } = await getSalesActivity('2026-10-01', '2026-10-07');

    expect(rpc).toHaveBeenCalledWith('best_selling_items_report', { range_start: '2026-10-01', range_end: '2026-10-07' });
    expect(rpc).toHaveBeenCalledWith('busiest_hours_report', { range_start: '2026-10-01', range_end: '2026-10-07' });

    expect(error).toBeNull();
    expect(data).toEqual({
      bestSellers: [{ menuItemIdentifier: 'item-1', menuItemName: 'Latte', quantitySold: 12, grossItemRevenue: 54 }],
      busiestHours: [{ hourOfDay: 9, orderCount: 4 }],
    });
  });

  it('returns empty arrays, not null, when both functions come back with no rows', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    const { data, error } = await getSalesActivity('2026-10-01', '2026-10-07');

    expect(error).toBeNull();
    expect(data).toEqual({ bestSellers: [], busiestHours: [] });
  });
});

describe('getSalesActivity — error handling', () => {
  it('maps an UNAUTHORIZED message from either function to the UNAUTHORIZED code', async () => {
    rpc.mockImplementation((fn) => Promise.resolve({
      data: null,
      error: fn === 'best_selling_items_report' ? { message: 'UNAUTHORIZED: caller is not an active admin' } : null,
    }));

    const { data, error } = await getSalesActivity('2026-10-01', '2026-10-07');

    expect(data).toBeNull();
    expect(error).toEqual({ code: 'UNAUTHORIZED', message: 'Only active admins can view sales activity.' });
  });

  it('maps a bare Postgres permission-denied code (42501) to UNAUTHORIZED', async () => {
    rpc.mockImplementation((fn) => Promise.resolve({
      data: null,
      error: fn === 'busiest_hours_report' ? { code: '42501', message: 'permission denied' } : null,
    }));

    const { data, error } = await getSalesActivity('2026-10-01', '2026-10-07');

    expect(data).toBeNull();
    expect(error).toEqual({ code: 'UNAUTHORIZED', message: 'Only active admins can view sales activity.' });
  });

  it('hides an unrelated database error behind LOOKUP_FAILED', async () => {
    rpc.mockImplementation((fn) => Promise.resolve({
      data: null,
      error: fn === 'best_selling_items_report' ? { message: 'relation does not exist' } : null,
    }));

    const { data, error } = await getSalesActivity('2026-10-01', '2026-10-07');

    expect(data).toBeNull();
    expect(error).toEqual({ code: 'LOOKUP_FAILED', message: 'Could not load sales activity for this date range.' });
  });

  it('returns LOOKUP_FAILED when the RPC calls themselves throw (network/client failure)', async () => {
    rpc.mockImplementation(() => { throw new Error('network down'); });

    const { data, error } = await getSalesActivity('2026-10-01', '2026-10-07');

    expect(data).toBeNull();
    expect(error).toEqual({ code: 'LOOKUP_FAILED', message: 'Could not load sales activity for this date range.' });
  });
});

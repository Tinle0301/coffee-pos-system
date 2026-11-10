// reports-service.test.js — POS-66
// Tests generateSalesReport's order-count and payment-method breakdown.

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

// Node cannot load the CDN-based Supabase client during unit tests,
// so replace it with controllable mocks.
vi.mock('./backend/supabase-client.js', () => ({
  supabase: { from: (...args) => from(...args) },
}));

const { generateSalesReport } = await import(
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

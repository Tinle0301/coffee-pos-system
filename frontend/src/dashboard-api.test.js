import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reportDateOf, reportToday, addDays, summarizePayments,
  loadPaymentBreakdown, loadDashboard, PAYMENT_ROW_LIMIT,
} from './dashboard-api.js';
import { supabase } from './backend/supabase-client.js';
import { getSalesActivity } from './backend/services/reports.js';

vi.mock('./backend/supabase-client.js', () => ({ supabase: { from: vi.fn() } }));
vi.mock('./backend/services/reports.js', () => ({ getSalesActivity: vi.fn() }));

// 2026-10-20 19:00 Pacific (PDT, UTC-7) = 2026-10-21 02:00Z — a late-evening sale
const pay = (ts, method, amount, order) => ({
  payment_processing_timestamp: ts, payment_method_type: method,
  payment_amount_value: amount, associated_order_identifier: order,
});

// supabase.from('payments').select().in().gte().lt().limit() -> result
function paymentsChain(result) {
  const chain = {};
  ['select', 'in', 'gte', 'lt'].forEach((m) => { chain[m] = vi.fn(() => chain); });
  chain.limit = vi.fn(() => Promise.resolve(result));
  return chain;
}

describe('date helpers', () => {
  it('uses the shop (Pacific) calendar day, not UTC', () => {
    expect(reportDateOf('2026-10-21T02:00:00Z')).toBe('2026-10-20'); // evening in LA
    expect(reportDateOf('2026-10-21T08:00:00Z')).toBe('2026-10-21'); // 1 AM in LA
  });

  it('returns null for a bad timestamp', () => {
    expect(reportDateOf('nope')).toBeNull();
  });

  it('reportToday gives a YYYY-MM-DD string', () => {
    expect(reportToday(new Date('2026-10-21T02:00:00Z'))).toBe('2026-10-20');
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-10-20', -6)).toBe('2026-10-14');
  });
});

describe('summarizePayments', () => {
  const rows = [
    pay('2026-10-20T20:00:00Z', 'Cash', 10.1, 'o1'),
    pay('2026-10-20T21:00:00Z', 'Credit/Debit', 20.2, 'o2'),
    pay('2026-10-20T22:00:00Z', 'Mobile Pay', 5, 'o3'),
    pay('2026-10-20T22:30:00Z', 'Cash', 4.9, 'o3'), // second payment on the same order
    pay('2026-10-19T20:00:00Z', 'Cash', 99, 'old'), // out of range
    pay('2026-10-20T20:00:00Z', 'Gift Card', 50, 'x'), // unknown method is ignored
  ];

  it('totals by method, counts distinct orders, and ignores out-of-range or unknown rows', () => {
    const s = summarizePayments(rows, '2026-10-20', '2026-10-20');
    expect(s.totals).toEqual({ Cash: 15, 'Credit/Debit': 20.2, 'Mobile Pay': 5 });
    expect(s.revenue).toBe(40.2);
    expect(s.orderCount).toBe(3);
  });

  it('puts a late-evening Pacific sale on the Pacific day', () => {
    const late = [pay('2026-10-21T02:00:00Z', 'Cash', 8, 'o9')];
    expect(summarizePayments(late, '2026-10-20', '2026-10-20').revenue).toBe(8);
    expect(summarizePayments(late, '2026-10-21', '2026-10-21').revenue).toBe(0);
  });

  it('returns zeros for no rows', () => {
    expect(summarizePayments([], '2026-10-20', '2026-10-20'))
      .toEqual({ totals: { Cash: 0, 'Credit/Debit': 0, 'Mobile Pay': 0 }, revenue: 0, orderCount: 0 });
  });

  it('avoids float drift when adding amounts', () => {
    const r = [0.1, 0.2].map((a, i) => pay('2026-10-20T20:00:00Z', 'Cash', a, `o${i}`));
    expect(summarizePayments(r, '2026-10-20', '2026-10-20').totals.Cash).toBe(0.3);
  });
});

describe('loadPaymentBreakdown', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads only Completed and Refunded payments, read-only', async () => {
    const chain = paymentsChain({ data: [pay('2026-10-20T20:00:00Z', 'Cash', 5, 'o1')], error: null });
    supabase.from.mockReturnValue(chain);
    const { data, error } = await loadPaymentBreakdown('2026-10-20', '2026-10-20');
    expect(supabase.from).toHaveBeenCalledWith('payments');
    expect(chain.in).toHaveBeenCalledWith('payment_completion_status', ['Completed', 'Refunded']);
    expect(error).toBeNull();
    expect(data.revenue).toBe(5);
    expect(data.truncated).toBe(false);
  });

  it('flags when the row limit was reached', async () => {
    const rows = Array.from({ length: PAYMENT_ROW_LIMIT }, (_, i) => pay('2026-10-20T20:00:00Z', 'Cash', 1, `o${i}`));
    supabase.from.mockReturnValue(paymentsChain({ data: rows, error: null }));
    const { data } = await loadPaymentBreakdown('2026-10-20', '2026-10-20');
    expect(data.truncated).toBe(true);
  });

  it('hides the raw database error', async () => {
    supabase.from.mockReturnValue(paymentsChain({ data: null, error: { message: 'relation "payments" denied' } }));
    const { data, error } = await loadPaymentBreakdown('2026-10-20', '2026-10-20');
    expect(data).toBeNull();
    expect(error.message).toBe('Could not load the payment breakdown.');
  });

  it('never throws', async () => {
    supabase.from.mockImplementation(() => { throw new Error('boom'); });
    const { error } = await loadPaymentBreakdown('2026-10-20', '2026-10-20');
    expect(error.code).toBe('LOOKUP_FAILED');
  });
});

describe('loadDashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads activity and payments together', async () => {
    getSalesActivity.mockResolvedValue({ data: { bestSellers: [], busiestHours: [] }, error: null });
    supabase.from.mockReturnValue(paymentsChain({ data: [], error: null }));
    const result = await loadDashboard('2026-10-14', '2026-10-20');
    expect(getSalesActivity).toHaveBeenCalledWith('2026-10-14', '2026-10-20');
    expect(result.activity.data).toEqual({ bestSellers: [], busiestHours: [] });
    expect(result.payments.error).toBeNull();
  });

  it('keeps the payment breakdown when the activity report fails', async () => {
    getSalesActivity.mockResolvedValue({ data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load sales activity for this date range.' } });
    supabase.from.mockReturnValue(paymentsChain({ data: [pay('2026-10-20T20:00:00Z', 'Cash', 5, 'o1')], error: null }));
    const result = await loadDashboard('2026-10-20', '2026-10-20');
    expect(result.activity.error.code).toBe('LOOKUP_FAILED');
    expect(result.payments.data.revenue).toBe(5);
  });

  it('survives getSalesActivity throwing', async () => {
    getSalesActivity.mockRejectedValue(new Error('network'));
    supabase.from.mockReturnValue(paymentsChain({ data: [], error: null }));
    const result = await loadDashboard('2026-10-20', '2026-10-20');
    expect(result.activity.error.message).toContain('Could not load');
  });

  it('rejects a reversed or malformed range without calling the backend', async () => {
    const result = await loadDashboard('2026-10-20', '2026-10-14');
    expect(result.activity.error.code).toBe('INVALID_DATE_RANGE');
    expect(getSalesActivity).not.toHaveBeenCalled();
    expect((await loadDashboard('x', 'y')).payments.error.code).toBe('INVALID_DATE_RANGE');
  });
});

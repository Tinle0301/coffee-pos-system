// refund-api.test.js — POS-84: the Refund screen's adapter issues refunds
// through the shared processRefund() service, not a direct supabase.rpc().
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./backend/supabase-client.js', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('./backend/services/payments.js', () => ({ getPayment: vi.fn() }));
vi.mock('./backend/services/refunds.js', () => ({ processRefund: vi.fn() }));

import { supabase } from './backend/supabase-client.js';
import { processRefund } from './backend/services/refunds.js';
import { submitRefund } from './refund-api.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitRefund (POS-84)', () => {
  it('sends the refund through the shared processRefund service', async () => {
    processRefund.mockResolvedValue({ data: { refundTransactionIdentifier: 'ref-1', refundAmountValue: 2.5 }, error: null });

    const result = await submitRefund('pay-1', 'Partial', 2.5);

    expect(processRefund).toHaveBeenCalledWith('pay-1', 'Partial', 2.5);
    expect(result).toEqual({ data: { refundTransactionIdentifier: 'ref-1' }, error: null });
  });

  it('never calls the database directly any more', async () => {
    processRefund.mockResolvedValue({ data: { refundTransactionIdentifier: 'ref-1' }, error: null });
    await submitRefund('pay-1', 'Full', 12.5);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['ALREADY_REFUNDED', 'This payment has already been refunded.'],
    ['UNAUTHORIZED', 'Only an admin can issue refunds.'],
    ['AMOUNT_MISMATCH', "That amount doesn't match the payment amount for a Full refund."],
  ])('passes the service error %s through with its friendly message', async (code, message) => {
    processRefund.mockResolvedValue({ data: null, error: { code, message } });
    const { data, error } = await submitRefund('pay-1', 'Full', 12.5);
    expect(data).toBeNull();
    expect(error).toEqual({ code, message });
  });

  it('counts the refund as done when only reading the new row back fails', async () => {
    // process_refund() already ran. Showing an error would invite a second try.
    processRefund.mockResolvedValue({ data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load the refund.' } });
    const result = await submitRefund('pay-1', 'Full', 12.5);
    expect(result).toEqual({ data: { refundTransactionIdentifier: null }, error: null });
  });

  it('returns a safe message if the service throws', async () => {
    processRefund.mockRejectedValue(new Error('boom: secret detail'));
    const { data, error } = await submitRefund('pay-1', 'Full', 12.5);
    expect(data).toBeNull();
    expect(error.message).toBe('Could not reach the server. Try again.');
  });
});

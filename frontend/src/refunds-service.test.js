// refunds-service.test.js — POS-68
// Tests the refund service used by the Admin Refund screen.

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest';

const rpc = vi.fn();

const query = {
  select: vi.fn(() => query),
  eq: vi.fn(() => query),
  maybeSingle: vi.fn(),
};

const from = vi.fn(() => query);

// Node cannot load the CDN-based Supabase client during unit tests,
// so replace it with controllable mocks.
vi.mock('./backend/supabase-client.js', () => ({
  supabase: {
    from: (...args) => from(...args),
    rpc: (...args) => rpc(...args),
  },
}));

const { processRefund, getRefund } = await import(
  './backend/services/refunds.js'
);

const refundRow = {
  refund_transaction_identifier: 'refund-1',
  associated_payment_identifier: 'payment-1',
  refund_amount_value: '4.50',
  refund_type_category: 'Partial',
  refund_processing_timestamp: '2026-01-01T12:10:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// -------------------------------------------------------------------------
// processRefund — input validation (no round trip to the database)
// -------------------------------------------------------------------------

describe('processRefund — input validation', () => {
  it('rejects a missing paymentId without calling the database', async () => {
    const { data, error } = await processRefund('', 'Full', 10);

    expect(data).toBeNull();
    expect(error).toEqual({ code: 'PAYMENT_NOT_FOUND', message: 'No payment found with that ID.' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a refundType that is not Full or Partial', async () => {
    const { data, error } = await processRefund('payment-1', 'Half', 10);

    expect(data).toBeNull();
    expect(error).toEqual({ code: 'INVALID_REFUND_TYPE', message: 'Choose a full or partial refund.' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a zero or negative amount', async () => {
    const zeroResult = await processRefund('payment-1', 'Full', 0);
    const negativeResult = await processRefund('payment-1', 'Full', -5);

    expect(zeroResult.error.code).toBe('INVALID_REFUND_AMOUNT');
    expect(negativeResult.error.code).toBe('INVALID_REFUND_AMOUNT');
    expect(rpc).not.toHaveBeenCalled();
  });
});

// -------------------------------------------------------------------------
// processRefund — success path
// -------------------------------------------------------------------------

describe('processRefund — success', () => {
  it('calls process_refund with the right arguments and returns the new refund', async () => {
    rpc.mockResolvedValue({ data: 'refund-1', error: null });
    query.maybeSingle.mockResolvedValue({ data: refundRow, error: null });

    const { data, error } = await processRefund('payment-1', 'Partial', 4.5);

    expect(rpc).toHaveBeenCalledWith('process_refund', {
      payment_id: 'payment-1',
      refund_type: 'Partial',
      amount: 4.5,
    });

    expect(error).toBeNull();
    expect(data).toEqual({
      refundTransactionIdentifier: 'refund-1',
      associatedPaymentIdentifier: 'payment-1',
      refundAmountValue: '4.50',
      refundTypeCategory: 'Partial',
      refundProcessingTimestamp: '2026-01-01T12:10:00Z',
    });
  });
});

// -------------------------------------------------------------------------
// processRefund — database error mapping
// -------------------------------------------------------------------------

describe('processRefund — database error mapping', () => {
  const cases = [
    ['UNAUTHORIZED: caller is not an admin', 'UNAUTHORIZED', 'Only an admin can issue refunds.'],
    ['PAYMENT_NOT_FOUND: payment x does not exist', 'PAYMENT_NOT_FOUND', 'No payment found with that ID.'],
    ['ALREADY_REFUNDED: payment x has already been refunded', 'ALREADY_REFUNDED', 'This payment has already been refunded.'],
    ['INVALID_PAYMENT_STATUS: payment x is Pending and cannot be refunded', 'INVALID_PAYMENT_STATUS', "This payment isn't completed, so it can't be refunded."],
    ['INVALID_REFUND_TYPE: x is not a supported refund type', 'INVALID_REFUND_TYPE', 'Choose a full or partial refund.'],
    ['INVALID_REFUND_AMOUNT: refund amount must be greater than zero', 'INVALID_REFUND_AMOUNT', "That refund amount isn't valid for this payment."],
    ['AMOUNT_MISMATCH: a Full refund must equal the payment amount 10.00 (got 5.00)', 'AMOUNT_MISMATCH', "That amount doesn't match the payment amount for a Full refund."],
  ];

  it.each(cases)('maps "%s" to { code: %s }', async (rawMessage, expectedCode, expectedMessage) => {
    rpc.mockResolvedValue({ data: null, error: { message: rawMessage } });

    const { data, error } = await processRefund('payment-1', 'Full', 10);

    expect(data).toBeNull();
    expect(error).toEqual({ code: expectedCode, message: expectedMessage });
  });

  it('hides an unrecognized database error behind REFUND_FAILED', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'some unexpected internal error' } });

    const { data, error } = await processRefund('payment-1', 'Full', 10);

    expect(data).toBeNull();
    expect(error).toEqual({ code: 'REFUND_FAILED', message: 'The refund could not be processed. Try again.' });
  });
});

// -------------------------------------------------------------------------
// getRefund
// -------------------------------------------------------------------------

describe('getRefund', () => {
  it('maps a found row to camelCase', async () => {
    query.maybeSingle.mockResolvedValue({ data: refundRow, error: null });

    const { data, error } = await getRefund('refund-1');

    expect(from).toHaveBeenCalledWith('refunds');
    expect(error).toBeNull();
    expect(data.refundTransactionIdentifier).toBe('refund-1');
    expect(data.refundTypeCategory).toBe('Partial');
  });

  it('returns REFUND_NOT_FOUND when nothing matches', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });

    const { data, error } = await getRefund('missing-refund');

    expect(data).toBeNull();
    expect(error).toEqual({ code: 'REFUND_NOT_FOUND', message: 'Refund not found.' });
  });

  it('returns LOOKUP_FAILED on a database error', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'database error' } });

    const { data, error } = await getRefund('refund-1');

    expect(data).toBeNull();
    expect(error).toEqual({ code: 'LOOKUP_FAILED', message: 'Could not load the refund.' });
  });
});

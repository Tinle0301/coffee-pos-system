// queue-service.test.js
// listActiveQueueEntries says whether each order is paid, and falls back to
// the plain list (paid status unknown) if that lookup fails.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.fn();
const select = vi.fn(() => ({ order }));
const from = vi.fn(() => ({ select }));
vi.mock('./backend/supabase-client.js', () => ({ supabase: { from: (...a) => from(...a) } }));

const { listActiveQueueEntries } = await import('./backend/services/queue.js');

const row = (id, orders) => ({
  queue_entry_identifier: `q-${id}`, associated_order_identifier: id,
  queue_entry_status_type: 'In Progress', queue_entry_timestamp: '2026-11-17T18:00:00Z', orders,
});

beforeEach(() => vi.clearAllMocks());

describe('listActiveQueueEntries', () => {
  it('marks each entry paid, unpaid, or unknown', async () => {
    order.mockResolvedValueOnce({
      data: [
        row('paid', { payments: [{ payment_completion_status: 'Completed' }] }),
        row('refunded', { payments: [{ payment_completion_status: 'Refunded' }] }),
        row('unpaid', { payments: [] }),
        row('hidden', null), // another barista's order: RLS hides it
      ],
      error: null,
    });
    const { data, error } = await listActiveQueueEntries();
    expect(error).toBeNull();
    expect(select).toHaveBeenCalledWith('*, orders(payments(payment_completion_status))');
    expect(data.map((e) => [e.associatedOrderIdentifier, e.isPaid])).toEqual([
      ['paid', true], ['refunded', false], ['unpaid', false], ['hidden', null],
    ]);
  });

  it('falls back to the plain list if the paid lookup fails', async () => {
    order
      .mockResolvedValueOnce({ data: null, error: { message: 'could not embed' } })
      .mockResolvedValueOnce({ data: [row('x', undefined)], error: null });
    const { data, error } = await listActiveQueueEntries();
    expect(error).toBeNull();
    expect(select).toHaveBeenLastCalledWith('*');
    expect(data[0]).toMatchObject({ associatedOrderIdentifier: 'x', isPaid: null });
  });

  it('returns LOOKUP_FAILED when both lookups fail', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'down' } });
    const { data, error } = await listActiveQueueEntries();
    expect(data).toBeNull();
    expect(error.code).toBe('LOOKUP_FAILED');
  });
});

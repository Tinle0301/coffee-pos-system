// queue.js — QueueController, including the Realtime subscription for the
// live Active Orders Queue.
//
// listActiveQueueEntries follows the { data, error } contract (see
// docs/API_CONTRACT.md and backend/services/auth.js). subscribeToQueue
// doesn't — Realtime callbacks aren't request/response, so it mirrors
// auth.js's onAuthChange() instead: a plain callback plus an unsubscribe
// function. Requires queue_entries to be in the supabase_realtime
// publication (0008_queue_realtime.sql) or the subscription connects but
// never fires.

import { supabase } from '../supabase-client.js';

/** @typedef {{ code: string, message: string }} ServiceError */

/**
 * @returns {Promise<{ data: import('../models/queueEntry.js').QueueEntry[] | null, error: ServiceError | null }>}
 */
export async function listActiveQueueEntries() {
  // Each entry also says whether its order has been paid, so the queue can
  // offer Pay / Cancel for unpaid orders instead of Start / Complete
  // ("pay first, then make" — update_order_status refuses to complete an
  // unpaid order). RLS only shows the order and payment to their creator or
  // an admin; for anyone else isPaid comes back null (unknown).
  let { data, error } = await supabase
    .from('queue_entries')
    .select('*, orders(payments(payment_completion_status))')
    .order('queue_entry_timestamp', { ascending: true });

  if (error) {
    // Never let the paid check take the whole queue down: fall back to the
    // plain list, with isPaid unknown.
    ({ data, error } = await supabase
      .from('queue_entries')
      .select('*')
      .order('queue_entry_timestamp', { ascending: true }));
  }

  if (error) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load the queue.' } };
  }

  return { data: data.map(toQueueEntry), error: null };
}

/**
 * Subscribes to Realtime updates on queue_entries. A row appears here on
 * create_order (status 'Pending'), changes on update_order_status, and
 * disappears on cancel_order (checkout_order no longer removes it — pay
 * first, then make, see POS-39 — the order stays in the queue until
 * someone actually marks it done or cancels it) — eventType tells the
 * caller which happened, since an INSERT/UPDATE's entry and a DELETE's
 * entry are otherwise indistinguishable from the row shape alone.
 *
 * @param {(change: { eventType: 'INSERT'|'UPDATE'|'DELETE', entry: import('../models/queueEntry.js').QueueEntry }) => void} onChange
 * @returns {() => void} unsubscribe function
 */
export function subscribeToQueue(onChange) {
  const channel = supabase
    .channel('queue_entries_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'queue_entries' },
      (payload) => {
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        onChange({ eventType: payload.eventType, entry: toQueueEntry(row) });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

function toQueueEntry(row) {
  return {
    queueEntryIdentifier: row.queue_entry_identifier,
    associatedOrderIdentifier: row.associated_order_identifier,
    queueEntryStatusType: row.queue_entry_status_type,
    queueEntryTimestamp: row.queue_entry_timestamp,
    isPaid: paidStatus(row.orders),
  };
}

// true / false when the order is visible, null when it isn't (RLS) or the
// row came from Realtime, which sends the queue row alone.
function paidStatus(order) {
  if (!order || !Array.isArray(order.payments)) return null;
  return order.payments.some((p) => p.payment_completion_status === 'Completed');
}

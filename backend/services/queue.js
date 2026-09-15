// queue.js — QueueController, including the Realtime subscription for the
// live Active Orders Queue.

/**
 * @returns {Promise<import('../models/queueEntry.js').QueueEntry[]>}
 */
export async function listActiveQueueEntries() {}

/**
 * Subscribes to Realtime updates on queue_entries.
 * @param {(entry: import('../models/queueEntry.js').QueueEntry) => void} onChange
 * @returns {() => void} unsubscribe function
 */
export function subscribeToQueue(onChange) {}

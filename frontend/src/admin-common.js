// admin-common.js — small helpers shared by the admin screens
// (sales-report.js, staff-manager.js, transaction-log.js).

/**
 * Turn a service result into { data, error }. Services that are still empty
 * placeholders return nothing — show that as "not available yet" instead of
 * crashing.
 */
export function normalize(result, what) {
  if (!result || typeof result !== 'object' || !('data' in result || 'error' in result)) {
    return { data: null, error: { code: 'SERVICE_UNAVAILABLE', message: `${what} isn’t available yet.` } };
  }
  return { data: result.data ?? null, error: result.error ?? null };
}

/** Call a service and never throw: network failures become an error result. */
export async function callService(fn, what, ...args) {
  try {
    return normalize(await fn(...args), what);
  } catch {
    return { data: null, error: { code: 'NETWORK', message: 'Could not reach the server. Try again.' } };
  }
}

/** Today as YYYY-MM-DD in the tablet's local time zone. */
export function todayISO(now = new Date()) {
  return toISODate(now);
}

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as a local date (new Date('2026-01-05') would be UTC midnight). */
export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatMoney(amount) {
  return `$${Number(amount ?? 0).toFixed(2)}`;
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString([], {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// dashboard-api.js — data for the Reports dashboard (admin only).
//
// Best sellers and busiest hours come from the POS-64 service (getSalesActivity).
// The payment breakdown is read straight from the payments table instead of
// generateSalesReport(), because that function SAVES a report row every time
// it runs — a dashboard that refreshes should not write to the database.
//
// Dates are America/Los_Angeles calendar days, the same basis the POS-64
// database functions use, so all three sections describe the same days.
// Payments RLS (payments_select_own_or_admin) lets an admin read every row.
//
// Every function returns { data, error } and never throws. The three sections
// are independent: if one fails (say the POS-64 migration isn't deployed yet)
// the others still load.
import { supabase } from './backend/supabase-client.js';
import { getSalesActivity } from './backend/services/reports.js';

export const REPORT_TIME_ZONE = 'America/Los_Angeles';
export const PAYMENT_METHODS = ['Cash', 'Credit/Debit', 'Mobile Pay'];
export const PAYMENT_ROW_LIMIT = 5000;

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** YYYY-MM-DD of an instant, as a calendar day in the shop's time zone. */
export function reportDateOf(timestamp) {
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? null : dayFormat.format(d);
}

/** Today in the shop's time zone, as YYYY-MM-DD. */
export function reportToday(now = new Date()) {
  return dayFormat.format(now);
}

/** Add whole days to a YYYY-MM-DD string (pure calendar math, no time zone). */
export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Turn payment rows into the breakdown the dashboard shows. Only rows whose
 * shop-local date is inside [startDate, endDate] count.
 * @returns {{ totals: Record<string, number>, revenue: number, orderCount: number }}
 */
export function summarizePayments(rows, startDate, endDate) {
  const sums = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0]));
  const orders = new Set();
  for (const row of rows) {
    const day = reportDateOf(row.payment_processing_timestamp);
    if (!day || day < startDate || day > endDate) continue;
    if (!(row.payment_method_type in sums)) continue;
    sums[row.payment_method_type] += Number(row.payment_amount_value) || 0;
    orders.add(row.associated_order_identifier);
  }
  const totals = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, round2(sums[m])]));
  const revenue = round2(PAYMENT_METHODS.reduce((sum, m) => sum + totals[m], 0));
  return { totals, revenue, orderCount: orders.size };
}

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** @returns {Promise<{ data: { totals, revenue, orderCount, truncated } | null, error: { code, message } | null }>} */
export async function loadPaymentBreakdown(startDate, endDate) {
  const failed = { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load the payment breakdown.' } };
  try {
    // Fetch a day of slack each side, then keep only rows whose Pacific date
    // is in range — avoids doing time-zone offset math in the browser.
    const from = `${addDays(startDate, -1)}T00:00:00Z`;
    const to = `${addDays(endDate, 2)}T00:00:00Z`;
    const { data, error } = await supabase
      .from('payments')
      .select('payment_amount_value, payment_method_type, associated_order_identifier, payment_processing_timestamp')
      .in('payment_completion_status', ['Completed', 'Refunded'])
      .gte('payment_processing_timestamp', from)
      .lt('payment_processing_timestamp', to)
      .limit(PAYMENT_ROW_LIMIT);
    if (error) return failed;
    const rows = data ?? [];
    return { data: { ...summarizePayments(rows, startDate, endDate), truncated: rows.length >= PAYMENT_ROW_LIMIT }, error: null };
  } catch {
    return failed;
  }
}

/**
 * Load everything for one date range.
 * @returns {Promise<{ activity: { data, error }, payments: { data, error } }>}
 */
export async function loadDashboard(startDate, endDate) {
  if (!isDate(startDate) || !isDate(endDate) || startDate > endDate) {
    const error = { code: 'INVALID_DATE_RANGE', message: 'Choose a start date on or before the end date.' };
    return { activity: { data: null, error }, payments: { data: null, error } };
  }
  const [activity, payments] = await Promise.all([
    getSalesActivity(startDate, endDate).catch(() => ({
      data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load sales activity for this date range.' },
    })),
    loadPaymentBreakdown(startDate, endDate),
  ]);
  return { activity, payments };
}

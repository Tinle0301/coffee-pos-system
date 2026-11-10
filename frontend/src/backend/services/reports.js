// reports.js — ReportsController (admin only)
//
// sales_reports is protected by RLS (sales_reports_admin_only in
// 0002_rls_policies.sql) — both read and write are admin-only, so a
// non-admin caller gets rejected at the database and these functions just
// shape the error.
//
// total_revenue_amount is gross revenue: the sum of Completed and Refunded
// payments whose payment_processing_timestamp falls in [startDate, endDate]
// (inclusive, by calendar day). Refunded payments are included because a
// refund (even a partial one) flips the whole payment's status to
// 'Refunded', so excluding that status would drop the original sale out of
// revenue entirely instead of just netting the refunded part. This total is
// NOT net of refunds — the refunded amount isn't subtracted here. Two
// reasons: sales_reports.total_revenue_amount has a `>= 0` check constraint,
// and a refund can be processed in a later window than the payment it
// refunds, so netting them against "revenue for this date range" would make
// a report's number depend on when someone chose to run it, not just on
// what happened in the range. If net-of-refunds reporting is wanted, it
// should probably be its own figure alongside this one, not a silent
// subtraction.
//
// orderCount and paymentMethodTotals (POS-66) share that same scope: both
// are computed from the same Completed+Refunded payment rows as
// totalRevenueAmount, so the three paymentMethodTotals values always sum
// to totalRevenueAmount. orderCount counts distinct order ids rather than
// payment rows — normally the same number, since an order has at most one
// Completed/Refunded payment, but distinct-counting is what actually
// matches "how many orders" instead of relying on that invariant.

import { supabase } from '../supabase-client.js';

/** @typedef {{ code: string, message: string }} ServiceError */

const VALID_GENERATION_TYPES = ['Daily', 'Weekly', 'Monthly'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAYMENT_METHODS = ['Cash', 'Credit/Debit', 'Mobile Pay'];

/**
 * @param {'Daily'|'Weekly'|'Monthly'} reportGenerationType
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate - 'YYYY-MM-DD', inclusive
 * @returns {Promise<{ data: import('../models/salesReport.js').SalesReport | null, error: ServiceError | null }>}
 */
export async function generateSalesReport(reportGenerationType, startDate, endDate) {
  if (!VALID_GENERATION_TYPES.includes(reportGenerationType)) {
    return {
      data: null,
      error: { code: 'INVALID_REPORT_TYPE', message: `reportGenerationType must be one of: ${VALID_GENERATION_TYPES.join(', ')}.` },
    };
  }

  if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) {
    return { data: null, error: { code: 'INVALID_DATE_RANGE', message: 'startDate and endDate must be YYYY-MM-DD.' } };
  }

  if (startDate > endDate) {
    return { data: null, error: { code: 'INVALID_DATE_RANGE', message: 'startDate must not be after endDate.' } };
  }

  const rangeStart = new Date(`${startDate}T00:00:00`).toISOString();
  const rangeEndExclusive = nextDayIso(endDate);

  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('payment_amount_value, payment_method_type, associated_order_identifier')
    .in('payment_completion_status', ['Completed', 'Refunded'])
    .gte('payment_processing_timestamp', rangeStart)
    .lt('payment_processing_timestamp', rangeEndExclusive);

  if (paymentsError) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not total payments for this date range.' } };
  }

  const totalRevenue = round2(payments.reduce((sum, p) => sum + p.payment_amount_value, 0));
  const orderCount = new Set(payments.map((p) => p.associated_order_identifier)).size;
  const paymentMethodTotals = summarizeByPaymentMethod(payments);

  const { data, error } = await supabase
    .from('sales_reports')
    .insert({
      report_generation_type: reportGenerationType,
      report_start_date: startDate,
      report_end_date: endDate,
      total_revenue_amount: totalRevenue,
      order_count: orderCount,
      payment_method_totals: paymentMethodTotals,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Could not save the sales report.' } };
  }

  return { data: toSalesReport(data), error: null };
}


// =====================================================
// POS-64: BEST SELLERS AND BUSIEST HOURS
// =====================================================

/**
 * Returns sales activity for an inclusive date range.
 *
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 */
export async function getSalesActivity(startDate, endDate) {

  // STEP 1: Validate both dates before querying Supabase.
  const isCalendarDate = (value) => {
    if (typeof value !== 'string' ||
        !DATE_PATTERN.test(value)) {
      return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return !Number.isNaN(date.valueOf()) &&
      date.toISOString().slice(0, 10) === value;
  };

  if (!isCalendarDate(startDate) ||
      !isCalendarDate(endDate) ||
      startDate > endDate) {
    return {
      data: null,
      error: {
        code: 'INVALID_DATE_RANGE',
        message: 'Choose a valid start and end date (start must be on or before end).',
      },
    };
  }

  // STEP 2: Call both PostgreSQL functions.
  // Catch unexpected network/client failures.
  let itemsResult;
  let hoursResult;

  try {
    [itemsResult, hoursResult] = await Promise.all([
      supabase.rpc('best_selling_items_report', {
        range_start: startDate,
        range_end: endDate,
      }),

      supabase.rpc('busiest_hours_report', {
        range_start: startDate,
        range_end: endDate,
      }),
    ]);
  } catch {
    return {
      data: null,
      error: {
        code: 'LOOKUP_FAILED',
        message: 'Could not load sales activity for this date range.',
      },
    };
  }

  // STEP 3: Handle database or permission errors.
  if (itemsResult.error || hoursResult.error) {
    const message =
      `${itemsResult.error?.message || ''} ${hoursResult.error?.message || ''}`;

    const unauthorized =
      message.includes('UNAUTHORIZED') ||
      itemsResult.error?.code === '42501' ||
      hoursResult.error?.code === '42501';

    return {
      data: null,
      error: unauthorized
        ? {
            code: 'UNAUTHORIZED',
            message: 'Only active admins can view sales activity.',
          }
        : {
            code: 'LOOKUP_FAILED',
            message: 'Could not load sales activity for this date range.',
          },
    };
  }

  // STEP 4: Convert database columns into JS-friendly objects.
  return {
    data: {
      bestSellers: (itemsResult.data ?? []).map((row) => ({
        menuItemIdentifier: row.menu_item_identifier,
        menuItemName: row.menu_item_name,
        quantitySold: Number(row.quantity_sold),
        grossItemRevenue: Number(row.gross_item_revenue),
      })),

      busiestHours: (hoursResult.data ?? []).map((row) => ({
        hourOfDay: Number(row.hour_of_day),
        orderCount: Number(row.order_count),
      })),
    },
    error: null,
  };
}

/**
 * @returns {Promise<{ data: import('../models/salesReport.js').SalesReport[] | null, error: ServiceError | null }>}
 */
export async function listSalesReports() {
  const { data, error } = await supabase
    .from('sales_reports')
    .select('*')
    .order('report_generated_timestamp', { ascending: false });

  if (error) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load sales reports.' } };
  }

  return { data: data.map(toSalesReport), error: null };
}

function round2(amount) {
  return Math.round(amount * 100) / 100;
}

function summarizeByPaymentMethod(payments) {
  const rawSums = {};
  for (const p of payments) {
    rawSums[p.payment_method_type] = (rawSums[p.payment_method_type] || 0) + p.payment_amount_value;
  }
  const totals = {};
  for (const method of PAYMENT_METHODS) {
    totals[method] = round2(rawSums[method] || 0);
  }
  return totals;
}

function nextDayIso(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}

function toSalesReport(row) {
  return {
    reportIdentifier: row.report_identifier,
    reportGenerationType: row.report_generation_type,
    reportStartDate: row.report_start_date,
    reportEndDate: row.report_end_date,
    totalRevenueAmount: row.total_revenue_amount,
    orderCount: row.order_count,
    paymentMethodTotals: row.payment_method_totals,
    reportGeneratedTimestamp: row.report_generated_timestamp,
  };
}

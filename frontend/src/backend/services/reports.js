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

import { supabase } from '../supabase-client.js';

/** @typedef {{ code: string, message: string }} ServiceError */

const VALID_GENERATION_TYPES = ['Daily', 'Weekly', 'Monthly'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
    .select('payment_amount_value')
    .in('payment_completion_status', ['Completed', 'Refunded'])
    .gte('payment_processing_timestamp', rangeStart)
    .lt('payment_processing_timestamp', rangeEndExclusive);

  if (paymentsError) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not total payments for this date range.' } };
  }

  const totalRevenue = round2(payments.reduce((sum, p) => sum + p.payment_amount_value, 0));

  const { data, error } = await supabase
    .from('sales_reports')
    .insert({
      report_generation_type: reportGenerationType,
      report_start_date: startDate,
      report_end_date: endDate,
      total_revenue_amount: totalRevenue,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Could not save the sales report.' } };
  }

  return { data: toSalesReport(data), error: null };
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
    reportGeneratedTimestamp: row.report_generated_timestamp,
  };
}

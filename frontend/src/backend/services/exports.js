// exports.js — CSV export of saved sales reports (admin only)
//
// Returns { data, error } and never throws, like every other service.
// data is { fileName, csvText }; the screen turns csvText into a download.
//
// sales_reports is admin-only under RLS (sales_reports_admin_only in
// 0002_rls_policies.sql), so a non-admin caller's select just returns no
// row — handled the same way as REPORT_NOT_FOUND below, same reasoning as
// login.js not distinguishing "wrong password" from "no such account."

import { supabase } from '../supabase-client.js';

const CSV_HEADER = ['Report Type', 'Start Date', 'End Date', 'Total Revenue', 'Generated At'];

/** @typedef {{ code: string, message: string }} ServiceError */

/**
 * @param {string} reportId a sales_reports.report_identifier
 * @returns {Promise<{ data: { fileName: string, csvText: string } | null, error: ServiceError | null }>}
 *   csvText is one header row plus one data row
 */
export async function exportReportAsCsv(reportId) {
  const { data, error } = await supabase
    .from('sales_reports')
    .select('*')
    .eq('report_identifier', reportId)
    .maybeSingle();

  if (error) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load the sales report.' } };
  }
  if (!data) {
    return { data: null, error: { code: 'REPORT_NOT_FOUND', message: 'Sales report not found.' } };
  }

  const row = [
    data.report_generation_type,
    data.report_start_date,
    data.report_end_date,
    data.total_revenue_amount,
    data.report_generated_timestamp,
  ];

  return {
    data: {
      fileName: `sales-report-${data.report_start_date}_${data.report_end_date}.csv`,
      csvText: [CSV_HEADER, row].map(toCsvLine).join('\r\n') + '\r\n',
    },
    error: null,
  };
}

function toCsvLine(fields) {
  return fields.map(csvEscape).join(',');
}

function csvEscape(value) {
  const str = String(value ?? '');
  // Excel needs a field quoted if it contains the delimiter, a quote, or a
  // line break — and any embedded quote doubled, per RFC 4180.
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

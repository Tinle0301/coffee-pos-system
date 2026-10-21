// exports.js — CSV/PDF export of reports (admin only)
//
// Unlike the rest of backend/services/, these don't return { data, error }
// — they return the thing to download directly (a Blob), matching the
// original stub signature. There's no form field to show an error next
// to; a caller wires this straight into a download click and can
// try/catch it. Only CSV is implemented here (POS-47); PDF stays a stub.
//
// sales_reports is admin-only under RLS (sales_reports_admin_only in
// 0002_rls_policies.sql), so a non-admin caller's select just returns no
// row — handled the same way as REPORT_NOT_FOUND below, same reasoning as
// login.js not distinguishing "wrong password" from "no such account."

import { supabase } from '../supabase-client.js';

const CSV_HEADER = ['Report Type', 'Start Date', 'End Date', 'Total Revenue', 'Generated At'];

/**
 * @param {string} reportId
 * @returns {Promise<Blob>} a text/csv Blob, one header row plus one data row
 */
export async function exportReportAsCsv(reportId) {
  const { data, error } = await supabase
    .from('sales_reports')
    .select('*')
    .eq('report_identifier', reportId)
    .maybeSingle();

  if (error) {
    throw new Error('Could not load the sales report.');
  }
  if (!data) {
    throw new Error('Sales report not found.');
  }

  const row = [
    data.report_generation_type,
    data.report_start_date,
    data.report_end_date,
    data.total_revenue_amount,
    data.report_generated_timestamp,
  ];

  const csv = [CSV_HEADER, row].map(toCsvLine).join('\r\n') + '\r\n';

  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

/**
 * @param {string} reportId
 * @returns {Promise<Blob>}
 */
export async function exportReportAsPdf(reportId) {}

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

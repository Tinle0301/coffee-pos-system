// sales-report.js — Sales Report screen (admin only)
//
// POS-53: pick a date, choose Day or Week, see the sales report for it.
//         Styles live in report.css, loaded by this screen, so the shared
//         style.css is untouched.
// POS-54: Export downloads the report shown on screen as a CSV file.
//
// Backend operations (see API_CONTRACT_additions.md):
//   generateSalesReport(type, startDate, endDate)  reports.js
//   exportReportAsCsv(reportId)                     exports.js -> { fileName, csvText }

import { generateSalesReport } from './backend/services/reports.js';
import { exportReportAsCsv } from './backend/services/exports.js';
import { callService, todayISO, toISODate, parseISODate, formatMoney, formatDateTime } from './admin-common.js';

/** Monday–Sunday week that contains the given YYYY-MM-DD date. */
export function weekRange(iso) {
  const date = parseISODate(iso);
  const daysSinceMonday = (date.getDay() + 6) % 7; // Sunday=6, Monday=0
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { startDate: toISODate(monday), endDate: toISODate(sunday) };
}

/** Build the CSV locally from the report on screen (used if exports.js isn't ready). */
export function reportToCsv(report) {
  const rows = [
    ['Report ID', 'Type', 'Start date', 'End date', 'Total revenue', 'Generated at'],
    [report.reportIdentifier, report.reportGenerationType, report.reportStartDate,
      report.reportEndDate, Number(report.totalRevenueAmount ?? 0).toFixed(2), report.reportGeneratedTimestamp],
  ];
  const cell = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(cell).join(',')).join('\n');
}

function downloadCsv(fileName, csvText) {
  const url = URL.createObjectURL(new Blob([csvText], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// POS-53: "its own styles" — load report.css once, the first time the screen opens.
function loadReportStyles() {
  if (document.getElementById('report-styles')) return;
  const link = document.createElement('link');
  link.id = 'report-styles';
  link.rel = 'stylesheet';
  link.href = './report.css';
  document.head.appendChild(link);
}

export const salesReportScreen = {
  render() {
    return `
      <div class="screen-container report-screen">
        <h2>Sales Report</h2>
        <form id="report-form" class="report-controls">
          <label class="report-field">
            <span>Date</span>
            <input type="date" id="report-date" required />
          </label>
          <div class="report-period" role="radiogroup" aria-label="Period">
            <label><input type="radio" name="report-period" value="Daily" checked /> Day</label>
            <label><input type="radio" name="report-period" value="Weekly" /> Week</label>
          </div>
          <button type="submit" id="report-run-btn">Show report</button>
        </form>

        <p id="report-status" role="status"></p>

        <section id="report-result" class="report-result" hidden>
          <p class="report-range" id="report-range"></p>
          <p class="report-total-label">Total revenue</p>
          <p class="report-total" id="report-total"></p>
          <p class="report-generated" id="report-generated"></p>
          <button type="button" id="report-export-btn" class="report-export">Export CSV</button>
        </section>
      </div>
    `;
  },

  init() {
    loadReportStyles();

    const form = document.getElementById('report-form');
    const dateInput = document.getElementById('report-date');
    const runBtn = document.getElementById('report-run-btn');
    const status = document.getElementById('report-status');
    const result = document.getElementById('report-result');
    const exportBtn = document.getElementById('report-export-btn');
    let currentReport = null;

    dateInput.value = todayISO();

    function showError(message) {
      status.className = 'error';
      status.textContent = message;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!dateInput.value || runBtn.disabled) return;

      const type = form.querySelector('input[name="report-period"]:checked').value;
      const { startDate, endDate } = type === 'Weekly'
        ? weekRange(dateInput.value)
        : { startDate: dateInput.value, endDate: dateInput.value };

      runBtn.disabled = true;
      runBtn.textContent = 'Loading…';
      status.className = '';
      status.textContent = '';

      const { data: report, error } = await callService(generateSalesReport, 'The sales report', type, startDate, endDate);

      runBtn.disabled = false;
      runBtn.textContent = 'Show report';

      if (error) {
        result.hidden = true;
        currentReport = null;
        showError(error.message);
        return;
      }

      currentReport = report;
      document.getElementById('report-range').textContent = report.reportStartDate === report.reportEndDate
        ? `${report.reportGenerationType} · ${report.reportStartDate}`
        : `${report.reportGenerationType} · ${report.reportStartDate} to ${report.reportEndDate}`;
      document.getElementById('report-total').textContent = formatMoney(report.totalRevenueAmount);
      document.getElementById('report-generated').textContent =
        report.reportGeneratedTimestamp ? `Generated ${formatDateTime(report.reportGeneratedTimestamp)}` : '';
      result.hidden = false;
    });

    // POS-54
    exportBtn.addEventListener('click', async () => {
      if (!currentReport || exportBtn.disabled) return;
      exportBtn.disabled = true;

      let { data, error } = await callService(exportReportAsCsv, 'CSV export', currentReport.reportIdentifier);

      // Until exports.js is implemented, build the CSV from the report on screen.
      if (error?.code === 'SERVICE_UNAVAILABLE') {
        data = {
          fileName: `sales-report-${currentReport.reportStartDate}_${currentReport.reportEndDate}.csv`,
          csvText: reportToCsv(currentReport),
        };
        error = null;
      }

      exportBtn.disabled = false;
      if (error) {
        showError(error.message);
        return;
      }
      downloadCsv(data.fileName, data.csvText);
    });
  },
};

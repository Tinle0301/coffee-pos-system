import { describe, it, expect, vi } from 'vitest';
import { salesReportScreen, weekRange } from './sales-report.js';
import { generateSalesReport } from './backend/services/reports.js';
import { exportReportAsCsv } from './backend/services/exports.js';

// Mock the backend services (Node can't load the CDN-based supabase-client.js chain)
vi.mock('./backend/services/reports.js', () => ({ generateSalesReport: vi.fn() }));
vi.mock('./backend/services/exports.js', () => ({ exportReportAsCsv: vi.fn() }));

const $ = (selector) => document.querySelector(selector);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const report = {
  reportIdentifier: 'r1', reportGenerationType: 'Weekly',
  reportStartDate: '2026-10-12', reportEndDate: '2026-10-18', totalRevenueAmount: 1234.5,
};

function mount() {
  document.body.innerHTML = salesReportScreen.render();
  salesReportScreen.init();
}

async function runReport(date, period) {
  $('#report-date').value = date;
  $(`input[name="report-period"][value="${period}"]`).checked = true;
  $('#report-form').dispatchEvent(new Event('submit', { cancelable: true }));
  await flush();
}

describe('POS-53: Sales Report with a date picker', () => {
  it('should load the Monday–Sunday week for the picked date and show its total', async () => {
    generateSalesReport.mockResolvedValue({ data: report, error: null });
    mount();
    await runReport('2026-10-15', 'Weekly'); // a Thursday

    expect(generateSalesReport).toHaveBeenCalledWith('Weekly', '2026-10-12', '2026-10-18');
    expect($('#report-total').textContent).toBe('$1234.50');
  });

  it('should use the picked date as both start and end for a single day', async () => {
    generateSalesReport.mockResolvedValue({ data: { ...report, reportGenerationType: 'Daily' }, error: null });
    mount();
    await runReport('2026-10-15', 'Daily');

    expect(generateSalesReport).toHaveBeenLastCalledWith('Daily', '2026-10-15', '2026-10-15');
    expect(weekRange('2026-10-18')).toEqual({ startDate: '2026-10-12', endDate: '2026-10-18' }); // a Sunday ends its week
  });
});

describe('POS-54: Export the report as CSV', () => {
  it('should download the CSV returned by exportReportAsCsv', async () => {
    generateSalesReport.mockResolvedValue({ data: report, error: null });
    exportReportAsCsv.mockResolvedValue({ data: { fileName: 'week.csv', csvText: 'a,b' }, error: null });
    URL.createObjectURL = vi.fn(() => 'blob:report');
    URL.revokeObjectURL = vi.fn();
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    mount();
    await runReport('2026-10-15', 'Weekly');
    $('#report-export-btn').click();
    await flush();

    expect(exportReportAsCsv).toHaveBeenCalledWith('r1');
    expect(clicked).toHaveBeenCalledTimes(1); // the download link was clicked
  });
});

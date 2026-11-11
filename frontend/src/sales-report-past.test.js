import { describe, it, expect, vi } from 'vitest';
import { salesReportScreen } from './sales-report.js';
import { generateSalesReport, listSalesReports } from './backend/services/reports.js';

// Mock the backend services (Node can't load the CDN-based supabase-client.js chain)
vi.mock('./backend/services/reports.js', () => ({ generateSalesReport: vi.fn(), listSalesReports: vi.fn() }));
vi.mock('./backend/services/exports.js', () => ({ exportReportAsCsv: vi.fn() }));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const week = (start, end, total) => ({
  reportIdentifier: `r-${start}`, reportGenerationType: 'Weekly',
  reportStartDate: start, reportEndDate: end, totalRevenueAmount: total,
});
const lastWeek = week('2026-10-26', '2026-11-01', 800);
const thisWeek = week('2026-11-02', '2026-11-08', 950);
const oneDay = { ...week('2026-11-03', '2026-11-03', 120), reportGenerationType: 'Daily' };

const pastRows = () => [...document.querySelectorAll('#past-rows tr')].map((tr) => tr.textContent);

describe('POS-76: Past weekly reports on the Sales Report screen', () => {
  it('should list the saved weeks with their totals, and add a newly run week', async () => {
    listSalesReports.mockResolvedValue({ data: [lastWeek, oneDay], error: null });
    document.body.innerHTML = salesReportScreen.render();
    salesReportScreen.init();
    await flush();

    expect(pastRows()).toEqual(['2026-10-26 to 2026-11-01$800.00']); // weeks only, no daily report

    listSalesReports.mockResolvedValue({ data: [lastWeek, thisWeek, oneDay], error: null });
    generateSalesReport.mockResolvedValue({ data: thisWeek, error: null });
    document.getElementById('report-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();

    expect(pastRows()).toEqual([                       // latest week first, ready to compare
      '2026-11-02 to 2026-11-08$950.00',
      '2026-10-26 to 2026-11-01$800.00'
    ]);
  });

  it('should show only the last 8 weeks', async () => {
    const weeks = Array.from({ length: 10 }, (_, i) => {
      const start = new Date(2026, 0, 5 + i * 7); // ten Mondays
      const end = new Date(2026, 0, 11 + i * 7);
      const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return week(iso(start), iso(end), 100 + i);
    });
    listSalesReports.mockResolvedValue({ data: weeks, error: null });
    document.body.innerHTML = salesReportScreen.render();
    salesReportScreen.init();
    await flush();

    expect(pastRows()).toHaveLength(8);
    expect(pastRows()[0]).toContain('$109.00');  // the newest of the ten
    expect(pastRows()[7]).toContain('$102.00');  // the two oldest are left out
  });
});
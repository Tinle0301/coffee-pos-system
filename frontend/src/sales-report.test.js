import { beforeEach, describe, expect, it, vi } from 'vitest';
import { salesReportScreen, weekRange } from './sales-report.js';
import { generateSalesReport } from './backend/services/reports.js';
import { exportReportAsCsv } from './backend/services/exports.js';

vi.mock('./backend/services/reports.js', () => ({
    generateSalesReport: vi.fn(),
}), { virtual: true });
vi.mock('./backend/services/exports.js', () => ({
    exportReportAsCsv: vi.fn(),
}), { virtual: true });
vi.mock('./admin-common.js', () => ({
    callService: (service, _label, ...args) => service(...args),
    todayISO: () => '2026-10-21',
    toISODate: (date) => [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-'),
    parseISODate: (value) => new Date(`${value}T00:00:00`),
    formatMoney: (amount) => `$${Number(amount).toFixed(2)}`,
    formatDateTime: (value) => value,
}), { virtual: true });

const $ = (selector) => document.querySelector(selector);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const report = {
    reportIdentifier: 'r1',
    reportGenerationType: 'Daily',
    reportStartDate: '2026-10-12',
    reportEndDate: '2026-10-12',
    totalRevenueAmount: 1234.5,
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

beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
});

describe('POS-53: Sales Report Screen', () => {
    it('calculates the Monday-Sunday range for a week', () => {
        expect(weekRange('2026-10-12')).toEqual({
            startDate: '2026-10-12',
            endDate: '2026-10-18',
        });
    });

    it('requests daily and weekly reports and displays the returned values', async () => {
        generateSalesReport.mockResolvedValue({ data: report, error: null });
        mount();

        await runReport('2026-10-12', 'Daily');
        expect(generateSalesReport).toHaveBeenLastCalledWith('Daily', '2026-10-12', '2026-10-12');

        const weeklyReport = {...report, reportGenerationType: 'Weekly', reportEndDate: '2026-10-18',};
        generateSalesReport.mockResolvedValue({ data: weeklyReport, error: null });
        await runReport('2026-10-12', 'Weekly');

        expect(generateSalesReport).toHaveBeenLastCalledWith('Weekly', '2026-10-12', '2026-10-18');
        expect($('#report-range').textContent).toContain('2026-10-12 to 2026-10-18');
        expect($('#report-total').textContent).toBe('$1234.50');
        expect($('#report-result').hidden).toBe(false);
    });
});

describe('POS-54: Sales Report Screen - Export', () => {
    it('exports the displayed report as CSV', async () => {
        generateSalesReport.mockResolvedValue({ data: report, error: null });
        exportReportAsCsv.mockResolvedValue({
            data: { fileName: 'report.csv', csvText: 'a,b' },
            error: null,
        });
        URL.createObjectURL = vi.fn(() => 'blob:test');
        URL.revokeObjectURL = vi.fn();

        mount();
        await runReport('2026-10-12', 'Daily');
        $('#report-export-btn').click();
        await flush();

        expect(exportReportAsCsv).toHaveBeenCalledWith('r1');
        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });
});
        
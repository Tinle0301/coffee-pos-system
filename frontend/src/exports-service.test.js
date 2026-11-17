// exports-service.test.js
// exportReportAsCsv returns { data: { fileName, csvText }, error } like the
// other services (it used to return a Blob or throw).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const maybeSingle = vi.fn();
const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: (...a) => maybeSingle(...a) };
vi.mock('./backend/supabase-client.js', () => ({ supabase: { from: vi.fn(() => query) } }));

const { exportReportAsCsv } = await import('./backend/services/exports.js');

beforeEach(() => vi.clearAllMocks());

describe('exportReportAsCsv', () => {
  it('returns the file name and CSV text for a saved report', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        report_generation_type: 'Weekly', report_start_date: '2026-11-09', report_end_date: '2026-11-15',
        total_revenue_amount: 412.5, report_generated_timestamp: '2026-11-16T03:00:00Z',
      },
      error: null,
    });
    const { data, error } = await exportReportAsCsv('r1');
    expect(error).toBeNull();
    expect(query.eq).toHaveBeenCalledWith('report_identifier', 'r1');
    expect(data.fileName).toBe('sales-report-2026-11-09_2026-11-15.csv');
    expect(data.csvText).toBe(
      'Report Type,Start Date,End Date,Total Revenue,Generated At\r\n' +
      'Weekly,2026-11-09,2026-11-15,412.5,2026-11-16T03:00:00Z\r\n'
    );
  });

  it('returns REPORT_NOT_FOUND instead of throwing when there is no such report', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { data, error } = await exportReportAsCsv('missing');
    expect(data).toBeNull();
    expect(error).toEqual({ code: 'REPORT_NOT_FOUND', message: 'Sales report not found.' });
  });

  it('returns LOOKUP_FAILED instead of throwing when the query fails', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'down' } });
    const { error } = await exportReportAsCsv('r1');
    expect(error.code).toBe('LOOKUP_FAILED');
  });
});

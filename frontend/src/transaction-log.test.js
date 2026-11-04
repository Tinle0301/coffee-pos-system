import { describe, it, expect, vi } from 'vitest';
import { transactionLogScreen, logsToCsv } from './transaction-log.js';
import { listTransactionLogs } from './backend/services/transactions.js';

// Mock the backend services (Node can't load the CDN-based supabase-client.js chain)
vi.mock('./backend/services/transactions.js', () => ({ listTransactionLogs: vi.fn() }));
vi.mock('./backend/services/staff.js', () => ({
  listStaffAccounts: vi.fn(() => Promise.resolve({
    data: [{ staffAccountIdentifier: 's1', staffFullName: 'Alex Barista' }], error: null
  }))
}));

const $ = (selector) => document.querySelector(selector);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const entry = {
  transactionLogIdentifier: 't1', associatedOrderIdentifier: 'ord-1',
  transactionTypeCategory: 'order_created', transactionTimestamp: '2026-10-15T12:00:00Z',
  performedByStaffIdentifier: 's1'
};

async function filterLog(from, to) {
  $('#log-from').value = from;
  $('#log-to').value = to;
  $('#log-filters').dispatchEvent(new Event('submit', { cancelable: true }));
  await flush();
}

describe('POS-56: Transaction Log with order and date filters', () => {
  it('should send the order and date filters and show the matching entries', async () => {
    listTransactionLogs.mockResolvedValue({ data: [entry], error: null });

    document.body.innerHTML = transactionLogScreen.render();
    await transactionLogScreen.init();
    expect(listTransactionLogs).toHaveBeenLastCalledWith({}); // no filters at first

    $('#log-order').value = 'ord-1';
    $('#log-from').value = '2026-10-01';
    $('#log-to').value = '2026-10-31';
    $('#log-filters').dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();

    expect(listTransactionLogs).toHaveBeenLastCalledWith({ orderId: 'ord-1', from: '2026-10-01', to: '2026-10-31' });
    const cells = [...document.querySelectorAll('#log-rows td')].map((td) => td.textContent);
    expect(cells).toContain('order created');
    expect(cells).toContain('Alex Barista'); // staff id shown as a name
  });
});

describe('POS-75: Export CSV on the Transaction Log screen', () => {
  it('should download the filtered log as a CSV file', async () => {
    listTransactionLogs.mockResolvedValue({ data: [entry], error: null });
    URL.createObjectURL = vi.fn(() => 'blob:log');
    URL.revokeObjectURL = vi.fn();
    let fileName;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { fileName = this.download; });

    document.body.innerHTML = transactionLogScreen.render();
    await transactionLogScreen.init();
    await filterLog('2026-10-01', '2026-10-31');
    $('#log-export-btn').click();

    expect(fileName).toBe('transaction-log_2026-10-01_2026-10-31.csv');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('should write one row per entry and keep odd values from breaking the CSV', () => {
    const csv = logsToCsv(
      [entry, { ...entry, associatedOrderIdentifier: '=1+1', performedByStaffIdentifier: 's2' }],
      new Map([['s1', 'Alex "Al" Barista, Jr']])
    );
    expect(csv.split('\r\n')).toEqual([
      'Time,Order,Event,By,Staff ID',
      '2026-10-15T12:00:00Z,ord-1,order_created,"Alex ""Al"" Barista, Jr",s1',
      "2026-10-15T12:00:00Z,'=1+1,order_created,,s2", // formula text is defused
      ''
    ]);
  });
});
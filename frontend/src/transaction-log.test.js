import { describe, it, expect, vi } from 'vitest';
import { transactionLogScreen, buildFilters } from './transaction-log.js';
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

describe('POS-56: Transaction Log with order and date filters', () => {
  it('should send the order and date filters and show the matching entries', async () => {
    listTransactionLogs.mockResolvedValue({
      data: [{
        transactionLogIdentifier: 't1', associatedOrderIdentifier: 'ord-1',
        transactionTypeCategory: 'order_created', transactionTimestamp: '2026-10-15T12:00:00Z',
        performedByStaffIdentifier: 's1'
      }], error: null
    });

    document.body.innerHTML = transactionLogScreen.render();
    await transactionLogScreen.init();
    expect(listTransactionLogs).toHaveBeenLastCalledWith({}); // no filters at first

    $('#log-order').value = 'ord-1';
    $('#log-from').value = '2026-10-01';
    $('#log-to').value = '2026-10-31';
    $('#log-filters').dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();

    expect(listTransactionLogs).toHaveBeenLastCalledWith({
      orderId: 'ord-1',
      from: new Date('2026-10-01T00:00:00').toISOString(),     // local start of Oct 1
      to: new Date('2026-10-31T23:59:59.999').toISOString(),   // local end of Oct 31
    });
    const cells = [...document.querySelectorAll('#log-rows td')].map((td) => td.textContent);
    expect(cells).toContain('order created');
    expect(cells).toContain('Alex Barista'); // staff id shown as a name
  });

  it('includes the whole "To" day, in local time', () => {
    const { to } = buildFilters({ to: '2026-10-27' });
    const end = new Date(to);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(9);      // October
    expect(end.getDate()).toBe(27);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it('leaves out filters that are empty', () => {
    expect(buildFilters({ orderId: '  ', from: '', to: '' })).toEqual({});
  });
});

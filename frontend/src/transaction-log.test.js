import { describe, it, expect, vi } from 'vitest';
import { transactionLogScreen } from './transaction-log.js';
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

    expect(listTransactionLogs).toHaveBeenLastCalledWith({ orderId: 'ord-1', from: '2026-10-01', to: '2026-10-31' });
    const cells = [...document.querySelectorAll('#log-rows td')].map((td) => td.textContent);
    expect(cells).toContain('order created');
    expect(cells).toContain('Alex Barista'); // staff id shown as a name
  });
});

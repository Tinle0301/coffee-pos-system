import { describe, it, expect, vi } from 'vitest';
import { queueScreen } from './queue.js';
import { listActiveQueueEntries, subscribeToQueue } from './backend/services/queue.js';
import { UpdateOrderStatus } from './backend/services/orderStatus.js';

// Mock the backend services (Node can't load the CDN-based supabase-client.js chain)
vi.mock('./backend/services/queue.js', () => ({
  listActiveQueueEntries: vi.fn(),
  subscribeToQueue: vi.fn()
}));
vi.mock('./backend/services/orderStatus.js', () => ({
  UpdateOrderStatus: vi.fn(() => Promise.resolve({ data: {}, error: null }))
}));

const flush = () => new Promise(process.nextTick);
const orderNumbers = () =>
  [...document.querySelectorAll('.order-line-name')].map((el) => el.textContent);

async function mount() {
  document.body.innerHTML = queueScreen.render();
  await queueScreen.init(vi.fn());
}

describe('POS-26: Active Orders queue updates in real time', () => {
  it('should show a new order when another device creates one, without refreshing', async () => {
    let notifyChange;
    subscribeToQueue.mockImplementation((onChange) => { notifyChange = onChange; return vi.fn(); });
    listActiveQueueEntries.mockResolvedValueOnce({
      data: [{ orderIdentifier: '1041', orderStatusType: 'Pending' }], error: null
    });
    await mount();
    expect(orderNumbers()).toEqual(['Order #1041']);

    // another register submits order 1042
    listActiveQueueEntries.mockResolvedValueOnce({
      data: [
        { orderIdentifier: '1041', orderStatusType: 'Pending' },
        { orderIdentifier: '1042', orderStatusType: 'Pending' }
      ], error: null
    });
    notifyChange();
    await flush();

    expect(orderNumbers()).toEqual(['Order #1041', 'Order #1042']);
  });
});

describe('POS-30: Mark an order In Progress or Completed from the queue', () => {
  it('should move a Pending order to In Progress, then In Progress to Completed', async () => {
    subscribeToQueue.mockReturnValue(vi.fn());
    listActiveQueueEntries.mockResolvedValue({
      data: [
        { orderIdentifier: '1041', orderStatusType: 'Pending' },
        { orderIdentifier: '1042', orderStatusType: 'In Progress' }
      ], error: null
    });
    await mount();

    document.querySelector('[data-order-id="1041"]').click(); // "Start"
    document.querySelector('[data-order-id="1042"]').click(); // "Complete"
    await flush();

    expect(UpdateOrderStatus).toHaveBeenCalledWith('1041', 'In Progress');
    expect(UpdateOrderStatus).toHaveBeenCalledWith('1042', 'Completed');
  });
});

describe('POS-26: Queue reads the queue service\'s real row shape', () => {
  it('should show order numbers and the next step from queue_entries rows', async () => {
    subscribeToQueue.mockReturnValue(vi.fn());
    listActiveQueueEntries.mockResolvedValue({
      data: [
        { associatedOrderIdentifier: 'abcdef12-0000-0000-0000-000000000001', queueEntryStatusType: 'Pending' },
        { associatedOrderIdentifier: '99999999-0000-0000-0000-000000000002', queueEntryStatusType: 'In Progress' }
      ], error: null
    });
    await mount();

    expect(orderNumbers()).toEqual(['Order #abcdef12', 'Order #99999999']);

    document.querySelector('[data-order-id="abcdef12-0000-0000-0000-000000000001"]').click();
    await flush();
    expect(UpdateOrderStatus).toHaveBeenCalledWith('abcdef12-0000-0000-0000-000000000001', 'In Progress');
  });
});

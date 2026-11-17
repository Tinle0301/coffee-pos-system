// queue-unpaid.test.js
// Unpaid orders on the Active Orders queue: "pay first, then make", so an
// unpaid order shows Pay and Cancel instead of Start / Complete. Before
// this, an order whose payment failed got stuck on the queue for good.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queueScreen } from './queue.js';
import { listActiveQueueEntries, subscribeToQueue } from './backend/services/queue.js';
import { UpdateOrderStatus } from './backend/services/orderStatus.js';
import { RetrieveOrderByIdentifier, CancelExistingOrder } from './backend/services/orders.js';

vi.mock('./backend/services/queue.js', () => ({ listActiveQueueEntries: vi.fn(), subscribeToQueue: vi.fn() }));
vi.mock('./backend/services/orderStatus.js', () => ({ UpdateOrderStatus: vi.fn() }));
vi.mock('./backend/services/orders.js', () => ({ RetrieveOrderByIdentifier: vi.fn(), CancelExistingOrder: vi.fn() }));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const $ = (sel) => document.querySelector(sel);
const button = (label) => [...document.querySelectorAll('#queue-list button')].find((b) => b.textContent === label);

const entry = (id, status, isPaid) => ({
  associatedOrderIdentifier: id, queueEntryStatusType: status, queueEntryTimestamp: '2026-11-17T18:00:00Z', isPaid,
});

let navigate;
let state;

async function mount(entries) {
  listActiveQueueEntries.mockResolvedValue({ data: entries, error: null });
  navigate = vi.fn();
  state = { lastOrder: null };
  document.body.innerHTML = queueScreen.render();
  await queueScreen.init(navigate, [], 'staff-1', state);
}

beforeEach(() => {
  vi.clearAllMocks();
  subscribeToQueue.mockReturnValue(vi.fn());
});

describe('Unpaid orders on the queue', () => {
  it('shows Pay and Cancel (not Start) for an unpaid order', async () => {
    await mount([entry('aaaaaaaa-1111', 'In Progress', false)]);
    expect($('#queue-list').textContent).toContain('Not paid');
    expect(button('Pay')).toBeTruthy();
    expect(button('Cancel')).toBeTruthy();
    expect(button('Complete')).toBeUndefined();
  });

  it('keeps Start / Complete for paid orders and when paid status is unknown', async () => {
    await mount([entry('aaaaaaaa-0001', 'Pending', true), entry('bbbbbbbb-0002', 'In Progress', null)]);
    expect(button('Start')).toBeTruthy();
    expect(button('Complete')).toBeTruthy();
    expect(button('Pay')).toBeUndefined();
  });

  it('Pay loads the order and opens the Payment screen for it', async () => {
    const order = { orderIdentifier: 'aaaaaaaa-1111', orderTotalAmount: 5.45 };
    RetrieveOrderByIdentifier.mockResolvedValue({ data: order, error: null });
    await mount([entry('aaaaaaaa-1111', 'Pending', false)]);

    button('Pay').click();
    await flush();

    expect(RetrieveOrderByIdentifier).toHaveBeenCalledWith('aaaaaaaa-1111');
    expect(state.lastOrder).toBe(order);
    expect(navigate).toHaveBeenCalledWith('payment');
  });

  it('Cancel needs two taps, then cancels and says so', async () => {
    CancelExistingOrder.mockResolvedValue({ data: null, error: null });
    await mount([entry('aaaaaaaa-1111', 'In Progress', false)]);

    button('Cancel').click();
    await flush();
    expect(CancelExistingOrder).not.toHaveBeenCalled();
    expect(button('Tap again to cancel')).toBeTruthy();

    listActiveQueueEntries.mockResolvedValue({ data: [], error: null });
    button('Tap again to cancel').click();
    await flush();

    expect(CancelExistingOrder).toHaveBeenCalledWith('aaaaaaaa-1111');
    expect($('#queue-status').textContent).toBe('Order #aaaaaaaa cancelled.');
    expect($('#queue-list').textContent).toContain('No active orders.');
  });

  it('when Complete is refused as NOT_PAID, explains it and switches to Pay / Cancel', async () => {
    UpdateOrderStatus.mockResolvedValue({ data: null, error: { code: 'NOT_PAID', message: 'order x must be paid before completion' } });
    await mount([entry('cccccccc-3333', 'In Progress', null)]);

    button('Complete').click();
    await flush();

    expect($('#queue-status').className).toBe('error');
    expect($('#queue-status').textContent).toBe("Order #cccccccc hasn't been paid yet. Tap Pay to take payment, or Cancel.");
    expect(button('Pay')).toBeTruthy();
    expect(button('Complete')).toBeUndefined();
  });

  it('an error from Start / Complete stays on screen after the list reloads', async () => {
    UpdateOrderStatus.mockResolvedValue({ data: null, error: { code: 'INVALID_TRANSITION', message: 'cannot change order' } });
    await mount([entry('dddddddd-4444', 'Pending', true)]);

    button('Start').click();
    await flush();

    expect($('#queue-status').textContent).toBe('cannot change order');
  });
});

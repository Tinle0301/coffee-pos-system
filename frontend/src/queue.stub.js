// queue.stub.js — TEMPORARY fake of backend/services/queue.js and
// backend/services/orderStatus.js, for clicking through the Active Orders
// queue before the backend is implemented. Delete once the real ones land.
//
// Orders live in this browser's localStorage, and a change in one tab
// shows up in the other tabs on its own, like Supabase Realtime would
// across devices. Only works between tabs of the SAME browser.
//
// In any tab's DevTools console, run  addStubOrder()  to add a fake order.

const KEY = 'stub-queue-orders';

const read = () => JSON.parse(localStorage.getItem(KEY) || '[]');
const write = (orders) => localStorage.setItem(KEY, JSON.stringify(orders));

const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

// Changes made in OTHER tabs arrive through the 'storage' event.
window.addEventListener('storage', (event) => {
  if (event.key === KEY) notify();
});

export function addStubOrder() {
  const orders = read();
  const order = {
    orderIdentifier: String(1001 + orders.length),
    orderStatusType: 'Pending',
    orderCreationTimestamp: new Date().toISOString(),
    items: [{ menuItemName: 'Latte', quantity: 1, customization: 'Large, Oat milk' }],
  };
  orders.push(order);
  write(orders);
  notify(); // this tab too
  return order.orderIdentifier;
}
window.addStubOrder = addStubOrder;

// ── queue.js ────────────────────────────────────────────────────────────
export async function listActiveQueueEntries() {
  const active = read().filter((o) => !['Completed', 'Cancelled'].includes(o.orderStatusType));
  return { data: active, error: null };
}

export function subscribeToQueue(onChange) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

// ── orderStatus.js ──────────────────────────────────────────────────────
export async function UpdateOrderStatus(orderId, newStatus) {
  const orders = read();
  const order = orders.find((o) => o.orderIdentifier === orderId);
  if (!order) {
    return { data: null, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found.' } };
  }
  order.orderStatusType = newStatus;
  write(orders);
  notify();
  return { data: { orderIdentifier: orderId, orderStatusType: newStatus }, error: null };
}

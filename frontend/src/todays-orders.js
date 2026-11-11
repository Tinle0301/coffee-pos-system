// todays-orders.js — Today's Orders screen (any signed-in staff)
//
// POS-77: show today's orders with their status and payment
// orders.js is already implemented without listOrders, and a normal named
// import of a missing export would stop the whole app from loading. So the
// module is imported as a namespace: until the backend adds listOrders, this
// screen just says it isn't available yet and nothing else breaks.

import * as ordersService from './backend/services/orders.js';
import { callService, formatMoney } from './admin-common.js';

/** Local midnight today (inclusive) to local midnight tomorrow (exclusive), as ISO timestamps. */
export function todayRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** "Paid · Cash · $7.90", "Unpaid", ... */
export function paymentText(order) {
  const payment = order.payment;
  if (!payment) return order.orderStatusType === 'Cancelled' ? 'No payment' : 'Unpaid';
  if (payment.paymentCompletionStatus === 'Completed') {
    return `Paid · ${payment.paymentMethodType} · ${formatMoney(payment.paymentAmountValue)}`;
  }
  return `Payment ${String(payment.paymentCompletionStatus ?? 'unknown').toLowerCase()}`;
}

function timeText(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export const todaysOrdersScreen = {
  render() {
    return `
      <div class="screen-container">
        <h2>Today's Orders</h2>
        <button type="button" id="todays-refresh-btn" class="btn-ghost" style="margin:0 0 12px">Refresh</button>
        <p id="todays-status" role="status"></p>
        <ul id="todays-list" class="order-list"></ul>
      </div>
    `;
  },

  async init() {
    const list = document.getElementById('todays-list');
    const status = document.getElementById('todays-status');
    const refreshBtn = document.getElementById('todays-refresh-btn');

    function render(orders) {
      list.innerHTML = '';
      if (!orders.length) {
        list.innerHTML = '<li class="order-empty">No orders yet today.</li>';
        return;
      }

      const newestFirst = [...orders].sort(
        (a, b) => new Date(b.orderCreationTimestamp) - new Date(a.orderCreationTimestamp)
      );
      for (const order of newestFirst) {
        const li = document.createElement('li');
        li.className = 'order-line';
        li.dataset.orderId = order.orderIdentifier;

        const name = document.createElement('p');
        name.className = 'order-line-name';
        name.textContent = `Order #${String(order.orderIdentifier).slice(0, 8)} · ${timeText(order.orderCreationTimestamp)}`;

        const detail = document.createElement('p');
        detail.className = 'order-line-detail';
        detail.textContent = [
          order.orderStatusType,
          paymentText(order),
          order.orderTotalAmount != null ? `Total ${formatMoney(order.orderTotalAmount)}` : '',
        ].filter(Boolean).join(' · ');

        const info = document.createElement('div');
        info.append(name, detail);
        li.appendChild(info);
        list.appendChild(li);
      }
    }

    async function load() {
      refreshBtn.disabled = true;
      const { data, error } = await callService(
        ordersService.listOrders ?? (() => undefined), // missing function -> "isn't available yet"
        "Today's orders",
        todayRange()
      );
      refreshBtn.disabled = false;

      if (!document.body.contains(list)) return; // screen was left while loading
      if (error) {
        status.className = 'error';
        status.textContent = error.message;
        list.innerHTML = '';
        return;
      }
      status.className = '';
      status.textContent = '';
      render(data ?? []);
    }

    refreshBtn.addEventListener('click', load);
    await load();
  },
};

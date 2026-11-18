// todays-orders.js — Today's Orders screen (any signed-in staff)
//
// POS-77: show today's orders with their status and payment, so a barista can
//         answer customer questions at the counter ("is my latte ready?",
//         "did I already pay?").
// POS-86: tap an order to see its items, their customizations and its payment.
//
// Backend operations (see API_CONTRACT_POS-76-77.md):
//   listOrders({ from, to })     orders.js       (new, POS-77)
//   ViewOrderItems(orderId)      orderItems.js  (POS-86) — quantity, customization, price
//   listMenuItems()              menu.js        (POS-86) — only to turn menu ids into names
//
// `from` / `to` are this register's local midnight and the next midnight, so
// "today" means today at the counter regardless of the server's time zone.
//
// orders.js is already implemented without listOrders, and a normal named
// import of a missing export would stop the whole app from loading. So the
// module is imported as a namespace: until the backend adds listOrders, this
// screen just says it isn't available yet and nothing else breaks.

import * as ordersService from './backend/services/orders.js';
import { ViewOrderItems } from './backend/services/orderItems.js';
import { listMenuItems } from './backend/services/menu.js';
import { callService, formatMoney } from './admin-common.js';

/** Local midnight today (inclusive) to local midnight tomorrow (exclusive), as ISO timestamps. */
export function todayRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function timeText(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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

/** Price x quantity worked out in whole cents, so $4.10 x 3 is exactly $12.30. */
export function itemLineTotal(item) {
  return (Math.round(Number(item.itemPriceAmount) * 100) * item.orderedItemQuantity) / 100;
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

    let orders = [];
    const rows = new Map();       // order id -> its <li>
    const itemsCache = new Map(); // order id -> { items } or { error }
    const openIds = new Set();    // orders whose details are showing (kept across Refresh)
    let menuNames = null;         // menu item id -> name, loaded on the first tap

    // POS-86: what a tapped order shows
    function buildDetail(order) {
      const panel = document.createElement('div');
      panel.className = 'order-detail';
      panel.style.cssText = 'grid-column:1 / -1;padding:8px 0 0;border-top:1px dashed var(--disabled-color)';

      const entry = itemsCache.get(order.orderIdentifier);
      if (!entry) {
        panel.textContent = 'Loading…';
        return panel;
      }
      if (entry.error) {
        panel.className = 'order-detail error';
        panel.textContent = entry.error;
        return panel;
      }

      if (!entry.items.length) {
        const none = document.createElement('p');
        none.className = 'order-empty';
        none.textContent = 'No items on this order.';
        panel.appendChild(none);
      }
      for (const item of entry.items) {
        const line = document.createElement('div');
        line.className = 'order-detail-item';
        line.style.cssText = 'display:flex;justify-content:space-between;gap:12px;padding:6px 0';

        const info = document.createElement('div');
        const name = document.createElement('p');
        name.className = 'order-line-name';
        name.textContent = `${item.orderedItemQuantity} × ${menuNames?.get(item.associatedMenuItemIdentifier) ?? 'Menu item'}`;
        const custom = document.createElement('p');
        custom.className = 'order-line-detail';
        custom.textContent = item.itemCustomizationDescription || 'No customizations';
        info.append(name, custom);

        const price = document.createElement('span');
        price.textContent = formatMoney(itemLineTotal(item));
        line.append(info, price);
        panel.appendChild(line);
      }

      const payment = document.createElement('p');
      payment.className = 'order-detail-payment';
      payment.style.cssText = 'margin:8px 0 0;font-weight:600';
      const paidAt = order.payment?.paymentProcessingTimestamp ? timeText(order.payment.paymentProcessingTimestamp) : '';
      payment.textContent = `Payment: ${[paymentText(order), paidAt].filter(Boolean).join(' · ')}`;
      panel.appendChild(payment);
      return panel;
    }

    function refreshPanel(order) {
      const li = rows.get(order.orderIdentifier);
      if (!li) return;
      li.querySelector('.order-detail')?.remove();
      const isOpen = openIds.has(order.orderIdentifier);
      li.querySelector('.order-line-info').setAttribute('aria-expanded', String(isOpen));
      if (isOpen) li.appendChild(buildDetail(order));
    }

    async function loadDetails(order) {
      const id = order.orderIdentifier;
      const [itemsResult] = await Promise.all([
        callService(ViewOrderItems, 'Order items', id),
        menuNames ? null : callService(listMenuItems, 'The menu').then(({ data, error }) => {
          if (!error) menuNames = new Map((data ?? []).map((m) => [m.menuItemIdentifier, m.menuItemName]));
        }),
      ]);
      if (!document.body.contains(list)) return; // screen was left while loading
      itemsCache.set(id, itemsResult.error
        ? { error: itemsResult.error.message }
        : { items: itemsResult.data ?? [] });
      refreshPanel(order);
    }

    async function toggle(order) {
      const id = order.orderIdentifier;
      if (openIds.has(id)) {
        openIds.delete(id);
        refreshPanel(order);
        return;
      }
      openIds.add(id);
      refreshPanel(order); // shows "Loading…" until the items arrive
      if (!itemsCache.get(id)?.items) await loadDetails(order); // an earlier error is retried
    }

    function render() {
      list.innerHTML = '';
      rows.clear();
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

        // the tap target: the whole summary, reachable and operable from the keyboard too
        const info = document.createElement('div');
        info.className = 'order-line-info editable';
        info.setAttribute('role', 'button');
        info.tabIndex = 0;
        info.setAttribute('aria-expanded', 'false');
        info.append(name, detail);
        info.addEventListener('click', () => toggle(order));
        info.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle(order);
          }
        });

        li.appendChild(info);
        list.appendChild(li);
        rows.set(order.orderIdentifier, li);

        if (openIds.has(order.orderIdentifier)) {
          refreshPanel(order);
          if (!itemsCache.get(order.orderIdentifier)?.items) loadDetails(order);
        }
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
      orders = data ?? [];
      itemsCache.clear(); // an order may have changed since it was opened, so look again
      render();
    }

    refreshBtn.addEventListener('click', load);
    await load();
  },
};
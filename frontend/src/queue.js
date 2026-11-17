// POS-26: the queue updates in real time across devices, so whoever is on
//         bar sees new orders without refreshing.
// POS-30: mark an order In Progress or Completed from the queue, so the bar
//         knows what to make next.
// Unpaid orders: "pay first, then make" — the database won't complete an
//         unpaid order (NOT_PAID), so an unpaid order shows Pay (opens the
//         Payment screen for it) and Cancel instead of Start / Complete.
//         Without this, an order whose payment failed got stuck on the queue.

import { listActiveQueueEntries, subscribeToQueue } from './backend/services/queue.js';
import { UpdateOrderStatus } from './backend/services/orderStatus.js';
import { RetrieveOrderByIdentifier, CancelExistingOrder } from './backend/services/orders.js';

export const NEXT_STEP = {
  'Pending': { status: 'In Progress', label: 'Start' },
  'In Progress': { status: 'Completed', label: 'Complete' },
};

const FINISHED = ['Completed', 'Cancelled'];

// The queue service returns queue_entries rows (associatedOrderIdentifier,
// queueEntryStatusType, queueEntryTimestamp). Map them to the fields this
// screen uses, and keep the older order-shaped fields working too.
export function toQueueCard(entry) {
  return {
    orderIdentifier: entry.orderIdentifier ?? entry.associatedOrderIdentifier,
    orderStatusType: entry.orderStatusType ?? entry.queueEntryStatusType,
    orderCreationTimestamp: entry.orderCreationTimestamp ?? entry.queueEntryTimestamp,
    items: entry.items,
    // true / false when known; null when this device can't see the payment
    isPaid: entry.isPaid ?? null,
  };
}

// Order ids are long UUIDs; show the first 8 characters, like a ticket number.
function shortId(id) {
  return String(id ?? '').slice(0, 8);
}

// Services still being written return nothing; treat that as "not available".
function normalize(result, what) {
  if (!result || typeof result !== 'object' || !('data' in result || 'error' in result)) {
    return { data: null, error: { code: 'SERVICE_UNAVAILABLE', message: `${what} isn’t available yet.` } };
  }
  return { data: result.data ?? null, error: result.error ?? null };
}

export const queueScreen = {
  render() {
    return `
      <div class="screen-container">
        <h2>Active Orders</h2>
        <p id="queue-status" role="status"></p>
        <ul id="queue-list" class="order-list"></ul>
        <button type="button" id="queue-new-order-btn">New order</button>
      </div>
    `;
  },

  async init(navigate, currentOrder, staffId, appState) {
    const list = document.getElementById('queue-list');
    const status = document.getElementById('queue-status');
    // Orders the database said aren't paid (NOT_PAID), when the list itself
    // couldn't tell us.
    const knownUnpaid = new Set();
    let loadFailed = false;

    function showError(message) {
      status.className = 'error';
      status.textContent = message;
    }

    function actionButton(label, orderId, onClick, extraClass = '') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `add-btn ${extraClass}`.trim();
      btn.dataset.orderId = orderId;
      btn.textContent = label;
      btn.addEventListener('click', () => onClick(orderId, btn));
      return btn;
    }

    document.getElementById('queue-new-order-btn').addEventListener('click', () => navigate('new-order'));

    function renderEntries(entries) {
      list.innerHTML = '';
      const active = entries.map(toQueueCard).filter((entry) => entry.orderIdentifier && !FINISHED.includes(entry.orderStatusType));

      if (!active.length) {
        list.innerHTML = '<li class="order-empty">No active orders.</li>';
        return;
      }

      for (const entry of active) {
        const li = document.createElement('li');
        li.className = 'order-line';

        const info = document.createElement('div');
        const title = document.createElement('p');
        title.className = 'order-line-name';
        title.textContent = `Order #${shortId(entry.orderIdentifier)}`;
        const meta = document.createElement('p');
        meta.className = 'order-line-detail';
        const time = entry.orderCreationTimestamp
          ? new Date(entry.orderCreationTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : '';
        meta.textContent = [entry.orderStatusType, time].filter(Boolean).join(' · ');
        info.append(title, meta);

        for (const item of entry.items ?? []) {
          const line = document.createElement('p');
          line.className = 'order-line-detail';
          const name = item.menuItemName ?? item.associatedMenuItemIdentifier ?? 'Item';
          const qty = item.orderedItemQuantity ?? item.quantity ?? 1;
          const custom = item.itemCustomizationDescription ?? item.customization;
          line.textContent = `${qty} × ${name}${custom && custom !== 'None' ? ` (${custom})` : ''}`;
          info.appendChild(line);
        }

        li.appendChild(info);

        const unpaid = entry.isPaid === false || knownUnpaid.has(entry.orderIdentifier);
        if (unpaid) {
          // Not paid yet: take payment, or cancel it (no refund needed).
          const actions = document.createElement('div');
          actions.className = 'queue-actions';
          actions.style.cssText = 'display:flex;gap:8px;align-items:center';
          const note = document.createElement('span');
          note.className = 'order-line-detail queue-unpaid';
          note.textContent = 'Not paid';
          actions.append(
            note,
            actionButton('Pay', entry.orderIdentifier, pay, 'queue-pay-btn'),
            actionButton('Cancel', entry.orderIdentifier, cancel, 'btn-ghost queue-cancel-btn')
          );
          li.appendChild(actions);
        } else {
          // POS-30: one button per order for its next step (Start / Complete).
          const next = NEXT_STEP[entry.orderStatusType];
          if (next) {
            li.appendChild(actionButton(next.label, entry.orderIdentifier, (id, btn) => advance(id, next.status, btn)));
          }
        }

        list.appendChild(li);
      }
    }

    async function load() {
      let result;
      try {
        result = normalize(await listActiveQueueEntries(), 'The order queue');
      } catch {
        result = { data: null, error: { message: 'Could not reach the server. Try again.' } };
      }
      if (!document.body.contains(list)) return; // screen was left while loading
      if (result.error) {
        showError(result.error.message);
        loadFailed = true;
        return;
      }
      // Only clear a message the list itself put up; a message from Start /
      // Complete / Pay / Cancel stays until the next action.
      if (loadFailed) {
        status.className = '';
        status.textContent = '';
        loadFailed = false;
      }
      renderEntries(result.data ?? []);
    }

    // POS-30: save the new status when the barista taps Start or Complete.
    async function advance(orderId, newStatus, btn) {
      // Guard against double-tap: one tap moves the order one step.
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = 'Saving…';
      status.className = '';
      status.textContent = '';

      let result;
      try {
        result = normalize(await UpdateOrderStatus(orderId, newStatus), 'Updating order status');
      } catch {
        result = { data: null, error: { message: 'Could not reach the server. Try again.' } };
      }

      if (result.error?.code === 'NOT_PAID') {
        knownUnpaid.add(orderId);
        showError(`Order #${shortId(orderId)} hasn't been paid yet. Tap Pay to take payment, or Cancel.`);
      } else if (result.error) {
        showError(result.error.message);
      }
      await load(); // show the new status (other devices get it through the subscription)
    }

    // Open the Payment screen for an order that was never paid.
    async function pay(orderId, btn) {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = 'Opening…';

      let result;
      try {
        result = normalize(await RetrieveOrderByIdentifier(orderId), 'Loading the order');
      } catch {
        result = { data: null, error: { message: 'Could not reach the server. Try again.' } };
      }
      if (result.error || !result.data) {
        showError(result.error?.message ?? 'Could not load this order.');
        btn.disabled = false;
        btn.textContent = 'Pay';
        return;
      }
      if (appState) appState.lastOrder = result.data;
      navigate('payment');
    }

    // Cancel an unpaid order. Two taps, so a stray touch can't cancel it.
    async function cancel(orderId, btn) {
      if (btn.disabled) return;
      if (btn.dataset.armed !== 'true') {
        btn.dataset.armed = 'true';
        btn.textContent = 'Tap again to cancel';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Cancelling…';

      let result;
      try {
        result = normalize(await CancelExistingOrder(orderId), 'Cancelling the order');
      } catch {
        result = { data: null, error: { message: 'Could not reach the server. Try again.' } };
      }
      if (result.error) {
        showError(result.error.message);
      } else {
        knownUnpaid.delete(orderId);
        status.className = '';
        status.textContent = `Order #${shortId(orderId)} cancelled.`;
      }
      await load();
    }

    // POS-26: reload whenever any device creates or updates an order.
    let unsubscribe = null;
    try {
      unsubscribe = subscribeToQueue(() => {
        // navigate() swaps the screen without telling it; stop listening
        // once this queue is no longer on screen.
        if (!document.body.contains(list)) {
          if (typeof unsubscribe === 'function') unsubscribe();
          return;
        }
        load();
      });
    } catch {
      unsubscribe = null;
    }

    await load();
  },
};

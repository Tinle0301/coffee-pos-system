// POS-26: the queue updates in real time across devices, so whoever is on
//         bar sees new orders without refreshing.
// POS-30: mark an order In Progress or Completed from the queue, so the bar
//         knows what to make next.

import { listActiveQueueEntries, subscribeToQueue } from './backend/services/queue.js';
import { UpdateOrderStatus } from './backend/services/orderStatus.js';

export const NEXT_STEP = {
  'Pending': { status: 'In Progress', label: 'Start' },
  'In Progress': { status: 'Completed', label: 'Complete' },
};

const FINISHED = ['Completed', 'Cancelled'];

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

  async init(navigate) {
    const list = document.getElementById('queue-list');
    const status = document.getElementById('queue-status');

    document.getElementById('queue-new-order-btn').addEventListener('click', () => navigate('new-order'));

    function renderEntries(entries) {
      list.innerHTML = '';
      const active = entries.filter((entry) => !FINISHED.includes(entry.orderStatusType));

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
        title.textContent = `Order #${entry.orderIdentifier}`;
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

        // POS-30: one button per order for its next step (Start / Complete).
        const next = NEXT_STEP[entry.orderStatusType];
        if (next) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'add-btn';
          btn.dataset.orderId = entry.orderIdentifier;
          btn.textContent = next.label;
          btn.addEventListener('click', () => advance(entry.orderIdentifier, next.status, btn));
          li.appendChild(btn);
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
        status.className = 'error';
        status.textContent = result.error.message;
        return;
      }
      status.className = '';
      status.textContent = '';
      renderEntries(result.data ?? []);
    }

    // POS-30: save the new status when the barista taps Start or Complete.
    async function advance(orderId, newStatus, btn) {
      // Guard against double-tap: one tap moves the order one step.
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = 'Saving…';

      let result;
      try {
        result = normalize(await UpdateOrderStatus(orderId, newStatus), 'Updating order status');
      } catch {
        result = { data: null, error: { message: 'Could not reach the server. Try again.' } };
      }

      if (result.error) {
        status.className = 'error';
        status.textContent = result.error.message;
      }
      await load(); // show the new status (other devices get it through the subscription)
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

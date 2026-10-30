// inventory.js — admin Inventory screen: every stock item at a glance, with
// low and out-of-stock items highlighted and listed first.
// "Low" matches the backend's POS-57 rule: quantity at or below the item's
// minimum stock threshold. Read-only for now; admin-only via the route guard
// in main.js (RLS is the real control).
import { listInventory, restockInventory } from './inventory-api.js';

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 1.5 -> "1.5", 25 -> "25", 0.04 -> "0.04"
const formatQty = (n) => String(Number(Number(n).toFixed(2)));

export const STOCK_LEVELS = {
  out: { label: 'Out of stock', rank: 0 },
  low: { label: 'Low stock', rank: 1 },
  ok: { label: 'In stock', rank: 2 },
};

// out: nothing left; low: at or below the threshold; ok: above it.
export function stockLevel(item) {
  const qty = Number(item.availableQuantityValue);
  const min = Number(item.minimumStockThreshold);
  if (qty <= 0) return 'out';
  if (qty <= min) return 'low';
  return 'ok';
}

// Worst first, then by name.
export function sortBySeverity(items) {
  return [...items].sort((a, b) =>
    STOCK_LEVELS[stockLevel(a)].rank - STOCK_LEVELS[stockLevel(b)].rank
    || String(a.inventoryItemName).localeCompare(String(b.inventoryItemName)));
}

export function countByLevel(items) {
  const counts = { out: 0, low: 0, ok: 0 };
  items.forEach((i) => { counts[stockLevel(i)] += 1; });
  return counts;
}

// Bar fills to 100% at 3x the threshold; a threshold of 0 just shows full when in stock.
function fillPercent(item) {
  const qty = Number(item.availableQuantityValue);
  const min = Number(item.minimumStockThreshold);
  if (qty <= 0) return 0;
  const full = min > 0 ? min * 3 : qty;
  return Math.max(4, Math.min(100, Math.round((qty / full) * 100)));
}

function formatUpdated(timestamp) {
  const d = new Date(timestamp);
  if (!timestamp || Number.isNaN(d.getTime())) return '';
  return `Updated ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export const MAX_RESTOCK = 9999.99;

// Check the "amount to add" box. Returns { error } or { value }.
export function validateRestockAmount(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { error: 'Enter how much to add.' };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { error: 'Use a number like 10 or 2.5.' };
  const value = Number(text);
  if (value <= 0) return { error: 'Enter an amount greater than zero.' };
  if (value > MAX_RESTOCK) return { error: 'That is too much to add at once. Enter 9,999.99 or less.' };
  return { value };
}

export const inventoryScreen = {
  render() {
    return `
      <div class="screen-container inventory">
        <div class="inventory-top">
          <button type="button" id="inventory-back-btn" class="btn-ghost">&larr; Admin Home</button>
        </div>
        <div class="inventory-heading">
          <h2>Inventory</h2>
          <button type="button" id="inventory-refresh-btn" class="btn-ghost">Refresh</button>
        </div>
        <p id="inventory-message" class="inventory-message" role="status" aria-live="polite"></p>
        <div id="inventory-summary" class="inventory-summary" aria-live="polite"></div>
        <div class="inventory-filters" role="group" aria-label="Filter inventory">
          <button type="button" class="inventory-filter is-active" data-filter="all" aria-pressed="true">All items</button>
          <button type="button" class="inventory-filter" data-filter="attention" aria-pressed="false">Needs attention</button>
        </div>
        <div id="inventory-list">Loading inventory...</div>

        <div id="restock-modal" class="modal-overlay" hidden>
          <form id="restock-form" class="screen-container modal-card" role="dialog" aria-modal="true" aria-labelledby="restock-title" novalidate>
            <h2 id="restock-title"></h2>
            <p id="restock-current" class="restock-current"></p>
            <div class="inventory-form-field">
              <label for="restock-amount">Amount to add</label>
              <input id="restock-amount" type="text" inputmode="decimal" autocomplete="off" placeholder="e.g. 10">
              <p id="restock-amount-error" class="inventory-form-error" role="alert"></p>
            </div>
            <p id="restock-preview" class="restock-preview" aria-live="polite"></p>
            <p id="restock-error" class="inventory-form-error" role="alert"></p>
            <div class="modal-actions">
              <button type="button" id="restock-cancel" class="btn-ghost">Cancel</button>
              <button type="submit" id="restock-save">Add stock</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async init(navigate) {
    document.getElementById('inventory-back-btn').addEventListener('click', () => navigate('admin'));

    const list = document.getElementById('inventory-list');
    const summary = document.getElementById('inventory-summary');
    const refreshBtn = document.getElementById('inventory-refresh-btn');
    const filterBtns = [...document.querySelectorAll('.inventory-filter')];

    let items = [];
    let filter = 'all';
    let loading = false;

    const draw = () => {
      summary.innerHTML = this.generateSummaryHTML(items);
      const sorted = sortBySeverity(items);
      const shown = filter === 'attention' ? sorted.filter((i) => stockLevel(i) !== 'ok') : sorted;
      if (items.length === 0) list.textContent = 'No inventory items yet.';
      else if (shown.length === 0) list.innerHTML = '<p class="inventory-allgood">Everything is stocked. Nothing needs attention.</p>';
      else list.innerHTML = `<ul class="inventory-list">${shown.map((i) => this.generateRowHTML(i)).join('')}</ul>`;
    };

    const load = async () => {
      if (loading) return; // double-tap protection
      loading = true;
      refreshBtn.disabled = true;
      const { data, error } = await listInventory();
      loading = false;
      refreshBtn.disabled = false;
      if (error || !data) {
        // Keep whatever was already on screen; show a calm message.
        const msg = `<div class="error" role="alert">${escapeHtml(error?.message || 'Could not load inventory.')}</div>`;
        if (items.length === 0) { list.innerHTML = msg; summary.innerHTML = ''; }
        else list.insertAdjacentHTML('afterbegin', msg);
        return;
      }
      items = data;
      draw();
    };

    filterBtns.forEach((btn) => btn.addEventListener('click', () => {
      filter = btn.dataset.filter;
      filterBtns.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      draw();
    }));
    refreshBtn.addEventListener('click', load);

    // ---------- Restock ----------
    const message = document.getElementById('inventory-message');
    const modal = document.getElementById('restock-modal');
    const form = document.getElementById('restock-form');
    const amountInput = document.getElementById('restock-amount');
    const amountError = document.getElementById('restock-amount-error');
    const formError = document.getElementById('restock-error');
    const preview = document.getElementById('restock-preview');
    const saveBtn = document.getElementById('restock-save');
    const cancelBtn = document.getElementById('restock-cancel');
    let restocking = null; // the item being restocked
    let saving = false;
    let returnFocusTo = null;

    const say = (text, isError = false) => {
      message.textContent = text;
      message.classList.toggle('is-error', isError);
    };

    const updatePreview = () => {
      const { value } = validateRestockAmount(amountInput.value);
      preview.textContent = value && restocking
        ? `New total: ${formatQty(Math.round((Number(restocking.availableQuantityValue) + value) * 100) / 100)}`
        : '';
    };

    function openRestock(item) {
      restocking = item;
      returnFocusTo = document.activeElement;
      document.getElementById('restock-title').textContent = `Restock ${item.inventoryItemName}`;
      document.getElementById('restock-current').textContent = `${formatQty(item.availableQuantityValue)} on hand · reorder at ${formatQty(item.minimumStockThreshold)}`;
      amountInput.value = '';
      amountError.textContent = '';
      formError.textContent = '';
      preview.textContent = '';
      saving = false;
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
      modal.hidden = false;
      amountInput.focus();
    }

    function closeRestock() {
      if (saving) return;
      modal.hidden = true;
      restocking = null;
      if (returnFocusTo && typeof returnFocusTo.focus === 'function') returnFocusTo.focus();
    }

    list.addEventListener('click', (event) => {
      const btn = event.target.closest('.inventory-restock-btn');
      if (!btn) return;
      const item = items.find((i) => String(i.inventoryItemIdentifier) === btn.dataset.itemId);
      if (item) openRestock(item);
    });
    amountInput.addEventListener('input', updatePreview);
    cancelBtn.addEventListener('click', closeRestock);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeRestock(); });
    modal.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeRestock(); });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (saving || !restocking) return; // double-tap protection
      amountError.textContent = '';
      formError.textContent = '';

      const { error: invalid, value } = validateRestockAmount(amountInput.value);
      if (invalid) {
        amountError.textContent = invalid;
        amountInput.focus();
        return;
      }

      saving = true;
      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      const item = restocking;
      const { data: updated, error } = await restockInventory(item.inventoryItemIdentifier, value);
      saving = false;
      saveBtn.disabled = false;
      cancelBtn.disabled = false;

      if (error || !updated) {
        // Keep the box open with what they typed. The service's messages are safe to show.
        formError.textContent = error?.message || 'Could not restock. Please try again.';
        return;
      }

      items = items.map((i) => (i.inventoryItemIdentifier === item.inventoryItemIdentifier ? updated : i));
      closeRestock();
      say(`Added ${formatQty(value)} to ${updated.inventoryItemName}. Now ${formatQty(updated.availableQuantityValue)} on hand.`);
      draw();
    });

    await load();
  },

  // Three count cards: out / low / in stock.
  generateSummaryHTML(items) {
    if (items.length === 0) return '';
    const counts = countByLevel(items);
    return ['out', 'low', 'ok'].map((level) => `
      <div class="inventory-count inventory-count--${level}${counts[level] === 0 ? ' is-zero' : ''}">
        <span class="inventory-count-num">${counts[level]}</span>
        <span class="inventory-count-label">${STOCK_LEVELS[level].label}</span>
      </div>`).join('');
  },

  generateRowHTML(item) {
    const level = stockLevel(item);
    return `
      <li class="inventory-row inventory-row--${level}">
        <div class="inventory-row-head">
          <div class="inventory-row-main">
            <span class="inventory-name">${escapeHtml(item.inventoryItemName)}</span>
            <span class="inventory-badge inventory-badge--${level}">${STOCK_LEVELS[level].label}</span>
          </div>
          <button type="button" class="inventory-restock-btn" data-item-id="${escapeHtml(item.inventoryItemIdentifier)}"
            aria-label="Restock ${escapeHtml(item.inventoryItemName)}">Restock</button>
        </div>
        <div class="inventory-row-detail">
          <span class="inventory-qty"><strong>${formatQty(item.availableQuantityValue)}</strong> on hand</span>
          <span class="inventory-min">Reorder at ${formatQty(item.minimumStockThreshold)}</span>
          <span class="inventory-updated">${escapeHtml(formatUpdated(item.inventoryLastUpdatedTimestamp))}</span>
        </div>
        <div class="inventory-bar" aria-hidden="true"><span style="width:${fillPercent(item)}%"></span></div>
      </li>`;
  },
};

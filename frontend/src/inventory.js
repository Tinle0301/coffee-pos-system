// inventory.js — admin Inventory screen: every stock item at a glance, with
// low and out-of-stock items highlighted and listed first.
// "Low" matches the backend's POS-57 rule: quantity at or below the item's
// minimum stock threshold. Read-only for now; admin-only via the route guard
// in main.js (RLS is the real control).
import { listInventory } from './inventory-api.js';

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
        <div id="inventory-summary" class="inventory-summary" aria-live="polite"></div>
        <div class="inventory-filters" role="group" aria-label="Filter inventory">
          <button type="button" class="inventory-filter is-active" data-filter="all" aria-pressed="true">All items</button>
          <button type="button" class="inventory-filter" data-filter="attention" aria-pressed="false">Needs attention</button>
        </div>
        <div id="inventory-list">Loading inventory...</div>
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
        <div class="inventory-row-main">
          <span class="inventory-name">${escapeHtml(item.inventoryItemName)}</span>
          <span class="inventory-badge inventory-badge--${level}">${STOCK_LEVELS[level].label}</span>
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

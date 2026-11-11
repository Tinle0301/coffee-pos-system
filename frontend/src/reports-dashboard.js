// reports-dashboard.js — admin Reports dashboard: how the shop is doing at a
// glance. Best sellers, busiest hours and payment breakdown for a date range.
// Data comes from dashboard-api.js; styles are in reports-dashboard.css.
// Admin-only via the route guard in main.js (RLS and the SQL functions are the
// real control).
import { loadDashboard, reportToday, addDays, PAYMENT_METHODS } from './dashboard-api.js';

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const formatMoney = (n) =>
  `$${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

/** 0 -> "12 AM", 13 -> "1 PM" */
export function formatHour(hour) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${hour < 12 ? 'AM' : 'PM'}`;
}

const shortHour = (hour) => `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? 'a' : 'p'}`;

/** The hours to draw: 5 AM–9 PM, widened if there are sales outside that. */
export function hourWindow(hours) {
  const active = hours.filter((h) => h.orderCount > 0).map((h) => h.hourOfDay);
  const first = Math.min(5, ...(active.length ? active : [5]));
  const last = Math.max(21, ...(active.length ? active : [21]));
  return { first, last };
}

/** Round percentages to whole numbers that add up to exactly 100 (largest remainder). */
export function wholePercents(values) {
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) return values.map(() => 0);
  const scaled = values.map((v) => (v / total) * 100);
  const floors = scaled.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = scaled.map((v, i) => [v - floors[i], i]).sort((x, y) => y[0] - x[0]);
  for (const [, i] of order) { if (left <= 0) break; floors[i] += 1; left -= 1; }
  return floors;
}

export const PRESETS = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
];

export function presetRange(key, today = reportToday()) {
  const preset = PRESETS.find((p) => p.key === key) ?? PRESETS[1];
  return { startDate: addDays(today, -(preset.days - 1)), endDate: today };
}

const errorHtml = (error) => `<p class="rd-error" role="alert">${escapeHtml(error?.message || 'Something went wrong.')}</p>`;
const emptyHtml = (text) => `<p class="rd-empty">${escapeHtml(text)}</p>`;

export const reportsDashboardScreen = {
  render() {
    return `
      <div class="screen-container rd">
        <div class="rd-top">
          <button type="button" id="rd-back-btn" class="btn-ghost">&larr; Admin Home</button>
        </div>
        <div class="rd-heading">
          <h2>Reports Dashboard</h2>
          <button type="button" id="rd-refresh-btn" class="btn-ghost">Refresh</button>
        </div>

        <div class="rd-range" role="group" aria-label="Date range">
          ${PRESETS.map((p) => `<button type="button" class="rd-preset" data-preset="${p.key}" aria-pressed="false">${p.label}</button>`).join('')}
        </div>
        <form id="rd-custom" class="rd-custom">
          <label>From <input type="date" id="rd-from" required></label>
          <label>To <input type="date" id="rd-to" required></label>
          <button type="submit" id="rd-apply-btn">Update</button>
        </form>
        <p id="rd-range-note" class="rd-range-note" aria-live="polite"></p>

        <section id="rd-summary" class="rd-summary" aria-label="Summary"></section>

        <section class="rd-card" aria-labelledby="rd-best-title">
          <h3 id="rd-best-title">Best sellers</h3>
          <div id="rd-best">Loading...</div>
        </section>
        <section class="rd-card" aria-labelledby="rd-hours-title">
          <h3 id="rd-hours-title">Busiest hours</h3>
          <div id="rd-hours">Loading...</div>
        </section>
        <section class="rd-card" aria-labelledby="rd-pay-title">
          <h3 id="rd-pay-title">Payment breakdown</h3>
          <div id="rd-pay">Loading...</div>
        </section>
      </div>
    `;
  },

  async init(navigate) {
    document.getElementById('rd-back-btn').addEventListener('click', () => navigate('admin'));

    const $ = (id) => document.getElementById(id);
    const presetBtns = [...document.querySelectorAll('.rd-preset')];
    const refreshBtn = $('rd-refresh-btn');
    const applyBtn = $('rd-apply-btn');
    let range = presetRange('7');
    let activePreset = '7';
    let requestId = 0; // ignore answers from a request that has been replaced

    const syncControls = () => {
      presetBtns.forEach((b) => {
        const on = b.dataset.preset === activePreset;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      $('rd-from').value = range.startDate;
      $('rd-to').value = range.endDate;
      $('rd-range-note').textContent = range.startDate === range.endDate
        ? `Showing ${range.startDate} (Pacific time)`
        : `Showing ${range.startDate} to ${range.endDate} (Pacific time)`;
    };

    const load = async () => {
      const mine = ++requestId;
      syncControls();
      refreshBtn.disabled = true;
      applyBtn.disabled = true;
      ['rd-best', 'rd-hours', 'rd-pay'].forEach((id) => { $(id).textContent = 'Loading...'; });
      $('rd-summary').innerHTML = '';

      const { activity, payments } = await loadDashboard(range.startDate, range.endDate);
      if (mine !== requestId) return;

      refreshBtn.disabled = false;
      applyBtn.disabled = false;
      $('rd-summary').innerHTML = this.renderSummary(payments);
      $('rd-best').innerHTML = this.renderBestSellers(activity);
      $('rd-hours').innerHTML = this.renderHours(activity);
      $('rd-pay').innerHTML = this.renderPayments(payments);
    };

    presetBtns.forEach((btn) => btn.addEventListener('click', () => {
      activePreset = btn.dataset.preset;
      range = presetRange(activePreset);
      load();
    }));

    $('rd-custom').addEventListener('submit', (event) => {
      event.preventDefault();
      if (applyBtn.disabled) return; // double-tap protection
      const from = $('rd-from').value;
      const to = $('rd-to').value;
      if (!from || !to || from > to) {
        $('rd-range-note').textContent = 'Choose a start date on or before the end date.';
        return;
      }
      activePreset = null;
      range = { startDate: from, endDate: to };
      load();
    });

    refreshBtn.addEventListener('click', () => { if (!refreshBtn.disabled) load(); });

    await load();
  },

  // ---------- sections (each takes { data, error }) ----------

  renderSummary({ data, error }) {
    if (error || !data) return '';
    const average = data.orderCount ? data.revenue / data.orderCount : 0;
    const cards = [
      ['Revenue', formatMoney(data.revenue)],
      ['Orders', data.orderCount.toLocaleString('en-US')],
      ['Average order', formatMoney(average)],
    ];
    return cards.map(([label, value]) => `
      <div class="rd-stat"><span class="rd-stat-value">${value}</span><span class="rd-stat-label">${label}</span></div>`).join('');
  },

  renderBestSellers({ data, error }) {
    if (error || !data) return errorHtml(error);
    const items = data.bestSellers;
    if (!items.length) return emptyHtml('No items sold in this period.');
    const top = Math.max(...items.map((i) => i.quantitySold), 1);
    return `<ol class="rd-best">${items.map((item, i) => `
      <li class="rd-best-row">
        <span class="rd-rank" aria-hidden="true">${i + 1}</span>
        <div class="rd-best-main">
          <div class="rd-best-line">
            <span class="rd-best-name">${escapeHtml(item.menuItemName)}</span>
            <span class="rd-best-qty"><strong>${item.quantitySold.toLocaleString('en-US')}</strong> sold · ${formatMoney(item.grossItemRevenue)}</span>
          </div>
          <div class="rd-bar" aria-hidden="true"><span style="width:${Math.max(3, Math.round((item.quantitySold / top) * 100))}%"></span></div>
        </div>
      </li>`).join('')}</ol>`;
  },

  renderHours({ data, error }) {
    if (error || !data) return errorHtml(error);
    const hours = [...data.busiestHours].sort((a, b) => a.hourOfDay - b.hourOfDay);
    const total = hours.reduce((sum, h) => sum + h.orderCount, 0);
    if (!total) return emptyHtml('No orders in this period.');

    const peakCount = Math.max(...hours.map((h) => h.orderCount));
    const peaks = hours.filter((h) => h.orderCount === peakCount);
    const peak = peaks[0];
    const summary = `Busiest hour: <strong>${formatHour(peak.hourOfDay)}–${formatHour((peak.hourOfDay + 1) % 24)}</strong> (${plural(peakCount, 'order')})${peaks.length > 1 ? `, tied with ${plural(peaks.length - 1, 'other hour')}` : ''}.`;

    const { first, last } = hourWindow(hours);
    const byHour = new Map(hours.map((h) => [h.hourOfDay, h.orderCount]));
    const cols = [];
    for (let h = first; h <= last; h += 1) {
      const count = byHour.get(h) ?? 0;
      const isPeak = count === peakCount;
      cols.push(`
        <li class="rd-hour${isPeak ? ' is-peak' : ''}${count === 0 ? ' is-zero' : ''}" title="${formatHour(h)}: ${plural(count, 'order')}">
          <span class="rd-hour-count">${count || ''}</span>
          <span class="rd-hour-bar" style="height:${count ? Math.max(4, Math.round((count / peakCount) * 100)) : 2}%"></span>
          <span class="rd-hour-label">${(h - first) % 3 === 0 ? shortHour(h) : ''}</span>
          <span class="rd-sr">${formatHour(h)}: ${plural(count, 'order')}</span>
        </li>`);
    }
    return `<p class="rd-hours-summary">${summary}</p><ul class="rd-hours">${cols.join('')}</ul>`;
  },

  renderPayments({ data, error }) {
    if (error || !data) return errorHtml(error);
    if (!data.revenue) return emptyHtml('No payments in this period.');
    const note = data.truncated ? '<p class="rd-note">Showing the most recent payments only; narrow the date range for exact totals.</p>' : '';
    const rows = PAYMENT_METHODS.map((method, i) => {
      const amount = data.totals[method] ?? 0;
      const pct = data.revenue ? (amount / data.revenue) * 100 : 0;
      return { method, amount, pct, cls: `rd-pay-${i}` };
    });
    wholePercents(rows.map((r) => r.pct)).forEach((p, i) => { rows[i].shown = p; });
    return `${note}
      <div class="rd-pay-bar" role="img" aria-label="${rows.map((r) => `${r.method} ${r.shown}%`).join(', ')}">
        ${rows.filter((r) => r.pct > 0).map((r) => `<span class="${r.cls}" style="width:${r.pct}%"></span>`).join('')}
      </div>
      <ul class="rd-pay-list">${rows.map((r) => `
        <li class="rd-pay-row">
          <span class="rd-pay-swatch ${r.cls}" aria-hidden="true"></span>
          <span class="rd-pay-name">${escapeHtml(r.method)}</span>
          <span class="rd-pay-amount">${formatMoney(r.amount)}</span>
          <span class="rd-pay-pct">${r.shown}%</span>
        </li>`).join('')}</ul>`;
  },
};

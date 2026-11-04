// transaction-log.js — Transaction Log screen (admin only)
//
// POS-56: list the audit log with an order filter and a date filter, so the
//         admin can audit any order.
// POS-75 export transaction-log to csv file

import { listTransactionLogs } from './backend/services/transactions.js';
import { listStaffAccounts } from './backend/services/staff.js';
import { callService, formatDateTime } from './admin-common.js';

/**
 * Only send the filters that were filled in. Dates are turned into the
 * tablet's local start of day (From) and end of day (To), so "To: Oct 27"
 * includes everything logged on Oct 27.
 */
export function buildFilters({ orderId, from, to }) {
  const filters = {};
  if (orderId?.trim()) filters.orderId = orderId.trim();
  if (from) filters.from = new Date(`${from}T00:00:00`).toISOString();
  if (to) filters.to = new Date(`${to}T23:59:59.999`).toISOString();
  return filters;
}

const CSV_COLUMNS = ['Time', 'Order', 'Event', 'By', 'Staff ID'];

function csvCell(value) {
  let text = String(value ?? '');
  // a cell that starts with = + - @ would be run as a formula by Excel/Sheets
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function logsToCSV(logs, staffNames = new Map()) {
  const rows = logs.map((log) => [
    log.transactionTimestamp,
    log.associatedOrderIdentifier,
    log.transactionTypeCategory,
    staffNames.get(log.performedByStaffAccountIdentifier) ??'',
    log.performedByStaffAccountIdentifier,
  ]);
  return [CSV_COLUMNS, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

function  downloadCsv (filename, csvText) {
  const url  = URL.createObjectURL(new Blob(['',csvText], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const transactionLogScreen = {
  render() {
    return `
      <div class="screen-container">
        <h2>Transaction Log</h2>
        <form id="log-filters" class="log-filters" style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px">
          <label class="field-label">Order
            <input type="text" id="log-order" placeholder="Order ID" autocomplete="off" style="display:block;min-height:44px;margin-top:6px;padding:0 10px;font-size:1rem;border:1px solid var(--disabled-color);border-radius:8px" />
          </label>
          <label class="field-label">From
            <input type="date" id="log-from" style="display:block;min-height:44px;margin-top:6px;padding:0 10px;font-size:1rem;border:1px solid var(--disabled-color);border-radius:8px" />
          </label>
          <label class="field-label">To
            <input type="date" id="log-to" style="display:block;min-height:44px;margin-top:6px;padding:0 10px;font-size:1rem;border:1px solid var(--disabled-color);border-radius:8px" />
          </label>
          <div class="log-filter-actions" style="display:flex;gap:8px">
            <button type="submit" id="log-apply-btn" style="width:auto;margin:0;min-height:44px">Filter</button>
            <button type="button" id="log-clear-btn" class="btn-ghost" style="margin:0">Clear</button>
          </div>
        </form>
        <p id="log-status" role="status"></p>
        <table class="menu-table log-table">
          <thead>
            <tr><th>Time</th><th>Order</th><th>Event</th><th>By</th></tr>
          </thead>
          <tbody id="log-rows"></tbody>
        </table>
      </div>
    `;
  },

  async init() {
    const form = document.getElementById('log-filters');
    const orderInput = document.getElementById('log-order');
    const fromInput = document.getElementById('log-from');
    const toInput = document.getElementById('log-to');
    const applyBtn = document.getElementById('log-apply-btn');
    const exportBtn = document.getElementById('log-export-btn');
    const rows = document.getElementById('log-rows');
    const status = document.getElementById('log-status');
    let staffNames = new Map();
    let shownLogs = [];
    let showFilters = [];

    function render(logs) {
      rows.innerHTML = '';
      if (!logs.length) {
        rows.innerHTML = '<tr><td colspan="4" class="order-empty">No log entries match these filters.</td></tr>';
        return;
      }
      for (const log of logs) {
        const tr = document.createElement('tr');
        const cells = [
          formatDateTime(log.transactionTimestamp),
          log.associatedOrderIdentifier,
          (log.transactionTypeCategory ?? '').replace(/_/g, ' '),
          staffNames.get(log.performedByStaffIdentifier) ?? log.performedByStaffIdentifier,
        ];
        for (const value of cells) {
          const td = document.createElement('td');
          td.textContent = value ?? '';
          tr.appendChild(td);
        }
        rows.appendChild(tr);
      }
    }

    async function load() {
      if (fromInput.value && toInput.value && fromInput.value > toInput.value) {
        status.className = 'error';
        status.textContent = '"From" must be on or before "To".';
        return;
      }

      applyBtn.disabled = true;
      exportBtn.disabled = true;
      const filters = buildFilters({ orderId: orderInput.value, from: fromInput.value, to: toInput.value });
      const { data, error } = await callService(listTransactionLogs, 'The transaction log', filters);
      applyBtn.disabled = false;

      if (!document.body.contains(rows)) return;
      if (error) {
        shownLogs = [];
        status.className = 'error';
        status.textContent = error.message;
        rows.innerHTML = '';
        return;
      }
      shownLogs = data ?? [];
      showFilters = filters;
      exportBtn.disabled = shownLogs.length === 0;
      status.className = '';
      status.textContent = '';
      render(shownLogs);
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      load();
    });

    document.getElementById('log-clear-btn').addEventListener('click', () => {
      orderInput.value = '';
      fromInput.value = '';
      toInput.value = '';
      load();
    });

   exportBtn.addEventListener('click', () => {
      if (!shownLogs.length) return;
      downloadCsv(exportFileName(shownFilters), logsToCsv(shownLogs, staffNames));
    });

    // Staff names are a nice-to-have for the "By" column; ids are shown if this fails.
    const staff = await callService(listStaffAccounts, 'Staff accounts');
    if (!staff.error) {
      staffNames = new Map((staff.data ?? []).map((s) => [s.staffAccountIdentifier, s.staffFullName]));
    }

    await load();
  },
};

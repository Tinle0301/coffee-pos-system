// receipt.js — builds the customer's receipt (POS-87)
//
// A pure builder: it gets plain values and returns a DOM element, with no
// backend calls, so it is easy to test. payment.js fetches the data, puts the
// result in #receipt and calls window.print(); receipt.css makes the printed
// page show only the receipt.
//
// Everything that comes from the database is set with textContent, never innerHTML.

export const SHOP_NAME = 'Coffee POS'; // change this to the shop's real name

const money = (amount) => `$${Number(amount).toFixed(2)}`;

function row(label, value, className = '') {
  const line = document.createElement('div');
  line.className = `receipt-row ${className}`.trim();
  const left = document.createElement('span');
  left.textContent = label;
  const right = document.createElement('span');
  right.textContent = value;
  line.append(left, right);
  return line;
}

function rule() {
  const hr = document.createElement('hr');
  hr.className = 'receipt-rule';
  return hr;
}

function text(tag, className, content) {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = content;
  return el;
}

/**
 * @param {object} receipt
 * @param {string} receipt.orderId
 * @param {string} receipt.paidAt        ISO timestamp
 * @param {{ quantity: number, name: string, customization?: string|null, lineTotal: number }[]} receipt.items
 * @param {number} receipt.subtotal
 * @param {number} receipt.tax
 * @param {number} receipt.total
 * @param {string} receipt.paymentMethod  'Cash' | 'Card'
 * @param {number|null} [receipt.cashReceived]
 * @param {number|null} [receipt.changeDue]
 */
export function buildReceipt(receipt) {
  const paper = document.createElement('div');
  paper.className = 'receipt-paper';

  const paidAt = new Date(receipt.paidAt);
  paper.append(
    text('p', 'receipt-title', SHOP_NAME),
    text('p', 'receipt-meta', Number.isNaN(paidAt.getTime())
      ? ''
      : paidAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })),
    text('p', 'receipt-meta', `Order #${String(receipt.orderId).slice(0, 8)}`),
    rule(),
  );

  for (const item of receipt.items) {
    paper.appendChild(row(`${item.quantity} × ${item.name}`, money(item.lineTotal)));
    if (item.customization) paper.appendChild(text('p', 'receipt-note', item.customization));
  }

  paper.append(
    rule(),
    row('Subtotal', money(receipt.subtotal)),
    row('Tax', money(receipt.tax)),
    row('Total', money(receipt.total), 'receipt-total'),
    rule(),
    row('Paid by', receipt.paymentMethod),
  );
  if (receipt.paymentMethod === 'Cash' && receipt.cashReceived != null) {
    paper.append(
      row('Cash received', money(receipt.cashReceived)),
      row('Change', money(receipt.changeDue ?? 0)),
    );
  }
  paper.appendChild(text('p', 'receipt-thanks', 'Thank you!'));
  return paper;
}
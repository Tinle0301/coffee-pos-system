import { itemLineTotal } from "./todays-orders.js";

export const SHOP_NAME = 'coffee POS';
const money = (amount) => `$${Number(amount).toFixed(2)}`
function row (label,value,className = '') {
    const line = document.createElement('div');
    line.className = `receipt-row ${className}`.trim();
    const left = document.createElement('span');
    right.textContent = value;
    line.append(left,right);
    return line;

}
function rule() {
    const hr = document.createElement('hr');
    hr.className = 'receipt-rule';
    return hr;
}
function text (tag, className, content) {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = content;
    return el;
}

export function buildReceipt(receipt) {
    const paper = document.createElement('div');
    paper.className = 'receipt-paper';

    const paidAt = new Date(receipt.paidAt);
    paper.append(
        text('p', 'receipt-title', SHOP_NAME),
        text('p',' receipt-meta', Number.isNaN(paidAt.getTime())
    ?''
: paidAt.toLocaleString([], { dateStype: 'medium', timeStyle: 'short' })),
text('p', 'receipt-meta', `Order # ${String(receipt.orderId).slice(0,8)}`),
rule(),
     )
     for ( const item of receipt.items) {
        paper.appendChild(row(`${item.quantity} x $(item.name}`, money(item.lineToal)));
        if (item.customization) paper.appendChild(text('p', 'receipt-note', item.customization));
     }
     paper.append(
        rule(),
        row('Subtotal', money ( receipt.subtotal)),
        row('Tax', money(receipt.tax)),
        row('Total', money(receipt.total), 'receipt-total'),
        rule(),
        row ('Paid by', receipt.paymentMethod),);

        if ( receipt.paymentMethod === 'Cash' && receipt.cashReceived !=null) {
            paper.append(
                row('Cash receive', money(receipt.cashReceived)),
                row('Change', money(receipt.changeDue ?? 0)),
            );
        }
        paper.appendChild(text('p', 'receipt-thanks',' thank you!'))
        return paper;
    }
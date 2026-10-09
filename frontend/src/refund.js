// refund.js — Admin: refund a completed payment in full or in part.
// Flow: look up the payment → choose Full / Partial (+ amount) → review → confirm.
import { lookUpPayment, submitRefund } from './refund-api.js';

function round2(amount) {
  return Math.round(amount * 100) / 100;
}

function formatPrice(amount) {
  return `$${amount.toFixed(2)}`;
}

// Only a payment that actually went through can be refunded.
export function isRefundable(payment) {
  return /^complete/i.test(String(payment?.paymentCompletionStatus || ''));
}

// "12", "12.5", "12.50" — never negative, never more than 2 decimals.
export function parseAmount(text) {
  const trimmed = String(text ?? '').trim().replace(/^\$/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return round2(Number(trimmed));
}

export const refundScreen = {
  render() {
    return `
      <div class="screen-container refund-card">
        <h2>Refund a Payment</h2>

        <form id="refund-lookup-form" class="refund-row" novalidate>
          <label for="refund-payment-id">Payment ID</label>
          <input id="refund-payment-id" type="text" autocomplete="off" spellcheck="false" />
          <button type="submit" id="refund-lookup-btn">Look up</button>
        </form>
        <p id="refund-lookup-msg" class="refund-msg" role="alert"></p>

        <div id="refund-details" hidden>
          <dl class="refund-summary">
            <div><dt>Method</dt><dd id="refund-method"></dd></div>
            <div><dt>Amount paid</dt><dd id="refund-paid"></dd></div>
            <div><dt>Status</dt><dd id="refund-status"></dd></div>
            <div><dt>Date</dt><dd id="refund-date"></dd></div>
          </dl>

          <fieldset class="modal-field">
            <legend>Refund type</legend>
            <div class="option-row">
              <label class="option-pill"><input type="radio" name="refund-type" value="Full" checked /> <span>Full refund</span></label>
              <label class="option-pill"><input type="radio" name="refund-type" value="Partial" /> <span>Partial refund</span></label>
            </div>
          </fieldset>

          <div id="refund-amount-row" class="refund-row" hidden>
            <label for="refund-amount">Refund amount ($)</label>
            <input id="refund-amount" type="text" inputmode="decimal" autocomplete="off" />
          </div>
          <p id="refund-form-msg" class="refund-msg" role="alert"></p>

          <button type="button" id="refund-review-btn">Review refund</button>

          <div id="refund-confirm" class="refund-confirm" hidden>
            <p id="refund-confirm-text"></p>
            <div class="modal-actions">
              <button type="button" id="refund-confirm-back" class="btn-ghost">Back</button>
              <button type="button" id="refund-confirm-go" class="btn-danger">Confirm refund</button>
            </div>
          </div>
        </div>

        <p id="refund-result" class="refund-msg" role="status"></p>
        <button type="button" id="refund-back" class="btn-ghost">Back to orders</button>
      </div>
    `;
  },

  init(navigate) {
    const $ = (id) => document.getElementById(id);
    const lookupForm = $('refund-lookup-form');
    const lookupBtn = $('refund-lookup-btn');
    const lookupMsg = $('refund-lookup-msg');
    const details = $('refund-details');
    const amountRow = $('refund-amount-row');
    const amountInput = $('refund-amount');
    const formMsg = $('refund-form-msg');
    const reviewBtn = $('refund-review-btn');
    const confirmBox = $('refund-confirm');
    const confirmText = $('refund-confirm-text');
    const confirmGo = $('refund-confirm-go');
    const result = $('refund-result');

    let payment = null;
    let pending = null; // { type, amount } awaiting confirmation

    const selectedType = () => document.querySelector('input[name="refund-type"]:checked').value;

    function resetFlow() {
      confirmBox.hidden = true;
      reviewBtn.hidden = false;
      pending = null;
      formMsg.textContent = '';
    }

    $('refund-back').addEventListener('click', () => navigate('new-order'));

    document.querySelectorAll('input[name="refund-type"]').forEach((el) => {
      el.addEventListener('change', () => {
        amountRow.hidden = selectedType() !== 'Partial';
        resetFlow();
      });
    });

    lookupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (lookupBtn.disabled) return;
      lookupMsg.textContent = '';
      result.textContent = '';
      details.hidden = true;
      payment = null;

      const id = $('refund-payment-id').value.trim();
      if (!id) {
        lookupMsg.textContent = 'Enter a payment ID.';
        return;
      }

      lookupBtn.disabled = true;
      const { data, error } = await lookUpPayment(id);
      lookupBtn.disabled = false;

      if (error || !data) {
        lookupMsg.textContent = error?.message || 'Could not look up that payment.';
        return;
      }
      if (!isRefundable(data)) {
        lookupMsg.textContent = `This payment can't be refunded — its status is "${data.paymentCompletionStatus}".`;
        return;
      }

      payment = data;
      $('refund-method').textContent = data.paymentMethodType;
      $('refund-paid').textContent = formatPrice(data.paymentAmountValue);
      $('refund-status').textContent = data.paymentCompletionStatus;
      $('refund-date').textContent = data.paymentProcessingTimestamp
        ? new Date(data.paymentProcessingTimestamp).toLocaleString()
        : '';
      document.querySelector('input[name="refund-type"][value="Full"]').checked = true;
      amountRow.hidden = true;
      amountInput.value = '';
      resetFlow();
      details.hidden = false;
    });

    reviewBtn.addEventListener('click', () => {
      formMsg.textContent = '';
      let amount;
      if (selectedType() === 'Full') {
        amount = payment.paymentAmountValue;
      } else {
        amount = parseAmount(amountInput.value);
        if (amount === null || amount <= 0) {
          formMsg.textContent = 'Enter a refund amount greater than $0.00 (for example 2.50).';
          return;
        }
        if (amount > payment.paymentAmountValue) {
          formMsg.textContent = `The refund can't be more than the ${formatPrice(payment.paymentAmountValue)} paid.`;
          return;
        }
      }
      // A "partial" for the whole amount is a full refund.
      const type = amount === payment.paymentAmountValue ? 'Full' : 'Partial';
      pending = { type, amount };
      confirmText.textContent = `Refund ${formatPrice(amount)} of ${formatPrice(payment.paymentAmountValue)} (${type.toLowerCase()}) to ${payment.paymentMethodType}? This can't be undone.`;
      confirmBox.hidden = false;
      reviewBtn.hidden = true;
    });

    $('refund-confirm-back').addEventListener('click', resetFlow);

    confirmGo.addEventListener('click', async () => {
      if (confirmGo.disabled || !pending) return; // double-tap protection
      confirmGo.disabled = true;
      confirmGo.textContent = 'Processing...';

      const { type, amount } = pending;
      const { data, error } = await submitRefund(payment.paymentTransactionIdentifier, type, amount);

      confirmGo.disabled = false;
      confirmGo.textContent = 'Confirm refund';

      if (error) {
        // No automatic retry — a second call after a slow failure could refund twice.
        result.textContent = error.message || 'The refund could not be processed.';
        return;
      }
      details.hidden = true;
      payment = null;
      pending = null;
      $('refund-payment-id').value = '';
      result.textContent = `Refunded ${formatPrice(amount)} (${type.toLowerCase()}). Refund ID: ${data.refundTransactionIdentifier}`;
    });
  },
};

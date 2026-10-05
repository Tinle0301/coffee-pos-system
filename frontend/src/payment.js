import {processPayment} from './backend/services/payments.js';

export const PAYMENT_METHODS = [
    { id: 'Cash', label:'Cash'},
    { id: 'credit-card', label:'credit-card'},
];
// Converts a monetary amount to cents
function ToCents(amount) {
    return Math.round(amount * 100); }

function formatCents(cents) {
    return (cents / 100).toFixed(2);
}

export function chargeDueCents(totalCents, receivedCents) {
    return Math.max(0, receivedCents - totalCents);
}

export function normalizePaymentResult(result) {
    if (result === undefined || result === null) {
        return { data: null, error: {code:'PAYMENT_UNAVAILABLE', message:'Payment service is not unavailable yet.'} };
    }
    if(typeof result == 'object' && ('data' in result || 'error' in result)) {
        return {data: result.data ?? null, error: result.error ?? null };
    }
    return {data: result, error: null};
}

export const paymentScreens = {
    render(state) { // Render the payment screen based on the current state
        const order = state?.lastOrder; // Retrieve the last order from the state.
        if (!order) {
            return `
                <div class="screen_container">
                    <h2>Payment</h2>
                    <p class="order-empty"> There is no active order.</p>
                    <button type="button" id="payment-new-order-btn">Start New Order</button>
                </div>
            `;
        }

        return `
              <div class="screen-container payment-card">
                <h2>Payment</h2>
                <p class="order-number">Order #<span id="payment-order-number"></span></p>
        
                <div class="order-totals">
                  <div class="order-totals-row"><span>Subtotal</span><span id="payment-subtotal"></span></div>
                  <div class="order-totals-row"><span>Tax</span><span id="payment-tax"></span></div>
                  <div class="order-totals-row total" style="font-size:1.6rem">
                    <span>Total due</span><span id="payment-total"></span>
                  </div>
                </div>
        
                <fieldset class="modal-field" id="payment-methods">
                  <legend>Payment method</legend>
                  <div class="option-row">
                    ${PAYMENT_METHODS.map((m) => `
                      <label class="option-pill" style="min-height:56px;font-size:1.1rem;padding:0 24px">
                        <input type="radio" name="payment-method" value="${m.id}" />
                        <span>${m.label}</span>
                      </label>`).join('')}
                  </div>
                </fieldset>
        
                <div id="cash-section" hidden>
                  <label class="field-label" for="cash-received">Amount received</label>
                  <input id="cash-received" type="number" inputmode="decimal" min="0" step="0.01"
                    style="width:100%;min-height:56px;font-size:1.4rem;padding:0 14px;border-radius:8px;border:1px solid var(--disabled-color)" />
                  <div class="order-totals-row total" style="margin-top:12px">
                    <span>Change due</span><span id="change-due">$0.00</span>
                  </div>
                </div>
        
                <p id="payment-status" role="status"></p>
                <button type="button" id="complete-sale-btn" disabled>Complete sale</button>
              </div>
            `;
          },
          
          init (navigate, currentOrder, staffId, appState) {
            const order = appState?.lastOrder;
             // if there is no active order to process, add event listener for new order button
            if (!order) {
                document.getElementById('payment-new-order-btn').addEventListener('click', () => navigate ('new-order'));
                return;
            }
            
            const orderId = order.orderIdentifier;
            const totalCents = toCents(order.orderTotalAmount);

            //  value come from the database-set with textContent, never innerHTML
            document.getElementById('payment-order-number').textContent = orderId;
            document.getElementById('payment-subtotal').textContent = formatCents(order.orderSubtotalAmount);
            document.getElementById('payment-tax').textContent = formatCents(order.orderTaxAmount);
            document.getElementById('payment-total').textContent = formatCents(totalCents);

            //  initialize payment method options
            const methodsBox = document.getElementById('payment-methods');
            const cashSection = document.getElementById('cash-section');
            const cashInput = document.getElementById('cash-received');
            const changeDueEl = document.getElementById('change-due');
            const status = document.getElementById('payment-status');
            const completeBtn = document.getElementById('complete-sale-btn');

            let completeted = false;
            let processing = false;
            
            const selectedMethod = () => methodBox.querySelector('input[name="payment-method"]:checked')?.value ?? null;
            const receivedCents = () => (cashInput.value === '' ? 0 : toCents(cashInput.value));

            function refresh() {
                if (completed || processing) return;
                const method = selectedMethod();
                cashSection.hidden = method !== 'Cash';

                if (method === 'Cash') {
                    const received = receivedCents();
                    changeDueEl.textContent = formatCents(changeDueCents(totalCents, received));
                    completeBtn.disabled = received < totalCents;
                } else {
                    completeBtn.disabled = method === null;
                }
            }
            
            methodsBox.addEventListener('change', () => {
                refresh();
                if (selectedMethod() === 'Cash') cashInput.focus();
            });
            cashInput.addEventListener('input', refresh);

            completeBtn.addEventListener('click', async () => {
                if (completed) {
                    navigate('new-order');
                    return;
                }
                if (processing || completed) return;
    
                const method = selectedMethod();
                processing = true;
                completeBtn.disabled = true;
                completeBtn.textContent = 'Processing...';
                status.className = '';
                status.textContent = '';

                let result;
                try {
                    result = normalizePaymentResult(await processPayment(orderId, method, totalCents / 100));
                }
                catch {
                    result = { data: null, error: { code: 'NETWORK', message: 'Could not reach the server, try again. '}};
                }
                processing = false;

                if (result.error) {
                    status.className = 'error';
                    status.textContent = result.error.message;
                    compeleteBtn.textContent = 'Complete sale';
                    refresh();
                    return;
                }

                completed = true;
                const change = method === 'Cash' ? changeDueCents(totalCents, receivedCents()) :0;
                status.className = 'success';
                status.textContent = method === 'cash'
                    ?`Sale complete. Give${formatCents(change)} change.`
                    :`Sale complete.`;

                currentOrder.splice(0);
                appState.lastOrder = null;

                methodsBox.querySelectorAll('input').forEach((input) => { input.disabled = true; });
                cashInput.disabled = true;
                completeBtn.disabled = false;
                completeBtn.textContent = 'Start new order';
            });

            refresh();
        },
    };


            





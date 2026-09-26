//import { CreateNewOrder } from './orders.stub.js';
import {CreateNewOrder} from '../../backend/services/orders.js';

export const confirmScreen = {
  render() {
    return `
      <div class="screen-container">
        <h2>Confirm POS Transaction</h2>
        <button id="confirm-order-btn">Submit Order to Kitchen</button>
        <div id="order-status-msg"></div>
      </div>
    `;
  },
  init(navigate, currentOrder, staffId) {
    const confirmBtn = document.getElementById('confirm-order-btn');
    
    confirmBtn.addEventListener('click', async () => {
      // Rule Protection: Guard against double-tap network requests
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Processing...';

      const structuredItems = this.preparePayload(currentOrder);
      const {data:order,error} = await CreateNewOrder(structuredItems, staffId);

      if (error) {
        // No automatic retry: a second call after a slow failure can put
        // the same order in the kitchen twice.
        document.getElementById('order-status-msg').textContent  = error.message;
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Submit Order to Kitchen';
        return;
      }
      // Backticks + ${...} so the real number is shown, not the text.
      // Works whether orders.js returns { orderIdentifier } or the id itself.
      const orderNumber = order?.orderIdentifier ?? order;
      document.getElementById('order-status-msg').textContent = `Success! Order #${orderNumber}`;
      confirmBtn.textContent = 'Order sent';
      
    });
  },
  preparePayload(orderLines) {
    return orderLines.map(line => ({
      menuItemIdentifier: line.menuItem.menu_item_identifier,
      quantity: line.quantity,
      customization: this.describeCustomization(line.customization)
    }));
  },
  describeCustomization(customization) {
    if (!customization) return 'None';
    if (typeof customization === 'string') return customization;

    const parts = [];
    if (customization.size) parts.push(customization.size);
    if (customization.milk && customization.milk !== 'none') parts.push(`${customization.milk} milk`);
    if (Array.isArray(customization.addons) && customization.addons.length) {
      parts.push(...customization.addons);
    }
    return parts.length ? parts.join(', ') : 'None';
  }
};

import { describe, it, expect } from 'vitest';
import { confirmScreen } from './confirm.js';

describe('Story #12: Confirm Order API Payload Wrapper', () => {
  it('should map local app order structures to the real orders.js contract (camelCase, no price)', () => {
    const mockCurrentOrder = [
      {
        menuItem: { menu_item_identifier: 'latte-abc' },
        quantity: 2,
        customization: 'Oat Milk, Extra Shot',
        lineTotal: 5.50
      }
    ];

    const resultPayload = confirmScreen.preparePayload(mockCurrentOrder);

    expect(resultPayload[0]).toEqual({
      menuItemIdentifier: 'latte-abc',
      quantity: 2,
      customization: 'Oat Milk, Extra Shot'
    });
  });
});


import { describe, it, expect,vi } from 'vitest';
import { confirmScreen } from './confirm.js';

// added vi.mock() for the backend import (Node can't load the CDN-based supabase-client.js chain)
vi.mock('../../backend/services/orders.js', () => ({ CreateNewOrder: vi.fn() }));

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


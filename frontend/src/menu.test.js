import {describe,it,expect, vi} from 'vitest';
import {menuScreen} from './menu.js';

vi.mock('../../backend/services/menu.js', () => ({listMenuItems: vi.fn()}));

describe('Story #11: Browse Menu by Category', () => {

  const mockItems = [
    { menu_item_identifier: '1', menu_item_name: 'Latte', menu_item_category_type: 'Espresso', menu_item_price_amount: 4.50, menu_item_availability_status: true },
    { menu_item_identifier: '2', menu_item_name: 'Cold Brew', menu_item_category_type: 'Brewed', menu_item_price_amount: 3.75, menu_item_availability_status: false }
  ];

  it('should correctly group raw menu array items by their category type', () => {
    const grouped = menuScreen.groupByCategory(mockItems);
    
    expect(grouped).toHaveProperty('Espresso');
    expect(grouped).toHaveProperty('Brewed');
    expect(grouped['Espresso']).toHaveLength(1);
    expect(grouped['Espresso'][0].menuItemName).toBe('Latte');
  });

  it('should render HTML with a disabled state flag when an item is unavailable', () => {
    const categorized = menuScreen.groupByCategory(mockItems);
    const htmlOutput = menuScreen.generateMenuHTML(categorized);

    expect(htmlOutput).toContain('disabled class="item-disabled"');
    expect(htmlOutput).toContain('(Unavailable)');
  });
});

import {describe,it,expect, vi} from 'vitest';
import {menuScreen} from './menu.js';

vi.mock('../../backend/services/menu.js', () => ({
  listMenuItems: vi.fn()
}));

describe('Story #11: Browse Menu by Category', () => {
  // camelCase — matches the real backend/services/menu.js contract
  // (its toMenuItem() maps snake_case DB columns to camelCase before
  // returning), not the raw DB column names.
  const mockItems = [
    { menuItemIdentifier: '1', menuItemName: 'python3 -m http.server 8000 ', menuItemCategoryType: 'Espresso', menuItemPriceAmount: 4.50, menuItemAvailabilityStatus: true },
    { menuItemIdentifier: '2', menuItemName: 'Cold Brew', menuItemCategoryType: 'Brewed', menuItemPriceAmount: 3.75, menuItemAvailabilityStatus: false }
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

// js/menustub.js
// TEMPORARY — delete once backend/services/menu.js is merged.
// Swap the import in neworder.js from this file to the real backend module
// when that lands. Shape must match ../docs/API_CONTRACT.md.

const MENU_ITEMS = [
  { menu_item_identifier: '1', menu_item_name: 'Latte', menu_item_category_type: 'Espresso', menu_item_price_amount: 4.00, menu_item_availability_status: true },
  { menu_item_identifier: '2', menu_item_name: 'Cappuccino', menu_item_category_type: 'Espresso', menu_item_price_amount: 4.00, menu_item_availability_status: true },
  { menu_item_identifier: '3', menu_item_name: 'Cortado', menu_item_category_type: 'Espresso', menu_item_price_amount: 4.00, menu_item_availability_status: false },
  { menu_item_identifier: '4', menu_item_name: 'Americano', menu_item_category_type: 'Espresso', menu_item_price_amount: 3.50, menu_item_availability_status: true },
  { menu_item_identifier: '5', menu_item_name: 'Chai Latte', menu_item_category_type: 'Tea', menu_item_price_amount: 4.25, menu_item_availability_status: true },
  { menu_item_identifier: '6', menu_item_name: 'Matcha Latte', menu_item_category_type: 'Tea', menu_item_price_amount: 4.75, menu_item_availability_status: true },
  { menu_item_identifier: '7', menu_item_name: 'Croissant', menu_item_category_type: 'Bakery', menu_item_price_amount: 3.25, menu_item_availability_status: true },
  { menu_item_identifier: '8', menu_item_name: 'Blueberry Muffin', menu_item_category_type: 'Bakery', menu_item_price_amount: 3.00, menu_item_availability_status: false },
];

/**
 * @returns {Promise<{ data: Array, error: { message: string } | null }>}
 */
export async function listMenuItems() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { data: MENU_ITEMS, error: null };
}
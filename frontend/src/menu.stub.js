// frontend/services/menu.stub.js — DELETE once backend/services/menu.js
// (real Supabase-backed module, per docs/API_CONTRACT.md) lands.
// Swap the import in menu.js to '../../backend/services/menu.js' at that point.

export async function listMenuItems() {
  return {
    data: [
      { menu_item_identifier: '1', menu_item_name: 'Latte', menu_item_category_type: 'Espresso', menu_item_price_amount: 4.50, menu_item_availability_status: true },
      { menu_item_identifier: '2', menu_item_name: 'Cold Brew', menu_item_category_type: 'Brewed', menu_item_price_amount: 3.75, menu_item_availability_status: false },
      { menu_item_identifier: '3', menu_item_name: 'Cortado', menu_item_category_type: 'Espresso', menu_item_price_amount: 4.00, menu_item_availability_status: false },
      { menu_item_identifier: '4', menu_item_name: 'Americano', menu_item_category_type: 'Espresso', menu_item_price_amount: 3.50, menu_item_availability_status: true },
      { menu_item_identifier: '5', menu_item_name: 'Chai Latte', menu_item_category_type: 'Tea', menu_item_price_amount: 4.25, menu_item_availability_status: true },
      { menu_item_identifier: '6', menu_item_name: 'Matcha Latte', menu_item_category_type: 'Tea', menu_item_price_amount: 4.75, menu_item_availability_status: true },
      { menu_item_identifier: '7', menu_item_name: 'Croissant', menu_item_category_type: 'Bakery', menu_item_price_amount: 3.25, menu_item_availability_status: true },
      { menu_item_identifier: '8', menu_item_name: 'Blueberry Muffin', menu_item_category_type: 'Bakery', menu_item_price_amount: 3.00, menu_item_availability_status: false },
    ],
    error: null
  };
}

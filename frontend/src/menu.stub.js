// frontend/services/menu.stub.js — DELETE once backend/services/menu.js
// (real Supabase-backed module, per docs/API_CONTRACT.md) lands.
// Swap the import in menu.js to '../../backend/services/menu.js' at that point.

export async function listMenuItems() {
  return {
    data: [
      { menu_item_identifier: '1', menu_item_name: 'Latte', menu_item_category_type: 'Espresso', menu_item_price_amount: 4.50, menu_item_availability_status: true },
      { menu_item_identifier: '2', menu_item_name: 'Cold Brew', menu_item_category_type: 'Brewed', menu_item_price_amount: 3.75, menu_item_availability_status: false }
    ],
    error: null
  };
}

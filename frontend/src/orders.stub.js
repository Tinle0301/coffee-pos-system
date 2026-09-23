// frontend/services/orders.stub.js — DELETE once backend/services/orders.js
// is actually implemented

export async function CreateNewOrder(items, staffId) {
  console.warn('CreateNewOrder: backend not implemented yet — returning a fake order.');
  return {
    orderIdentifier: `LOCAL-${Date.now()}`,
    items,
    staffId,
    status: 'Pending'
  };
}

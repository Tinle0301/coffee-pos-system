// stock-level.js — the one definition of "low" and "out of stock", shared by
// the Inventory screen and the Admin Home inventory tile so they always agree.
// "Low" matches the backend's POS-57 rule: quantity at or below the item's
// minimum stock threshold (an item with none left is "out", the worst kind of low).
// Pure functions only — no backend imports — so any screen can use them.

export const STOCK_LEVELS = {
  out: { label: 'Out of stock', rank: 0 },
  low: { label: 'Low stock', rank: 1 },
  ok: { label: 'In stock', rank: 2 },
};

// out: nothing left; low: at or below the threshold; ok: above it.
export function stockLevel(item) {
  const qty = Number(item.availableQuantityValue);
  const min = Number(item.minimumStockThreshold);
  if (qty <= 0) return 'out';
  if (qty <= min) return 'low';
  return 'ok';
}

// Worst first, then by name.
export function sortBySeverity(items) {
  return [...items].sort((a, b) =>
    STOCK_LEVELS[stockLevel(a)].rank - STOCK_LEVELS[stockLevel(b)].rank
    || String(a.inventoryItemName).localeCompare(String(b.inventoryItemName)));
}

export function countByLevel(items) {
  const counts = { out: 0, low: 0, ok: 0 };
  items.forEach((i) => { counts[stockLevel(i)] += 1; });
  return counts;
}

/**
 * TEMPORARY placeholder occupying real path (confirm.js imports it
 * directly, and the acceptance criteria for Story #12 need a real DB row).
 * when the real Supabase orders module lands, overwrite this
 * file's contents in place — don't create a second file — to avoid a path
 * collision.
 */
export async function createOrder(items, staffId) { 
  console.warn('createOrder: backend not implemented yet — returning a fake success.');
  return { data: `LOCAL-${Date.now()}`, error: null };
}

/**
 * TEMPORARY placeholder occupying real path (logout.test.js mocks
 * this exact import, so it can't live in frontend stub space like menu's).
 * when real Supabase auth module lands, overwrite this file's
 * contents in place — don't create a second file — to avoid a path collision.
 */

export async function signOut() {
  console.warn('signOut: backend not implemented yet.');
  return null;
}

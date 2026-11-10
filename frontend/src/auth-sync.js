// auth-sync.js — POS-60
//
// Keeps every open tab on the same login.
//
// All tabs share one Supabase session (it lives in localStorage). If someone
// logs in as a different staff member, or logs out, in another tab, this tab
// still shows the old person. Its next order then fails with
// "staff_id must match the authenticated caller".
//
// startAuthSync watches for that and calls onUserChanged when the signed-in
// staff member is no longer the one this tab is showing. main.js then
// reloads the page, so the tab shows the new person (or the Login screen).
//
// It checks:
//   - when another tab writes the Supabase session to localStorage
//     (the browser's "storage" event only fires in the OTHER tabs)
//   - when this tab comes back into view or gets focus, in case an event
//     was missed (laptop asleep, tab frozen in the background)

import { session } from './backend/auth.js';

// Supabase stores the session under "sb-<project ref>-auth-token".
const SUPABASE_AUTH_KEY = /^sb-.*-auth-token$/;

// A session lookup that failed for these reasons means "nobody valid is
// signed in". Any other error (e.g. a network blip) is ignored, so a bad
// connection never kicks a barista out mid-order.
const SIGNED_OUT_CODES = new Set(['NO_STAFF_ACCOUNT', 'ACCOUNT_DEACTIVATED']);

/**
 * @param {{
 *   getCurrentStaffId: () => string | null,
 *   onUserChanged: (staff: object | null) => void,
 *   getSession?: typeof session,
 *   win?: Window,
 *   doc?: Document,
 * }} options
 * @returns {{ check: () => Promise<void>, stop: () => void }}
 */
export function startAuthSync({
  getCurrentStaffId,
  onUserChanged,
  getSession = session,
  win = window,
  doc = document,
}) {
  let checking = false;
  let checkAgain = false;
  let stopped = false;

  async function check() {
    if (stopped) return;
    if (checking) {
      checkAgain = true;
      return;
    }
    checking = true;
    try {
      const { data, error } = await getSession();
      if (stopped) return;
      if (error && !SIGNED_OUT_CODES.has(error.code)) return;

      const signedInId = data?.staffAccountIdentifier ?? null;
      const shownId = getCurrentStaffId() ?? null;
      if (signedInId !== shownId) {
        stopped = true; // the page is about to reload; don't fire twice
        onUserChanged(data ?? null);
      }
    } finally {
      checking = false;
      if (checkAgain && !stopped) {
        checkAgain = false;
        check();
      }
    }
  }

  function onStorage(event) {
    // event.key is null when another tab clears all of localStorage.
    if (event.key === null || SUPABASE_AUTH_KEY.test(event.key)) check();
  }

  function onVisible() {
    if (doc.visibilityState === 'visible') check();
  }

  win.addEventListener('storage', onStorage);
  win.addEventListener('focus', check);
  doc.addEventListener('visibilitychange', onVisible);

  return {
    check,
    stop() {
      stopped = true;
      win.removeEventListener('storage', onStorage);
      win.removeEventListener('focus', check);
      doc.removeEventListener('visibilitychange', onVisible);
    },
  };
}

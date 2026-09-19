// sessionTimeout.js — POS-6 Session Timeout
//
// "As a Barista, I want to be logged out automatically after 10 minutes of
//  inactivity so that an unattended terminal cannot be misused."
//
// The register sits on a counter in a public room. A barista walks away to
// make a drink and the next person to touch the screen can create orders,
// and — if an admin is signed in — change prices. Ten minutes is the limit
// from the 491A SRS (docs/REQUIREMENTS.md).
//
// Usage (frontend, after a successful login and on every page load with a
// live session):
//
//   import { startSessionTimeout } from '../../backend/services/sessionTimeout.js'
//
//   startSessionTimeout({
//     onWarning: secondsLeft => showBanner(`Signing out in ${secondsLeft}s`),
//     onTimeout: () => { location.replace('/index.html') },
//   })

import { logout } from './auth.js';

/** 10 minutes, from the SRS. */
const IDLE_LIMIT_MS = 10 * 60 * 1000;

/** Warn the barista 60 seconds before signing them out. */
const WARNING_MS = 60 * 1000;

/**
 * How often we compare "now" against the last activity.
 *
 * Deliberately a polling check rather than one long setTimeout: a laptop
 * lid closing, or a background tab being throttled, makes a 10-minute timer
 * fire late or not at all. Comparing timestamps is immune to that — if the
 * machine was asleep for an hour, the very next tick sees the gap and signs
 * out, which is exactly what the requirement is asking for.
 */
const TICK_MS = 5 * 1000;

/** Shared across tabs, so working in one tab doesn't time out another. */
const STORAGE_KEY = 'pos.lastActivity';

/** Events that count as "the barista is still here". */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'focus'];

let tickHandle = null;
let lastActivity = 0;
let warned = false;
let handlers = {};

/**
 * Start watching for inactivity. Safe to call more than once — a second
 * call restarts the timer rather than stacking a second one, which is what
 * you want when a screen re-renders.
 *
 * @param {object} [options]
 * @param {(secondsLeft: number) => void} [options.onWarning]  called once, 60s before sign-out
 * @param {() => void} [options.onTimeout]  called after the session has been ended
 * @param {number} [options.idleLimitMs]  override the 10 minutes (tests only)
 * @returns {() => void} stop function
 */
export function startSessionTimeout(options = {}) {
  stopSessionTimeout();

  handlers = {
    onWarning: options.onWarning ?? (() => {}),
    onTimeout: options.onTimeout ?? (() => {}),
    idleLimitMs: options.idleLimitMs ?? IDLE_LIMIT_MS,
  };

  recordActivity();

  for (const evt of ACTIVITY_EVENTS) {
    window.addEventListener(evt, recordActivity, { passive: true });
  }
  window.addEventListener('storage', syncFromOtherTab);

  tickHandle = setInterval(check, TICK_MS);

  return stopSessionTimeout;
}

/**
 * Stop watching. Call on logout so the timer doesn't keep running against
 * a session that is already gone.
 */
export function stopSessionTimeout() {
  if (tickHandle !== null) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
  for (const evt of ACTIVITY_EVENTS) {
    window.removeEventListener(evt, recordActivity);
  }
  window.removeEventListener('storage', syncFromOtherTab);
  warned = false;
}

/**
 * Milliseconds of inactivity so far. Exposed for tests and for a screen
 * that wants to show a countdown.
 * @returns {number}
 */
export function idleTime() {
  return Date.now() - lastActivity;
}

// ── internals ──────────────────────────────────────────────────────────

function recordActivity() {
  lastActivity = Date.now();
  warned = false;
  try {
    localStorage.setItem(STORAGE_KEY, String(lastActivity));
  } catch {
    // Private browsing or blocked storage: the timer still works, it just
    // stops being shared between tabs. Not worth failing over.
  }
}

function syncFromOtherTab(event) {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  const stamp = Number(event.newValue);
  if (Number.isFinite(stamp) && stamp > lastActivity) {
    lastActivity = stamp;
    warned = false;
  }
}

async function check() {
  const idle = idleTime();
  const limit = handlers.idleLimitMs;

  if (idle >= limit) {
    // Stop first: signing out triggers an auth state change, and a timer
    // still running against a dead session fires again on the login screen.
    stopSessionTimeout();
    await logout();
    handlers.onTimeout();
    return;
  }

  if (!warned && idle >= limit - WARNING_MS) {
    warned = true;
    handlers.onWarning(Math.ceil((limit - idle) / 1000));
  }
}

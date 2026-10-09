// sessionTimeout.js — POS-6 Session Timeout
//
// "As a Barista, I want to be logged out automatically after 10 minutes of
//  inactivity so that an unattended terminal cannot be misused."
//
// The register sits on a counter in a public room. A barista walks away to
// make a drink, and whoever touches the screen next is signed in as them.
// Ten minutes is the limit from the 491A SRS (docs/REQUIREMENTS.md).
//
// Usage, after login:
//
//   startSessionTimeout(() => location.replace('/index.html'))

import { logout } from './auth.js';

const IDLE_LIMIT_MS = 10 * 60 * 1000;   // 10 minutes, from the SRS
const TICK_MS = 5 * 1000;               // how often we check

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'];

let tickHandle = null;
let lastActivity = 0;
let onTimeout = () => {};

/**
 * Start watching for inactivity.
 * @param {() => void} [callback] runs after the session has been ended
 * @param {number} [idleLimitMs] override the 10 minutes (tests only)
 */
export function startSessionTimeout(callback, idleLimitMs = IDLE_LIMIT_MS) {
  stopSessionTimeout();               // never stack two timers
  onTimeout = callback ?? (() => {});
  lastActivity = Date.now();

  for (const evt of ACTIVITY_EVENTS) {
    window.addEventListener(evt, recordActivity, { passive: true });
  }

  // A poll comparing timestamps, not one long setTimeout: a closed laptop
  // lid or a throttled background tab makes a 10-minute timer fire late or
  // never — which is exactly the case this feature exists to cover.
  tickHandle = setInterval(async () => {
    if (Date.now() - lastActivity < idleLimitMs) return;
    stopSessionTimeout();             // stop before signing out, or this
    await logout();                   // ticks again on the login screen
    onTimeout();
  }, TICK_MS);
}

/** Stop watching. Call on manual logout. */
export function stopSessionTimeout() {
  clearInterval(tickHandle);
  tickHandle = null;
  for (const evt of ACTIVITY_EVENTS) {
    window.removeEventListener(evt, recordActivity);
  }
}

// Must be a named function: removeEventListener can only remove a listener
// it was given the same reference for. An inline arrow can never be removed.
function recordActivity() {
  lastActivity = Date.now();
}

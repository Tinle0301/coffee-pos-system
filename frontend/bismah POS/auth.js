// src/auth.js
//
// TEMPORARY frontend-only auth stub for local development.
//
// backend/services/auth.js defines the real contract — login, logout,
// session, resetInactivityTimeout — but its function bodies are still
// empty. This file gives the exact same function names and shapes so the
// rest of the app can be built and tested against it right now.
//
// TO SWAP IN THE REAL BACKEND once auth.js is implemented, replace every
// import of this file with:
//   import { login, logout, session, resetInactivityTimeout } from '../../backend/services/auth.js';
// and delete this file. Nothing else in the app should need to change —
// every caller only depends on these four function names and shapes.
//
// Demo accounts (stub-only, never sent to a real backend):
//   barista@demo.com / password123
//   manager@demo.com / password123

const DEMO_ACCOUNTS = [
  {
    email: 'barista@demo.com',
    password: 'password123',
    userIdentifier: '1',
    employeeName: 'Alex Rivera',
    userRoleType: 'barista',
  },
  {
    email: 'manager@demo.com',
    password: 'password123',
    userIdentifier: '2',
    employeeName: 'Jordan Lee',
    userRoleType: 'manager',
  },
];

const SESSION_KEY = 'coffeepos.session';

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * @param {string} usernameCredential
 * @param {string} password
 * @returns {Promise<{ userIdentifier: string, userRoleType: string, employeeName: string }>}
 * @throws {Error} when credentials don't match a known account
 */
export async function login(usernameCredential, password) {
  await delay(400); // lets the loading state actually be visible/testable

  const account = DEMO_ACCOUNTS.find(
    (candidate) => candidate.email === usernameCredential && candidate.password === password
  );

  if (!account) {
    // Caller (login.js) is responsible for turning this into the generic
    // "Incorrect email or password." message — never surface this raw.
    throw new Error('Invalid credentials');
  }

  const user = {
    userIdentifier: account.userIdentifier,
    userRoleType: account.userRoleType,
    employeeName: account.employeeName,
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

/**
 * @returns {Promise<void>}
 */
export async function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * @returns {Promise<{ userIdentifier: string, userRoleType: string, employeeName: string } | null>}
 */
export async function session() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Called on user activity to reset the 10-minute inactivity timer.
 * The timer itself is a separate ticket (auto-logout on inactivity) —
 * this is a no-op stub so callers can wire it up now without waiting.
 * @returns {void}
 */
export function resetInactivityTimeout() {
  // intentionally empty until the inactivity-timeout ticket implements it
}

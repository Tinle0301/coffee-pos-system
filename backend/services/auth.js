// auth.js — AuthController
// Login, logout, session handling. Session auto-times out after 10 minutes
// of inactivity (see docs/REQUIREMENTS.md).

/**
 * @param {string} usernameCredential
 * @param {string} password
 * @returns {Promise<{ userIdentifier: string, userRoleType: string }>}
 */
export async function login(usernameCredential, password) {}

/**
 * @returns {Promise<void>}
 */
export async function logout() {}

/**
 * @returns {Promise<{ userIdentifier: string, userRoleType: string } | null>}
 */
export async function session() {}

/**
 * Called on user activity to reset the 10-minute inactivity timer.
 * @returns {void}
 */
export function resetInactivityTimeout() {}

// src/logout.js
import { logout } from './auth.js';

/**
 * Builds a logout button wired to the real logout flow. Used in the app
 * shell (see main.js) so every authenticated screen has one.
 * @param {{ onLoggedOut: () => void }} options
 * @returns {HTMLButtonElement}
 */
export function logoutComponent({ onLoggedOut }) {
  const button = document.createElement('button');
  button.id = 'global-logout-btn';
  button.type = 'button';
  button.textContent = 'Log out';

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await logout();
    } catch (err) {
      // If the backend logout call fails, still clear things locally and
      // send the user back to login — staying "logged in" on this device
      // after a failed logout is the less safe failure mode.
      console.error('Logout request failed; clearing local session anyway.', err);
    } finally {
      onLoggedOut();
    }
  });

  return button;
}

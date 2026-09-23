// src/main.js
//
// The app's router/shell. This is a single-page app: one real index.html
// with an empty <div id="app">, and navigate() swaps its contents by
// screen name instead of the browser doing full page navigation.

import './style.css';
import { session } from '../../backend/services/auth.js';
import { renderLoginScreen } from './login.js';
import { logoutComponent } from './logout.js';
import { renderNewOrderScreen } from './new-order.js';
// menu.js and confirm.js are still empty placeholders owned by other
// tickets/teammates — not wired in yet. Once either exports a render
// function, add it to renderScreenContent() below.
//
// NOTE: the real auth.js has no resetInactivityTimeout export (its doc
// comment says the 10-minute timeout is handled some other way, likely
// Supabase's own session/token expiry). If POS-6 adds one later, wire it
// back in here the same way the old stub version did.

const appRoot = document.getElementById('app');

function renderScreenContent(screenName, container) {
  if (screenName === 'new-order') {
    renderNewOrderScreen(container);
    return;
  }
  container.innerHTML = '<p>Coming soon.</p>';
}

/**
 * Swaps the visible screen.
 * @param {string} screenName
 */
async function navigate(screenName) {
  appRoot.innerHTML = '';

  if (screenName === 'login') {
    renderLoginScreen(appRoot, {
      onLoginSuccess: () => navigate('new-order'),
    });
    return;
  }

  // Every screen other than login requires an authenticated session.
  // Checking this on every navigate() call is what makes it impossible to
  // reach a protected screen without logging in first — there's only one
  // page, and it always re-checks session() before showing anything.
  const { data: currentUser } = await session();
  if (!currentUser) {
    navigate('login');
    return;
  }

  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const header = document.createElement('header');
  header.className = 'app-header';

  const title = document.createElement('span');
  title.className = 'app-header-title';
  title.textContent = 'Coffee POS';

  const employeeLabel = document.createElement('span');
  employeeLabel.className = 'app-header-employee';
  employeeLabel.textContent = currentUser.staffFullName || '';

  const logoutBtn = logoutComponent({
    onLoggedOut: () => {
      // Full reload via replace(), not href: no history entry is left
      // pointing at the authenticated shell, so Back can't restore it.
      window.location.replace(window.location.pathname);
    },
  });

  header.append(title, employeeLabel, logoutBtn);

  const content = document.createElement('main');
  content.id = 'screen-content';

  shell.append(header, content);
  appRoot.appendChild(shell);

  renderScreenContent(screenName, content);
}

(async function init() {
  const { data: currentUser } = await session();
  navigate(currentUser ? 'new-order' : 'login');
})();
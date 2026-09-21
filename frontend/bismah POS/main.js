// src/main.js
//
// The app's router/shell. This is a single-page app (see
// structure_explain.md): one real index.html with an empty <div id="app">,
// and navigate() swaps its contents by screen name instead of the browser
// doing full page navigation.
//
// Screens are plain functions of the form (container, options) => void
// that render into whatever container they're given — they don't know
// about routing or auth, main.js handles both.

import './style.css';
import { session, resetInactivityTimeout } from './auth.js';
import { renderLoginScreen } from './login.js';
import { logoutComponent } from './logout.js';
import { renderNewOrderScreen } from './new-order.js';
// menu.js and confirm.js are still empty placeholders owned by other
// tickets/teammates — not wired in yet. Once either exports a render
// function, add it to renderScreenContent() below following the same
// (container) => void pattern as renderNewOrderScreen.

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
  // Checking this on every navigate() call — rather than trusting
  // whatever screen the caller asked for — is what makes it impossible
  // to reach a protected screen without logging in first: there is no
  // separate URL for /new-order to open directly, there's only this one
  // page, and it always re-checks session() before showing anything.
  const currentUser = await session();
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
  employeeLabel.textContent = currentUser.employeeName || '';

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

// Reset the inactivity timer on user interaction. The 10-minute timeout
// itself is a separate ticket (auto-logout on inactivity) — this just
// wires the hook so that ticket doesn't need to touch main.js later.
['click', 'keydown', 'touchstart'].forEach((eventName) => {
  document.addEventListener(eventName, () => resetInactivityTimeout());
});

(async function init() {
  const currentUser = await session();
  navigate(currentUser ? 'new-order' : 'login');
})();

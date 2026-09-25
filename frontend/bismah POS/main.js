// src/main.js
//
// The app's router/shell. Single-page app: one real index.html with an
// empty <div id="app">, and navigate() swaps its contents by screen name.
//
// Screens are plain functions of the form (container, options) => void
// that render into whatever container they're given.
//
// NOTE ON MERGE: this file previously had two competing implementations
// (one using this container-function pattern with a login/session guard,
// one using render()/init() screen objects with a global state object and
// no login check). This version keeps the container-function pattern
// because it's the one with a working, tested login flow — auth is a core
// requirement, not optional. menu.js and confirm.js still use the other
// pattern and aren't wired in below; reconciling them is a team decision,
// not something resolved unilaterally here.

import { session } from '../../backend/services/auth.js';
import { renderLoginScreen } from './login.js';
import { logoutComponent } from './logout.js';
import { renderNewOrderScreen } from './new-order.js';
// menu.js, confirm.js: different pattern (render()/init() objects, global
// state), not wired in here. See note above.

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
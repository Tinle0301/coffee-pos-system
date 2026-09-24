import { menuScreen } from './menu.js';
import { confirmScreen } from './confirm.js';
import { newOrderScreen } from './new-order.js';
import { logoutComponent } from './logout.js';
import { renderLoginScreen } from './login.js';
import { session } from './backend/auth.js';

// Global application memory state — staffId starts null
const state = {
  currentOrder: [
    { menuItem: { menu_item_identifier: '1', menu_item_name: 'Latte' }, quantity: 2, lineTotal: 9.00 }
  ],
  staffId: null
};

const routes = {
  'new-order': newOrderScreen,
  menu: menuScreen,
  confirm: confirmScreen
};

const appRoot = document.querySelector('#app');
let contentRoot;

// The header (title, staff name, logout) only makes sense once someone is
// actually signed in — the login screen gets a bare shell with no header.
function renderAuthenticatedShell(staffName) {
  appRoot.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <span class="app-header-title">Coffee POS</span>
        <span class="app-header-employee">${staffName || ''}</span>
        <button id="global-logout-btn">Log Out</button>
      </header>
      <main id="app-content"></main>
    </div>
  `;
  logoutComponent.bindLogoutButton('global-logout-btn');
  contentRoot = document.querySelector('#app-content');
}

function renderLoginShell() {
  appRoot.innerHTML = `<div id="app-content"></div>`;
  contentRoot = document.querySelector('#app-content');
}

export function navigate(screenName) {
  const targetScreen = routes[screenName];
  if (!targetScreen) return;

  // 1. Clear layout and inject fresh layout template string
  contentRoot.innerHTML = targetScreen.render(state);

  // 2. Hydrate action listeners & pass the specific state pieces each screen needs
  targetScreen.init(navigate, state.currentOrder, state.staffId);
}

function onLoginSuccess(user) {
  // staff_account_identifier IS the Supabase auth user id (see auth.js's
  // fetchStaffAccount comment) — this is what orders_insert_own's RLS
  // policy checks against, so this has to be the real value, not a
  // hardcoded placeholder.
  state.staffId = user.staffAccountIdentifier;
  renderAuthenticatedShell(user.staffFullName);
  navigate('new-order');
}

function showLogin() {
  renderLoginShell();
  renderLoginScreen(contentRoot, { onLoginSuccess });
}

// Boot: a barista who reloads mid-shift should stay signed in (per
// auth.js's own doc comment on session()), so check for an existing
// session before falling back to the login screen.
async function boot() {
  const { data: user } = await session();
  if (user) {
    onLoginSuccess(user);
  } else {
    showLogin();
  }
}

boot();
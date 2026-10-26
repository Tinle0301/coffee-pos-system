import { menuScreen } from './menu.js';
import { confirmScreen } from './confirm.js';
import { newOrderScreen } from './new-order.js';
import { refundScreen } from './refund.js';
import { logoutComponent } from './logout.js';
import { renderLoginScreen } from './login.js';
import { session } from './backend/auth.js';

import { paymentScreen } from './payment.js';
import { queueScreen } from './queue.js';
import { adminHomeScreen } from './admin-home.js';
import { inventoryScreen } from './inventory.js';

// Global application memory state — staffId starts null
const state = {
  currentOrder: [], // filled by the New Order screen (new-order.js)
  staffId: null,
  staffRole: null,
  staffName: null,
  lastOrder: null
};

const routes = {
  'new-order': newOrderScreen,
  menu: menuScreen,
  confirm: confirmScreen,
  refund: refundScreen,
  payment: paymentScreen,
  queue: queueScreen,
  admin: adminHomeScreen,
  inventory: inventoryScreen
};

// Screens only an Admin may open. Hiding a button isn't security (RLS is),
// but don't draw an admin screen to a barista.
const ADMIN_ONLY = new Set(['admin', 'refund', 'menu', 'inventory']);

const appRoot = document.querySelector('#app');
let contentRoot;

// The header (title, staff name, logout) only makes sense once someone is
// actually signed in — the login screen gets a bare shell with no header.
function renderAuthenticatedShell(staffName, isAdmin = false) {
  appRoot.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <span class="app-header-title">Coffee POS</span>
        <span class="app-header-employee">${staffName || ''}</span>
        ${isAdmin ? '<button id="header-admin-home-btn" class="header-nav-btn">Admin Home</button>' : ''}
        <button id="header-active-orders-btn" class="header-nav-btn">Active Orders</button>
        <button id="global-logout-btn">Log Out</button>
      </header>
      <main id="app-content"></main>
    </div>
  `;
  logoutComponent.bindLogoutButton('global-logout-btn');
  contentRoot = document.querySelector('#app-content');
  const adminHomeBtn = document.getElementById('header-admin-home-btn');
  if (adminHomeBtn) adminHomeBtn.addEventListener('click', () => navigate('admin'));
  const activeOrdersBtn = document.getElementById('header-active-orders-btn');
  if (activeOrdersBtn) {
    activeOrdersBtn.addEventListener('click', () => navigate('queue'));
  }
}

function renderLoginShell() {
  appRoot.innerHTML = `<div id="app-content"></div>`;
  contentRoot = document.querySelector('#app-content');
}

export function navigate(screenName) {
  const targetScreen = routes[screenName];
  if (!targetScreen) return;
  if (ADMIN_ONLY.has(screenName) && state.staffRole !== 'Admin') return;

  // 1. Clear layout and inject fresh layout template string
  contentRoot.innerHTML = targetScreen.render(state);

  // 2. Hydrate action listeners & pass the specific state pieces each screen needs
  targetScreen.init(navigate, state.currentOrder, state.staffId, state);
}

function onLoginSuccess(user) {
  // staff_account_identifier IS the Supabase auth user id (see auth.js's
  // fetchStaffAccount comment) — this is what orders_insert_own's RLS
  // policy checks against, so this has to be the real value, not a
  // hardcoded placeholder.
  state.staffId = user.staffAccountIdentifier;
  state.staffRole = user.staffRoleType;
  state.staffName = user.staffFullName;
  const isAdmin = user.staffRoleType === 'Admin';
  renderAuthenticatedShell(user.staffFullName, isAdmin);
  navigate(isAdmin ? 'admin' : 'new-order'); // admins land on their home screen
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

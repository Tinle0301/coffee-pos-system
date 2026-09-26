import { menuScreen } from './menu.js';
import { newOrderScreen } from './new-order.js';
import { confirmScreen } from './confirm.js';
import { logoutComponent } from './logout.js';
import { renderLoginScreen } from './login.js';
import { session } from './backend/auth.js';

// Global application memory state — staffId starts null
const state = {
  currentOrder: [], // filled by the New Order screen (new-order.js)
  staffId: null
};

const routes = {
  'new-order': newOrderScreen,
  menu: menuScreen,
  confirm: confirmScreen
};

const appRoot = document.querySelector('#app');

// The logout button lives in a persistent shell OUTSIDE the swappable screen
// content, so it survives every navigate() call instead of being wiped out
// by innerHTML replacement (and so we only ever bind its listener once).
appRoot.innerHTML = `
  <div id="app-content"></div>
  <button id="global-logout-btn">Log Out</button>
`;
logoutComponent.bindLogoutButton('global-logout-btn');

const contentRoot = document.querySelector('#app-content');

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
  navigate('new-order');
}

function showLogin() {
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

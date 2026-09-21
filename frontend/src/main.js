import './style.css';
import { menuScreen } from './screens/menu.js';
import { confirmScreen } from './screens/confirm.js';
import { logoutComponent } from './screens/logout.js';

// Global application memory state
const state = {
  currentOrder: [
    { menuItem: { menu_item_identifier: '1', menu_item_name: 'Latte' }, quantity: 2, lineTotal: 9.00 }
  ],
  staffId: 'barista-mike'
};

const routes = {
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

// Boot application
navigate('menu');

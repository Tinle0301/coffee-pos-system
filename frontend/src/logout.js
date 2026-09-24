import { logout } from './backend/auth.js';

export const logoutComponent = {
  bindLogoutButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.addEventListener('click', async () => {
      const {error} = await logout();
      if(error){
        console.warn('Logout reported an error, redirecting anyway:', error.message);
      }
      // Reload the current page itself (whatever URL that is) instead of
      // a hardcoded path — works no matter where this is served from.
      window.location.replace(window.location.pathname);
    });
  }
};
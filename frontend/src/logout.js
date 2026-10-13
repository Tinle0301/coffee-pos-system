import { logout } from '../../backend/services/auth.js';

export const logoutComponent = {
  bindLogoutButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.addEventListener('click', async () => {
      const {error} = await logout();
      if(error){
        console.warn('Logout reported an error, redirecting anyway:', error.message);
      }
      // Replace removes history trace so browser back arrow fails securely
      // Reload the app's own page (works under `npm run dev` and on Vercel);
      // with no session left, main.js shows the login screen.
      window.location.replace(window.location.pathname);
    });
  }
};

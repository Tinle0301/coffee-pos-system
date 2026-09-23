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
      window.location.replace('/index.html');
    });
  }
};

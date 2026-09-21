import { signOut } from '../../backend/services/auth.js';

export const logoutComponent = {
  bindLogoutButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.addEventListener('click', async () => {
      await signOut();
      // Replace removes history trace so browser back arrow fails securely
      window.location.replace('/index.html');
    });
  }
};

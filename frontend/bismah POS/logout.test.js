// src/logout.test.js
import { describe, it, expect, vi } from 'vitest';
import { logoutComponent } from './logout.js';
import * as auth from '../../backend/services/auth.js';

describe('logoutComponent', () => {
  it('renders a button labeled Log out', () => {
    const button = logoutComponent({ onLoggedOut: vi.fn() });
    expect(button.tagName).toBe('BUTTON');
    expect(button.textContent).toBe('Log out');
    expect(button.id).toBe('global-logout-btn');
  });

  it('calls the auth logout service and then onLoggedOut', async () => {
    const logoutSpy = vi.spyOn(auth, 'logout').mockResolvedValueOnce({ data: null, error: null });
    const onLoggedOut = vi.fn();
    const button = logoutComponent({ onLoggedOut });

    button.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(logoutSpy).toHaveBeenCalled();
    expect(onLoggedOut).toHaveBeenCalled();
  });

  it('still calls onLoggedOut even if logout() returns an error', async () => {
    vi.spyOn(auth, 'logout').mockResolvedValueOnce({
      data: null,
      error: { code: 'LOGOUT_FAILED', message: 'Could not sign out. Try again.' },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onLoggedOut = vi.fn();
    const button = logoutComponent({ onLoggedOut });

    button.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(onLoggedOut).toHaveBeenCalled();
  });

  it('disables the button once clicked', () => {
    const button = logoutComponent({ onLoggedOut: vi.fn() });
    expect(button.disabled).toBe(false);
    button.click();
    expect(button.disabled).toBe(true);
  });
});
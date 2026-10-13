import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logoutComponent } from './logout.js';
import * as authService from '../../backend/services/auth.js';

// Stub out global browser redirect layer
const replaceMock = vi.fn();
Object.defineProperty(window, 'location', {
  value: { replace: replaceMock, pathname: '/frontend/src/' },
  writable: true
});

// Spy on service layers — matches the real auth.js contract: { data, error }
vi.mock('../../backend/services/auth.js', () => ({
  logout: vi.fn(() => Promise.resolve({ data: null, error: null }))
}));

describe('Story #13: Safe App Session Termination', () => {
  beforeEach(() => {
    document.body.innerHTML = `<button id="test-logout">Logout</button>`;
    vi.clearAllMocks();
  });

  it('should execute backend logout routine and enforce history stack replacement', async () => {
    logoutComponent.bindLogoutButton('test-logout');

    const targetButton = document.getElementById('test-logout');
    targetButton.click();

    // Small delay to allow async calls to resolve inside click handler
    await new Promise(process.nextTick);

    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith('/frontend/src/');
  });

  it('should still redirect even if the backend reports a logout error', async () => {
    authService.logout.mockResolvedValueOnce({ data: null, error: { code: 'LOGOUT_FAILED', message: 'Could not sign out. Try again.' } });
    logoutComponent.bindLogoutButton('test-logout');

    document.getElementById('test-logout').click();
    await new Promise(process.nextTick);

    expect(replaceMock).toHaveBeenCalledWith('/frontend/src/');
  });
});

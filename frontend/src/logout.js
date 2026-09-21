import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logoutComponent } from './logout.js';
import * as authService from '../../backend/services/auth.js';

// Stub out global browser redirect layer
const replaceMock = vi.fn();
Object.defineProperty(window, 'location', {
  value: { replace: replaceMock },
  writable: true
});

// Spy on service layers
vi.mock('../../backend/services/auth.js', () => ({
  signOut: vi.fn(() => Promise.resolve())
}));

describe('Story #13: Safe App Session Termination', () => {
  beforeEach(() => {
    document.body.innerHTML = `<button id="test-logout">Logout</button>`;
    vi.clearAllMocks();
  });

  it('should execute backend signOut routine and enforce history stack replacement', async () => {
    logoutComponent.bindLogoutButton('test-logout');
    
    const targetButton = document.getElementById('test-logout');
    targetButton.click();

    // Small delay to allow async calls to resolve inside click handler
    await new Promise(process.nextTick);

    expect(authService.signOut).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith('/index.html');
  });
});


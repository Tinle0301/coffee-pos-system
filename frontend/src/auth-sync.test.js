// auth-sync.test.js — POS-60
// The tab notices when the login changes in another tab.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./backend/auth.js', () => ({ session: vi.fn() }));

const { startAuthSync } = await import('./auth-sync.js');

const AUTH_KEY = 'sb-inwlmodlxpcajgivmlbr-auth-token';
const barista = { staffAccountIdentifier: 'barista-1', staffRoleType: 'Barista' };
const admin = { staffAccountIdentifier: 'admin-1', staffRoleType: 'Admin' };

let sync;
let getSession;
let onUserChanged;
let shownId;

function start() {
  sync = startAuthSync({ getCurrentStaffId: () => shownId, onUserChanged, getSession });
}

// The browser fires "storage" in the other tabs when one tab changes localStorage.
function otherTabWrites(key = AUTH_KEY) {
  window.dispatchEvent(new StorageEvent('storage', { key }));
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  getSession = vi.fn();
  onUserChanged = vi.fn();
  shownId = 'barista-1';
});

afterEach(() => {
  sync?.stop();
});

describe('startAuthSync', () => {
  it('does nothing when the same person is still signed in (e.g. token refresh)', async () => {
    getSession.mockResolvedValue({ data: barista, error: null });
    start();
    otherTabWrites();
    await flush();
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(onUserChanged).not.toHaveBeenCalled();
  });

  it('reloads when another tab logs in as someone else', async () => {
    getSession.mockResolvedValue({ data: admin, error: null });
    start();
    otherTabWrites();
    await flush();
    expect(onUserChanged).toHaveBeenCalledWith(admin);
  });

  it('reloads to Login when another tab logs out', async () => {
    getSession.mockResolvedValue({ data: null, error: null });
    start();
    otherTabWrites();
    await flush();
    expect(onUserChanged).toHaveBeenCalledWith(null);
  });

  it('leaves the Login screen when another tab logs in', async () => {
    shownId = null;
    getSession.mockResolvedValue({ data: barista, error: null });
    start();
    otherTabWrites();
    await flush();
    expect(onUserChanged).toHaveBeenCalledWith(barista);
  });

  it('treats a deactivated account as signed out', async () => {
    getSession.mockResolvedValue({ data: null, error: { code: 'ACCOUNT_DEACTIVATED', message: 'x' } });
    start();
    otherTabWrites();
    await flush();
    expect(onUserChanged).toHaveBeenCalledWith(null);
  });

  it('does not kick anyone out when the lookup fails (network blip)', async () => {
    getSession.mockResolvedValue({ data: null, error: { code: 'LOOKUP_FAILED', message: 'x' } });
    start();
    otherTabWrites();
    await flush();
    expect(onUserChanged).not.toHaveBeenCalled();
  });

  it('ignores localStorage keys that are not the Supabase session', async () => {
    getSession.mockResolvedValue({ data: admin, error: null });
    start();
    otherTabWrites('some-other-key');
    await flush();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('checks again when the tab gets focus, in case an event was missed', async () => {
    getSession.mockResolvedValue({ data: admin, error: null });
    start();
    window.dispatchEvent(new Event('focus'));
    await flush();
    expect(onUserChanged).toHaveBeenCalledWith(admin);
  });

  it('only reloads once even if several events arrive together', async () => {
    getSession.mockResolvedValue({ data: admin, error: null });
    start();
    otherTabWrites();
    otherTabWrites();
    window.dispatchEvent(new Event('focus'));
    await flush();
    await flush();
    expect(onUserChanged).toHaveBeenCalledTimes(1);
  });

  it('stops listening after stop()', async () => {
    getSession.mockResolvedValue({ data: admin, error: null });
    start();
    sync.stop();
    otherTabWrites();
    await flush();
    expect(getSession).not.toHaveBeenCalled();
  });
});

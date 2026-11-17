// session-timeout.test.js
// The register signs out after 10 minutes with no activity (491A SRS,
// docs/REQUIREMENTS.md). Tests the copy the site loads:
// frontend/src/backend/sessionTimeout.js (synced from backend/services/).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const logout = vi.fn(() => Promise.resolve({ data: null, error: null }));
vi.mock('./backend/auth.js', () => ({ logout: (...a) => logout(...a) }));

const { startSessionTimeout, stopSessionTimeout } = await import('./backend/sessionTimeout.js');

const TEN_MINUTES = 10 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  logout.mockClear();
});

afterEach(() => {
  stopSessionTimeout();
  vi.useRealTimers();
});

describe('session timeout', () => {
  it('signs out after 10 minutes with no activity, then runs the callback', async () => {
    const onTimeout = vi.fn();
    startSessionTimeout(onTimeout);

    await vi.advanceTimersByTimeAsync(TEN_MINUTES - 10_000);
    expect(logout).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(20_000);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('a tap or key press restarts the 10 minutes', async () => {
    const onTimeout = vi.fn();
    startSessionTimeout(onTimeout);

    await vi.advanceTimersByTimeAsync(9 * 60 * 1000);
    window.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(9 * 60 * 1000);
    window.dispatchEvent(new Event('keydown'));
    await vi.advanceTimersByTimeAsync(9 * 60 * 1000);

    expect(logout).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('signs out only once, even if the screen stays open', async () => {
    const onTimeout = vi.fn();
    startSessionTimeout(onTimeout);
    await vi.advanceTimersByTimeAsync(TEN_MINUTES * 3);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('stopSessionTimeout cancels it (manual logout)', async () => {
    const onTimeout = vi.fn();
    startSessionTimeout(onTimeout);
    stopSessionTimeout();
    await vi.advanceTimersByTimeAsync(TEN_MINUTES * 2);
    expect(logout).not.toHaveBeenCalled();
  });

  it('starting again replaces the old timer instead of adding a second one', async () => {
    const first = vi.fn();
    const second = vi.fn();
    startSessionTimeout(first);
    startSessionTimeout(second);
    await vi.advanceTimersByTimeAsync(TEN_MINUTES + 10_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(logout).toHaveBeenCalledTimes(1);
  });
});

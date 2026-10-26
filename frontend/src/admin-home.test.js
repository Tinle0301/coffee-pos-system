// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminHomeScreen, ADMIN_SECTIONS } from './admin-home.js';

const admin = { staffRole: 'Admin', staffName: 'Ada Admin' };

function mount(state) {
  document.body.innerHTML = `<main id="app-content">${adminHomeScreen.render(state)}</main>`;
}

describe('admin home screen', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('renders a tile for every configured admin screen', () => {
    mount(admin);
    const total = ADMIN_SECTIONS.reduce((n, s) => n + s.tiles.length, 0);
    expect(document.querySelectorAll('.admin-tile')).toHaveLength(total);
    expect(document.body.textContent).toContain('Refunds');
    expect(document.body.textContent).toContain('Active Orders');
    expect(document.body.textContent).toContain('Menu Management');
  });

  it('disables tiles that have no screen yet and gives them no route', () => {
    mount(admin);
    const soon = document.querySelectorAll('.admin-tile--soon');
    expect(soon.length).toBeGreaterThan(0);
    soon.forEach((t) => {
      expect(t.disabled).toBe(true);
      expect(t.dataset.route).toBeUndefined();
    });
  });

  it('navigates to the tile route on click', () => {
    mount(admin);
    const navigate = vi.fn();
    adminHomeScreen.init(navigate);
    document.querySelector('[data-route="refund"]').click();
    document.querySelector('[data-route="queue"]').click();
    expect(navigate).toHaveBeenNthCalledWith(1, 'refund');
    expect(navigate).toHaveBeenNthCalledWith(2, 'queue');
  });

  it('shows an admins-only panel to non-admins', () => {
    mount({ staffRole: 'Barista' });
    expect(document.querySelectorAll('.admin-tile')).toHaveLength(0);
    expect(document.body.textContent).toContain('Admins only');
  });

  it('escapes the staff name', () => {
    mount({ staffRole: 'Admin', staffName: '<img src=x onerror=alert(1)>' });
    expect(document.querySelector('.admin-home img')).toBeNull();
  });
});

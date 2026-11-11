import { describe, it, expect, vi } from 'vitest';
import { staffManagerScreen } from './staff-manager.js';
import { listStaffAccounts, deactivateStaffAccount, updateStaffAccount } from './backend/services/staff.js';

// Mock the backend service (Node can't load the CDN-based supabase-client.js chain)
vi.mock('./backend/services/staff.js', () => ({
  listStaffAccounts: vi.fn(),
  deactivateStaffAccount: vi.fn(() => Promise.resolve({ data: {}, error: null })),
  updateStaffAccount: vi.fn(() => Promise.resolve({ data: {}, error: null }))
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('POS-55: Staff screen to see staff and deactivate accounts', () => {
  it('should list staff and deactivate an account after confirming', async () => {
    listStaffAccounts.mockResolvedValue({
      data: [
        { staffAccountIdentifier: 'admin-1', staffFullName: 'Jamie Admin', staffRoleType: 'Admin', staffAccountStatus: true },
        { staffAccountIdentifier: 'b-1', staffFullName: 'Alex Barista', staffRoleType: 'Barista', staffAccountStatus: true }
      ], error: null
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    document.body.innerHTML = staffManagerScreen.render();
    await staffManagerScreen.init(vi.fn(), [], 'admin-1'); // signed in as Jamie

    const names = [...document.querySelectorAll('.order-line-name')].map((el) => el.textContent);
    expect(names).toEqual(['Jamie Admin', 'Alex Barista']);
    expect(document.querySelector('[data-staff-id="admin-1"]')).toBeNull(); // can't deactivate yourself

    document.querySelector('.staff-deactivate-btn[data-staff-id="b-1"]').click();
    await flush();
    expect(deactivateStaffAccount).toHaveBeenCalledWith('b-1');
  });
});

describe('POS-74: Reactivate staff and change their role', () => {
  it('should reactivate a deactivated account and change a role after confirming', async () => {
    listStaffAccounts.mockResolvedValue({
      data: [
        { staffAccountIdentifier: 'admin-1', staffFullName: 'Jamie Admin', staffRoleType: 'Admin', staffAccountStatus: true },
        { staffAccountIdentifier: 'b-1', staffFullName: 'Alex Barista', staffRoleType: 'Barista', staffAccountStatus: true },
        { staffAccountIdentifier: 'b-2', staffFullName: 'Sam Barista', staffRoleType: 'Barista', staffAccountStatus: false }
      ], error: null
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    document.body.innerHTML = staffManagerScreen.render();
    await staffManagerScreen.init(vi.fn(), [], 'admin-1'); // signed in as Jamie

    // only the deactivated account offers Reactivate; you can't change your own role
    expect(document.querySelectorAll('.staff-reactivate-btn')).toHaveLength(1);
    expect(document.querySelector('.staff-deactivate-btn[data-staff-id="b-2"]')).toBeNull();
    expect(document.querySelector('.staff-role-select[data-staff-id="admin-1"]')).toBeNull();

    document.querySelector('.staff-reactivate-btn[data-staff-id="b-2"]').click();
    await flush();
    expect(updateStaffAccount).toHaveBeenCalledWith('b-2', { staffAccountStatus: true });

    const select = document.querySelector('.staff-role-select[data-staff-id="b-1"]');
    select.value = 'Admin';
    select.dispatchEvent(new Event('change'));
    await flush();
    expect(updateStaffAccount).toHaveBeenCalledWith('b-1', { staffRoleType: 'Admin' });
  });
});
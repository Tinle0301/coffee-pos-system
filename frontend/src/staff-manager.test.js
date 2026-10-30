import { describe, it, expect, vi } from 'vitest';
import { staffManagerScreen } from './staff-manager.js';
import { listStaffAccounts, deactivateStaffAccount } from './backend/services/staff.js';

// Mock the backend service (Node can't load the CDN-based supabase-client.js chain)
vi.mock('./backend/services/staff.js', () => ({
  listStaffAccounts: vi.fn(),
  deactivateStaffAccount: vi.fn(() => Promise.resolve({ data: {}, error: null }))
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

    document.querySelector('[data-staff-id="b-1"]').click();
    await flush();
    expect(deactivateStaffAccount).toHaveBeenCalledWith('b-1');
  });
});

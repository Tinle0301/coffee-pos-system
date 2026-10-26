// staff-service.test.js — POS-43
// Tests the staff service the admin Staff screen uses
// (frontend/src/backend/services/staff.js, synced from backend/services/).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const query = {
  select: vi.fn(() => query),
  order: vi.fn(),
  update: vi.fn(() => query),
  eq: vi.fn(() => query),
  maybeSingle: vi.fn(),
};
const from = vi.fn(() => query);

// Node can't load the CDN-based supabase client, so mock it.
vi.mock('./backend/supabase-client.js', () => ({ supabase: { rpc: (...a) => rpc(...a), from: (...a) => from(...a) } }));

const {
  listStaffAccounts,
  deactivateStaffAccount,
  reactivateStaffAccount,
  updateStaffAccount,
  createStaffAccount,
  mapStaffError,
} = await import('./backend/services/staff.js');

const row = {
  staff_account_identifier: 'id-1',
  staff_full_name: 'Test Barista',
  staff_role_type: 'Barista',
  staff_email_address: 'barista@test.com',
  staff_account_status: true,
  account_creation_timestamp: '2026-10-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listStaffAccounts', () => {
  it('maps rows to camelCase staff accounts, sorted by name', async () => {
    query.order.mockResolvedValue({ data: [row], error: null });
    const { data, error } = await listStaffAccounts();
    expect(error).toBeNull();
    expect(from).toHaveBeenCalledWith('staff_accounts');
    expect(query.order).toHaveBeenCalledWith('staff_full_name', { ascending: true });
    expect(data).toEqual([{
      staffAccountIdentifier: 'id-1',
      staffFullName: 'Test Barista',
      staffRoleType: 'Barista',
      staffEmailAddress: 'barista@test.com',
      staffAccountStatus: true,
      accountCreationTimestamp: '2026-10-01T00:00:00Z',
    }]);
  });

  it('returns LOOKUP_FAILED when the query fails', async () => {
    query.order.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { data, error } = await listStaffAccounts();
    expect(data).toBeNull();
    expect(error.code).toBe('LOOKUP_FAILED');
  });
});

describe('deactivate / reactivate', () => {
  it('calls set_staff_active with false to deactivate', async () => {
    rpc.mockResolvedValue({ data: { ...row, staff_account_status: false }, error: null });
    const { data, error } = await deactivateStaffAccount('id-1');
    expect(rpc).toHaveBeenCalledWith('set_staff_active', { staff_id: 'id-1', is_active: false });
    expect(error).toBeNull();
    expect(data.staffAccountStatus).toBe(false);
  });

  it('calls set_staff_active with true to reactivate', async () => {
    rpc.mockResolvedValue({ data: row, error: null });
    await reactivateStaffAccount('id-1');
    expect(rpc).toHaveBeenCalledWith('set_staff_active', { staff_id: 'id-1', is_active: true });
  });

  it('shows a clear message when an admin tries to deactivate themselves', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'SELF_CHANGE: you cannot change your own role or deactivate your own account' } });
    const { data, error } = await deactivateStaffAccount('me');
    expect(data).toBeNull();
    expect(error).toEqual({ code: 'SELF_CHANGE', message: 'You cannot change your own role or deactivate your own account.' });
  });
});

describe('updateStaffAccount', () => {
  it('changes the role through set_staff_role', async () => {
    rpc.mockResolvedValue({ data: { ...row, staff_role_type: 'Admin' }, error: null });
    const { data } = await updateStaffAccount('id-1', { staffRoleType: 'Admin' });
    expect(rpc).toHaveBeenCalledWith('set_staff_role', { staff_id: 'id-1', new_role: 'Admin' });
    expect(data.staffRoleType).toBe('Admin');
  });

  it('rejects an empty name without calling the database', async () => {
    const { error } = await updateStaffAccount('id-1', { staffFullName: '   ' });
    expect(error.code).toBe('INVALID_NAME');
    expect(from).not.toHaveBeenCalled();
  });

  it('returns NOTHING_TO_UPDATE when no changes are given', async () => {
    const { error } = await updateStaffAccount('id-1', {});
    expect(error.code).toBe('NOTHING_TO_UPDATE');
  });
});

describe('createStaffAccount', () => {
  it('points admins to the Supabase dashboard instead of creating a login', async () => {
    const { data, error } = await createStaffAccount({ staffFullName: 'X', staffRoleType: 'Barista', staffEmailAddress: 'x@test.com' });
    expect(data).toBeNull();
    expect(error.code).toBe('NOT_SUPPORTED');
  });
});

describe('mapStaffError', () => {
  it('turns unknown database errors into a generic message', () => {
    expect(mapStaffError({ message: 'something odd' })).toEqual({ code: 'UPDATE_FAILED', message: 'Could not update the staff account.' });
  });

  it('keeps known codes', () => {
    expect(mapStaffError({ message: 'UNAUTHORIZED: caller must be an active admin' }).code).toBe('UNAUTHORIZED');
  });
});

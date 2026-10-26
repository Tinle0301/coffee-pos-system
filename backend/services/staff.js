// staff.js — UserController
// Manage staff accounts (admin only, see 0002_rls_policies.sql).
//
// POS-43: role and active/deactivated changes go through the database
// functions set_staff_role and set_staff_active (0017_staff_management.sql).
// They check that the caller is an active admin, and a trigger stops anyone
// from changing their own role or deactivating themselves, so the shop
// always keeps at least one admin.
//
// Every function returns { data, error } and never throws, like the other
// services.

import { supabase } from '../supabase-client.js';

/** @typedef {{ code: string, message: string }} ServiceError */

/**
 * Creating a login needs the Supabase secret key, which must never be in the
 * browser, so new staff are added in the Supabase dashboard (docs/SETUP.md,
 * "Adding a staff member").
 *
 * @param {{ staffFullName: string, staffRoleType: string, staffEmailAddress: string }} input
 * @returns {Promise<{ data: null, error: ServiceError }>}
 */
export async function createStaffAccount(input) {
  return {
    data: null,
    error: {
      code: 'NOT_SUPPORTED',
      message: 'New staff are added in the Supabase dashboard. See docs/SETUP.md, "Adding a staff member".',
    },
  };
}

/**
 * Change a staff member's name, role and/or active status.
 *
 * @param {string} staffAccountIdentifier
 * @param {{ staffFullName?: string, staffRoleType?: 'Barista'|'Admin', staffAccountStatus?: boolean }} updates
 * @returns {Promise<{ data: import('../models/staffAccount.js').StaffAccount | null, error: ServiceError | null }>}
 */
export async function updateStaffAccount(staffAccountIdentifier, updates = {}) {
  let latest = null;

  if (updates.staffFullName !== undefined) {
    const name = String(updates.staffFullName).trim();
    if (!name) {
      return { data: null, error: { code: 'INVALID_NAME', message: 'Name cannot be empty.' } };
    }
    const { data, error } = await supabase
      .from('staff_accounts')
      .update({ staff_full_name: name })
      .eq('staff_account_identifier', staffAccountIdentifier)
      .select()
      .maybeSingle();
    if (error) return { data: null, error: mapStaffError(error) };
    if (!data) return { data: null, error: { code: 'STAFF_NOT_FOUND', message: 'Staff account not found.' } };
    latest = data;
  }

  if (updates.staffRoleType !== undefined) {
    const { data, error } = await supabase.rpc('set_staff_role', {
      staff_id: staffAccountIdentifier,
      new_role: updates.staffRoleType,
    });
    if (error) return { data: null, error: mapStaffError(error) };
    latest = data;
  }

  if (updates.staffAccountStatus !== undefined) {
    const { data, error } = await supabase.rpc('set_staff_active', {
      staff_id: staffAccountIdentifier,
      is_active: updates.staffAccountStatus,
    });
    if (error) return { data: null, error: mapStaffError(error) };
    latest = data;
  }

  if (!latest) {
    return { data: null, error: { code: 'NOTHING_TO_UPDATE', message: 'No changes were given.' } };
  }

  return { data: toStaffAccount(latest), error: null };
}

/**
 * @param {string} staffAccountIdentifier
 * @returns {Promise<{ data: import('../models/staffAccount.js').StaffAccount | null, error: ServiceError | null }>}
 */
export async function deactivateStaffAccount(staffAccountIdentifier) {
  return updateStaffAccount(staffAccountIdentifier, { staffAccountStatus: false });
}

/**
 * @param {string} staffAccountIdentifier
 * @returns {Promise<{ data: import('../models/staffAccount.js').StaffAccount | null, error: ServiceError | null }>}
 */
export async function reactivateStaffAccount(staffAccountIdentifier) {
  return updateStaffAccount(staffAccountIdentifier, { staffAccountStatus: true });
}

/**
 * Admins see every staff member; anyone else only sees their own row (RLS).
 *
 * @returns {Promise<{ data: import('../models/staffAccount.js').StaffAccount[] | null, error: ServiceError | null }>}
 */
export async function listStaffAccounts() {
  const { data, error } = await supabase
    .from('staff_accounts')
    .select('*')
    .order('staff_full_name', { ascending: true });

  if (error) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load staff accounts.' } };
  }

  return { data: data.map(toStaffAccount), error: null };
}

function toStaffAccount(row) {
  return {
    staffAccountIdentifier: row.staff_account_identifier,
    staffFullName: row.staff_full_name,
    staffRoleType: row.staff_role_type,
    staffEmailAddress: row.staff_email_address,
    staffAccountStatus: row.staff_account_status,
    accountCreationTimestamp: row.account_creation_timestamp,
  };
}

// The database functions raise 'CODE: message'. Unpack that so the screen
// can show the message; anything else becomes a generic error.
const KNOWN_CODES = ['UNAUTHORIZED', 'INVALID_ROLE', 'INVALID_STATUS', 'STAFF_NOT_FOUND', 'SELF_CHANGE'];

export function mapStaffError(error) {
  const message = error?.message ?? '';
  const match = message.match(/^([A-Z_]+):\s*(.*)$/);
  if (match && KNOWN_CODES.includes(match[1])) {
    return { code: match[1], message: friendlyMessage(match[1], match[2]) };
  }
  return { code: 'UPDATE_FAILED', message: 'Could not update the staff account.' };
}

function friendlyMessage(code, fallback) {
  switch (code) {
    case 'UNAUTHORIZED': return 'Only an admin can manage staff accounts.';
    case 'SELF_CHANGE': return 'You cannot change your own role or deactivate your own account.';
    case 'STAFF_NOT_FOUND': return 'Staff account not found.';
    case 'INVALID_ROLE': return 'Role must be Barista or Admin.';
    default: return fallback;
  }
}

// auth.js — AuthController (491A)
//
// POS-5 Staff Login · POS-6 Session Timeout · POS-15 Logout
//
// Every function returns { data, error } — never throws, never returns a
// bare value. That shape is the contract (docs/API_CONTRACT.md); the
// frontend checks `error` first, every time.
//
// `error` is always { code, message }:
//   code    — stable, safe to branch on in code
//   message — safe to show a barista; never leaks whether an account exists

import { supabase } from '../supabase-client.js';

/** @typedef {{ code: string, message: string }} ServiceError */

/**
 * Sign a staff member in with email and password.
 *
 * Supabase Auth verifies the credentials; the role comes from our own
 * staff_accounts table, keyed by the auth user id. A staff member whose
 * account has been deactivated is signed straight back out — being in
 * Supabase Auth is not the same as being allowed to work a shift.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ data: { staffAccountIdentifier: string, staffFullName: string,
 *   staffRoleType: 'Barista'|'Admin', staffEmailAddress: string } | null,
 *   error: ServiceError | null }>}
 */
export async function login(email, password) {
  if (!email || !password) {
    return { data: null, error: { code: 'INVALID_CREDENTIALS', message: 'Enter your email and password.' } };
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (authError || !authData?.user) {
    // Deliberately identical message for "no such account" and "wrong
    // password" — anything more specific tells an attacker which emails
    // are real.
    return { data: null, error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' } };
  }

  const { data: staff, error: staffError } = await fetchStaffAccount(authData.user.id);

  if (staffError) {
    await supabase.auth.signOut();
    return { data: null, error: staffError };
  }

  return { data: staff, error: null };
}

/**
 * End the current session. Safe to call when nobody is signed in.
 * Used by both the logout button (POS-15) and the inactivity timer (POS-6).
 *
 * @returns {Promise<{ data: null, error: ServiceError | null }>}
 */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { data: null, error: { code: 'LOGOUT_FAILED', message: 'Could not sign out. Try again.' } };
  }
  return { data: null, error: null };
}

/**
 * Who is signed in right now, if anyone.
 *
 * Call this on every page load before rendering: a barista who reloads
 * mid-shift should stay signed in, and a page that assumes a session it
 * does not have shows empty screens with no error.
 *
 * @returns {Promise<{ data: { staffAccountIdentifier: string, staffFullName: string,
 *   staffRoleType: 'Barista'|'Admin', staffEmailAddress: string } | null,
 *   error: ServiceError | null }>}
 */
export async function session() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;

  if (!user) {
    // Not an error — "nobody is signed in" is a normal answer.
    return { data: null, error: null };
  }

  return await fetchStaffAccount(user.id);
}

/**
 * True when the signed-in staff member is an Admin.
 * Convenience for hiding admin navigation — NOT a security control.
 * Authorization lives in the RLS policies (POS-7); this only decides what
 * the UI bothers to draw.
 *
 * @returns {Promise<boolean>}
 */
export async function isAdmin() {
  const { data } = await session();
  return data?.staffRoleType === 'Admin';
}

/**
 * Run a callback whenever the session appears or disappears — including
 * when it is ended in another tab. Screens use this to redirect to login
 * instead of sitting there broken.
 *
 * @param {(staff: object|null) => void} callback
 * @returns {() => void} unsubscribe
 */
export function onAuthChange(callback) {
  const { data: subscription } = supabase.auth.onAuthStateChange(async (event) => {
    if (event === 'SIGNED_OUT') {
      callback(null);
      return;
    }
    const { data } = await session();
    callback(data);
  });
  return () => subscription?.subscription?.unsubscribe();
}

/**
 * Read the staff_accounts row for an authenticated user and map it to the
 * shape in the contract.
 *
 * Note for whoever debugs this later: staff_accounts is admin-only under
 * our RLS policies, so a Barista cannot read this table directly. The
 * lookup works because it is scoped to the caller's own id — if it starts
 * returning nothing for baristas, the policy in 0002_rls_policies.sql is
 * what changed, not this function.
 *
 * @param {string} authUserId
 */
async function fetchStaffAccount(authUserId) {
  const { data, error } = await supabase
    .from('staff_accounts')
    .select('staff_account_identifier, staff_full_name, staff_role_type, staff_email_address, staff_account_status')
    .eq('staff_account_identifier', authUserId)
    .maybeSingle();

  if (error) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load your staff profile.' } };
  }

  if (!data) {
    // Signed in to Supabase Auth but no staff row: the accounts were
    // created out of step. Seed data and Auth users must share ids —
    // see docs/SETUP.md.
    return { data: null, error: { code: 'NO_STAFF_ACCOUNT', message: 'This login is not linked to a staff account. Ask an admin.' } };
  }

  if (data.staff_account_status !== true) {
    return { data: null, error: { code: 'ACCOUNT_DEACTIVATED', message: 'This account has been deactivated.' } };
  }

  return {
    data: {
      staffAccountIdentifier: data.staff_account_identifier,
      staffFullName: data.staff_full_name,
      staffRoleType: data.staff_role_type,
      staffEmailAddress: data.staff_email_address,
    },
    error: null,
  };
}

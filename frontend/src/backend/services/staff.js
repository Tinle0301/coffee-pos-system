// staff.js — UserController
// Manage staff accounts (admin only, see 0002_rls_policies.sql).

/**
 * @param {{ staffFullName: string, staffRoleType: string, staffEmailAddress: string }} input
 * @returns {Promise<import('../models/staffAccount.js').StaffAccount>}
 */
export async function createStaffAccount(input) {}

/**
 * @param {string} staffAccountIdentifier
 * @param {Partial<import('../models/staffAccount.js').StaffAccount>} updates
 * @returns {Promise<import('../models/staffAccount.js').StaffAccount>}
 */
export async function updateStaffAccount(staffAccountIdentifier, updates) {}

/**
 * @param {string} staffAccountIdentifier
 * @returns {Promise<void>}
 */
export async function deactivateStaffAccount(staffAccountIdentifier) {}

/**
 * @returns {Promise<import('../models/staffAccount.js').StaffAccount[]>}
 */
export async function listStaffAccounts() {}

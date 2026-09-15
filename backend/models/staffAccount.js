// staffAccount.js — shape definition + validator for `staff_accounts`
// (maps to 491A StaffAccount). Columns: staff_account_identifier,
// staff_full_name, staff_role_type, staff_email_address,
// staff_account_status, account_creation_timestamp.

/**
 * @typedef {Object} StaffAccount
 * @property {string} staffAccountIdentifier
 * @property {string} staffFullName
 * @property {'Barista'|'Admin'} staffRoleType
 * @property {string} staffEmailAddress
 * @property {boolean} staffAccountStatus
 * @property {string} accountCreationTimestamp
 */

/**
 * @param {unknown} value
 * @returns {value is StaffAccount}
 */
export function isValidStaffAccount(value) {
  throw new Error('isValidStaffAccount: not implemented');
}

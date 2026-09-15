// user.js — shape definition + validator for `users` (maps to 491A User)
// Columns: user_identifier, username_credential, encrypted_password_hash,
// user_email_address, user_role_type, account_creation_timestamp,
// account_active_status. See docs/DATA_MODEL.md for the full mapping.

/**
 * @typedef {Object} User
 * @property {string} userIdentifier
 * @property {string} usernameCredential
 * @property {string} userEmailAddress
 * @property {'Barista'|'Admin'} userRoleType
 * @property {string} accountCreationTimestamp
 * @property {boolean} accountActiveStatus
 */

/**
 * @param {unknown} value
 * @returns {value is User}
 */
export function isValidUser(value) {
  throw new Error('isValidUser: not implemented');
}

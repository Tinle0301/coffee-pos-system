// menu.js — MenuController (view for all staff, write for admin only)

/**
 * @returns {Promise<import('../models/menuItem.js').MenuItem[]>}
 */
export async function listMenuItems() {}

/**
 * @param {import('../models/menuItem.js').MenuItem} item
 * @returns {Promise<import('../models/menuItem.js').MenuItem>}
 */
export async function createMenuItem(item) {}

/**
 * @param {string} menuItemId
 * @param {Partial<import('../models/menuItem.js').MenuItem>} updates
 * @returns {Promise<import('../models/menuItem.js').MenuItem>}
 */
export async function updateMenuItem(menuItemId, updates) {}

/**
 * @param {string} menuItemId
 * @returns {Promise<void>}
 */
export async function deleteMenuItem(menuItemId) {}

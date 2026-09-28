// menu.js — MenuController (view for all staff, write for admin only)
//
// Every function returns { data, error } — never throws, never returns a
// bare value (see docs/API_CONTRACT.md and backend/services/auth.js for the
// contract). Write access is enforced by RLS (menu_items_write_admin in
// 0002_rls_policies.sql) — a non-admin caller gets rejected at the database,
// this module only shapes the error.

import { supabase } from '../supabase-client.js';

/** @typedef {{ code: string, message: string }} ServiceError */

/**
 * @returns {Promise<{ data: import('../models/menuItem.js').MenuItem[] | null, error: ServiceError | null }>}
 */
export async function listMenuItems() {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('menu_item_category_type');

  if (error) {
    return { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load the menu.' } };
  }

  return { data: data.map(toMenuItem), error: null };
}

/**
 * @param {{ menuItemName: string, menuItemCategoryType: string, menuItemDescriptionText?: string,
 *   menuItemPriceAmount: number, menuItemAvailabilityStatus?: boolean }} item
 * @returns {Promise<{ data: import('../models/menuItem.js').MenuItem | null, error: ServiceError | null }>}
 */
export async function createMenuItem(item) {
  if (!item?.menuItemName || item.menuItemPriceAmount == null) {
    return { data: null, error: { code: 'INVALID_MENU_ITEM', message: 'Name and price are required.' } };
  }
  if (item.menuItemPriceAmount < 0) {
    return { data: null, error: { code: 'INVALID_MENU_ITEM', message: 'Price cannot be negative.' } };
  }

  const { data, error } = await supabase
    .from('menu_items')
    .insert({
      menu_item_name: item.menuItemName,
      menu_item_category_type: item.menuItemCategoryType,
      menu_item_description_text: item.menuItemDescriptionText ?? null,
      menu_item_price_amount: item.menuItemPriceAmount,
      menu_item_availability_status: item.menuItemAvailabilityStatus ?? true,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Could not create the menu item.' } };
  }

  return { data: toMenuItem(data), error: null };
}

/**
 * @param {string} menuItemId
 * @param {Partial<import('../models/menuItem.js').MenuItem>} updates
 * @returns {Promise<{ data: import('../models/menuItem.js').MenuItem | null, error: ServiceError | null }>}
 */
export async function updateMenuItem(menuItemId, updates) {
  if (updates?.menuItemPriceAmount != null && updates.menuItemPriceAmount < 0) {
    return { data: null, error: { code: 'INVALID_MENU_ITEM', message: 'Price cannot be negative.' } };
  }

  const patch = {};
  if (updates?.menuItemName !== undefined) patch.menu_item_name = updates.menuItemName;
  if (updates?.menuItemCategoryType !== undefined) patch.menu_item_category_type = updates.menuItemCategoryType;
  if (updates?.menuItemDescriptionText !== undefined) patch.menu_item_description_text = updates.menuItemDescriptionText;
  if (updates?.menuItemPriceAmount !== undefined) patch.menu_item_price_amount = updates.menuItemPriceAmount;
  if (updates?.menuItemAvailabilityStatus !== undefined) patch.menu_item_availability_status = updates.menuItemAvailabilityStatus;

  const { data, error } = await supabase
    .from('menu_items')
    .update(patch)
    .eq('menu_item_identifier', menuItemId)
    .select()
    .maybeSingle();

  if (error) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Could not update the menu item.' } };
  }
  if (!data) {
    // No matching row: either the id doesn't exist, or RLS silently
    // excluded it because the caller isn't an admin. Deliberately the same
    // message for both — see auth.js login() for the same pattern.
    return { data: null, error: { code: 'MENU_ITEM_NOT_FOUND', message: 'Menu item not found.' } };
  }

  return { data: toMenuItem(data), error: null };
}

/**
 * @param {string} menuItemId
 * @returns {Promise<{ data: null, error: ServiceError | null }>}
 */
export async function deleteMenuItem(menuItemId) {
  const { data, error } = await supabase
    .from('menu_items')
    .delete()
    .eq('menu_item_identifier', menuItemId)
    .select()
    .maybeSingle();

  if (error) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Could not delete the menu item.' } };
  }
  if (!data) {
    return { data: null, error: { code: 'MENU_ITEM_NOT_FOUND', message: 'Menu item not found.' } };
  }

  return { data: null, error: null };
}

function toMenuItem(row) {
  return {
    menuItemIdentifier: row.menu_item_identifier,
    menuItemName: row.menu_item_name,
    menuItemCategoryType: row.menu_item_category_type,
    menuItemDescriptionText: row.menu_item_description_text,
    menuItemPriceAmount: row.menu_item_price_amount,
    menuItemAvailabilityStatus: row.menu_item_availability_status,
  };
}

// menu.js — admin Menu Management: lists every item by category, lets an
// Admin switch each one on or off (sold-out items disappear from New Order),
// and add or edit an item's name, category and price.
// Writes go through createMenuItem / updateMenuItem; RLS
// (menu_items_write_admin) is the real admin check, the route guard in
// main.js is only a convenience.
import { listMenuItems, createMenuItem, updateMenuItem } from './backend/services/menu.js';

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const formatPrice = (amount) => `$${Number(amount ?? 0).toFixed(2)}`;
const NEW_CATEGORY = '__new__';

// Check the add/edit form. Returns field errors plus the cleaned values.
// `others` is the list of other items, used to catch duplicate names.
export function validateMenuItemForm({ name, category, price }, others = []) {
  const errors = {};
  const cleanName = String(name ?? '').trim();
  const cleanCategory = String(category ?? '').trim();
  const rawPrice = String(price ?? '').trim().replace(/^\$/, '');

  if (!cleanName) errors.name = 'Enter a name.';
  else if (cleanName.length > 60) errors.name = 'Keep the name under 60 characters.';
  else if (cleanCategory && others.some((i) =>
    i.menuItemCategoryType.toLowerCase() === cleanCategory.toLowerCase()
    && i.menuItemName.trim().toLowerCase() === cleanName.toLowerCase())) {
    errors.name = 'An item with this name is already in that category.';
  }

  if (!cleanCategory) errors.category = 'Choose a category or enter a new one.';

  if (!rawPrice) errors.price = 'Enter a price.';
  else if (!/^\d+(\.\d{1,2})?$/.test(rawPrice)) errors.price = 'Use a price like 4.50.';
  else if (Number(rawPrice) > 999.99) errors.price = 'Price must be under $1,000.';

  return {
    errors,
    values: {
      name: cleanName,
      category: cleanCategory,
      price: errors.price ? null : Math.round(Number(rawPrice) * 100) / 100,
    },
  };
}

export const menuScreen = {
  render() {
    return `
      <div class="screen-container menu-admin">
        <div class="menu-admin-top">
          <button type="button" id="menu-back-btn" class="btn-ghost">&larr; Admin Home</button>
        </div>
        <div class="menu-admin-heading">
          <h2>Menu Management</h2>
          <button type="button" id="menu-add-btn">+ Add item</button>
        </div>
        <p class="menu-admin-hint">Switch an item off when it sells out and it disappears from New Order. Use Edit to change a name, category or price.</p>
        <p id="menu-admin-summary" class="menu-admin-summary" aria-live="polite"></p>
        <p id="menu-admin-message" class="menu-admin-message" role="status" aria-live="polite"></p>
        <div id="menu-categories">Loading menu...</div>

        <div id="menu-form-modal" class="modal-overlay" hidden>
          <form id="menu-form" class="screen-container modal-card" role="dialog" aria-modal="true" aria-labelledby="menu-form-title" novalidate>
            <h2 id="menu-form-title"></h2>
            <div class="menu-form-field">
              <label for="menu-form-name">Name</label>
              <input id="menu-form-name" type="text" maxlength="60" autocomplete="off">
              <p class="menu-form-error" id="menu-form-name-error" role="alert"></p>
            </div>
            <div class="menu-form-field">
              <label for="menu-form-category">Category</label>
              <select id="menu-form-category"></select>
              <input id="menu-form-new-category" type="text" maxlength="40" placeholder="New category name" autocomplete="off" hidden>
              <p class="menu-form-error" id="menu-form-category-error" role="alert"></p>
            </div>
            <div class="menu-form-field">
              <label for="menu-form-price">Price ($)</label>
              <input id="menu-form-price" type="text" inputmode="decimal" placeholder="4.50" autocomplete="off">
              <p class="menu-form-error" id="menu-form-price-error" role="alert"></p>
            </div>
            <p class="menu-form-error" id="menu-form-error" role="alert"></p>
            <div class="modal-actions">
              <button type="button" id="menu-form-cancel" class="btn-ghost">Cancel</button>
              <button type="submit" id="menu-form-save">Save</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async init(navigate) {
    document.getElementById('menu-back-btn').addEventListener('click', () => navigate('admin'));

    const container = document.getElementById('menu-categories');
    const summary = document.getElementById('menu-admin-summary');
    const message = document.getElementById('menu-admin-message');

    const { data, error } = await listMenuItems();
    if (error) {
      // The service's messages are written to be safe to show as-is.
      container.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
      document.getElementById('menu-add-btn').disabled = true;
      return;
    }

    let items = data || [];

    const draw = () => {
      container.innerHTML = items.length
        ? this.generateMenuHTML(this.groupByCategory(items))
        : 'No menu items yet. Use "Add item" to create the first one.';
      const on = items.filter((i) => i.menuItemAvailabilityStatus).length;
      summary.textContent = items.length ? `${on} of ${items.length} items on` : '';
    };
    draw();

    const say = (text, isError = false) => {
      message.textContent = text;
      message.classList.toggle('is-error', isError);
    };

    // ---------- on/off switches and Edit buttons ----------
    const pending = new Set(); // ids with a request in flight (double-tap protection)

    container.addEventListener('click', async (event) => {
      const editBtn = event.target.closest('.menu-edit-btn');
      if (editBtn) {
        const item = items.find((i) => String(i.menuItemIdentifier) === editBtn.dataset.itemId);
        if (item) openForm(item);
        return;
      }

      const toggle = event.target.closest('.menu-toggle');
      if (!toggle || toggle.disabled) return;
      const id = toggle.dataset.itemId;
      if (pending.has(id)) return;
      const item = items.find((i) => String(i.menuItemIdentifier) === id);
      if (!item) return;

      pending.add(id);
      toggle.disabled = true;
      say('');

      const next = !item.menuItemAvailabilityStatus;
      const { data: updated, error: updateError } = await updateMenuItem(item.menuItemIdentifier, {
        menuItemAvailabilityStatus: next,
      });
      pending.delete(id);

      if (updateError || !updated) {
        say(`Couldn't update ${item.menuItemName}. ${updateError?.message || 'Please try again.'}`, true);
        draw();
        return;
      }

      items = items.map((i) => (i.menuItemIdentifier === item.menuItemIdentifier ? { ...i, menuItemAvailabilityStatus: next } : i));
      say(`${item.menuItemName} is now ${next ? 'available' : 'sold out'}.`);
      draw();
    });

    // ---------- add / edit form ----------
    const modal = document.getElementById('menu-form-modal');
    const form = document.getElementById('menu-form');
    const nameInput = document.getElementById('menu-form-name');
    const categorySelect = document.getElementById('menu-form-category');
    const newCategoryInput = document.getElementById('menu-form-new-category');
    const priceInput = document.getElementById('menu-form-price');
    const saveBtn = document.getElementById('menu-form-save');
    const cancelBtn = document.getElementById('menu-form-cancel');
    const formError = document.getElementById('menu-form-error');
    let editing = null; // the item being edited, or null when adding
    let saving = false;
    let returnFocusTo = null;

    const fieldError = (field, text = '') => {
      document.getElementById(`menu-form-${field}-error`).textContent = text;
    };
    const clearErrors = () => {
      ['name', 'category', 'price'].forEach((f) => fieldError(f));
      formError.textContent = '';
    };
    const syncNewCategory = () => {
      newCategoryInput.hidden = categorySelect.value !== NEW_CATEGORY;
    };
    const selectedCategory = () => (categorySelect.value === NEW_CATEGORY ? newCategoryInput.value : categorySelect.value);

    function openForm(item) {
      editing = item;
      returnFocusTo = document.activeElement;
      clearErrors();
      document.getElementById('menu-form-title').textContent = item ? `Edit ${item.menuItemName}` : 'Add menu item';
      saveBtn.textContent = item ? 'Save changes' : 'Add item';

      const categories = [...new Set(items.map((i) => i.menuItemCategoryType))];
      categorySelect.innerHTML = categories
        .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
        .join('') + `<option value="${NEW_CATEGORY}">+ New category…</option>`;

      nameInput.value = item ? item.menuItemName : '';
      priceInput.value = item ? Number(item.menuItemPriceAmount).toFixed(2) : '';
      newCategoryInput.value = '';
      categorySelect.value = item ? item.menuItemCategoryType : (categories[0] ?? NEW_CATEGORY);
      syncNewCategory();

      saving = false;
      saveBtn.disabled = false;
      modal.hidden = false;
      nameInput.focus();
    }

    function closeForm() {
      if (saving) return;
      modal.hidden = true;
      editing = null;
      if (returnFocusTo && typeof returnFocusTo.focus === 'function') returnFocusTo.focus();
    }

    document.getElementById('menu-add-btn').addEventListener('click', () => openForm(null));
    cancelBtn.addEventListener('click', closeForm);
    categorySelect.addEventListener('change', syncNewCategory);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeForm(); });
    modal.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeForm(); });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (saving) return; // double-tap protection
      clearErrors();

      const others = items.filter((i) => !editing || i.menuItemIdentifier !== editing.menuItemIdentifier);
      const { errors, values } = validateMenuItemForm(
        { name: nameInput.value, category: selectedCategory(), price: priceInput.value },
        others,
      );
      if (Object.keys(errors).length) {
        Object.entries(errors).forEach(([field, text]) => fieldError(field, text));
        const first = ['name', 'category', 'price'].find((f) => errors[f]);
        ({ name: nameInput, category: categorySelect, price: priceInput })[first].focus();
        return;
      }

      saving = true;
      saveBtn.disabled = true;
      cancelBtn.disabled = true;

      let result;
      if (editing) {
        const patch = {};
        if (values.name !== editing.menuItemName) patch.menuItemName = values.name;
        if (values.category !== editing.menuItemCategoryType) patch.menuItemCategoryType = values.category;
        if (values.price !== Number(editing.menuItemPriceAmount)) patch.menuItemPriceAmount = values.price;
        if (Object.keys(patch).length === 0) {
          saving = false;
          cancelBtn.disabled = false;
          closeForm();
          return;
        }
        result = await updateMenuItem(editing.menuItemIdentifier, patch);
      } else {
        result = await createMenuItem({
          menuItemName: values.name,
          menuItemCategoryType: values.category,
          menuItemPriceAmount: values.price,
          menuItemAvailabilityStatus: true,
        });
      }

      saving = false;
      cancelBtn.disabled = false;
      saveBtn.disabled = false;

      if (result.error || !result.data) {
        // Keep the form open with what they typed so nothing is lost.
        formError.textContent = result.error?.message || 'Could not save the menu item. Please try again.';
        return;
      }

      const saved = result.data;
      const wasEditing = Boolean(editing);
      items = wasEditing
        ? items.map((i) => (i.menuItemIdentifier === saved.menuItemIdentifier ? saved : i))
        : [...items, saved];
      items.sort((a, b) => String(a.menuItemCategoryType).localeCompare(String(b.menuItemCategoryType)));
      closeForm();
      say(wasEditing ? `Saved changes to ${saved.menuItemName}.` : `Added ${saved.menuItemName} to the menu.`);
      draw();
    });
  },

  // Group the flat item list into { [category]: item[] }.
  // Field names are camelCase — backend/services/menu.js maps the DB columns.
  groupByCategory(items) {
    return items.reduce((groups, item) => {
      const category = item.menuItemCategoryType;
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
      return groups;
    }, {});
  },

  // One section per category, one row per item with Edit and an on/off switch.
  generateMenuHTML(categorizedItems) {
    return Object.entries(categorizedItems)
      .map(([category, items]) => {
        const rows = items
          .map((item) => {
            const on = Boolean(item.menuItemAvailabilityStatus);
            const id = escapeHtml(item.menuItemIdentifier);
            return `
              <li class="menu-admin-row${on ? '' : ' is-off'}">
                <div class="menu-admin-info">
                  <span class="menu-admin-name">${escapeHtml(item.menuItemName)}</span>
                  <span class="menu-admin-price">${formatPrice(item.menuItemPriceAmount)}</span>
                </div>
                <span class="menu-admin-status">${on ? 'Available' : 'Sold out'}</span>
                <button type="button" class="menu-edit-btn btn-ghost" data-item-id="${id}"
                  aria-label="Edit ${escapeHtml(item.menuItemName)}">Edit</button>
                <button type="button" class="menu-toggle${on ? ' is-on' : ''}" role="switch"
                  aria-checked="${on}" aria-label="${escapeHtml(item.menuItemName)} available"
                  data-item-id="${id}">
                  <span class="menu-toggle-knob"></span>
                </button>
              </li>`;
          })
          .join('');

        return `
          <section class="menu-admin-category">
            <h3>${escapeHtml(category)}</h3>
            <ul class="menu-admin-list">${rows}</ul>
          </section>`;
      })
      .join('');
  },
};

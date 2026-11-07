// staff-manager.js — Staff screen (admin only)
//
// POS-55: see every staff account and deactivate one, so the admin can
//         manage the team.
// POS-74: reactivate a deactivated account and change a role, so mistakes
//         can be fixed without the SQL Editor.
//
// Backend operations (see API_CONTRACT_additions.md):
//   listStaffAccounts()                 staff.js
//   deactivateStaffAccount(id)          staff.js
//   updateStaffAccount(id, updates)     staff.js
//     reactivate:   updates = { staffAccountStatus: true }
//     change role:  updates = { staffRoleType: 'Admin' | 'Barista' }
//
// The signed-in admin can't deactivate themselves or change their own role
// (they would lock themselves out); the backend should refuse that too.
// Deactivating and changing a role ask for confirmation first.

import { listStaffAccounts, deactivateStaffAccount, updateStaffAccount } from './backend/services/staff.js';
import { callService } from './admin-common.js';

const ROLES = ['Barista', 'Admin'];

export const staffManagerScreen = {
  render() {
    return `
      <div class="screen-container">
        <h2>Staff</h2>
        <p id="staff-status" role="status"></p>
        <ul id="staff-list" class="order-list"></ul>
      </div>
    `;
  },

  async init(navigate, currentOrder, staffId) {
    const list = document.getElementById('staff-list');
    const status = document.getElementById('staff-status');

    function showError(message) {
      status.className = 'error';
      status.textContent = message;
    }

    function roleSelect(account) {
      const select = document.createElement('select');
      select.className = 'staff-role-select';
      select.dataset.staffId = account.staffAccountIdentifier;
      select.setAttribute('aria-label', `Role for ${account.staffFullName}`);
      select.style.minHeight = '44px';
      // keep an unexpected role visible instead of silently showing the first option
      const roles = ROLES.includes(account.staffRoleType) ? ROLES : [...ROLES, account.staffRoleType];
      for (const role of roles) {
        const option = document.createElement('option');
        option.value = role;
        option.textContent = role;
        select.appendChild(option);
      }
      select.value = account.staffRoleType;
      select.addEventListener('change', () => changeRole(account, select));
      return select;
    }

    function actionButton(className, label, account, onClick) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `add-btn ${className}`;
      btn.dataset.staffId = account.staffAccountIdentifier;
      btn.textContent = label;
      btn.addEventListener('click', () => onClick(account, btn));
      return btn;
    }

    function render(accounts) {
      list.innerHTML = '';
      if (!accounts.length) {
        list.innerHTML = '<li class="order-empty">No staff accounts.</li>';
        return;
      }

      for (const account of accounts) {
        const active = account.staffAccountStatus === true;
        const isSelf = account.staffAccountIdentifier === staffId;
        const li = document.createElement('li');
        li.className = 'order-line';

        const info = document.createElement('div');
        const name = document.createElement('p');
        name.className = 'order-line-name';
        name.textContent = account.staffFullName;
        const detail = document.createElement('p');
        detail.className = 'order-line-detail';
        detail.textContent = [account.staffRoleType, account.staffEmailAddress, active ? 'Active' : 'Deactivated']
          .filter(Boolean).join(' · ');
        info.append(name, detail);
        li.appendChild(info);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;align-items:center;gap:8px';
        if (!isSelf) {
          actions.appendChild(roleSelect(account));
          actions.appendChild(active
            ? actionButton('staff-deactivate-btn', 'Deactivate', account, deactivate)
            : actionButton('staff-reactivate-btn', 'Reactivate', account, reactivate));
        }
        li.appendChild(actions);

        list.appendChild(li);
      }
    }

    async function load() {
      const { data, error } = await callService(listStaffAccounts, 'Staff accounts');
      if (!document.body.contains(list)) return; // screen was left while loading
      if (error) {
        showError(error.message);
        return;
      }
      render(data ?? []);
    }

    // Run one change, then reload so the list (and every control) shows the saved state.
    async function save(control, what, service, ...args) {
      control.disabled = true;
      status.className = '';
      status.textContent = '';

      const { error } = await callService(service, what, ...args);
      if (error) showError(error.message);
      await load();
    }

    async function deactivate(account, btn) {
      if (btn.disabled) return;
      if (!window.confirm(`Deactivate ${account.staffFullName}? They won't be able to log in.`)) return;
      btn.textContent = 'Saving…';
      await save(btn, 'Deactivating staff', deactivateStaffAccount, account.staffAccountIdentifier);
    }

    async function reactivate(account, btn) {
      if (btn.disabled) return;
      btn.textContent = 'Saving…';
      await save(btn, 'Reactivating staff', updateStaffAccount,
        account.staffAccountIdentifier, { staffAccountStatus: true });
    }

    async function changeRole(account, select) {
      const newRole = select.value;
      if (select.disabled || newRole === account.staffRoleType) return;
      if (!window.confirm(`Change ${account.staffFullName} from ${account.staffRoleType} to ${newRole}?`)) {
        select.value = account.staffRoleType; // put it back
        return;
      }
      await save(select, 'Changing role', updateStaffAccount,
        account.staffAccountIdentifier, { staffRoleType: newRole });
    }

    await load();
  },
};
// staff-manager.js — Staff screen (admin only)
//
// POS-55: see every staff account and deactivate one, so the admin can
//         manage the team.
//
// Backend operations (see API_CONTRACT_additions.md):
//   listStaffAccounts()                 staff.js
//   deactivateStaffAccount(id)          staff.js
//
// Deactivating is not undoable from this screen, so it asks for
// confirmation first. The signed-in admin can't deactivate themselves
// (they would lock themselves out); the backend should refuse that too.

import { listStaffAccounts, deactivateStaffAccount } from './backend/services/staff.js';
import { callService } from './admin-common.js';

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

    function render(accounts) {
      list.innerHTML = '';
      if (!accounts.length) {
        list.innerHTML = '<li class="order-empty">No staff accounts.</li>';
        return;
      }

      for (const account of accounts) {
        const active = account.staffAccountStatus === true;
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

        const isSelf = account.staffAccountIdentifier === staffId;
        if (active && !isSelf) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'add-btn staff-deactivate-btn';
          btn.dataset.staffId = account.staffAccountIdentifier;
          btn.textContent = 'Deactivate';
          btn.addEventListener('click', () => deactivate(account, btn));
          li.appendChild(btn);
        }

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

    async function deactivate(account, btn) {
      if (btn.disabled) return;
      if (!window.confirm(`Deactivate ${account.staffFullName}? They won't be able to log in.`)) return;

      btn.disabled = true;
      btn.textContent = 'Saving…';
      status.className = '';
      status.textContent = '';

      const { error } = await callService(deactivateStaffAccount, 'Deactivating staff', account.staffAccountIdentifier);
      if (error) showError(error.message);
      await load();
    }

    await load();
  },
};

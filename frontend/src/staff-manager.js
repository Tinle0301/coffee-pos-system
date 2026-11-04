// staff-manager.js — Staff screen (admin only)

// POS-55: see every staff account and deactivate one, so the admin can manage the team.
// POS 74: reactive account and change a user's role between admin and barista with dropdown menu

import { listStaffAccounts, deactivateStaffAccount } from './backend/services/staff.js';
import { callService } from './admin-common.js';

const ROLES = ['admin', 'barista'];

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
      const select = document.createElement('select'); // create a dropdown for changing the staff role
      select.classname = 'staff-role-select'; // set the class for styling the dropdown
      select.dataset.staffId = account.staffAccountIdentifier; // 
      select.setAttribute('aria-label', `Change role for ${account.staffFullName}`);
      select.style.minHeight = '44px';

      const roles = ROLES.includes(account.staffRoleType) ? ROLES : ROLES.filter(role => role !== account.staffRoleType); // include current role if it exists, otherwise exclude it
      
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
    // 
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
        const itself = account.staffAccountIdentifier === staffId; // check if the account is the current staff member
        const li = document.createElement('li');
        li.className = 'order-line';

        const info = document.createElement('div');
        const name = document.createElement('p');
        name.className = 'order-line-name';
        name.textContent = account.staffFullName;
        const detail = document.createElement('p');
        detail.className = 'order-line-detail';
        detail.textContent = [account.staffRoleType, account.staffEmailAddress, active ? 'Active' : 'Deactivated'].filter(Boolean).join(' · ');
        info.append(name, detail);
        li.appendChild(info);

        const actions = document.createElement('div');
        actions.style.cssTest = 'display:flex; alight-items:centre;gap:8px';
        if (!itself) {
          actions.appendChild(roleSelect(account));
          actions.appendChild(active
            ? actionButton('staff-deactivate-btn', 'Deactivate', account, deactivate)
            : actionButton('staff-activate-btn', 'Activate', account, reactivate)
          );
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

    async function save(control,what, service, ...args) {
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
      btn.textContent = 'Saving…'; // to indicate the action is in progress
      await save(btn, 'Deactivating staff', deactivateStaffAccount, account.staffAccountIdentifier);
    }
    async function reactivate(account, btn) {
      if (btn.disabled) return;
      btn.textContent = 'Saving…';
      await save(btn, 'Reactivating staff', reactivateStaffAccount, updateStaffAccount, account.staffAccountIdentifier, { staffAccount: true});
    }

    async function changeRole(account,select) {
      const newRole = select.value;
      if (select.disabled || newRole === account.staffRoleType) return;
      if (!window.confirm(`Change role of ${account.staffFullName} from ${account.staffRoleType} to ${newRole}?`)) {
        select.value = account.staffRoleType;
      return;
      }
      
      await save(select, 'Changing role', updateStaffAccount, account.staffAccountIdentifier, { staffRoleType: newRole });
    }

    await load();
  },
};

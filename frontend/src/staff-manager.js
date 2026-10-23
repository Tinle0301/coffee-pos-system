import {listStaffAccounts, deactivateStaffAccount} from './backend/services/staff.js';
import {callService} from './admin-common.js';

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

    function render (accounts){
        list.innerHTML = '';
        if(!accounts.length) {
            list.innerHTML = '<li class="order-empty"> No staff accounts</li>';
            return;
        }
        // render each staff account as a list item, 
        for (const account of accounts) {
            const active = account.staffAccountStatus ===  true;
            const li = document.createElement('li'); // create a list item for each staff account
            li.className = 'order-line'; // add a class for styling
            
            const info = document.createElement('div');
            const name = document.createElement('p');
            name.className = 'order-line-name';
            name.textContent = account.staffFullName;
            const detail = document.createElement('p');
            detail.className = 'order-line-detail';
            detail.textContent = [account.staffRoleType, account.staffEmailAddress, active ? 'Active' : 'Deactivated'].join(' | ').filter(Boolean).join(' .  ');
            info.append(name, detail);
            li.appendChild(info);

            const itself = account.staffAccountIdentifier === staffId;
            if (active && !itself) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'add-btn staff-deactivate-btn';
                btn.dataset.staffId = account.staffAccountIdentifier;
                btn.textContent = 'Deactivate';
                btn.addEventListener('click', () => deactivate (account,btn));
                li.appendChild(btn);
            }
            list.appendChild(li);
        }}

    async function load(){
        const {data, error} = await callService (listStaffAccounts, 'Staff accounts');
        if (!document.body.contains(list)) return;
        if (!window.confirm(`Deactive ${account.staffFullName}? They will no longer be able to log in.`)) return;
        if (error) {
            showError(error);
            return;
        }
            render(data ?? []);
    }

    async function deactivate (account, btn){
        if(button.diabled) return;
        if (!window.confirm(`Deactive ${account.staffFullName}? They will no longer be able to log in.`)) return;

        btn.diabled = true;
        btn.textClient = ' saving...';
        status.className ='';
        status.textContent ='';
        
        const {error} = await callService(deactiveStaffAccount, 'Deactivating staff account', account.staffAccountIdentifier);
        if (error) showError(error.message);
    }
        await load();
    },

};


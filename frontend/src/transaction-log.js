import {listTransactionLog} from './backend/services/transactions.js';
import {listStaffAccounts} from './backend/services/staff.js';
import {callService, formatDateTime} from './admin-common.js';


export function buildFilters({orderId,from,to}) {
    const filters = [];
    if (orderId?.trim()) filters.orderId = orderId.trim();
    if (from)  filters.from = from;
    if (to) filters.to = to;
    return filters;
}

export const transactionLogScreen = {
    render() {
        return `
        `
    }
}
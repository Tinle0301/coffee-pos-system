# API Contract

**This is THE handshake between frontend/ and backend/.** It is
language-neutral on purpose — a Python frontend (option C in
[FRONTEND_DECISION.md](FRONTEND_DECISION.md)) could implement the same
contract against Supabase directly with `supabase-py`, without touching a
line of `backend/services/`. This document is the source of truth, not the
JS files in `backend/services/`.

**Changing an operation here requires telling the other sub-team before
merging.** See [WORKFLOW.md](WORKFLOW.md) and the PR template checkbox
"this changes the API contract" (two reviews required when checked).

Each operation below: name, inputs (with types), return shape, errors, and
which screen calls it.

---

## Operation format

```
### OperationName
- **Screen(s):** which screen(s) call this
- **Backend module:** backend/services/<file>.js
- **Input:**
  - fieldName: type — description
- **Returns:** shape
- **Errors:** condition -> error
```

---

### CreateNewOrder
- **Screen(s):** New Order
- **Backend module:** `backend/services/orders.js` (calls the
  `create_order` database function)
- **Input:**
  - items: `Array<{ menuItemIdentifier: string, quantity: number, customization?: string }>`
  - staffId: `string` (uuid) — the authenticated barista's staff account id
- **Returns:**
  ```json
  {
    "orderIdentifier": "uuid",
    "orderStatusType": "Pending",
    "orderSubtotalAmount": 7.25,
    "orderTaxAmount": 0.65,
    "orderTotalAmount": 7.90,
    "orderCreationTimestamp": "2026-01-01T12:00:00Z",
    "createdByStaffIdentifier": "uuid"
  }
  ```
- **Errors:**
  - `items` is empty -> `INVALID_ORDER: order must contain at least one item`
  - a `menuItemIdentifier` does not exist or is unavailable -> `MENU_ITEM_UNAVAILABLE`
  - caller is not an authenticated barista/admin -> `UNAUTHORIZED`

### AddOrderItem
- **Screen(s):** New Order, Modify Order
- **Backend module:** `backend/services/orderItems.js`
- **Input:**
  - orderId: `string` (uuid)
  - item: `{ menuItemIdentifier: string, quantity: number, customization?: string }`
- **Returns:**
  ```json
  {
    "orderItemIdentifier": "uuid",
    "associatedOrderIdentifier": "uuid",
    "associatedMenuItemIdentifier": "uuid",
    "orderedItemQuantity": 2,
    "itemCustomizationDescription": "oat milk",
    "itemPriceAmount": 4.50
  }
  ```
- **Errors:**
  - `quantity <= 0` -> `INVALID_QUANTITY`
  - order is not in `Pending` status -> `ORDER_NOT_MODIFIABLE`
  - caller does not own the order and is not admin -> `UNAUTHORIZED`

### UpdateOrderStatus
- **Screen(s):** Active Orders Queue, Checkout
- **Backend module:** `backend/services/orderStatus.js` (calls the
  `update_order_status` database function)
- **Input:**
  - orderId: `string` (uuid)
  - newStatus: `'Pending' | 'In Progress' | 'Completed' | 'Cancelled'`
- **Returns:** `{ orderIdentifier: string, orderStatusType: string }`
- **Errors:**
  - transition is not legal from the current status -> `INVALID_STATUS_TRANSITION`
  - order does not exist -> `ORDER_NOT_FOUND`
  - caller is not an authenticated barista/admin -> `UNAUTHORIZED`

---

## Remaining operations (signatures TBD as they're implemented)

Fill in an entry per operation as each screen is built, following the
format above. Placeholder list from `backend/services/`:

- ModifyExistingOrder, CancelExistingOrder, RetrieveOrderByIdentifier
  (`orders.js`)
- MarkOrderAsInProgress (`orderStatus.js`)
- UpdateOrderItemQuantity, RemoveOrderItem, ViewOrderItems (`orderItems.js`)
- processPayment, getPayment (`payments.js`)
- processRefund (`refunds.js`)
- listTransactionLogs (`transactions.js`)
- listMenuItems, createMenuItem, updateMenuItem, deleteMenuItem (`menu.js`)
- listInventoryItems, createInventoryItem, updateInventoryItem
  (`inventory.js`)
- listActiveQueueEntries, subscribeToQueue (`queue.js`)
- generateSalesReport, listSalesReports (`reports.js`)
- exportReportAsCsv, exportReportAsPdf (`exports.js`)
- login, logout, session (`auth.js`)
- createStaffAccount, updateStaffAccount, deactivateStaffAccount,
  listStaffAccounts (`staff.js`)

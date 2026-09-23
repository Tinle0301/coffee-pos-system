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

## Return shape — every operation, no exceptions

Every function in `backend/services/` returns:

```js
{ data: <result> | null, error: { code: string, message: string } | null }
```

It never throws and never returns a bare value. The frontend checks `error`
first, every time:

```js
const { data, error } = await login(email, password)
if (error) { show(error.message); return }
```

- `code` is stable and safe to branch on in code (`INVALID_CREDENTIALS`)
- `message` is safe to show a barista as-is — it never reveals whether an
  account exists, or leaks a raw database error

"Nothing found" is **not** an error. `session()` with nobody signed in returns
`{ data: null, error: null }`, because that is a normal answer to a normal
question.

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

### RetrieveOrderByIdentifier
- **Screen(s):** New Order, Modify Order, Checkout, Active Orders Queue
- **Backend module:** `backend/services/orders.js`
- **Input:**
  - orderId: `string` (uuid)
- **Returns:** same shape as `CreateNewOrder`
- **Errors:**
  - no order with that id -> `ORDER_NOT_FOUND`

### CancelExistingOrder
- **Screen(s):** Active Orders Queue
- **Backend module:** `backend/services/orders.js` (calls the
  `cancel_order` database function)
- **Input:**
  - orderId: `string` (uuid)
- **Returns:** `null`
- **Errors:**
  - order already has a completed payment, does not exist, or caller is not
    authorized -> `CANCEL_FAILED` (the database function does not yet
    distinguish these — see `cancel_order` in `0003_functions.sql`, still a
    stub as of POS-8/POS-9)

### UpdateOrderItemQuantity
- **Screen(s):** Modify Order
- **Backend module:** `backend/services/orderItems.js`
- **Input:**
  - orderItemId: `string` (uuid)
  - quantity: `number`
- **Returns:** same shape as `AddOrderItem`
- **Errors:**
  - `quantity <= 0` -> `INVALID_QUANTITY`
  - no order item with that id -> `ORDER_ITEM_NOT_FOUND`
  - parent order is not in `Pending` status -> `ORDER_NOT_MODIFIABLE`
  - caller does not own the parent order and is not admin -> `UNAUTHORIZED`

### RemoveOrderItem
- **Screen(s):** Modify Order
- **Backend module:** `backend/services/orderItems.js`
- **Input:**
  - orderItemId: `string` (uuid)
- **Returns:** `null`
- **Errors:**
  - no order item with that id -> `ORDER_ITEM_NOT_FOUND`
  - parent order is not in `Pending` status -> `ORDER_NOT_MODIFIABLE`
  - caller does not own the parent order and is not admin -> `UNAUTHORIZED`

### ViewOrderItems
- **Screen(s):** New Order, Modify Order, Checkout
- **Backend module:** `backend/services/orderItems.js`
- **Input:**
  - orderId: `string` (uuid)
- **Returns:** `Array<>` of the same shape as `AddOrderItem` (empty array if the order has no items)
- **Errors:** none beyond the generic `LOOKUP_FAILED`

### listMenuItems
- **Screen(s):** New Order, Menu Management
- **Backend module:** `backend/services/menu.js`
- **Input:** none
- **Returns:** `Array<{ menuItemIdentifier, menuItemName, menuItemCategoryType, menuItemDescriptionText, menuItemPriceAmount, menuItemAvailabilityStatus }>`, ordered by category
- **Errors:** none beyond the generic `LOOKUP_FAILED`

### createMenuItem
- **Screen(s):** Menu Management
- **Backend module:** `backend/services/menu.js`
- **Input:**
  - item: `{ menuItemName: string, menuItemCategoryType: string, menuItemDescriptionText?: string, menuItemPriceAmount: number, menuItemAvailabilityStatus?: boolean }`
- **Returns:** the created menu item, same shape as `listMenuItems` rows
- **Errors:**
  - missing name or price, or price `< 0` -> `INVALID_MENU_ITEM`
  - caller is not admin -> `UNAUTHORIZED`

### updateMenuItem
- **Screen(s):** Menu Management
- **Backend module:** `backend/services/menu.js`
- **Input:**
  - menuItemId: `string` (uuid)
  - updates: `Partial<>` of `createMenuItem`'s item shape
- **Returns:** the updated menu item
- **Errors:**
  - price `< 0` -> `INVALID_MENU_ITEM`
  - id doesn't exist, or caller is not admin -> `MENU_ITEM_NOT_FOUND` (deliberately the same for both, same reasoning as `login`)

### deleteMenuItem
- **Screen(s):** Menu Management
- **Backend module:** `backend/services/menu.js`
- **Input:**
  - menuItemId: `string` (uuid)
- **Returns:** `null`
- **Errors:**
  - id doesn't exist, or caller is not admin -> `MENU_ITEM_NOT_FOUND`

---

## Remaining operations (signatures TBD as they're implemented)

Fill in an entry per operation as each screen is built, following the
format above. Placeholder list from `backend/services/`:

- ModifyExistingOrder (`orders.js`) — not implemented yet; see the comment
  in `orders.js` for why (item-level and status changes already have
  homes elsewhere, order-level "changes" doesn't have settled semantics)
- MarkOrderAsInProgress (`orderStatus.js`)
- processPayment, getPayment (`payments.js`)
- processRefund (`refunds.js`)
- listTransactionLogs (`transactions.js`)
- listInventoryItems, createInventoryItem, updateInventoryItem
  (`inventory.js`)
- listActiveQueueEntries, subscribeToQueue (`queue.js`)
- generateSalesReport, listSalesReports (`reports.js`)
- exportReportAsCsv, exportReportAsPdf (`exports.js`)
- login, logout, session (`auth.js`)
- createStaffAccount, updateStaffAccount, deactivateStaffAccount,
  listStaffAccounts (`staff.js`)

---

## Authentication — `backend/services/auth.js`

Implemented (POS-5). Used by the Login screen (POS-10) and every screen that
has to know who is signed in.

### login
- **Screen(s):** Login
- **Input:**
  - email: `string`
  - password: `string`
- **Returns:**
  ```json
  {
    "staffAccountIdentifier": "uuid",
    "staffFullName": "Test Barista",
    "staffRoleType": "Barista",
    "staffEmailAddress": "barista@test.com"
  }
  ```
- **Errors:**
  - missing email or password -> `INVALID_CREDENTIALS: Enter your email and password.`
  - wrong email OR wrong password -> `INVALID_CREDENTIALS: Incorrect email or password.` (deliberately the same for both — anything more specific tells an attacker which emails are real)
  - signed in but no matching `staff_accounts` row -> `NO_STAFF_ACCOUNT`
  - staff account deactivated -> `ACCOUNT_DEACTIVATED` (the session is ended again automatically)

### logout
- **Screen(s):** every screen (logout control), and the inactivity timer
- **Input:** none
- **Returns:** `null`
- **Errors:** `LOGOUT_FAILED: Could not sign out. Try again.`

### session
- **Screen(s):** every screen, on load, before rendering
- **Input:** none
- **Returns:** the same object as `login`, or `null` when nobody is signed in
- **Errors:** `LOOKUP_FAILED`, `NO_STAFF_ACCOUNT`, `ACCOUNT_DEACTIVATED`
- **Note:** nobody signed in is `{ data: null, error: null }` — not an error

### isAdmin
- **Screen(s):** navigation, to decide whether to draw admin links
- **Returns:** `boolean`
- **NOT a security control.** Authorization is enforced by the RLS policies
  (POS-7). This only decides what the UI bothers to render — hiding a button
  never stops a request.

### onAuthChange
- **Screen(s):** any screen that should react to signing out, including from
  another browser tab
- **Input:** `callback(staff | null)`
- **Returns:** an unsubscribe function

---

## Session timeout — `backend/services/sessionTimeout.js`

Implemented (POS-6). Ten minutes, from the SRS.

### startSessionTimeout
- **Screen(s):** call once after login, and on any page load that already has a session
- **Input:**
  - callback: `() => void` — runs after the session has been ended (usually a redirect to login)
  - idleLimitMs: `number` — optional, tests only
- **Returns:** nothing
- **Activity counted:** pointerdown, keydown, touchstart, wheel

### stopSessionTimeout
- Call on manual logout, so the timer stops running against a dead session.

**Note for reviewers:** the check is a 5-second poll comparing timestamps, not
one long `setTimeout`. A closed laptop lid or a throttled background tab makes
a single long timer fire late or not at all — which is exactly the case this
feature exists to cover. Comparing `Date.now()` against the last activity means
a machine that slept past the limit signs out on the very next tick.

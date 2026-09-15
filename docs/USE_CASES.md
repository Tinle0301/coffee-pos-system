# Use Cases

All 14 use cases from the approved 491A documentation, with actor and the
`backend/services/` modules each touches.

| # | Use Case | Actor | Services touched |
|---|----------|-------|-------------------|
| 1 | Login/Logout | Barista | `auth.js` |
| 2 | Create Order | Barista | `orders.js` (CreateNewOrder), `orderItems.js`, `queue.js` |
| 3 | Modify Order | Barista | `orders.js` (ModifyExistingOrder), `orderItems.js` |
| 4 | Process Payment | Barista | `payments.js`, `orders.js`, `inventory.js` |
| 5 | Update Order Status | Barista | `orderStatus.js`, `queue.js` |
| 6 | View Menu | Barista | `menu.js` |
| 7 | View Active Orders Queue | Barista | `queue.js` |
| 8 | Manage Menu Items | Admin | `menu.js` |
| 9 | Manage Inventory | Admin | `inventory.js` |
| 10 | View Sales Reports | Admin | `reports.js` |
| 11 | Export Reports | Admin | `exports.js`, `reports.js` |
| 12 | Manage Staff Accounts | Admin | `staff.js` |
| 13 | Process Refund | Admin | `refunds.js`, `transactions.js` |
| 14 | View Transaction Logs | Admin | `transactions.js` |

See [../frontend/README.md](../frontend/README.md) for the screen each use
case maps to, and [API_CONTRACT.md](API_CONTRACT.md) for the operation
signatures.

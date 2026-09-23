# Data Model

The 491A data model as implemented in 491B. The original 'User' concept
is implemented by Supabase Auth ('auth.users') rather than having a
duplicate public 'users' table. The remaining application tables use
camelCase (491A) -> snake_case (Postgres) mappings below.
Schema source: `backend/migrations/0001_schema.sql`.

---

## 1. Users - Supabase Auth

The 491A `User` concept is implemented by Supabase Auth (`auth.users`)
instead of a separate `public.users` table.

Authentication uses email/password through Supabase Auth. Password storage
and hashing are managed by Supabase, so `encryptedPasswordHash` is not stored
in the application schema. The original `usernameCredential` field was
dropped because the 491B implementation authenticates staff by email/password.

Application-specific staff information such as full name, role, email, and
active status is stored in `staff_accounts`.

## 2. staff_accounts

| 491A                  | Postgres                     |
|-------------------------|-----------------------------|
| staffAccountIdentifier (PK) | staff_account_identifier |
| staffFullName          | staff_full_name              |
| staffRoleType           | staff_role_type              |
| staffEmailAddress       | staff_email_address          |
| staffAccountStatus      | staff_account_status         |
| accountCreationTimestamp | account_creation_timestamp |

Example row: see `backend/seed/seed.sql` (`Alex Barista`, `Jamie Admin`).

## 3. orders

| 491A                        | Postgres                        |
|-------------------------------|--------------------------------|
| orderIdentifier (PK)          | order_identifier                |
| orderStatusType                | order_status_type               |
| orderSubtotalAmount             | order_subtotal_amount           |
| orderTaxAmount                   | order_tax_amount                |
| orderTotalAmount                  | order_total_amount              |
| orderCreationTimestamp             | order_creation_timestamp        |
| createdByStaffIdentifier (FK -> staff_accounts) | created_by_staff_identifier |

Relationship: many orders belong to one staff_accounts row (creator).

Example row:
```
order_identifier: 10000000-0000-0000-0000-0000000000b1
order_status_type: Pending
order_subtotal_amount: 7.25
order_tax_amount: 0.65
order_total_amount: 7.90
created_by_staff_identifier: 00000000-0000-0000-0000-000000000001
```

## 4. order_items

| 491A                                  | Postgres                          |
|------------------------------------------|-----------------------------------|
| orderItemIdentifier (PK)                  | order_item_identifier             |
| associatedOrderIdentifier (FK -> orders, cascade) | associated_order_identifier |
| associatedMenuItemIdentifier (FK -> menu_items) | associated_menu_item_identifier |
| orderedItemQuantity                        | ordered_item_quantity             |
| itemCustomizationDescription                | item_customization_description    |
| itemPriceAmount                              | item_price_amount                 |

Relationship: many order_items belong to one order; deleted with their
order (ON DELETE CASCADE). Many order_items reference one menu_items row.

Example row:
```
order_item_identifier: 20000000-0000-0000-0000-0000000000c1
associated_order_identifier: 10000000-0000-0000-0000-0000000000b1
associated_menu_item_identifier: 10000000-0000-0000-0000-000000000002
ordered_item_quantity: 1
item_customization_description: oat milk
item_price_amount: 4.50
```

## 5. payments

| 491A                                | Postgres                          |
|----------------------------------------|-----------------------------------|
| paymentTransactionIdentifier (PK)       | payment_transaction_identifier    |
| associatedOrderIdentifier (FK -> orders) | associated_order_identifier      |
| paymentMethodType                         | payment_method_type               |
| paymentAmountValue                         | payment_amount_value              |
| paymentCompletionStatus                     | payment_completion_status         |
| paymentProcessingTimestamp                   | payment_processing_timestamp      |

Example row:
```
payment_transaction_identifier: 30000000-0000-0000-0000-0000000000d1
associated_order_identifier: 10000000-0000-0000-0000-0000000000b1
payment_method_type: Credit/Debit
payment_amount_value: 7.90
payment_completion_status: Completed
```

## 6. refunds

| 491A                                     | Postgres                          |
|----------------------------------------------|-----------------------------------|
| refundTransactionIdentifier (PK)              | refund_transaction_identifier     |
| associatedPaymentIdentifier (FK -> payments)   | associated_payment_identifier    |
| refundAmountValue                               | refund_amount_value               |
| refundTypeCategory                               | refund_type_category              |
| refundProcessingTimestamp                         | refund_processing_timestamp       |

Example row:
```
refund_transaction_identifier: 40000000-0000-0000-0000-0000000000e1
associated_payment_identifier: 30000000-0000-0000-0000-0000000000d1
refund_amount_value: 7.90
refund_type_category: Full
```

## 7. transaction_logs

| 491A                                    | Postgres                          |
|----------------------------------------------|-----------------------------------|
| transactionLogIdentifier (PK)                 | transaction_log_identifier        |
| associatedOrderIdentifier (FK -> orders)       | associated_order_identifier      |
| transactionTypeCategory                          | transaction_type_category         |
| transactionTimestamp                              | transaction_timestamp             |
| performedByStaffIdentifier (FK -> staff_accounts)            | performed_by_staff_identifier    |

Immutable — no client update/delete policy (see
`backend/migrations/0002_rls_policies.sql`).

Example row:
```
transaction_log_identifier: 50000000-0000-0000-0000-0000000000f1
associated_order_identifier: 10000000-0000-0000-0000-0000000000b1
transaction_type_category: order_created
performed_by_staff_identifier: 00000000-0000-0000-0000-0000000000a1
```

## 8. menu_items

| 491A                              | Postgres                          |
|----------------------------------------|-----------------------------------|
| menuItemIdentifier (PK)                 | menu_item_identifier              |
| menuItemName                              | menu_item_name                    |
| menuItemCategoryType                       | menu_item_category_type           |
| menuItemDescriptionText                     | menu_item_description_text        |
| menuItemPriceAmount                          | menu_item_price_amount            |
| menuItemAvailabilityStatus                    | menu_item_availability_status     |

Example row: see `backend/seed/seed.sql` ("Latte", $4.50).

## 9. inventory_items

| 491A                                  | Postgres                          |
|----------------------------------------|-----------------------------------|
| inventoryItemIdentifier (PK)            | inventory_item_identifier         |
| inventoryItemName                         | inventory_item_name               |
| availableQuantityValue                      | available_quantity_value          |
| minimumStockThreshold                         | minimum_stock_threshold           |
| inventoryLastUpdatedTimestamp                   | inventory_last_updated_timestamp  |

Example row: see `backend/seed/seed.sql` ("Espresso Beans (lb)", 25).

## 10. queue_entries

| 491A                                | Postgres                          |
|----------------------------------------|-----------------------------------|
| queueEntryIdentifier (PK)               | queue_entry_identifier            |
| associatedOrderIdentifier (FK -> orders) | associated_order_identifier      |
| queueEntryStatusType                       | queue_entry_status_type           |
| queueEntryTimestamp                          | queue_entry_timestamp             |

Example row:
```
queue_entry_identifier: 60000000-0000-0000-0000-0000000000g1
associated_order_identifier: 10000000-0000-0000-0000-0000000000b1
queue_entry_status_type: Pending
```

## 11. sales_reports

| 491A                              | Postgres                          |
|----------------------------------------|-----------------------------------|
| reportIdentifier (PK)                   | report_identifier                 |
| reportGenerationType                      | report_generation_type            |
| reportStartDate                             | report_start_date                 |
| reportEndDate                                | report_end_date                   |
| totalRevenueAmount                             | total_revenue_amount              |
| reportGeneratedTimestamp                         | report_generated_timestamp        |

Example row:
```
report_identifier: 70000000-0000-0000-0000-0000000000h1
report_generation_type: Daily
report_start_date: 2026-01-01
report_end_date: 2026-01-01
total_revenue_amount: 142.50
```

---

## Relationships summary

```
staff_accounts 1───* orders 1───* order_items *───1 menu_items
                        │
                        ├──1───* payments 1───* refunds
                        │
                        ├──1───* queue_entries
                        │
                        └──1───* transaction_logs *───1 staff_accounts

inventory_items — decremented by checkout_order(), not FK-linked to
order_items (ingredient-to-menu-item mapping is a services-layer concern).
```

-- 0001_schema.sql
-- Coffee POS System — initial schema
-- Source of truth: 491A Class Diagram. Column names are snake_case
-- (Postgres convention); see docs/DATA_MODEL.md for the camelCase mapping
-- back to the approved 491A documentation.
--
-- Schema changes happen ONLY through migration files committed to the repo.
-- Nobody edits tables by hand in the Supabase dashboard.

-- 1. User is implemented by Supabase Auth (auth.users); no public users table.

-- 2. staff_accounts
create table staff_accounts (
  staff_account_identifier uuid primary key default gen_random_uuid(),
  staff_full_name text not null,
  staff_role_type text not null check (staff_role_type in ('Barista', 'Admin')),
  staff_email_address text not null unique,
  staff_account_status boolean not null default true,
  account_creation_timestamp timestamptz not null default now()
);

-- 8. menu_items (created before orders/order_items so FKs can reference it)
create table menu_items (
  menu_item_identifier uuid primary key default gen_random_uuid(),
  menu_item_name text not null,
  menu_item_category_type text not null,
  menu_item_description_text text,
  menu_item_price_amount numeric(10, 2) not null check (menu_item_price_amount >= 0),
  menu_item_availability_status boolean not null default true
);

-- 9. inventory_items
create table inventory_items (
  inventory_item_identifier uuid primary key default gen_random_uuid(),
  inventory_item_name text not null,
  available_quantity_value numeric(10, 2) not null check (available_quantity_value >= 0),
  minimum_stock_threshold numeric(10, 2) not null check (minimum_stock_threshold >= 0),
  inventory_last_updated_timestamp timestamptz not null default now()
);

-- 3. orders
create table orders (
  order_identifier uuid primary key default gen_random_uuid(),
  order_status_type text not null default 'Pending'
    check (order_status_type in ('Pending', 'In Progress', 'Completed', 'Cancelled')),
  order_subtotal_amount numeric(10, 2) not null check (order_subtotal_amount >= 0),
  order_tax_amount numeric(10, 2) not null check (order_tax_amount >= 0),
  order_total_amount numeric(10, 2) not null check (order_total_amount >= 0),
  order_creation_timestamp timestamptz not null default now(),
  created_by_staff_identifier uuid not null references staff_accounts (staff_account_identifier)
);

create index idx_orders_status on orders (order_status_type);
create index idx_orders_creation_timestamp on orders (order_creation_timestamp);

-- 4. order_items
create table order_items (
  order_item_identifier uuid primary key default gen_random_uuid(),
  associated_order_identifier uuid not null references orders (order_identifier) on delete cascade,
  associated_menu_item_identifier uuid not null references menu_items (menu_item_identifier),
  ordered_item_quantity integer not null check (ordered_item_quantity > 0),
  item_customization_description text,
  item_price_amount numeric(10, 2) not null check (item_price_amount >= 0)
);

create index idx_order_items_order on order_items (associated_order_identifier);

-- 5. payments
create table payments (
  payment_transaction_identifier uuid primary key default gen_random_uuid(),
  associated_order_identifier uuid not null references orders (order_identifier),
  payment_method_type text not null
    check (payment_method_type in ('Cash', 'Credit/Debit', 'Mobile Pay')),
  payment_amount_value numeric(10, 2) not null check (payment_amount_value >= 0),
  payment_completion_status text not null,
  payment_processing_timestamp timestamptz not null default now()
);

create index idx_payments_order on payments (associated_order_identifier);

-- 6. refunds
create table refunds (
  refund_transaction_identifier uuid primary key default gen_random_uuid(),
  associated_payment_identifier uuid not null references payments (payment_transaction_identifier),
  refund_amount_value numeric(10, 2) not null check (refund_amount_value >= 0),
  refund_type_category text not null
    check (refund_type_category in ('Full', 'Partial')),
  refund_processing_timestamp timestamptz not null default now()
);

-- 7. transaction_logs
create table transaction_logs (
  transaction_log_identifier uuid primary key default gen_random_uuid(),
  associated_order_identifier uuid not null references orders (order_identifier),
  transaction_type_category text not null,
  transaction_timestamp timestamptz not null default now(),
  performed_by_staff_identifier uuid not null
    references staff_accounts (staff_account_identifier)
);

-- 10. queue_entries
create table queue_entries (
  queue_entry_identifier uuid primary key default gen_random_uuid(),
  associated_order_identifier uuid not null references orders (order_identifier),
  queue_entry_status_type text not null
    check (queue_entry_status_type in ('Pending', 'In Progress')),
  queue_entry_timestamp timestamptz not null default now()
);

-- 11. sales_reports
create table sales_reports (
  report_identifier uuid primary key default gen_random_uuid(),
  report_generation_type text not null
    check (report_generation_type in ('Daily', 'Weekly', 'Monthly')),
  report_start_date date not null,
  report_end_date date not null,
  total_revenue_amount numeric(10, 2) not null check (total_revenue_amount >= 0),
  report_generated_timestamp timestamptz not null default now()
);

-- seed.sql
-- Deterministic sample data for local development and testing.
-- Run AFTER migrations. NOT for production use — all data is fake.
--
-- Re-runnable: truncating first means anyone can reset to a known state.
-- Expected values are documented in docs/TESTING.md — if you change anything
-- here, update that file in the same commit or testers will chase ghosts.

truncate table
  transaction_logs, refunds, payments, queue_entries, order_items, orders,
  sales_reports, inventory_items, menu_items, staff_accounts, users
restart identity cascade;

-- ── users (auth records) ────────────────────────────────────────────────
insert into users (user_identifier, username_credential, encrypted_password_hash, user_email_address, user_role_type, account_active_status)
values
  ('00000000-0000-0000-0000-000000000001', 'barista',  'seed-not-a-real-hash', 'barista@test.com',  'Barista', true),
  ('00000000-0000-0000-0000-000000000002', 'admin',    'seed-not-a-real-hash', 'admin@test.com',    'Admin',   true),
  ('00000000-0000-0000-0000-000000000003', 'barista2', 'seed-not-a-real-hash', 'barista2@test.com', 'Barista', true);

-- ── staff_accounts ──────────────────────────────────────────────────────
-- IDs match the users above AND must match the Supabase Auth user ids, since
-- RLS resolves auth.uid() against staff_account_identifier.
insert into staff_accounts (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address, staff_account_status)
values
  ('00000000-0000-0000-0000-000000000001', 'Test Barista',   'Barista', 'barista@test.com',  true),
  ('00000000-0000-0000-0000-000000000002', 'Test Admin',     'Admin',   'admin@test.com',    true),
  ('00000000-0000-0000-0000-000000000003', 'Test Barista 2', 'Barista', 'barista2@test.com', true);

-- ── menu_items ──────────────────────────────────────────────────────────
-- 16 items. Two are unavailable on purpose so the out-of-stock display can be
-- tested. Prices are chosen so tax math is checkable by hand:
--   $4.00 at 10.25% -> $0.41 tax -> $4.41 total
insert into menu_items (menu_item_identifier, menu_item_name, menu_item_category_type, menu_item_description_text, menu_item_price_amount, menu_item_availability_status)
values
  ('10000000-0000-0000-0000-000000000001', 'Espresso',          'Espresso', 'Double shot',                  3.00, true),
  ('10000000-0000-0000-0000-000000000002', 'Americano',         'Espresso', 'Espresso and hot water',       3.50, true),
  ('10000000-0000-0000-0000-000000000003', 'Latte',             'Espresso', 'Espresso with steamed milk',   4.00, true),
  ('10000000-0000-0000-0000-000000000004', 'Cappuccino',        'Espresso', 'Equal parts espresso and foam',4.00, true),
  ('10000000-0000-0000-0000-000000000005', 'Flat White',        'Espresso', 'Microfoam, double ristretto',  4.50, true),
  ('10000000-0000-0000-0000-000000000006', 'Mocha',             'Espresso', 'Espresso, chocolate, milk',    5.00, true),
  ('10000000-0000-0000-0000-000000000007', 'Cortado',           'Espresso', 'Equal parts espresso and milk',4.00, false),
  ('10000000-0000-0000-0000-000000000008', 'Drip Coffee',       'Brewed',   'House blend, hot',             2.50, true),
  ('10000000-0000-0000-0000-000000000009', 'Cold Brew',         'Brewed',   'Steeped 18 hours',             4.00, true),
  ('10000000-0000-0000-0000-00000000000a', 'Pour Over',         'Brewed',   'Single origin, made to order', 5.00, true),
  ('10000000-0000-0000-0000-00000000000b', 'Vietnamese Coffee', 'Brewed',   'Phin filter, condensed milk',  5.00, true),
  ('10000000-0000-0000-0000-00000000000c', 'Matcha Latte',      'Tea',      'Ceremonial grade matcha',      5.00, true),
  ('10000000-0000-0000-0000-00000000000d', 'Hot Tea',           'Tea',      'Black, green, or herbal',      3.00, true),
  ('10000000-0000-0000-0000-00000000000e', 'Croissant',         'Food',     'Baked in-house daily',         4.00, true),
  ('10000000-0000-0000-0000-00000000000f', 'Blueberry Muffin',  'Food',     'Baked in-house daily',         3.50, true),
  ('10000000-0000-0000-0000-000000000010', 'Avocado Toast',     'Food',     'Sourdough, chili flakes',      9.00, false);

-- ── inventory_items ─────────────────────────────────────────────────────
-- "Oat Milk" is deliberately BELOW its threshold so low-stock display can be
-- tested without editing data first.
insert into inventory_items (inventory_item_identifier, inventory_item_name, available_quantity_value, minimum_stock_threshold)
values
  ('20000000-0000-0000-0000-000000000001', 'Espresso Beans (lb)',  25.00, 5.00),
  ('20000000-0000-0000-0000-000000000002', 'Whole Milk (gal)',     10.00, 3.00),
  ('20000000-0000-0000-0000-000000000003', 'Oat Milk (gal)',        1.00, 4.00),
  ('20000000-0000-0000-0000-000000000004', 'Almond Milk (gal)',     6.00, 2.00),
  ('20000000-0000-0000-0000-000000000005', 'Vanilla Syrup (btl)',   8.00, 2.00),
  ('20000000-0000-0000-0000-000000000006', 'Cups 12oz (each)',    400.00, 100.00);

-- ── orders ──────────────────────────────────────────────────────────────
-- Two pre-existing Pending orders so the queue screen has content before
-- anyone has built the create-order flow.
--   Order A: Latte $4.00 + Drip $2.50       = 6.50 subtotal, 0.67 tax, 7.17 total
--   Order B: Cold Brew $4.00 x2 = $8.00     = 8.00 subtotal, 0.82 tax, 8.82 total
insert into orders (order_identifier, order_status_type, order_subtotal_amount, order_tax_amount, order_total_amount, created_by_staff_identifier)
values
  ('30000000-0000-0000-0000-00000000000a', 'Pending', 6.50, 0.67, 7.17, '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-00000000000b', 'Pending', 8.00, 0.82, 8.82, '00000000-0000-0000-0000-000000000001');

insert into order_items (associated_order_identifier, associated_menu_item_identifier, ordered_item_quantity, item_customization_description, item_price_amount)
values
  ('30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000003', 1, 'Medium, oat milk', 4.00),
  ('30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000008', 1, 'Small, room for milk', 2.50),
  ('30000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000009', 2, 'Large, no ice', 4.00);

insert into queue_entries (associated_order_identifier, queue_entry_status_type)
values
  ('30000000-0000-0000-0000-00000000000a', 'Pending'),
  ('30000000-0000-0000-0000-00000000000b', 'Pending');

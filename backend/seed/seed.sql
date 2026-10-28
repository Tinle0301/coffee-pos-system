-- seed.sql
-- Sample data for local development. Run after migrations.
-- NOT for production use.

insert into staff_accounts (staff_account_identifier, staff_full_name, staff_role_type, staff_email_address, staff_account_status)
values
  ('00000000-0000-0000-0000-000000000001', 'Alex Barista', 'Barista', 'alex.barista@example.com', true),
  ('00000000-0000-0000-0000-000000000002', 'Jamie Admin', 'Admin', 'jamie.admin@example.com', true);

insert into menu_items (menu_item_identifier, menu_item_name, menu_item_category_type, menu_item_description_text, menu_item_price_amount, menu_item_availability_status)
values
  ('10000000-0000-0000-0000-000000000001', 'Drip Coffee', 'Coffee', 'House blend, hot', 2.75, true),
  ('10000000-0000-0000-0000-000000000002', 'Latte', 'Coffee', 'Espresso with steamed milk', 4.50, true),
  ('10000000-0000-0000-0000-000000000003', 'Blueberry Muffin', 'Pastry', 'Baked in-house', 3.25, true);

insert into inventory_items (inventory_item_identifier, inventory_item_name, available_quantity_value, minimum_stock_threshold)
values
  ('20000000-0000-0000-0000-000000000001', 'Espresso Beans (lb)', 25, 5),
  ('20000000-0000-0000-0000-000000000002', 'Whole Milk (gal)', 10, 2),
  ('20000000-0000-0000-0000-000000000003', 'Blueberry Muffins (each)', 12, 3);

-- POS-20: Base ingredient requirements for each sample menu item.
--
-- For this project, Espresso Beans are used as the bean inventory for
-- both Drip Coffee and espresso-based drinks.
insert into menu_item_ingredients (menu_item_identifier, inventory_item_identifier,quantity_per_item_value)
values
  -- Drip Coffee: Espresso Beans
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 0.04),
  -- Latte: Espresso Beans + Whole Milk
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 0.04),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 0.10),
  -- Blueberry Muffin: one inventory unit per menu item
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003',1.00);

-- POS-48: realistic order/payment history, so reports and the demo have
-- real numbers to show instead of an empty database.
--
-- Timestamps are all `now() - interval` rather than fixed dates, so the
-- data looks "recent" no matter when seed.sql is actually run before a
-- demo. Two extra menu items (Cappuccino, Cold Brew) give more variety
-- across orders than the original three.
insert into menu_items (menu_item_identifier, menu_item_name, menu_item_category_type, menu_item_description_text, menu_item_price_amount, menu_item_availability_status)
values
  ('10000000-0000-0000-0000-000000000004', 'Cappuccino', 'Coffee', 'Espresso, steamed milk, deep foam', 4.75, true),
  ('10000000-0000-0000-0000-000000000005', 'Cold Brew', 'Coffee', 'Steeped 18 hours, served over ice', 4.25, true);

-- 11 historical orders (Completed, paid — some later refunded), 1
-- cancelled order from yesterday, and 2 orders from today (one still
-- Pending, one paid and In Progress) so the live Active Orders Queue has
-- something to show too.
insert into orders (order_identifier, order_status_type, order_subtotal_amount, order_tax_amount, order_total_amount, order_creation_timestamp, created_by_staff_identifier)
values
  ('30000000-0000-0000-0000-000000000001', 'Completed', 8.75, 0.79, 9.54, now() - interval '9 days 1 hour', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', 'Completed', 9.25, 0.83, 10.08, now() - interval '8 days 1 hour', '00000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000003', 'Completed', 8.25, 0.74, 8.99, now() - interval '7 days 2 hours', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000004', 'Completed', 7.50, 0.68, 8.18, now() - interval '7 days 1 hour', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000005', 'Completed', 9.00, 0.81, 9.81, now() - interval '6 days 2 hours', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000006', 'Completed', 7.50, 0.68, 8.18, now() - interval '6 days 1 hour', '00000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000007', 'Completed', 11.00, 0.99, 11.99, now() - interval '5 days 2 hours', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000008', 'Completed', 13.50, 1.22, 14.72, now() - interval '4 days 2 hours', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000009', 'Completed', 6.50, 0.59, 7.09, now() - interval '4 days 1 hour', '00000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000010', 'Completed', 7.25, 0.65, 7.90, now() - interval '3 days 1 hour', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000011', 'Completed', 14.25, 1.28, 15.53, now() - interval '2 days 1 hour', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000012', 'Cancelled', 7.50, 0.68, 8.18, now() - interval '1 day 2 hours', '00000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000013', 'Pending', 8.75, 0.79, 9.54, now() - interval '2 hours', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000014', 'In Progress', 9.25, 0.83, 10.08, now() - interval '1 hour', '00000000-0000-0000-0000-000000000001');

insert into order_items (associated_order_identifier, associated_menu_item_identifier, ordered_item_quantity, item_price_amount)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 2, 2.75),
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 1, 3.25),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 1, 4.50),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 1, 4.75),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 3, 2.75),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005', 1, 4.25),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 1, 3.25),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 2, 4.50),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000004', 1, 4.75),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 1, 2.75),
  ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 4, 2.75),
  ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', 1, 4.50),
  ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000004', 1, 4.75),
  ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000005', 1, 4.25),
  ('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', 2, 3.25),
  ('30000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 1, 2.75),
  ('30000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000002', 1, 4.50),
  ('30000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000004', 3, 4.75),
  ('30000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000005', 1, 4.25),
  ('30000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000003', 1, 3.25),
  ('30000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 2, 2.75),
  ('30000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000003', 1, 3.25),
  ('30000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000002', 1, 4.50),
  ('30000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000004', 1, 4.75);

-- One payment per order that reached checkout. Amount always matches the
-- order's total, same rule checkout_order enforces (AMOUNT_MISMATCH).
insert into payments (payment_transaction_identifier, associated_order_identifier, payment_method_type, payment_amount_value, payment_completion_status, payment_processing_timestamp)
values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Cash', 9.54, 'Completed', now() - interval '9 days'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Credit/Debit', 10.08, 'Completed', now() - interval '8 days'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'Cash', 8.99, 'Completed', now() - interval '7 days 1 hour 55 minutes'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'Mobile Pay', 8.18, 'Refunded', now() - interval '7 days 55 minutes'),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', 'Cash', 9.81, 'Completed', now() - interval '6 days 1 hour 55 minutes'),
  ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000006', 'Credit/Debit', 8.18, 'Refunded', now() - interval '6 days 55 minutes'),
  ('40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000007', 'Cash', 11.99, 'Completed', now() - interval '5 days 1 hour 55 minutes'),
  ('40000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000008', 'Mobile Pay', 14.72, 'Completed', now() - interval '4 days 1 hour 55 minutes'),
  ('40000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000009', 'Cash', 7.09, 'Completed', now() - interval '4 days 55 minutes'),
  ('40000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000010', 'Cash', 7.90, 'Completed', now() - interval '3 days 55 minutes'),
  ('40000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000011', 'Credit/Debit', 15.53, 'Completed', now() - interval '2 days 55 minutes'),
  ('40000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000014', 'Mobile Pay', 10.08, 'Completed', now() - interval '50 minutes');

-- A Partial and a Full refund (process_refund always flips the whole
-- payment to 'Refunded' — see payments rows 4 and 6 above).
insert into refunds (associated_payment_identifier, refund_amount_value, refund_type_category, refund_processing_timestamp)
values
  ('40000000-0000-0000-0000-000000000004', 3.00, 'Partial', now() - interval '7 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000006', 8.18, 'Full', now() - interval '6 days 30 minutes');

-- The two live orders stay on the active queue; everything Completed or
-- Cancelled has already left it (same rule update_order_status enforces).
insert into queue_entries (associated_order_identifier, queue_entry_status_type, queue_entry_timestamp)
values
  ('30000000-0000-0000-0000-000000000013', 'Pending', now() - interval '2 hours'),
  ('30000000-0000-0000-0000-000000000014', 'In Progress', now() - interval '45 minutes');

-- Simplified transaction log per order: order_created, payment_processed
-- (if paid), refund_processed (if refunded), and a final status_updated
-- (skipping the intermediate Pending -> In Progress log that a real
-- order would also have, to keep this seed file readable).
insert into transaction_logs (associated_order_identifier, transaction_type_category, performed_by_staff_identifier, transaction_timestamp)
values
  ('30000000-0000-0000-0000-000000000001', 'order_created', '00000000-0000-0000-0000-000000000001', now() - interval '9 days 1 hour'),
  ('30000000-0000-0000-0000-000000000001', 'payment_processed', '00000000-0000-0000-0000-000000000001', now() - interval '9 days'),
  ('30000000-0000-0000-0000-000000000001', 'status_updated', '00000000-0000-0000-0000-000000000001', now() - interval '9 days'),

  ('30000000-0000-0000-0000-000000000002', 'order_created', '00000000-0000-0000-0000-000000000002', now() - interval '8 days 1 hour'),
  ('30000000-0000-0000-0000-000000000002', 'payment_processed', '00000000-0000-0000-0000-000000000002', now() - interval '8 days'),
  ('30000000-0000-0000-0000-000000000002', 'status_updated', '00000000-0000-0000-0000-000000000002', now() - interval '8 days'),

  ('30000000-0000-0000-0000-000000000003', 'order_created', '00000000-0000-0000-0000-000000000001', now() - interval '7 days 2 hours'),
  ('30000000-0000-0000-0000-000000000003', 'payment_processed', '00000000-0000-0000-0000-000000000001', now() - interval '7 days 1 hour 55 minutes'),
  ('30000000-0000-0000-0000-000000000003', 'status_updated', '00000000-0000-0000-0000-000000000001', now() - interval '7 days 1 hour 55 minutes'),

  ('30000000-0000-0000-0000-000000000004', 'order_created', '00000000-0000-0000-0000-000000000001', now() - interval '7 days 1 hour'),
  ('30000000-0000-0000-0000-000000000004', 'payment_processed', '00000000-0000-0000-0000-000000000001', now() - interval '7 days 55 minutes'),
  ('30000000-0000-0000-0000-000000000004', 'status_updated', '00000000-0000-0000-0000-000000000001', now() - interval '7 days 55 minutes'),
  ('30000000-0000-0000-0000-000000000004', 'refund_processed', '00000000-0000-0000-0000-000000000002', now() - interval '7 days 30 minutes'),

  ('30000000-0000-0000-0000-000000000005', 'order_created', '00000000-0000-0000-0000-000000000001', now() - interval '6 days 2 hours'),
  ('30000000-0000-0000-0000-000000000005', 'payment_processed', '00000000-0000-0000-0000-000000000001', now() - interval '6 days 1 hour 55 minutes'),
  ('30000000-0000-0000-0000-000000000005', 'status_updated', '00000000-0000-0000-0000-000000000001', now() - interval '6 days 1 hour 55 minutes'),

  ('30000000-0000-0000-0000-000000000006', 'order_created', '00000000-0000-0000-0000-000000000002', now() - interval '6 days 1 hour'),
  ('30000000-0000-0000-0000-000000000006', 'payment_processed', '00000000-0000-0000-0000-000000000002', now() - interval '6 days 55 minutes'),
  ('30000000-0000-0000-0000-000000000006', 'status_updated', '00000000-0000-0000-0000-000000000002', now() - interval '6 days 55 minutes'),
  ('30000000-0000-0000-0000-000000000006', 'refund_processed', '00000000-0000-0000-0000-000000000002', now() - interval '6 days 30 minutes'),

  ('30000000-0000-0000-0000-000000000007', 'order_created', '00000000-0000-0000-0000-000000000001', now() - interval '5 days 2 hours'),
  ('30000000-0000-0000-0000-000000000007', 'payment_processed', '00000000-0000-0000-0000-000000000001', now() - interval '5 days 1 hour 55 minutes'),
  ('30000000-0000-0000-0000-000000000007', 'status_updated', '00000000-0000-0000-0000-000000000001', now() - interval '5 days 1 hour 55 minutes'),

  ('30000000-0000-0000-0000-000000000008', 'order_created', '00000000-0000-0000-0000-000000000001', now() - interval '4 days 2 hours'),
  ('30000000-0000-0000-0000-000000000008', 'payment_processed', '00000000-0000-0000-0000-000000000001', now() - interval '4 days 1 hour 55 minutes'),
  ('30000000-0000-0000-0000-000000000008', 'status_updated', '00000000-0000-0000-0000-000000000001', now() - interval '4 days 1 hour 55 minutes'),

  ('30000000-0000-0000-0000-000000000009', 'order_created', '00000000-0000-0000-0000-000000000002', now() - interval '4 days 1 hour'),
  ('30000000-0000-0000-0000-000000000009', 'payment_processed', '00000000-0000-0000-0000-000000000002', now() - interval '4 days 55 minutes'),
  ('30000000-0000-0000-0000-000000000009', 'status_updated', '00000000-0000-0000-0000-000000000002', now() - interval '4 days 55 minutes'),

  ('30000000-0000-0000-0000-000000000010', 'order_created', '00000000-0000-0000-0000-000000000001', now() - interval '3 days 1 hour'),
  ('30000000-0000-0000-0000-000000000010', 'payment_processed', '00000000-0000-0000-0000-000000000001', now() - interval '3 days 55 minutes'),
  ('30000000-0000-0000-0000-000000000010', 'status_updated', '00000000-0000-0000-0000-000000000001', now() - interval '3 days 55 minutes'),

  ('30000000-0000-0000-0000-000000000011', 'order_created', '00000000-0000-0000-0000-000000000001', now() - interval '2 days 1 hour'),
  ('30000000-0000-0000-0000-000000000011', 'payment_processed', '00000000-0000-0000-0000-000000000001', now() - interval '2 days 55 minutes'),
  ('30000000-0000-0000-0000-000000000011', 'status_updated', '00000000-0000-0000-0000-000000000001', now() - interval '2 days 55 minutes'),

  ('30000000-0000-0000-0000-000000000012', 'order_created', '00000000-0000-0000-0000-000000000002', now() - interval '1 day 2 hours'),
  ('30000000-0000-0000-0000-000000000012', 'status_updated', '00000000-0000-0000-0000-000000000002', now() - interval '1 day 1 hour 58 minutes'),

  ('30000000-0000-0000-0000-000000000013', 'order_created', '00000000-0000-0000-0000-000000000001', now() - interval '2 hours'),

  ('30000000-0000-0000-0000-000000000014', 'order_created', '00000000-0000-0000-0000-000000000001', now() - interval '1 hour'),
  ('30000000-0000-0000-0000-000000000014', 'payment_processed', '00000000-0000-0000-0000-000000000001', now() - interval '50 minutes'),
  ('30000000-0000-0000-0000-000000000014', 'status_updated', '00000000-0000-0000-0000-000000000001', now() - interval '45 minutes');

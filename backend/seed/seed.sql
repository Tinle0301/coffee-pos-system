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

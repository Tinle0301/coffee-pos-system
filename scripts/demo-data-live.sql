-- demo-data-live.sql — POS-62
--
-- Loads realistic demo orders into the LIVE Supabase project, so every
-- review and the final demo show real numbers on the reports, dashboard,
-- transaction log, queue and Today's Orders screens.
--
-- How to run: Supabase dashboard -> SQL Editor -> paste this whole file ->
-- Run. Nothing else is needed.
--
-- What it adds (one "batch" per Los Angeles calendar day):
--   14 orders over the last 9 days, using the real live staff accounts:
--     11 Completed and paid (Cash, Credit/Debit, Mobile Pay),
--     2 of them refunded (1 Partial, 1 Full),
--     1 Cancelled yesterday,
--     2 from today (1 Pending, 1 paid and In Progress) on the live queue.
--   Their order items, payments, refunds, queue entries and transaction logs.
--   Timestamps are relative to now(), so the data always looks recent.
--
-- Safe to run twice: every row has a fixed id made from today's date, so a
-- second run on the same day adds nothing. Running it on a later day (for
-- example the morning of a review) adds a fresh batch, so "today" has orders
-- again; the older batches stay as history. Earlier batches' demo orders
-- that are still open are closed first (paid -> Completed, unpaid ->
-- Cancelled), so only today's two demo orders are on the queue.
--
-- It does NOT change stock levels, menu prices or staff accounts. Menu items
-- are matched by name (Drip Coffee, Latte, Blueberry Muffin, Cappuccino,
-- Cold Brew); any that are missing are added with demo prices.
--
-- Payments and transaction logs can't be deleted (POS-16 audit rules), so
-- demo data can't be removed later. Don't run this on a database that has
-- real sales.

do $$
declare
  v_admin   uuid;
  v_barista uuid;
  v_batch   text := to_char(now() at time zone 'America/Los_Angeles', 'YYYY-MM-DD');
  v_names   text[]    := array['Drip Coffee', 'Latte', 'Blueberry Muffin', 'Cappuccino', 'Cold Brew'];
  v_cats    text[]    := array['Coffee', 'Coffee', 'Pastry', 'Coffee', 'Coffee'];
  v_prices  numeric[] := array[2.75, 4.50, 3.25, 4.75, 4.25];
  v_menu    uuid[]    := array[]::uuid[];
  v_price   numeric[] := array[]::numeric[];
  v_id      uuid;
  v_p       numeric;
  i         integer;

  -- n, status, by (b = barista, a = admin), created (ago), paid (ago or null),
  -- method, items as [[menu index, quantity], ...], refund type, refund amount
  -- (null = full payment), refunded (ago)
  v_orders jsonb := $json$[
    {"n":1,  "status":"Completed",   "by":"b", "created":"9 days 1 hour",  "paid":"9 days",                   "method":"Cash",         "items":[[1,2],[3,1]]},
    {"n":2,  "status":"Completed",   "by":"a", "created":"8 days 1 hour",  "paid":"8 days",                   "method":"Credit/Debit", "items":[[2,1],[4,1]]},
    {"n":3,  "status":"Completed",   "by":"b", "created":"7 days 2 hours", "paid":"7 days 1 hour 55 minutes", "method":"Cash",         "items":[[1,3]]},
    {"n":4,  "status":"Completed",   "by":"b", "created":"7 days 1 hour",  "paid":"7 days 55 minutes",        "method":"Mobile Pay",   "items":[[5,1],[3,1]],
             "refund":"Partial", "refund_amount":3.00, "refunded":"7 days 30 minutes"},
    {"n":5,  "status":"Completed",   "by":"b", "created":"6 days 2 hours", "paid":"6 days 1 hour 55 minutes", "method":"Cash",         "items":[[2,2]]},
    {"n":6,  "status":"Completed",   "by":"a", "created":"6 days 1 hour",  "paid":"6 days 55 minutes",        "method":"Credit/Debit", "items":[[4,1],[1,1]],
             "refund":"Full", "refunded":"6 days 30 minutes"},
    {"n":7,  "status":"Completed",   "by":"b", "created":"5 days 2 hours", "paid":"5 days 1 hour 55 minutes", "method":"Cash",         "items":[[1,4]]},
    {"n":8,  "status":"Completed",   "by":"b", "created":"4 days 2 hours", "paid":"4 days 1 hour 55 minutes", "method":"Mobile Pay",   "items":[[2,1],[4,1],[5,1]]},
    {"n":9,  "status":"Completed",   "by":"a", "created":"4 days 1 hour",  "paid":"4 days 55 minutes",        "method":"Cash",         "items":[[3,2]]},
    {"n":10, "status":"Completed",   "by":"b", "created":"3 days 1 hour",  "paid":"3 days 55 minutes",        "method":"Cash",         "items":[[1,1],[2,1]]},
    {"n":11, "status":"Completed",   "by":"b", "created":"2 days 1 hour",  "paid":"2 days 55 minutes",        "method":"Credit/Debit", "items":[[4,3]]},
    {"n":12, "status":"Cancelled",   "by":"a", "created":"1 day 2 hours",  "paid":null,                       "method":null,           "items":[[5,1],[3,1]]},
    {"n":13, "status":"Pending",     "by":"b", "created":"2 hours",        "paid":null,                       "method":null,           "items":[[1,2],[3,1]]},
    {"n":14, "status":"In Progress", "by":"b", "created":"1 hour",         "paid":"50 minutes",               "method":"Mobile Pay",   "items":[[2,1],[4,1]]}
  ]$json$;

  o           jsonb;
  it          jsonb;
  v_order     uuid;
  v_payment   uuid;
  v_staff     uuid;
  v_created   timestamptz;
  v_paid      timestamptz;
  v_subtotal  numeric(10, 2);
  v_tax       numeric(10, 2);
  v_total     numeric(10, 2);
  v_refund    numeric(10, 2);
  v_added     integer := 0;
  v_log       integer;
  v_old       record;
  v_closed    integer := 0;
begin
  -- 1. real live staff accounts ------------------------------------------------
  select staff_account_identifier into v_admin
  from staff_accounts
  where staff_role_type = 'Admin' and staff_account_status
  order by account_creation_timestamp
  limit 1;

  select staff_account_identifier into v_barista
  from staff_accounts
  where staff_role_type = 'Barista' and staff_account_status
  order by (staff_email_address = 'barista@test.com') desc, account_creation_timestamp
  limit 1;

  if v_admin is null or v_barista is null then
    raise exception 'demo-data-live: needs at least one active Admin and one active Barista in staff_accounts';
  end if;

  -- 2. menu items, matched by name; missing ones are added ----------------------
  for i in 1 .. array_length(v_names, 1) loop
    select menu_item_identifier, menu_item_price_amount into v_id, v_p
    from menu_items
    where lower(menu_item_name) = lower(v_names[i])
    order by menu_item_availability_status desc
    limit 1;

    if v_id is null then
      v_id := md5('pos62-menu-' || v_names[i])::uuid;
      v_p  := v_prices[i];
      insert into menu_items (menu_item_identifier, menu_item_name, menu_item_category_type, menu_item_price_amount)
      values (v_id, v_names[i], v_cats[i], v_p)
      on conflict (menu_item_identifier) do nothing;
    end if;

    v_menu  := v_menu || v_id;
    v_price := v_price || v_p;
  end loop;

  -- 3. close earlier batches' demo orders that are still open -----------------
  for v_old in
    select o.order_identifier, o.created_by_staff_identifier, d.day,
           exists (select 1 from payments p
                   where p.associated_order_identifier = o.order_identifier
                     and p.payment_completion_status = 'Completed') as paid
    from generate_series(1, 90) d(day)
    cross join generate_series(13, 14) n(n)
    join orders o
      on o.order_identifier = md5('pos62-'
           || to_char((now() at time zone 'America/Los_Angeles')::date - d.day, 'YYYY-MM-DD')
           || '-order-' || n.n)::uuid
    where o.order_status_type in ('Pending', 'In Progress')
  loop
    update orders
      set order_status_type = case when v_old.paid then 'Completed' else 'Cancelled' end
      where order_identifier = v_old.order_identifier;
    delete from queue_entries where associated_order_identifier = v_old.order_identifier;
    insert into transaction_logs (transaction_log_identifier, associated_order_identifier, transaction_type_category,
                                  performed_by_staff_identifier)
    values (md5('pos62-close-' || v_old.order_identifier)::uuid, v_old.order_identifier,
            case when v_old.paid then 'status_updated' else 'order_cancelled' end,
            v_old.created_by_staff_identifier)
    on conflict (transaction_log_identifier) do nothing;
    v_closed := v_closed + 1;
  end loop;

  -- 4. orders, items, payments, refunds, queue, logs -----------------------------
  for o in select * from jsonb_array_elements(v_orders) loop
    v_order := md5('pos62-' || v_batch || '-order-' || (o->>'n'))::uuid;

    -- already loaded today: leave it alone
    continue when exists (select 1 from orders where order_identifier = v_order);

    v_staff   := case o->>'by' when 'a' then v_admin else v_barista end;
    v_created := now() - (o->>'created')::interval;
    v_paid    := case when o->>'paid' is null then null else now() - (o->>'paid')::interval end;

    v_subtotal := 0;
    for it in select * from jsonb_array_elements(o->'items') loop
      v_subtotal := v_subtotal + v_price[(it->>0)::int] * (it->>1)::int;
    end loop;
    v_tax   := round(v_subtotal * 0.09, 2);   -- same rate as create_order
    v_total := v_subtotal + v_tax;

    insert into orders (order_identifier, order_status_type, order_subtotal_amount, order_tax_amount,
                        order_total_amount, order_creation_timestamp, created_by_staff_identifier)
    values (v_order, o->>'status', v_subtotal, v_tax, v_total, v_created, v_staff);

    i := 0;
    for it in select * from jsonb_array_elements(o->'items') loop
      i := i + 1;
      insert into order_items (order_item_identifier, associated_order_identifier, associated_menu_item_identifier,
                               ordered_item_quantity, item_price_amount)
      values (md5('pos62-' || v_batch || '-item-' || (o->>'n') || '-' || i)::uuid, v_order,
              v_menu[(it->>0)::int], (it->>1)::int, v_price[(it->>0)::int]);
    end loop;

    v_log := 0;
    v_log := v_log + 1;
    insert into transaction_logs (transaction_log_identifier, associated_order_identifier, transaction_type_category,
                                  performed_by_staff_identifier, transaction_timestamp)
    values (md5('pos62-' || v_batch || '-log-' || (o->>'n') || '-' || v_log)::uuid, v_order, 'order_created', v_staff, v_created);

    if v_paid is not null then
      v_payment := md5('pos62-' || v_batch || '-payment-' || (o->>'n'))::uuid;
      insert into payments (payment_transaction_identifier, associated_order_identifier, payment_method_type,
                            payment_amount_value, payment_completion_status, payment_processing_timestamp)
      values (v_payment, v_order, o->>'method', v_total,
              case when o ? 'refund' then 'Refunded' else 'Completed' end, v_paid);

      v_log := v_log + 1;
      insert into transaction_logs (transaction_log_identifier, associated_order_identifier, transaction_type_category,
                                    performed_by_staff_identifier, transaction_timestamp)
      values (md5('pos62-' || v_batch || '-log-' || (o->>'n') || '-' || v_log)::uuid, v_order, 'payment_processed', v_staff, v_paid);

      if o ? 'refund' then
        v_refund := coalesce((o->>'refund_amount')::numeric, v_total);
        insert into refunds (refund_transaction_identifier, associated_payment_identifier, refund_amount_value,
                             refund_type_category, refund_processing_timestamp)
        values (md5('pos62-' || v_batch || '-refund-' || (o->>'n'))::uuid, v_payment, v_refund,
                o->>'refund', now() - (o->>'refunded')::interval);

        v_log := v_log + 1;
        insert into transaction_logs (transaction_log_identifier, associated_order_identifier, transaction_type_category,
                                      performed_by_staff_identifier, transaction_timestamp)
        values (md5('pos62-' || v_batch || '-log-' || (o->>'n') || '-' || v_log)::uuid, v_order, 'refund_processed',
                v_admin, now() - (o->>'refunded')::interval);
      end if;
    end if;

    if o->>'status' in ('Completed', 'Cancelled', 'In Progress') then
      v_log := v_log + 1;
      insert into transaction_logs (transaction_log_identifier, associated_order_identifier, transaction_type_category,
                                    performed_by_staff_identifier, transaction_timestamp)
      values (md5('pos62-' || v_batch || '-log-' || (o->>'n') || '-' || v_log)::uuid, v_order,
              case o->>'status' when 'Cancelled' then 'order_cancelled' else 'status_updated' end,
              v_staff, coalesce(v_paid, v_created + interval '2 minutes'));
    end if;

    -- live orders stay on the queue (Completed and Cancelled have left it)
    if o->>'status' in ('Pending', 'In Progress') then
      insert into queue_entries (queue_entry_identifier, associated_order_identifier, queue_entry_status_type, queue_entry_timestamp)
      values (md5('pos62-' || v_batch || '-queue-' || (o->>'n'))::uuid, v_order, o->>'status', v_created);
    end if;

    v_added := v_added + 1;
  end loop;

  if v_closed > 0 then
    raise notice 'demo-data-live: closed % open demo orders from earlier days', v_closed;
  end if;

  if v_added = 0 then
    raise notice 'demo-data-live: today''s demo batch (%) is already loaded, nothing added', v_batch;
  else
    raise notice 'demo-data-live: added % demo orders for batch %', v_added, v_batch;
  end if;
end $$;

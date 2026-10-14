-- 0013_queue_indexes.sql
-- POS-22: indexes supporting active-queue and transaction-log queries.

create index if not exists idx_queue_status_time
  on queue_entries (queue_entry_status_type, queue_entry_timestamp);

create index if not exists idx_queue_order
  on queue_entries (associated_order_identifier);

create index if not exists idx_logs_order
  on transaction_logs (associated_order_identifier);

create index if not exists idx_logs_time
  on transaction_logs (transaction_timestamp);
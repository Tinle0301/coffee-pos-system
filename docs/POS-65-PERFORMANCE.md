# POS-65 Order Performance Evidence

## Purpose

POS-65 measures order creation speed and verifies that the Coffee POS system can support 100 concurrent active orders.

The benchmark exercises the real PostgreSQL `create_order()` transaction used by the application. The transaction creates the order, order item, active queue entry, and transaction log.

## SRS Requirements

The relevant SRS requirements are:

- Section 5.1 requires a new order to be processed and displayed in the order queue within 2 seconds after confirmation.
- Section 5.3 requires support for at least 100 concurrent active orders without performance degradation.
- Section 5.3 also requires multiple simultaneous order creations by different staff members without data conflicts.
- The Create Order use case separately states a 5-second completion requirement. This benchmark uses the stricter 2-second threshold.

## Benchmark Environment

- Local Supabase PostgreSQL database
- PostgreSQL / pgbench 15.19
- Real `create_order()` database function
- Benchmark data isolated using POS-65-specific UUIDs
- Latency limit: 2,000 ms

This benchmark measures the backend order-creation transaction through queue insertion. It does not measure browser rendering or external network latency.

## Baseline Test

Configuration:

- 1 client
- 10 order creations
- 2,000 ms latency limit

Results:

- Transactions processed: 10 / 10
- Failed transactions: 0
- Transactions above 2,000 ms: 0 / 10
- Average latency: 0.859 ms
- Latency standard deviation: 0.746 ms

## Concurrent Order Test

Configuration:

- 10 concurrent staff sessions
- 10 order creations per session
- 100 total active orders
- 2,000 ms latency limit

Results:

- Transactions processed: 100 / 100
- Failed transactions: 0
- Transactions above 2,000 ms: 0 / 100
- Average latency: 1.081 ms
- Latency standard deviation: 0.836 ms

## Database Verification

After the concurrent benchmark completed, the concurrent-test cohort contained:

- 100 benchmark orders
- 100 pending benchmark orders
- 100 order items
- 100 queue entries
- 100 `order_created` transaction logs
- 10 concurrent staff identities

The 10 baseline orders created earlier in the same benchmark run remain separate from these concurrency counts until the final `supabase db reset`.

All expected concurrent-test records were present and no transaction failures or data conflicts occurred.

## Result

PASS.

All 100 order-creation transactions completed successfully with no database conflicts or failed transactions. All 100 resulting orders remained active and appeared in the queue.

The average concurrent order-creation latency was 1.081 ms, which is far below both the stricter 2-second performance requirement and the 5-second Create Order use-case requirement.

## Reproducing the Test

Start local Supabase and reset the local database:

```bash
supabase start
supabase db reset
```

Run the performance benchmark:

```bash
./scripts/run-order-performance.sh
```

After collecting the benchmark results, remove all temporary POS-65 benchmark data:

```bash
supabase db reset
```

The benchmark must only be run against the local Supabase development database.

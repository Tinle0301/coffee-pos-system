# Architecture

## Stack

- **Supabase** is the entire backend: PostgreSQL for data, Supabase Auth
  for staff login, Row Level Security for authorization, Realtime for the
  live order queue. There is no application server.
- **Vercel** hosts the frontend, auto-deploying from GitHub on push to
  `main`.
- **GitHub** holds the repo, issues, project board, and CI.
- Data-access layer: vanilla JavaScript ES modules using
  `@supabase/supabase-js` (see `backend/services/`).

```
┌─────────────┐        ┌──────────────────────────────┐
│  frontend/   │──────▶│  Supabase                     │
│  (Vercel)    │        │  - PostgreSQL (data)          │
│              │◀──────│  - Auth (staff login)          │
│  imports     │  RLS   │  - Row Level Security (authz)  │
│  backend/    │  +     │  - Realtime (live queue)       │
│  services/   │  RPC   │  - plpgsql functions (atomic   │
└─────────────┘        │    multi-table operations)     │
                        └──────────────────────────────┘
```

## Why no application server

The 491A SRS assumed a separate backend server tier between the frontend
and the database. This project removes that tier and replaces its
responsibilities as follows:

| SRS responsibility | Where it lives now |
|---|---|
| Business logic / validation | SQL `CHECK` constraints (`0001_schema.sql`) + plpgsql RPC functions for multi-table transactions (`0003_functions.sql`) |
| Authorization / RBAC | Row Level Security policies (`0002_rls_policies.sql`) — enforced by Postgres itself on every query, not by a middle tier that could be bypassed |
| Session management | Supabase Auth |
| Live updates (order queue) | Supabase Realtime (Postgres logical replication over websockets) |
| PostgreSQL, ACID transactions | Unchanged — still plain PostgreSQL, still ACID. Supabase does not replace Postgres; it wraps it with Auth/RLS/Realtime/REST. Multi-table writes are wrapped in plpgsql functions, which are transactional by default. |

This satisfies the SRS's PostgreSQL and ACID requirements fully — those
requirements were about the database, not about having a separate server
process in front of it. What changes is that authorization and multi-table
business logic move from application code (which the SRS implied would run
on a server tier) into the database itself (RLS + RPC functions). For a
5-person student team with no dedicated DevOps capacity, this trades one
axis of flexibility (custom server-side logic in a general-purpose
language) for a large reduction in what has to be built, deployed, and kept
running — there is nothing to host, patch, or scale beyond Supabase and
Vercel's managed infrastructure.

## Data flow example: creating an order

1. Barista submits the New Order screen.
2. Frontend calls `backend/services/orders.js#CreateNewOrder(items, staffId)`.
3. That calls the `create_order(items, staff_id)` Postgres function
   (`0003_functions.sql`), which — in one transaction — inserts the order,
   its order_items, a queue_entries row, and a transaction_logs row.
4. RLS (`0002_rls_policies.sql`) checks the calling user is an
   authenticated staff member before any of it is allowed to run.
5. Supabase Realtime pushes the new queue_entries row to every subscribed
   Active Orders Queue screen.

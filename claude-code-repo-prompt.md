# Paste this into Claude Code to scaffold the project repo

Create a new git repository for the Coffee POS System — a CSULB CECS 491B senior
project, managed entirely through GitHub. This is scaffolding only: folder
structure, config, SQL, and documentation so teammates fill in the code.
Do NOT implement application features. Every domain detail below comes from the
team's approved 491A SRS, Use Cases, and Class Diagram — use these exact names so
the code matches the submitted documentation.

## TEAM
Trung Tin Le (team lead), Bismah Farooq, Minh Tri Chau, Ryan Grubert,
Trong Nghia Le. Two sub-teams working in parallel:
- frontend/ — 2 people. Everything the barista sees. Never writes SQL directly.
- backend/ — 3 people. Schema, migrations, RLS policies, database functions,
  and the data-access layer.
They meet at docs/API_CONTRACT.md. Structure so the two sides almost never edit
the same file. Leave the 2/3 name assignment as a marked placeholder.

## STACK — decided, keep it simple
- **Supabase** is the entire backend: PostgreSQL for data, Supabase Auth for
  staff login, Row Level Security for authorization, Realtime for the live order
  queue. There is NO application server to write or host.
- **Vercel** hosts the frontend, auto-deploying from GitHub on push to main.
- **GitHub** holds the repo, issues, project board, and CI.
- Data-access layer is vanilla JavaScript ES modules using @supabase/supabase-js.
- NO Java, NO Firebase, NO ORM, NO Docker in production, NO custom REST server.
- Schema changes happen ONLY through Supabase CLI migration files committed to
  the repo. Nobody edits tables by hand in the dashboard.

## FRONTEND — DELIBERATELY UNDECIDED, do not lock it in
The frontend sub-team has not chosen a stack and leans Python. Keep these open:
  A. Plain HTML/CSS/vanilla JS — deploys to Vercel as-is, imports the backend
     JS modules directly.
  B. React/TypeScript — build step, still Vercel, still uses the backend modules.
  C. Python (Flask/Django) — CANNOT deploy to Vercel; needs Render instead, and
     CANNOT import the backend JS modules, so it would use the supabase-py
     client against the same tables and the same contract.
  D. Python desktop app — not web-hosted at all.
Therefore frontend/ gets a NEUTRAL layout only: /src (.gitkeep), /assets,
/tests, README.md. Do NOT create package.json, requirements.txt, or any
framework config. Create one placeholder frontend/src/index.html ("Coffee POS —
under construction") purely so Vercel has something to serve and the deploy
pipeline is proven on day one; comment that it is temporary.

## DATABASE SCHEMA — from the 491A Class Diagram
Use snake_case column names (Postgres convention) and document the mapping to
the 491A camelCase names in docs/DATA_MODEL.md so the code traces back to the
approved documentation. Write these as the first Supabase migration file with
primary keys, foreign keys, NOT NULL, CHECK constraints, and indexes:

1.  users: user_identifier (PK), username_credential, encrypted_password_hash,
    user_email_address, user_role_type, account_creation_timestamp,
    account_active_status
2.  staff_accounts: staff_account_identifier (PK), staff_full_name,
    staff_role_type, staff_email_address, staff_account_status,
    account_creation_timestamp
3.  orders: order_identifier (PK), order_status_type, order_subtotal_amount,
    order_tax_amount, order_total_amount, order_creation_timestamp,
    created_by_staff_identifier (FK -> staff_accounts)
4.  order_items: order_item_identifier (PK), associated_order_identifier
    (FK -> orders, ON DELETE CASCADE), associated_menu_item_identifier
    (FK -> menu_items), ordered_item_quantity, item_customization_description,
    item_price_amount
5.  payments: payment_transaction_identifier (PK), associated_order_identifier
    (FK -> orders), payment_method_type, payment_amount_value,
    payment_completion_status, payment_processing_timestamp
6.  refunds: refund_transaction_identifier (PK), associated_payment_identifier
    (FK -> payments), refund_amount_value, refund_type_category,
    refund_processing_timestamp
7.  transaction_logs: transaction_log_identifier (PK),
    associated_order_identifier (FK -> orders), transaction_type_category,
    transaction_timestamp, performed_by_user_identifier (FK -> users)
8.  menu_items: menu_item_identifier (PK), menu_item_name,
    menu_item_category_type, menu_item_description_text, menu_item_price_amount,
    menu_item_availability_status
9.  inventory_items: inventory_item_identifier (PK), inventory_item_name,
    available_quantity_value, minimum_stock_threshold,
    inventory_last_updated_timestamp
10. queue_entries: queue_entry_identifier (PK), associated_order_identifier
    (FK -> orders), queue_entry_status_type, queue_entry_timestamp
11. sales_reports: report_identifier (PK), report_generation_type,
    report_start_date, report_end_date, total_revenue_amount,
    report_generated_timestamp

Constraints to enforce in SQL, not in application code:
- order_status_type CHECK in ('Pending','In Progress','Completed','Cancelled')
- user_role_type / staff_role_type CHECK in ('Barista','Admin')
- ordered_item_quantity > 0; all amount columns >= 0
- Indexes on orders(order_status_type), orders(order_creation_timestamp),
  order_items(associated_order_identifier), payments(associated_order_identifier)

## DATABASE FUNCTIONS (plpgsql RPC) — atomic operations
With no application server, multi-table atomic work lives in the database.
Create stub function files (signature + comment describing the transaction, no
full body) for:
- create_order(items jsonb, staff_id) — insert order + order_items + queue_entry
  + transaction_log in one transaction, status 'Pending'
- checkout_order(order_id, payment_method, amount) — insert payment, set order
  status 'Completed', decrement inventory, write transaction_log
- process_refund(payment_id, refund_type, amount) — insert refund, update
  payment status, write transaction_log
- cancel_order(order_id) — only if not paid; mark cancelled, remove from queue
- update_order_status(order_id, new_status) — validate the transition

## ROW LEVEL SECURITY — this is the ONLY authorization in the system
Separate migration file. Enable RLS on every table. Comment EVERY policy.
- Authenticated Barista: read menu_items and inventory_items; insert and update
  their own orders and order_items; read queue_entries; insert payments.
- Admin only: write menu_items, inventory_items, staff_accounts, users, refunds;
  read transaction_logs and sales_reports.
- Nobody may update or delete transaction_logs — audit records are immutable.
Add a README note: a wrong policy here means a barista can make themselves an
admin. These policies need tests, not just review.

## SERVICES LAYER — backend/services/
One module per 491A controller, exported function signatures with JSDoc, NO
bodies. Preserve the documented method names:
  auth.js (AuthController — login, logout, session, 10-minute inactivity
  timeout), staff.js (UserController), orders.js (OrderController:
  CreateNewOrder, ModifyExistingOrder, CancelExistingOrder,
  RetrieveOrderByIdentifier), orderStatus.js (OrderStatusController:
  UpdateOrderStatus, MarkOrderAsInProgress), orderItems.js (AddOrderItem,
  UpdateOrderItemQuantity, RemoveOrderItem, ViewOrderItems), payments.js,
  refunds.js, transactions.js, menu.js, inventory.js, queue.js (including the
  Realtime subscription for the live queue), reports.js, exports.js (CSV/PDF).

## SCREENS — from the 491A boundary objects
List these in frontend/README.md with the use case each serves and a place to
record its owner. Do NOT create the files (stack undecided):
Login, Staff Accounts (admin), New Order, Modify Order, Checkout, Refund
(admin), Transaction Logs, Owner Menu (admin), Inventory (admin), Staff Menu,
Active Orders Queue, Reports, Export Reports.

## USE CASES — all 14, in docs/USE_CASES.md with actor and services touched
1 Login/Logout (Barista) · 2 Create Order (Barista) · 3 Modify Order (Barista) ·
4 Process Payment (Barista) · 5 Update Order Status (Barista) · 6 View Menu
(Barista) · 7 View Active Orders Queue (Barista) · 8 Manage Menu Items (Admin) ·
9 Manage Inventory (Admin) · 10 View Sales Reports (Admin) · 11 Export Reports
(Admin) · 12 Manage Staff Accounts (Admin) · 13 Process Refund (Admin) ·
14 View Transaction Logs (Admin)

## NON-FUNCTIONAL REQUIREMENTS — from the 491A SRS, in docs/REQUIREMENTS.md
- Order creation within 5 seconds; modification within 3 seconds.
- Interactive operations respond within 2-5 seconds.
- At least 100 concurrent active orders without degradation.
- 99% uptime target.
- RBAC enforced immediately on save; account and menu changes audit-logged
  immutably.
- Session auto-timeout after 10 minutes of inactivity.
- TLS 1.2+ in transit; payment data encrypted; PCI-DSS guidance followed.
- Tablet/touch use behind a counter: touch-sized targets, not mouse-sized.
Note in ARCHITECTURE.md that the SRS's PostgreSQL and ACID requirements are
fully satisfied by this stack, and that the change from the SRS is only the
removal of the separate backend server tier — explain why.

## STRUCTURE
```
/frontend
  /src/index.html            placeholder page only
  /src /assets /tests        .gitkeep
  README.md                  undecided stack, options A-D, screen list, ownership
/backend
  /migrations                Supabase CLI migration files, numbered:
                             0001_schema.sql, 0002_rls_policies.sql,
                             0003_functions.sql
  /seed                      seed.sql — sample menu items, staff, inventory
  /services                  JS data-access modules, stubs only
  /models                    JS shape definitions + validators for the 11 entities
  supabase-client.js         client init reading env vars, marked placeholders
  /tests                     RLS policy tests + README on running them locally
  README.md                  ownership; never imports from frontend/
/docs
  API_CONTRACT.md  DATA_MODEL.md  USE_CASES.md  REQUIREMENTS.md
  FRONTEND_DECISION.md  ARCHITECTURE.md  SETUP.md  WORKFLOW.md
/docs/491A-reference/        .gitkeep + README: the team commits the approved
                             SRS, Use Cases, Class Diagram and Sequence Diagram
                             PDFs here as the source of truth
/supabase/config.toml        Supabase CLI project config
```

## KEY DOCS
- **API_CONTRACT.md** — THE handshake, LANGUAGE-NEUTRAL so a Python frontend
  could implement it: operation name, inputs with types, return shape, errors,
  and which screen calls it. It is the source of truth, not the JS files. Fill
  in complete example rows for CreateNewOrder, AddOrderItem, and
  UpdateOrderStatus. State at the top that changing an operation requires
  telling the other sub-team before merging.
- **DATA_MODEL.md** — the 11 tables, their columns, the camelCase-to-snake_case
  mapping back to the 491A class diagram, the relationships, and one example row
  per table.
- **FRONTEND_DECISION.md** — ADR-style: options A-D, trade-offs (hosting,
  whether the backend JS layer is reusable, learning curve, sprint impact), a
  decision-deadline field, an empty Decision section.
- **SETUP.md** — for a teammate who has never used Supabase: create the project,
  install the Supabase CLI, `supabase link`, run migrations, load seed data,
  run locally, and where to get the env vars. Include an explicit warning that
  the anon key is safe in frontend code but the service_role key bypasses all
  RLS and must never be committed or shipped to the browser.
- **WORKFLOW.md** — how the sub-teams work in parallel: branch naming, review
  rules, what to do when the contract changes, the rule that frontend codes
  against the contract with stubbed returns rather than waiting on backend, and
  the rule that schema changes are migration files only.

## GITHUB
- .github/CODEOWNERS: frontend/ to the frontend sub-team, backend/ to the
  backend sub-team, docs/API_CONTRACT.md to BOTH. Placeholder handles with a
  comment to replace them.
- .github/ISSUE_TEMPLATE/user_story.yml: story in "As a <role>, I want
  <functionality> so that <reason>" form, story points (1/2/3/5/8/13),
  acceptance criteria, related use case number (1-14), owning side.
- .github/ISSUE_TEMPLATE/bug_report.yml: steps to reproduce, expected vs actual,
  screen affected, severity.
- .github/pull_request_template.md: linked issue, which side, what changed, how
  tested, checkbox "this changes the API contract", checkbox "this adds a
  migration".
- .github/workflows/ci.yml: two independent jobs, one per folder, each triggered
  only by changes to its own path so the sub-teams never wait on each other.
  Backend job spins up a Postgres service container, applies the migrations, and
  runs the RLS tests. Frontend job is a passing stub with a comment that it gets
  filled in once the stack is chosen.
- NO deploy workflow — Vercel deploys from GitHub automatically. Document the
  Vercel setup steps in SETUP.md instead, including which env vars to set in the
  Vercel dashboard (SUPABASE_URL and SUPABASE_ANON_KEY only).
- CONTRIBUTING.md: main protected; branches feature/<issue-number>-<short-
  description>; one review from the owning sub-team, two if API_CONTRACT.md is
  touched; no direct pushes to main; schema changes only via migration files.
- README.md: project name, course, team roster split into sub-teams, repo
  layout, live Vercel URL placeholder, quick start pointing at docs/SETUP.md,
  and a Project Management section: work tracked as GitHub Issues on a GitHub
  Projects board with columns Backlog / Sprint / In Progress / Review / Done.
- .gitignore: node_modules, .env, .env.local, Supabase local files, .DS_Store,
  IDE folders, and Python artifacts (__pycache__, .venv, *.pyc) since the
  frontend may go that way.
- .env.example with SUPABASE_URL and SUPABASE_ANON_KEY placeholders and a
  comment that service_role belongs nowhere in this repo.
- MIT LICENSE.

## FINISH BY
- git init, initial commit on main.
- Print the file tree.
- Print anything here that will cause friction for a 5-person student team
  splitting 2/3 across a semester, and what you would do differently. Be direct
  — do not just agree with me.

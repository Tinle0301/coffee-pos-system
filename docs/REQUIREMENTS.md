# Non-Functional Requirements

From the approved 491A SRS.

## Performance
- Order creation completes within 5 seconds.
- Order modification completes within 3 seconds.
- Interactive operations respond within 2-5 seconds.
- At least 100 concurrent active orders without degradation.

## Availability
- 99% uptime target.

## Security & Authorization
- RBAC (Barista / Admin) enforced immediately on save — see
  `backend/migrations/0002_rls_policies.sql`, the only authorization layer
  in the system.
- Account and menu changes are audit-logged immutably in
  `transaction_logs` (no client update/delete policy).
- TLS 1.2+ in transit (provided by Supabase/Vercel infrastructure).
- Payment data encrypted; PCI-DSS guidance followed — no raw card data is
  ever stored in this schema (`payments.payment_method_type` records the
  method, not card details; actual processing should go through a
  PCI-compliant payment processor's tokenized flow).
- Session auto-timeout after 10 minutes of inactivity (`auth.js`).

## Usability
- Tablet/touch use behind a counter: touch-sized targets, not mouse-sized,
  across all screens.

---

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the Supabase/Vercel stack
satisfies the SRS's PostgreSQL and ACID requirements.

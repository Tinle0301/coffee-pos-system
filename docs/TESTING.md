# Testing Guide — Coffee POS System

How to verify the stack works, what data to expect, and how to check each
Sprint 1 story. All data here is fake — this is a CSULB class project.

---

## 1. Start here: the smoke test

Before writing any feature code, open `frontend/src/smoke-test.html` in a
browser (via a local server, not `file://`) and run it.

```bash
npx serve frontend/src      # then open http://localhost:3000/smoke-test.html
```

Paste the Supabase URL and the publishable key, then Run. Seven checks:

| # | Check | Passes when |
|---|---|---|
| 1 | Configuration present | URL and publishable key are set |
| 2 | Client initializes | The library accepts them |
| 3 | Anonymous read of menu_items | **DENIED** |
| 4 | Login as test barista | Succeeds |
| 5 | Signed-in read of menu_items | Returns rows |
| 6 | Barista reads staff_accounts | **DENIED** |
| 7 | Logout ends access | Read denied again |

**Checks 3 and 6 pass when access is blocked.** Our publishable key is public
and the repo is public — if an anonymous client can read data, Row Level
Security is not protecting us, and that is a failure no matter how nice the
app looks.

This page is a development tool. Delete or block it before the final
presentation.

---

## 2. Test accounts

Created in Supabase → Authentication → Users. Their ids must match the
`staff_account_identifier` values in `backend/seed/seed.sql`, because RLS
resolves `auth.uid()` against that column.

| Email | Role | UUID | Used for |
|---|---|---|---|
| barista@test.com | Barista | `…0001` | Normal staff flows; must NOT reach admin data |
| admin@test.com | Admin | `…0002` | Admin flows; full access |
| barista2@test.com | Barista | `…0003` | A second browser session — testing the live queue across two screens |

Full UUIDs are `00000000-0000-0000-0000-00000000000N`.

Passwords are kept in the team chat, not in the repo. Fake accounts, fake data,
but the repo is public and committing credentials is a habit worth not having.

---

## 3. What the seed data contains

Run `backend/seed/seed.sql` after the migrations. It truncates first, so it is
safe to re-run any time you want a known state.

**16 menu items** across Espresso, Brewed, Tea, Food. Two are deliberately
unavailable — **Cortado** and **Avocado Toast** — so the out-of-stock display
can be tested without editing data first.

**Prices are chosen so tax is checkable by hand.** At the 10.25% LA County
rate: a $4.00 Latte → $0.41 tax → **$4.41** total. If your totals screen shows
$4.42 or $4.40, the bug is rounding at the end instead of per line item.

**6 inventory items.** Oat Milk is below its threshold (1.00 on hand, 4.00
minimum) so low-stock display works out of the box.

**2 pre-existing Pending orders**, both by the test barista, so the queue
screen has content before the create-order flow exists:

| Order | Items | Subtotal | Tax | Total |
|---|---|---|---|---|
| `…000a` | Latte (medium, oat) + Drip (small) | 6.50 | 0.67 | 7.17 |
| `…000b` | Cold Brew ×2 (large, no ice) | 8.00 | 0.82 | 8.82 |

If you change the seed, update this section in the same commit — otherwise
testers chase differences that aren't bugs.

---

## 4. Security policy tests

```bash
# see backend/tests/README.md for the full local command sequence
psql "$PG" -v ON_ERROR_STOP=1 -f backend/tests/rls_test.sql
```

Eight cases covering: anonymous access denied, barista can read the menu,
barista can create their own order, barista cannot create an order in someone
else's name, barista cannot change the menu, barista cannot read staff
accounts, admin can change the menu, and audit logs are immutable.

CI runs these on every pull request touching `backend/`. A PR that breaks a
policy fails the build instead of surfacing at the sprint review.

---

## 5. Manual test checklist — Sprint 1

Written so you can test a teammate's story without asking them how it should
behave. Test as a Barista unless stated.

| Story | Do this | Expect |
|---|---|---|
| POS-1 Database Schema | Run migrations on an empty database | All 11 tables created, no errors, re-runnable from scratch |
| POS-2 Seed Data | Run `seed.sql` twice in a row | No errors the second time; counts identical |
| POS-3 Staff Login | Log in with barista@test.com | Lands on the order screen |
| POS-3 Staff Login | Log in with a wrong password | Clear message, no raw error text, no crash |
| POS-4 Session Timeout | Log in, leave idle 10 minutes | Returned to the login screen |
| POS-5 Security Policies | Run the smoke test | Checks 3 and 6 both PASS (access denied) |
| POS-6 Create Order Transaction | Call `create_order` with two items | One order, two order_items, one queue_entry — all present |
| POS-6 Create Order Transaction | Call it with an invalid menu item id | Nothing is written at all — no partial order |
| POS-7 Data Access Modules | Search the frontend for `.from(` | No matches — the frontend never queries directly |
| POS-8 Login Screen | Open at 768px width | Usable; touch targets at least 44px |
| POS-9 Build the Order | Add a Latte, set large + oat milk | Line price updates to match the customization rules |
| POS-9 Build the Order | Remove an item before confirming | Removed from the list and the total |
| POS-10 Order Summary | Add one $4.00 Latte | Subtotal 4.00, tax 0.41, total 4.41 — exactly |
| POS-10 Order Summary | Add three of them | Subtotal 12.00, tax 1.23, total 13.23 |
| POS-11 Browse Menu | Open the menu screen | 16 items grouped by category; Cortado and Avocado Toast marked unavailable and not clickable |
| POS-12 Confirm Order | Build an order and confirm | Order number shown; row appears in the database with status "Pending" |
| POS-12 Confirm Order | Double-tap Confirm quickly | Exactly ONE order created |
| POS-13 Logout | Click logout, then press browser Back | Login screen — the session does not come back |

---

## 6. Before you say a story is Done

- [ ] Works on the live Vercel URL, not just localhost
- [ ] Works at 768px width (tablet — this runs on a counter, not a laptop)
- [ ] Tested as a Barista **and** as an Admin where the story involves roles
- [ ] Reloading the page mid-flow doesn't break it
- [ ] The smoke test still passes after your change
- [ ] Merged via a reviewed PR and deployed

---

## 7. Troubleshooting

| Symptom | Most likely cause |
|---|---|
| Query returns empty, no error | **Missing RLS policy.** Check this before debugging your code — it is the single most common confusion on this stack. |
| "relation does not exist" | Migration not pushed, or your local database is stale. Pull, then `supabase db push`. |
| 401 / not authenticated | Session expired, or you queried before login resolved. |
| Login fails for a seeded account | "Confirm email" is on in Supabase → Authentication → Providers. Turn it off. |
| CORS error | You opened the file with `file://`. Use a local server. |
| Works locally, fails on Vercel | Environment variables aren't set in the Vercel dashboard. |
| Totals off by a cent | Rounding at the end instead of per line item. |
| Live URL shows 404 | Vercel Root Directory doesn't point at the folder holding `index.html`. |

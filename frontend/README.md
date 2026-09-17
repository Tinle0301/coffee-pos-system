# frontend/ — everything the barista sees

**Owners:** Bismah Farooq (order screens) · Minh Tri Chau (menu, checkout, queue, admin screens)

This runs on a tablet on a counter during a rush. Not a laptop, not a desk.
Design for a thumb and bad lighting.

---

## The one rule

**Never write SQL. Never call Supabase directly.** Every piece of data comes
through `backend/services/`, which implements
[`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md).

```js
// yes
import { listMenuItems } from '../../backend/services/menu.js'
const { data, error } = await listMenuItems()

// no
const { data } = await supabase.from('menu_items').select('*')
```

Why: when the query changes, it changes in one place. Query directly and it
breaks silently across five screens, and the backend team can't fix it because
they don't know it exists.

---

## Stack: still undecided — this blocks you

Nothing in `src/` can be built until this is settled. See
[`../docs/FRONTEND_DECISION.md`](../docs/FRONTEND_DECISION.md).

| Option | Hosting | Can import `backend/services/`? | Cost |
|---|---|---|---|
| **A. Plain HTML/CSS/JS** | Vercel, as-is | Yes | None — edit, refresh, done |
| **B. React/TypeScript** | Vercel | Yes | A build step and setup time |
| **C. Python (Flask/Django)** | **Render, not Vercel** | **No** — would use `supabase-py` against the same contract | Adds a server tier; Python can't run in a browser |
| **D. Python desktop** | Not web-hosted | No | Gives up the live URL entirely |

**If the two of you can't agree, default to A.** The decision matters less than
the days lost deciding. Write it in `FRONTEND_DECISION.md` with one paragraph
on why, and move.

That is why this folder has no `package.json`, no `requirements.txt` and no
framework config — adding them now would pick the answer by accident.

---

## Layout

| Path | State | Purpose |
|---|---|---|
| `src/index.html` | Placeholder | Proves the Vercel pipeline works. Replace with the real login screen (POS-8) |
| `src/` | Empty | Screens and their logic |
| `assets/` | Empty | Images, icons, fonts |
| `tests/` | Empty | Fill in once the stack is chosen |

Suggested structure once you decide — keep one file per screen so you two
almost never edit the same file:

```
src/
  index.html          login (entry point)
  pages/              one file per screen
  js/screens/         one module per screen
  js/components/      shared pieces
  css/styles.css      base styles + design tokens
```

---

## Screens — all 13, from the 491A boundary objects

Fill in the Owner column at sprint planning so nobody builds the same screen twice.

| Screen | Use Case | Sprint | Owner |
|---|---|---|---|
| Login | 1 Login/Logout | 1 | Bismah |
| Staff Menu (browse) | 6 View Menu | 1 | Minh Tri |
| New Order | 2 Create Order | 1 | Bismah |
| Modify Order | 3 Modify Order | 2 | Bismah |
| Checkout | 4 Process Payment | 2 | Minh Tri |
| Active Orders Queue | 7 View Active Orders Queue | 2 | Minh Tri |
| Owner Menu (admin) | 8 Manage Menu Items | 3 | Bismah |
| Inventory (admin) | 9 Manage Inventory | 3 | Bismah |
| Staff Accounts (admin) | 12 Manage Staff Accounts | 3 | Minh Tri |
| Refund (admin) | 13 Process Refund | 3 | Minh Tri |
| Reports | 10 View Sales Reports | 4 | Bismah |
| Export Reports | 11 Export Reports | 4 | Minh Tri |
| Transaction Logs | 14 View Transaction Logs | 4 | Minh Tri |

---

## Do not wait for the backend

Nghia publishes function names, parameters and return shapes to
`API_CONTRACT.md` on day one, before implementing them. Build against those
with fake data immediately:

```js
// src/js/services/menu.stub.js — delete when the real module lands
export async function listMenuItems() {
  return {
    data: [
      { menu_item_identifier: '1', menu_item_name: 'Latte',
        menu_item_category_type: 'Espresso', menu_item_price_amount: 4.00,
        menu_item_availability_status: true },
      { menu_item_identifier: '2', menu_item_name: 'Cortado',
        menu_item_category_type: 'Espresso', menu_item_price_amount: 4.00,
        menu_item_availability_status: false },
    ],
    error: null
  }
}
```

Swap the import when the real module is merged. **If either of you is idle
waiting on backend, something went wrong with this plan — say so at the daily
scrum the same day.**

---

## Things that will bite you

**Money.** Round at each step, not at the end. Floating point accumulates
error and your total lands a cent off — which a grader will notice in a POS
demo. At 10.25%, a $4.00 latte is $0.41 tax and $4.41 total.

```js
const tax = Math.round(subtotal * 0.1025 * 100) / 100
```

**Double-tap.** Disable the confirm button while the request is in flight. A
barista tapping twice during a rush creating two orders is a real bug in a real
POS, and it's the kind of thing a demo surfaces at the worst moment.

**Empty screen, no error.** This almost always means a missing RLS policy on
the backend, not a bug in your code. Ask Tin before you spend an hour on it.
It's the single most common confusion on this stack.

**Never show raw auth errors.** "Incorrect email or password" is all the user
gets. Raw errors leak which accounts exist.

**Session state.** After logout use `window.location.replace()`, not `href` —
otherwise the back button restores the previous screen.

---

## Designing for the counter

- **Touch targets at least 44×44 px.** Thumbs, not mouse pointers.
- **No hover-only interactions.** There is no hover on a touchscreen.
- **High contrast.** Coffee shops have glare and uneven lighting.
- **Big, obvious confirm buttons.** Destructive actions (remove item, cancel
  order) visually distinct from constructive ones.
- **Test at 768px width** in your browser's device toolbar — not at 1440px,
  where everything looks fine and nothing is representative.

---

## Running it

```bash
npx serve frontend/src
# or
python3 -m http.server 8000 --directory frontend/src
```

Use a local server, not `file://` — opening the file directly causes CORS
errors that look like backend problems and aren't.

Copy `.env.example` to `.env` and get the values from Tin. The publishable key
is safe in browser code; it is only safe *because* the RLS policies are
correct.

---

## Sprint 1 checklist for this folder

- [ ] **Stack decision recorded** in `FRONTEND_DECISION.md` — *this blocks everything else*
- [ ] **POS-8** Login screen (Bismah)
- [ ] **POS-9** Build the order: add items, customize size / milk / add-ons (Bismah)
- [ ] **POS-10** Running subtotal, tax and total (Bismah)
- [ ] **POS-11** Browse menu by category, unavailable items marked (Minh Tri)
- [ ] **POS-12** Confirm order, show the order number (Minh Tri)
- [ ] **POS-13** Logout (Minh Tri)

Your stories with code patterns for each:
[`../guides/FRONTEND-GUIDE-Sprint1.md`](../guides/FRONTEND-GUIDE-Sprint1.md)

**Done means deployed.** Merged to `main` is not done — check the live Vercel
URL after every merge.

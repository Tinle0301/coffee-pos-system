# Frontend Team Guide — Sprint 1
**Bismah (order screens) · Minh Tri (menu, confirm, logout)**
Sprint: `Create Order End-to-End` · Sept 14–27, 2026

---

## 0. The stack decision — Friday Sept 18

You two own this. Options and consequences:

| Option | Hosting | Can it use backend/services/? | Notes |
|---|---|---|---|
| **A. Plain HTML/CSS/JS** | Vercel, as-is | Yes | No build step. Edit a file, refresh. Fastest start. |
| **B. React/TypeScript** | Vercel | Yes | Build step, more setup, better for complex state |
| **C. Python (Flask)** | Render, **not Vercel** | **No** — would use supabase-py | Python can't run in a browser; this adds a server tier |
| **D. Python desktop** | Not web-hosted | No | Rules out the live URL entirely |

**If you can't agree by Friday, default to A.** The decision matters less than the week you'd lose arguing. Everything below assumes A; if you choose B the concepts are identical, only the syntax changes.

Write the decision in `docs/FRONTEND_DECISION.md` with one paragraph on why.

---

## 1. Setup (Day 1, ~20 min)

Create `.env` in the repo root (gitignored):

```
SUPABASE_URL=https://inwlmodlxpcajgivmlbr.supabase.co
SUPABASE_PUBLISHABLE_KEY=<get from Tin>
```

Run locally — any static server works:

```bash
npx serve frontend
# or
python3 -m http.server 8000 --directory frontend
```

The publishable key is safe in browser code. It is *only* safe because Tin's RLS policies are correct — the key is not the security, the policies are.

---

## 2. The one rule

**You never write SQL or call Supabase directly.** Everything goes through `backend/services/`.

```js
// yes
import { listMenuItems } from '../../backend/services/menu.js'
const { data, error } = await listMenuItems()

// no
const { data } = await supabase.from('menu_items').select('*')
```

Why: when Nghia changes a query, it changes in one place. When you query directly, it breaks silently in five screens.

---

## 3. Do not wait for the backend

Nghia publishes function signatures to `docs/API_CONTRACT.md` on day one, before implementing them. Build against those with fake data from hour one:

```js
// frontend/js/services/menu.stub.js — delete once the real module lands
export async function listMenuItems() {
  return {
    data: [
      { menu_item_identifier: '1', menu_item_name: 'Latte',
        menu_item_category_type: 'Espresso', menu_item_price_amount: 4.50,
        menu_item_availability_status: true },
      { menu_item_identifier: '2', menu_item_name: 'Cold Brew',
        menu_item_category_type: 'Brewed', menu_item_price_amount: 3.75,
        menu_item_availability_status: false },
    ],
    error: null
  }
}
```

Swap the import when the real module is merged. If you find yourself idle waiting on backend, something went wrong with this plan — raise it at the daily scrum.

---

# BISMAH — Order screens (11 points)

## Story #8 — Login Screen (3 pts)

Email + password form, error state, redirect to the order screen on success.

```js
import { signIn } from '../../backend/services/auth.js'

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const { data, error } = await signIn(email.value, password.value)
  if (error) {
    errorEl.textContent = 'Incorrect email or password'
    return
  }
  window.location.href = '/pages/order.html'
})
```

Never show the raw error to the user — "Incorrect email or password" is all they need. Raw auth errors leak information about which accounts exist.

**Acceptance:** valid credentials land on the order screen; invalid shows a clear message; works at tablet width.

## Story #9 — Build the Order (5 pts)

The core screen. Keep the working order in a plain JavaScript array in memory — it does not go to the database until #12 Confirm.

```js
let currentOrder = []   // [{ menuItem, quantity, customization, lineTotal }]

function addItem(menuItem, customization = {}) {
  currentOrder.push({
    menuItem,
    quantity: 1,
    customization,
    lineTotal: calculatePrice(menuItem, customization)
  })
  render()
}
```

Customizations for Sprint 1: **size** (S/M/L), **milk type** (whole, oat, almond, none), **add-ons** (extra shot, syrup). Each modifies the price — agree the rules with Minh Tri and write them down so his menu display and your pricing don't disagree.

**Acceptance:** items add; customizations apply per item; items can be removed before confirming.

## Story #10 — Order Summary Totals (3 pts)

Subtotal, tax, total — recalculating on every change.

```js
function calculateTotals(order) {
  const subtotal = order.reduce((sum, line) => sum + line.lineTotal * line.quantity, 0)
  const tax = Math.round(subtotal * 0.1025 * 100) / 100   // LA County ~10.25%
  return { subtotal, tax, total: subtotal + tax }
}
```

**Round at each step, not at the end.** Floating-point money accumulates error and your total ends up a cent off — which a grader absolutely will notice in a POS demo.

**Acceptance:** totals update on every change; tax correct to the cent.

---

# MINH TRI — Menu, confirm, logout (11 points)

## Story #11 — Browse Menu by Category (5 pts)

Live menu from the database, grouped by category, unavailable items clearly marked.

```js
import { listMenuItems } from '../../backend/services/menu.js'

const { data: items, error } = await listMenuItems()
if (error) { showError('Could not load the menu'); return }

const byCategory = items.reduce((groups, item) => {
  (groups[item.menu_item_category_type] ||= []).push(item)
  return groups
}, {})
```

Unavailable items stay visible but are dimmed and not clickable — hiding them makes a barista think the shop stopped selling it.

**Acceptance:** menu loads from the database, grouped by category, unavailable items visibly marked.

## Story #12 — Confirm Order (5 pts)

Calls Nghia's `create_order` function through the orders service, shows the order number.

```js
import { createOrder } from '../../backend/services/orders.js'

async function confirmOrder(currentOrder, staffId) {
  const items = currentOrder.map(line => ({
    menu_item_id: line.menuItem.menu_item_identifier,
    quantity: line.quantity,
    customization: describeCustomization(line.customization),
    price: line.lineTotal
  }))

  const { data: orderId, error } = await createOrder(items, staffId)
  if (error) { showError('Could not save the order — try again'); return }
  showConfirmation(orderId)
}
```

**Disable the confirm button while the call is in flight.** A barista double-tapping during a rush creates two orders, and that is a real bug in a real POS.

**Acceptance:** confirm saves the order, shows the order number, row visible in the database with status "Pending."

## Story #13 — Logout (1 pt)

Logout control on every screen once signed in; ends the session; back button does not restore it.

```js
import { signOut } from '../../backend/services/auth.js'

logoutBtn.addEventListener('click', async () => {
  await signOut()
  window.location.replace('/index.html')   // replace, not href — kills the back entry
})
```

Coordinate with Tin — his Session Timeout story (#4) calls the same sign-out path.

---

## Building for a tablet, not a laptop

This runs on a counter during a rush. Design accordingly:

- Touch targets **at least 44×44 px**. A barista uses a thumb, not a mouse.
- No hover-only interactions — there is no hover on a touchscreen.
- High contrast; coffee shops have glare and bad lighting.
- Big, obvious confirm buttons. Destructive actions (remove item, cancel order) visually distinct.
- Test at 768px width in your browser's device toolbar, not at 1440px.

---

## Common problems and what they actually mean

| Symptom | Most likely cause |
|---|---|
| Query returns empty, no error | **Missing RLS policy.** Check with Tin before debugging your code. |
| "relation does not exist" | The migration isn't pushed, or you're on stale local data. Pull and `supabase db push`. |
| 401 / not authenticated | Session expired, or you're calling before login completes. |
| Totals off by a cent | Rounding at the end instead of each step. |
| CORS error | You're opening the file directly (`file://`). Use a local server. |

---

## Resources

- supabase-js reference: https://supabase.com/docs/reference/javascript/introduction
- Auth with JS: https://supabase.com/docs/guides/auth/quickstarts/react (concepts apply to vanilla JS too)
- MDN JavaScript: https://developer.mozilla.org/en-US/docs/Web/JavaScript
- Flexbox/Grid layout: https://css-tricks.com/snippets/css/a-guide-to-flexbox/
- Touch target sizing: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

---

## Working agreements

- Branch naming: `feature/<issue-number>-<short-description>`
- One teammate reviews every PR before merge
- Never push to `main` directly
- Every merge to main deploys to the live URL — check it after merging
- Blocked more than half a day? Say it at the daily scrum

## Definition of Done

Merged to `main` via reviewed PR · deployed and working on the live URL · acceptance criteria met · demoed to the team.

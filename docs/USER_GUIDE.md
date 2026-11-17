# User Guide

How baristas and admins use the Coffee POS.
Live site: https://coffee-pos-system-omega.vercel.app — best on a tablet
(1024 × 768 or larger) or any desktop browser.

---

## Logging in and out

- Sign in with your staff email and password. Baristas land on **New
  Order**; admins land on **Admin Home**.
- **Log Out** is in the header. The register also **signs out by itself
  after 10 minutes with no taps or typing**, so a walked-away register
  can't be used by someone else.
- If someone logs in as a different person (or logs out) in another tab,
  this tab reloads to match, so an order is never saved under the wrong
  person.
- A deactivated account can't log in ("This account has been
  deactivated."). Ask an admin.

---

## Barista

### 1. Take an order — New Order

1. Pick a category tab, then tap **Add** next to an item. Unavailable
   items don't show up.
2. Drinks open a **customize** window:
   - Size: Small, Medium (+$0.50), Large (+$1.00)
   - Milk: Whole, Skim, Oat (+$0.60), Almond (+$0.60)
   - Add-ons: Extra shot (+$0.75), Whipped cream (+$0.50), Decaf
   Pastries and food go straight into the order.
3. The order list shows each line, the subtotal, 9% tax and the total.
   **Edit** or remove a line there before you submit.
4. **Proceed to Confirmation** → check the order → **Submit Order to
   Kitchen**. The order goes on the queue and the Payment screen opens.
   - **Cancel Order** (tap twice) clears an order that hasn't been
     submitted.

### 2. Take payment — Payment

1. Choose **Cash** or **Card**.
2. Cash: type the amount received; **Change due** updates as you type.
   **Complete sale** turns on once the amount covers the total.
3. **Complete sale**. You'll see "Sale complete." (and the change to
   give for cash). Stock for the order's recipe is deducted at this
   moment.
4. **Start new order** for the next customer.

### 3. Make the drinks — Active Orders

Header → **Active Orders**. The queue updates live on every device.

| The order shows | Tap | What happens |
|---|---|---|
| Pending (paid) | **Start** | Moves to In Progress |
| In Progress (paid) | **Complete** | Done; it leaves the queue |
| **Not paid** | **Pay** | Opens Payment for that order |
| **Not paid** | **Cancel** (tap twice) | Cancels it; it leaves the queue |

An order can't be completed until it's paid ("pay first, then make").
A paid order can't be cancelled; an admin refunds it instead.

### 4. Look something up — Today's Orders

Header → **Today's Orders**: every order from today, newest first, with
its status, payment (method and amount, or "Unpaid") and total. Baristas
see their own orders; admins see everyone's.

---

## Admin

Everything a barista can do, plus **Admin Home** (header → **Admin
Home**), which has a tile for every screen. The **Inventory** tile shows
how many items are low on stock.

### Menu Management
- **+ Add item**: name, category (or a new one) and price.
- **Edit** changes a name, category or price.
- The **on/off switch** hides an item from New Order (sold out) without
  deleting it.

### Inventory
- Every stock item with its amount and low-stock line; **Needs attention**
  shows only low and out-of-stock items.
- **Restock** adds an amount to an item. Every change (restock or checkout)
  is recorded in the stock log.
- New stock items and recipes (which menu item uses how much) are added in
  the Supabase SQL Editor for now; see SETUP.md.

### Staff Accounts
- Change a person's role (Barista / Admin), **Deactivate** or
  **Reactivate** them. You can't change or deactivate yourself, so the
  shop always keeps an admin.
- New staff logins are created in the Supabase dashboard (SETUP.md,
  "Adding a staff member").

### Refunds
1. Pick a recent payment, or paste its payment ID and **Look up**.
2. **Full refund**, or **Partial refund** with an amount.
3. **Review refund** → **Confirm refund**. A payment can only be refunded once.

### Sales Report
- Pick a date, choose **Day** or **Week** (Monday–Sunday), **Show
  report**: the total revenue for that day or week. (Sales by payment
  method are on the Reports Dashboard.)
- **Export CSV** downloads the report.
- **Past reports** lists the saved weekly reports to compare weeks.
- Revenue includes refunded sales (it's what was taken in); refunds are
  listed in the Transaction Log.

### Reports Dashboard
- **Today**, **Last 7 days**, **Last 30 days**, or your own dates.
- Best sellers, busiest hours and sales by payment method, all in the
  shop's time (Los Angeles).

### Transaction Log
- Every order, payment, status change, cancellation and refund, with who
  did it. Entries can't be edited or deleted.
- Filter by order ID and/or From–To dates (whole days, local time).
- **Export CSV** downloads exactly what's on screen.

---

## When something goes wrong

| You see | What to do |
|---|---|
| "Incorrect email or password." | Check the email and password; ask an admin to reset it in Supabase. |
| An order says **Not paid** on the queue | Tap **Pay** to take payment, or **Cancel** if the customer left. |
| "…must be paid before completion" | Same as above: the order was never paid. |
| A screen shows a red error | Tap Refresh or open the screen again. If it keeps happening, tell the team lead. |
| "staff_id must match the authenticated caller" | Two people were logged in on the same browser. Log out and back in (the app now reloads the other tab automatically). |

# frontend/src/backend/ — generated copy, do not edit

Vercel deploys only `frontend/src/`, so the live site can't import files
from `backend/`. This folder is a copy of the backend files the site needs.

**Edit the file in `backend/`, then run the sync** (from the repo root):

```bash
node scripts/sync-backend.mjs
```

or, from `frontend/src/`: `npm run sync-backend`. Commit both the
`backend/` change and the updated copy here.

CI runs `node scripts/sync-backend.mjs --check` on every PR and fails if
this folder no longer matches `backend/`.

| Copy here | Source |
|---|---|
| `config.js` | `backend/config.js` |
| `supabase-client.js` | `backend/supabase-client.js` |
| `auth.js` | `backend/services/auth.js` (import path adjusted) |
| `services/menu.js` | `backend/services/menu.js` |
| `services/orders.js` | `backend/services/orders.js` |
| `services/orderItems.js` | `backend/services/orderItems.js` |
| `services/payments.js` | `backend/services/payments.js` |
| `services/queue.js` | `backend/services/queue.js` |
| `services/orderStatus.js` | `backend/services/orderStatus.js` |

To ship another backend file to the site, add it to `FILES` in
`scripts/sync-backend.mjs` and run the script.

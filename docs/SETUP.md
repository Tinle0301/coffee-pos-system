# Setup

For a teammate who has never used Supabase before.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in / create an
   account.
2. Create a new project (pick a name, a database password, and a region).
   Save the database password somewhere safe — you'll need it for CLI
   linking.
3. Once the project is provisioned, go to **Project Settings > API** and
   note:
   - **Project URL** -> this is `SUPABASE_URL`
   - **anon public key** -> this is `SUPABASE_ANON_KEY`
   - **service_role key** -> do **not** copy this into any file in this
     repo. See the warning below.

## 2. Install the Supabase CLI

```bash
brew install supabase/tap/supabase
```

(See the [Supabase CLI docs](https://supabase.com/docs/guides/cli) for
other platforms.)

## 3. Link the local repo to your project

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

The project ref is in your project's dashboard URL:
`https://supabase.com/dashboard/project/<project-ref>`.

## 4. Run migrations

```bash
supabase db push
```

This applies everything in `backend/migrations/` in numeric order
(`0001_schema.sql`, `0002_rls_policies.sql`, `0003_functions.sql`).

For local development against a local Postgres instead of the hosted
project:

```bash
supabase start
supabase db reset
```

`db reset` applies all migrations and then `backend/seed/seed.sql`.

## 5. Load seed data

If you didn't use `supabase db reset` above, load it manually:

```bash
psql "<your-connection-string>" -f backend/seed/seed.sql
```

## 6. Run locally

- **Backend:** nothing to run — Supabase is hosted (or `supabase start`
  for a local instance). Set env vars as below.
- **Frontend:** see `frontend/README.md` — no framework decided yet, so no
  local dev server exists until `docs/FRONTEND_DECISION.md` is resolved.

## 7. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
SUPABASE_URL=<Project URL from step 1>
SUPABASE_ANON_KEY=<anon public key from step 1>
```

### ⚠️ service_role key warning

The **anon key** is safe to ship in frontend code — it's meant to be
public, and every request made with it is still subject to Row Level
Security.

The **service_role key bypasses RLS entirely.** It must never be:
- committed to this repo,
- put in `.env.example`, `.env.local`, or any file that gets bundled to
  the browser,
- used anywhere in `frontend/` or in code that ships to a client.

If you ever need it (e.g. a one-off admin script run locally), keep it out
of version control and out of any client-shipped bundle.

## 8. Vercel deployment

Vercel auto-deploys from GitHub on push to `main` — there is no deploy
workflow in `.github/workflows/`. Set these in the **Vercel dashboard**
(Project Settings > Environment Variables), not in a committed file:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

(Same warning as above: never add `SUPABASE_SERVICE_ROLE_KEY` to Vercel's
environment variables for this project — the frontend has no server-side
code to keep it secret from the browser bundle.)

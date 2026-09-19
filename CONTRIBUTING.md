# Contributing

## Branching model

```
main                 protected · deploys to the live Vercel URL
│                    backend work integrates here directly
└── frontend         long-lived · Bismah and Minh Tri integrate here,
                     merges into main after testing
```

**Backend (Tin, Ryan, Nghia)** — work goes straight to `main`:

```bash
git checkout main
git pull origin main
git checkout -b feature/POS-7-rls-policies
# ...work, commit, push...
# open a PR into `main`
```

**Frontend (Bismah, Minh Tri)** — work goes to the `frontend` branch first:

```bash
git checkout frontend
git pull origin frontend
git checkout -b feature/POS-12-confirm-order
# ...work, commit, push...
# open a PR into `frontend`
```

The `frontend` branch merges into `main` once the screens have been tested
together.

| Branch | Merges into | Reviewed by |
|---|---|---|
| `feature/POS-7-...` (backend) | `main` | one backend teammate |
| `feature/POS-12-...` (frontend) | `frontend` | the other frontend teammate |
| `frontend` | `main` | one person from each side |

`main` stays protected — no direct pushes from anyone, including backend. A
short-lived story branch and a one-person review is the cost, and it is what
keeps a broken commit from taking down the live URL that everyone demos from.

## Keeping the frontend branch current

Backend lands on `main` continuously, so the `frontend` branch goes stale
fast. Pull `main` down into it **every couple of days**:

```bash
git checkout frontend
git pull origin main        # take the backend's latest
# resolve conflicts here, in the branch, not in a PR
git push origin frontend
```

Merge `frontend` into `main` **at least twice per sprint**, not only at the
end. Two weeks of divergence is where student projects lose a weekend.

**Nothing reaches the live URL until it is on `main`.** Vercel deploys `main`
only. Vercel generates a preview URL for each pull request — use that to show
frontend work that has not merged yet.

## Branch naming

```
feature/<JIRA-KEY>-<short-description>     feature/POS-7-rls-policies
fix/<JIRA-KEY>-<short-description>         fix/POS-12-total-rounding
docs/<short-description>                   docs/api-contract
```

## Commit messages

Every commit starts with the Jira key:

```
POS-7: Enable RLS on all 11 tables
```

Required, not a nicety. The graded per-sprint Code Contributions report maps
committed files to Jira tasks, and an untagged commit cannot be counted for
anyone.

Commit your own work — the commit author is the only record of who did what,
and contributions are graded per person.

## Reviews

- One review from your own sub-team for a story branch.
- Two reviews, one from each side, for `frontend` → `main` or any change
  touching `docs/API_CONTRACT.md`.

## Schema changes

Only via numbered migration files in `backend/migrations/`. Nobody edits tables
by hand in the Supabase dashboard.

## Never commit

`.env` · any `sb_secret_...` or legacy `service_role` key · database passwords ·
`node_modules/` · `.DS_Store`

This repo is public, and git history keeps a secret even after you delete it.
If you push one by accident, tell Tin immediately — the key must be rotated,
not just removed.

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for the full process.

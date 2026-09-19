# Contributing

## Branching model

Two long-lived integration branches, one per sub-team:

```
main                 protected, deployed to the live Vercel URL
├── backend          Tin, Ryan, Nghia integrate here
└── frontend         Bismah, Minh Tri integrate here
```

**Work in a story branch off your team branch, not directly on it:**

```bash
git checkout backend
git pull origin backend
git checkout -b feature/POS-7-rls-policies
# ...work, commit, push...
# open a PR into `backend`
```

| Branch | Merges into | Reviewed by |
|---|---|---|
| `feature/POS-7-...` | your team branch | one teammate on your side |
| `backend` / `frontend` | `main` | one person from each side |

`main` is protected: no direct pushes, ever.

## Merging to main

The two team branches merge into `main` after the work has been tested.

**Do this at least twice per sprint, not only at the end.** Two branches that
sit apart for two weeks diverge, and the merge that follows is where student
projects lose a weekend. Merge `main` back down into your team branch every
couple of days so the gap never gets big:

```bash
git checkout backend
git pull origin main        # take everyone else's work
# fix any conflicts here, in your branch, not in the PR
```

Also: **nothing reaches the live URL until it's on `main`.** Vercel deploys
`main`. Use the preview URL Vercel generates for each pull request when you
need to show work that hasn't merged yet.

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

This is required, not a nicety. The graded per-sprint Code Contributions
report maps committed files to Jira tasks, and an untagged commit can't be
counted for anyone.

Commit your own work — the commit author is the only record of who did what,
and contributions are graded per person.

## Reviews

- One review from your own sub-team for a story branch merging into
  `backend` or `frontend`.
- Two reviews, one from each side, for `backend` → `main`, `frontend` → `main`,
  or any change touching `docs/API_CONTRACT.md`.

## Schema changes

Only via numbered migration files in `backend/migrations/`. Nobody edits tables
by hand in the Supabase dashboard.

## Never commit

`.env` · any `sb_secret_...` or legacy `service_role` key · database passwords ·
`node_modules/` · `.DS_Store`

This repo is public, and git history keeps a secret even after you delete it.
If you push one by accident, tell Tin immediately — the key must be rotated,
not just removed.

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for the full process, including what
to do when the API contract changes.

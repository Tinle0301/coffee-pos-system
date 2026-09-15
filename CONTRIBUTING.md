# Contributing

## Branch protection

`main` is protected. No direct pushes — all changes go through a pull
request.

## Branch naming

```
feature/<issue-number>-<short-description>
```
Example: `feature/17-refund-flow`.

## Reviews

- One review from the owning sub-team for changes confined to
  `frontend/` or `backend/`.
- Two reviews (one from each sub-team) if `docs/API_CONTRACT.md` is
  touched.

## Schema changes

Only via migration files in `backend/migrations/`, numbered sequentially.
Nobody edits tables by hand in the Supabase dashboard.

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for the full process, including
what to do when the API contract changes.

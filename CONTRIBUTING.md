# Contributing

## Branch protection

`main` is protected. No direct pushes — all changes go through a pull
request.

## Branch naming

```
feature/<jira-task-label>-<short-description>
```
Example: `feature/A-17-refund-flow`.

## Commit messages and PR titles

Prefix with the Jira task label, e.g. `[A-17] Add refund confirmation
dialog`. This is required, not just a nicety — the graded per-sprint Code
Contributions report (see
[docs/WORKFLOW.md](docs/WORKFLOW.md#code-contributions-reporting-sprint-grading))
is compiled from Jira task labels tied to committed files, so untagged
commits can't be counted.

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

# Workflow

How the two sub-teams (`frontend/`, 2 people; `backend/`, 3 people) work in
parallel without blocking each other.

## Branch naming

```
feature/<issue-number>-<short-description>
```
Example: `feature/42-checkout-screen`.

## Review rules

- One review from the owning sub-team for changes within `frontend/` or
  `backend/`.
- **Two reviews** (one from each sub-team) if `docs/API_CONTRACT.md` is
  touched — see the PR template checkbox.
- No direct pushes to `main`. `main` is protected.

## When the API contract changes

1. Open an issue or comment describing the proposed change to
   `docs/API_CONTRACT.md` *before* opening the PR, so the other sub-team
   isn't surprised by it in review.
2. Update `docs/API_CONTRACT.md` in the same PR as any code change that
   depends on it.
3. Check the "this changes the API contract" box in the PR template — this
   triggers the two-review rule.

## Frontend does not wait on backend

The frontend sub-team codes against `docs/API_CONTRACT.md` with **stubbed
return values** matching the documented shapes, rather than waiting for
`backend/services/*.js` to have real implementations. This is the whole
point of writing the contract down: it's the shared source of truth, not
the JS files.

## Schema changes are migration files only

Nobody edits tables by hand in the Supabase dashboard, ever — not even to
"try something quickly." All schema changes are new numbered files in
`backend/migrations/` (e.g. `0004_*.sql`), committed to the repo, reviewed
like any other backend change, and applied with `supabase db push`. Check
the "this adds a migration" box in the PR template so reviewers know to
check for a `db push` before merge.

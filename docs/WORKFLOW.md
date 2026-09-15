# Workflow

How the two sub-teams (`frontend/`, 2 people; `backend/`, 3 people) work in
parallel without blocking each other.

## Task tracking: Jira + GitHub

**Jira is the system of record for sprint planning and task numbers.**
Story points, sprint assignment, and the task label (e.g. `A-22`) all live
in Jira — not in GitHub Issues. This matters beyond planning: the
per-sprint Code Contributions report graded in this course (see
[Code Contributions Reporting](#code-contributions-reporting-sprint-grading)
below) requires every committed file to be traceable to a Jira task
number, so the discipline below isn't optional.

- Every commit message and PR title/description that implements a Jira
  task **must include that task's label**, e.g.:
  ```
  [A-22] Add checkout screen submit handler
  ```
- GitHub Issues (`.github/ISSUE_TEMPLATE/`) are still used for bug reports
  and lightweight code-review discussion, but they are not the source of
  truth for sprint task numbers — if a GitHub issue corresponds to a Jira
  task, reference the Jira label in the issue body.
- Record the team's Jira project URL in `README.md` (Project Management
  section) once it exists.

## Branch naming

```
feature/<jira-task-label>-<short-description>
```
Example: `feature/A-22-checkout-screen`.

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

## Code Contributions Reporting (sprint grading)

**This is a graded deliverable, submitted once per Sprint via the course
Assignment tool.** The instructor's rubric is strict: using anything other
than the exact mandatory format below is worth 0 points for the whole
team, regardless of how much work was actually done. Read this section
before the first sprint deadline, not after.

### Mandatory format

```
Team Name: <team name>

<Team Member Name>: <# files committed>; <Jira task label(s) completed>; <file names committed for that task>
<Team Member Name>: <# files committed>; <Jira task label(s) completed>; <file names committed for that task>
... one line per team member ...
```

Example (from the rubric):

```
Team Name: The C Team

John Doe: 4 files committed. A-22; a.java, b.java; A-48; w.java, u.java;
Mary Smith: 5 files committed. A-13; c.java, d.java; A-12; x.java, y.java, z.java;
```

### The below-average-commits rule

1. Compute the average number of files committed per team member this
   sprint, rounded **down**.
2. Any team member whose commit count is below that average **must**
   include a reason on their line (e.g. blocked on a dependency, out sick,
   task turned out to be smaller than estimated). No reason = 0 points for
   that member's Code Contributions grade this sprint, even if the rest of
   the team's report is fine.

### Where this lives in the repo

- Keep a running copy of each sprint's report in
  `docs/sprint-reports/sprint-<N>.md`, copied from
  `docs/sprint-reports/TEMPLATE.md`. This is the team's own record — the
  graded copy still goes through the course's Assignment tool, but keeping
  it in the repo means it's derived from the same Jira task labels and
  file lists as the actual commits, not reconstructed from memory the
  night it's due.
- Whoever compiles the report for a given sprint should pull each
  teammate's Jira task labels and committed file names directly from that
  teammate's merged PRs (`git log --author=<name> --oneline` and the PR
  list both work) rather than trusting a self-report — this is also why
  commit messages and PR titles are required to carry the Jira task label
  (see [Task tracking](#task-tracking-jira--github) above).

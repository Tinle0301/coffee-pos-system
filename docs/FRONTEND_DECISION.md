# ADR: Frontend Stack

**Status:** Undecided
**Decision deadline:** _TBD — fill in before Sprint 2 planning_

## Context

The frontend sub-team (2 people) has not chosen a stack and leans Python.
The backend (Supabase + `backend/services/` JS modules) does not require
any particular frontend technology, but the choice affects hosting,
whether the JS data-access layer is reusable, learning curve, and how much
of the first sprint goes to tooling instead of screens.

## Options

### A. Plain HTML/CSS/vanilla JS
- **Hosting:** deploys to Vercel as static files, as-is.
- **Backend JS reuse:** yes — imports `backend/services/*.js` directly.
- **Learning curve:** lowest; no build step.
- **Sprint impact:** fastest to a working screen; less structure as the app
  grows (no components, manual DOM updates).

### B. React/TypeScript
- **Hosting:** Vercel, with a build step.
- **Backend JS reuse:** yes — imports `backend/services/*.js` directly.
- **Learning curve:** moderate-high if the team hasn't used React/TS.
- **Sprint impact:** more setup time up front (build tooling, component
  structure), better structure for 13 screens across a semester.

### C. Python (Flask/Django)
- **Hosting:** CANNOT deploy to Vercel — needs Render (or similar) instead.
- **Backend JS reuse:** no — `backend/services/*.js` is unusable from
  Python. Would call Supabase directly via `supabase-py` against the same
  tables, following the same [API_CONTRACT.md](API_CONTRACT.md).
- **Learning curve:** lowest for a team that leans Python.
- **Sprint impact:** two hosting providers to manage instead of one; the
  API contract must be enforced by discipline (no shared JS code to lean
  on); RLS still applies identically since auth still goes through
  Supabase Auth.

### D. Python desktop app
- **Hosting:** not web-hosted at all — runs on the POS terminal directly.
- **Backend JS reuse:** no, same as C.
- **Learning curve:** lowest for a team that leans Python; no web
  deployment concerns at all.
- **Sprint impact:** loses the "auto-deploy from GitHub on push" workflow
  entirely; touch-target/tablet requirements (see REQUIREMENTS.md) need a
  desktop UI toolkit instead of CSS.

## Decision

_Empty — record the chosen option, who decided, and the date once the
frontend sub-team picks._

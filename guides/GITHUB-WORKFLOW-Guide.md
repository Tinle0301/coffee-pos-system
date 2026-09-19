# GitHub Workflow — How We Submit Code
**Team POS · CECS 491B · All members**
Repo: `github.com/Tinle0301/coffee-pos-system` · Live: `coffee-pos-system-omega.vercel.app`

---

## 1. THE GRADED REQUIREMENT — read this first

Every sprint, the team submits **one Code Contributions document** via Assignment. The format is mandatory:

```
Team Name: POS

<Member Name>: <#> files committed. <Jira task>; <file1>, <file2>; <Jira task>; <file3>, <file4>;
<one line per team member>
```

Example from the professor:
```
Team Name: The C Team
John Doe:  4 files committed.  A-22;  a.java, b.java; A-48; w.java, u.java;
Mary Smith: 5 files committed. A 13; c.java, d.java; A-12; x.java; y.java, z.java;
```

**Grading:**
- **Wrong format = the whole team gets 0 points.** Not a deduction — zero.
- Any member below the team average (rounded down) **must state a reason** on their line.
- If the instructor doesn't accept the reason, that member gets 0 for Code Contributions that sprint. Otherwise 1 point.

### What this means for how we work

| Requirement | What we do |
|---|---|
| Contributions are counted **per person** | Everyone commits and pushes their **own** work. Never let one person push someone else's code — the commit author is the only record of who did it. |
| Files must be listed **per Jira task** | Every commit message starts with its Jira key: `POS-12: Add order confirmation modal` |
| Below average needs a reason | Watch the board mid-sprint. If you're behind, say so at the daily scrum while there's still time to fix it — not in the submission doc. |
| Branch names carry the Jira key | `feature/POS-12-confirm-order` |

Pair programming is fine, but the person who typed is the commit author. If two people genuinely built something together, split it into two commits or add a `Co-authored-by:` trailer — and flag it to the instructor rather than assuming it counts for both.

### Generating the numbers at sprint end

Don't count by hand. From the repo root:

```bash
# files each person touched this sprint
git log --since=2026-09-14 --until=2026-09-28 --author="Bismah" --name-only --pretty=format: | sort -u

# commit count per person
git shortlog -sn --since=2026-09-14 --until=2026-09-28
```

Cross-check against the Jira tasks each person closed, then fill in the template at `Plan/Code-Contributions-Template.md`.

**Tin submits the document.** Everyone sends their own line by the Sunday before it's due.

---

## 2. One-time setup (everyone, ~10 min)

```bash
# clone the repo
git clone https://github.com/Tinle0301/coffee-pos-system.git
cd coffee-pos-system

# set your identity — use your REAL name and school email
git config user.name "Your Full Name"
git config user.email "your.email@student.csulb.edu"
```

Why the real name matters: commits are how contribution is measured. A commit authored by "user123" with a personal email may not be credited to you.

Then create your `.env` (never committed):
```
SUPABASE_URL=https://inwlmodlxpcajgivmlbr.supabase.co
SUPABASE_PUBLISHABLE_KEY=<from Tin>
```

---

## 3. The rules — short version

1. **Never push directly to `main`.** Ever. It is branch-protected.
   Work goes: story branch → your team branch (`backend` / `frontend`) → `main`.
2. **One branch per story.** Named after your issue number.
3. **One pull request per story**, reviewed by a teammate before merge.
4. **Commit often, in small pieces.** Not one giant commit at the end of the sprint.
5. **Never commit secrets** — no `.env`, no secret keys, no passwords.
6. **Pull before you start working**, every time.

---

## 4. The daily cycle

### Starting a story

```bash
git checkout backend                     # or `frontend` — your team branch
git pull origin backend                  # ALWAYS pull first
git checkout -b feature/POS-12-confirm-order
```

Your story branch is cut from your **team branch**, not from `main`. Open the
pull request back into that same team branch. The team branch merges into
`main` after testing — at least twice a sprint, not only at the end.

**Branch naming:** `feature/<JIRA-KEY>-<short-description>`

| Type | Format | Example |
|---|---|---|
| New story | `feature/<JIRA-KEY>-<desc>` | `feature/POS-12-confirm-order` |
| Bug fix | `fix/<JIRA-KEY>-<desc>` | `fix/POS-28-total-rounding` |
| Docs only | `docs/<desc>` | `docs/api-contract` |

### While working

```bash
git add .
git commit -m "POS-12: Add order confirmation modal with order number"
git push origin feature/POS-12-confirm-order
```

Commit whenever a piece works — a few times a day, not once a week. Small commits are easier to review and easier to undo.

**Commit message format:**

```
<JIRA-KEY>: <verb> <what changed>

Optional: why, if it isn't obvious.
```

Good:
- `POS-12: Add order confirmation modal with order number`
- `POS-28: Fix tax rounding to calculate per line item`
- `POS-1: Create orders table with foreign keys and status constraint`

Bad:
- `update` · `fix bug` · `asdf` · `final version 2 FINAL`

Start with the Jira key, then a verb in present tense. The key is what makes the sprint-end contribution report possible. A teammate reading the commit list should understand the sprint's history without opening a single file.

### Finishing a story

```bash
git checkout main
git pull origin main
git checkout feature/POS-12-confirm-order
git merge main              # bring in others' work, fix conflicts HERE not in the PR
git push origin feature/POS-12-confirm-order
```

Then on GitHub: **Compare & pull request**.

---

## 5. Pull request rules

**Title:** the story name — `Confirm Order`

**Description:** use the template. It asks for:
- Linked issue (`Closes #12` — this auto-closes the issue on merge)
- Which side: frontend / backend / both
- What changed
- How you tested it
- ☐ This changes the API contract
- ☐ This adds a migration

**Reviewers:** one teammate from your own sub-team. **Two** (one from each side) if the PR touches `docs/API_CONTRACT.md`.

**Do not merge your own PR without a review.** The review is not a formality — it is how the other four people find out what changed.

### Reviewing someone's PR

You are expected to review within one working day. Being the bottleneck on a teammate's story is worse than a small bug getting through.

Look for: does it do what the story says · does it break anything else · any secrets committed · does the live site still work after merge.

Approve, or leave comments asking for changes. "LGTM" with no reading is not a review.

### After merge

Vercel deploys `main` automatically. **Open the live URL and confirm your change works there.** Merged is not Done — deployed and working is Done.

```bash
git checkout main
git pull origin main
git branch -d feature/POS-12-confirm-order   # clean up
```

---

## 6. What never goes in the repo

| Never commit | Why |
|---|---|
| `.env` | Contains keys |
| Any `sb_secret_...` key | Bypasses all database security |
| Legacy `service_role` key | Same |
| Database password | Full database access |
| `node_modules/` | Huge, regenerable |
| `.DS_Store` | macOS clutter |
| Personal notes, scratch files | Noise |

All of these are in `.gitignore` already. **The repo is public — anything pushed is visible to the world and stays in git history even after deletion.**

If you push a secret by accident: tell Tin immediately, do not just delete it in a new commit. The key must be rotated in Supabase.

---

## 7. Handling conflicts

Conflicts happen when two people change the same lines. They are normal, not a crisis.

```bash
git checkout main
git pull origin main
git checkout your-branch
git merge main
# Git lists conflicted files. Open each one, find the <<<<<<< ======= >>>>>>> markers,
# keep what's correct, delete the markers.
git add .
git commit -m "Merge main into feature branch"
git push
```

**Never resolve a conflict by deleting a teammate's work without asking them.** If you can't tell which version is right, message them — it takes two minutes and saves a day.

We avoid most conflicts by structure: frontend and backend own separate folders, and within backend each person owns different service files. If you're regularly conflicting with someone, raise it at the retro — it means the split is wrong.

---

## 8. Issues and the board

Every story from the sprint plan becomes a GitHub Issue using the **User Story** template: the "As a… I want… so that…" text, story points, acceptance criteria, related use case number, owning side.

Board columns: **Backlog → Sprint → In Progress → Review → Done**

Move your own card. When you start, drag it to In Progress. When you open the PR, Review. Merge moves it to Done (automatically if your PR says `Closes #12`).

The board is what we screen-share at the sprint review. If it's stale, our progress looks worse than it is.

---

## 9. Quick reference

```bash
git status                      # what's changed
git pull origin main            # get everyone's latest
git checkout -b feature/N-name  # start a story
git add .                       # stage changes
git commit -m "message"         # save a checkpoint
git push origin branch-name     # send to GitHub
git log --oneline -10           # recent history
git diff                        # what you changed
```

**Undoing things**

```bash
git checkout -- file.js         # discard changes to one file
git reset HEAD~1                # undo last commit, keep the changes
git revert <commit-hash>        # safely undo a commit already on main
```

Never use `git push --force` on `main`. If you think you need it, ask first.

---

## 10. If you're stuck

Before asking, try: `git status` — it usually tells you exactly what to do next.

Then ask in the group chat with the output of `git status` pasted in. Do not spend an hour fighting git alone; it's a tool, not a test.

Resources:
- Git basics: https://docs.github.com/en/get-started/using-git/about-git
- GitHub flow: https://docs.github.com/en/get-started/using-github/github-flow
- Resolving conflicts: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/addressing-merge-conflicts
- Oh Shit, Git!?! (fixing mistakes): https://ohshitgit.com

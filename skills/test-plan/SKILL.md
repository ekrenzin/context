---
name: test-plan
description: Create concise developer self-vetting test plans (new behavior + regression checks). Use when the user asks for a "test plan", "QA steps", "manual test steps", "how to verify", or "dev testing" a change.
triggers: []
related_skills:
  - code-review
  - pr-summary
  - staging-test
  - start-platform
---

# Test Plan

When the user asks for a **test plan**, produce a short developer self-vetting doc that:

- **Verifies the new/changed behavior works**
- **Verifies related/touched behavior did not regress**

## Where test plans live in context

Test plans are **local artifacts** and must **not** be committed.

- **Write to**: `playground/test-plans/`
- **Default filename**: `playground/test-plans/TEST_PLAN.md` (overwrite if it exists)

This directory is git-ignored by design, so it won't accidentally land in a PR.

## Pull PR context from GitHub (required when PR-based)

If the test plan is for a GitHub PR, fetch context using `gh` so the plan includes the **branch name** and a short **gist** of what changed.

Use:

```bash
gh pr view <PR_NUMBER> -R <OWNER/REPO> --json headRefName,title,url,body
```

Then include near the top of the doc:

- **Branch name**: `<headRefName>`
- **PR gist**: 1–2 bullets summarizing the change (from title/body + touched files if known)

## Required content (keep it short)

### 1) Scope header

- Feature name / PR / branch (always include branch name when PR-based)

### 2) Preconditions

- Auth role(s) required (e.g., `Super Admin`, `Org Admin`, `Monitoring Operator`)
- Environment assumptions (local vs staging, mobile vs web)
- Any required feature flags / toggles

### 3) Verify the change (happy path)

Write steps as if the tester has never used the product:

- "Go to X"
- "Click Y on the left/right side"
- "Type Z into field"
- "Press Save"
- "Verify A changes to B"

Keep each step to one line. Prefer short numbered lists.

### 4) Regression checks (related/touched behavior)

Add a short checklist of "adjacent" behaviors to verify didn't break. Prefer a small set of high-signal checks over exhaustive lists.

Good sources for regression checks:

- **Files/endpoints touched** (UI routes, API endpoints, DB writes)
- **Same UI area** (navigation, lists/detail pages, filters, pagination)
- **Permissions** (can/can't see or edit; cross-role checks when risky)
- **State transitions** (create -> edit -> disable/delete; undo/cancel flows)
- **Side effects** (notifications, audits/logs, webhooks, background jobs)
- **Error handling** (invalid input shows a validation error; no 500s)

Format as "verify" bullets:

- Verify <previous behavior> still works
- Verify <role> cannot do <action> (if permissions changed/are risky)
- Verify <failure mode> shows a user-safe error (no stack traces)

### 5) Seed data / state flips (instructions only — do not execute)

If verification requires data that may not exist locally, include:

- **What to seed** and **why**
- **Exact copy/paste commands** in code blocks
- **No execution** (the agent must not run these)

### 6) Expected results (tight assertions)

Use a short checklist of expected outcomes:

- UI shows Y
- API returns X
- No console errors / no 500s
- Audit/logging behavior is correct (if relevant)

## Output template (write `TEST_PLAN.md` like this)

````markdown
# Test Plan — <feature>

## Scope
- PR: <url>
- Branch name: <headRefName>
- PR gist:
  - <one-liner>
  - <optional one-liner>
- Apps: <put relevant apps here>

## Preconditions
- Login as: <role>
- Environment: <local/staging> | <mobile/web>
- Flags/Toggles: <none | ...>

## Verify the Change (Happy Path)
1. <step>
2. <step>
3. <verify>

## Regression Checks (Related/Touched Behavior)
- [ ] Verify <adjacent behavior> still works
- [ ] Verify <permissions expectation> still holds
- [ ] Verify <error/edge case> fails safely (no 500s)

## Seed / State (do not run automatically)
### Why
<one sentence>

### Commands
```bash
<copy/paste>
```

## Expected Results
- [ ] <assertion>
- [ ] <assertion>
````

## Multiple PRs -> index file (allowed + preferred)

When the user asks for test plans for multiple PRs, create:

- `playground/test-plans/TEST_PLANS_INDEX.md`
- One file per PR in `playground/test-plans/` (do not commit)

The index must include, per PR:

- Repo + PR number (link)
- **Branch name**
- **PR gist** (one line)
- Filename for the full test plan

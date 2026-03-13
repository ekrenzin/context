---
name: debug
description: Systematic debugging and diagnosis workflow. Use when investigating bugs, unexpected behavior, test failures, or production incidents. Covers root cause analysis, isolation techniques, and verification. Addresses the most common agent error pattern -- wrong approach first.
triggers:
  - memory
  - cloudwatch-logs
related_skills:
  - preflight
  - guardduty
  - file-analysis
---

# Debug

Follow this structured workflow when diagnosing a bug or unexpected behavior.
The goal is to find the root cause, not just suppress the symptom.

## Step 1: Reproduce

Before theorizing, confirm you can observe the failure:

- Read the error message, stack trace, or user description carefully.
- Identify the exact input, state, and sequence that triggers the bug.
- If the bug is intermittent, note the conditions under which it appears
  and does not appear.
- Do not skip this step. Many debugging failures start with an assumed
  reproduction that turns out to be wrong.

## Step 2: Isolate

Narrow the search space before reading code:

- **Binary search the call chain**: Start at the failure point and trace
  backward. Is the bad data coming from the caller, the database, the API,
  or the UI?
- **Check the boundaries**: Bugs often hide at integration points -- between
  frontend and backend, between services, between the app and the database.
- **Timestamp and format mismatches**: A recurring pattern in this codebase.
  ISO 8601 vs human-readable, UTC vs local, string vs Date object.
- **Re-mount state resets**: In React, component unmount/remount cycles reset
  `useState`. If state disappears on re-render, the component is being
  unmounted by a parent conditional.

## Step 3: Root Cause

Identify the actual cause, not a proximate symptom:

- Ask "why" at least twice. The first answer is usually the symptom.
- **Common root causes in this codebase**:
  - Missing encryption key on webhook reset (crash-level).
  - DB triggers in your-app causing unexpected side effects in your-service.
  - Contact list routing normalization silently corrupting phone numbers.
  - React lifecycle issues where modals reset state on parent re-render.
  - IAM credential expiration during long-running operations.
- Look for "landmine" bugs: code that works in the common case but fails on
  edge inputs. Normalization functions and regex parsers are frequent culprits.

## Step 4: Fix

Apply the minimal correct fix:

- Fix the root cause, not the symptom. A try/catch that swallows the error
  is not a fix.
- If the fix is in one repo but the bug manifests in another, check
  `docs/architecture.md` for the data flow to ensure the fix is in the
  right place.
- Consider whether the bug class could exist elsewhere. If a timestamp
  format mismatch caused this bug, grep for similar patterns.

## Step 5: Verify

Prove the fix works and does not regress:

- Reproduce the original failure scenario and confirm it no longer occurs.
- Run the existing test suite to check for regressions.
- If no test covers this case, write one.
- For cross-repo bugs, verify the fix at both ends of the integration.

## Anti-Patterns to Avoid

- **Shotgun debugging**: Making multiple changes at once without understanding
  which one fixes the issue. Change one thing, test, repeat.
- **Wrong approach first**: The most common agent error (157 occurrences).
  Resist the urge to start coding a fix before completing Steps 1-3.
- **Searching empty paths**: If a search returns nothing, do not retry the
  same search with minor variations. Re-evaluate your assumptions about
  where the code lives.
- **Ignoring empty tool output**: Empty search results are information. They
  mean the thing you are looking for does not exist at that path.

## Additional Resources

- For detailed codebase-specific root causes, see [references/codebase-patterns.md](references/codebase-patterns.md)

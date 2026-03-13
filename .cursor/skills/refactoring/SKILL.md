---
name: refactoring
description: Refactoring guidelines for your organization. Use when restructuring code, splitting files, extracting utilities, or improving code quality without changing behavior. Covers extraction patterns, behavior preservation, and cross-repo safety.
triggers:
  - file-analysis
  - modular-design
  - code-review
related_skills:
  - feature-dev
  - cross-repo-check
---

# Refactoring Guidelines

Standards for restructuring code without changing its external behavior.

## When to Refactor

- A file exceeds ~400 lines and has multiple responsibilities.
- A function exceeds ~50 lines or has more than 3 levels of nesting.
- The same logic appears in two or more places (DRY violation).
- A module has grown to depend on too many external modules (high coupling).
- Test setup is complex because business logic is entangled with I/O.
- The Boy Scout Rule applies: you are already modifying the file for another
  reason and spot an improvement opportunity.

## Before Refactoring

- Ensure existing tests pass and cover the behavior you are about to change.
- If test coverage is insufficient, add characterization tests first to lock
  down current behavior before restructuring.
- Understand the file's role and dependencies (apply the /file-analysis skill).
- Identify all consumers of the code being refactored; check for cross-repo
  impact.

## Extraction Patterns

### Extract Function
- Pull a block of code into a named function with a clear, descriptive name.
- The function should have a single responsibility and return a meaningful value.
- Keep the extracted function in the same file unless it is reusable elsewhere.

### Extract Module
- When a file has grown beyond ~400 lines, split it along responsibility
  boundaries.
- Create a new file with a name that describes its responsibility.
- Re-export from the original module if needed to preserve the public API.
- Update all import paths in consumers.

### Extract Utility
- When the same logic appears in multiple files, extract it to a shared
  utility module (`utils/` or `lib/`).
- The utility must have a stable, documented API.
- Add tests for the extracted utility.

### Deduplicate Names (Name Things Once)
- When a concept name repeats across namespace levels (directory, module, class,
  variable), collapse the redundancy.
- Example: `services/user/UserService.ts` exporting class `UserService` should
  become `services/user/index.ts` exporting class `Service` (or a plain
  function if the class only wraps a single method).
- Rename class properties that redundantly include the class name
  (e.g., `organization.organizationName` becomes `organization.name`).
- Replace single-method classes with plain functions.
- These renames change public API, so update all consumers in the same commit
  and treat the rename like any other behavior-preserving refactor (run tests
  after each step).

### Push I/O to the Edges
- If a function mixes business logic with database queries, API calls, or
  file system operations, separate them:
  1. Pure function that computes the result from inputs.
  2. Thin wrapper that performs I/O and calls the pure function.
- This makes the core logic testable without mocks.

## Preserving Behavior

- Refactoring must not change observable behavior. If it does, it is a feature
  change and should be treated as such (separate branch, separate PR).
- Run the full test suite after each refactoring step, not just at the end.
- Make small, incremental changes; commit after each successful step so you
  can revert if something breaks.
- If renaming exports, update all consumers in the same commit to avoid
  broken intermediate states.

## Cross-Repo Refactoring

- If the refactored code is consumed across repositories (shared DB schemas,
  message formats, API contracts), coordinate changes carefully.
- Database schema refactors must go through your-app migrations.
- Message format changes require simultaneous updates in producer and consumer
  repos.
- Prefer backward-compatible changes; deprecate before removing.

## Anti-Patterns to Avoid

- Do not refactor and add features in the same commit.
- Do not refactor without tests; you need a safety net.
- Do not introduce abstraction layers that add complexity without clear benefit.
- Do not rename things for style preference alone; rename only when the current
  name is misleading or unclear.
- Do not move code across repo boundaries without explicit coordination.

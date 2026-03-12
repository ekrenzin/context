---
name: feature-dev
description: Feature development workflow for your organization. Optimized for high-autonomy agents handling multi-repo implementations, schema migrations, and Jira-integrated PRs.
triggers:
  - preflight
  - commit-format
  - cross-repo-check
  - code-review
related_skills:
  - mqtt
  - action-ticket
  - finish-ticket
  - refactoring
  - database-ops
  - security-audit
---

# Feature Development Workflow

Guidelines for developing new features across your organization's repositories with high architectural awareness and operational trust.

## 1. Discovery & Strategy

- **Memory & Standards**: Invoke `/memory` immediately. Search for 'Standard', 'Strategy', or 'Principles' docs before implementing cross-cutting concerns (logging, auth, UI).
- **Pattern Matching**: Search for existing UI components (e.g., 'drawer', 'viewer') and patterns before creating 'new' ones. Use `grep` or `glob` to find prior art.
- **Dependency Audit**: Verify `package.json` or `requirements.txt` before assuming a library is available. Do not guess versions.

## 2. Baseline & Pre-flight

- **Git Freshness**: Check `git status -sb` and `git fetch`. If `behind`, warn the user. Starting on a stale branch increases merge conflict risk.
- **Integration Health**: Verify reachability of Jira and AWS. Use direct API fallbacks if local caches/sync tools are incomplete.
- **Environment**: Ensure JIRA_PROJECTS and AWS_PROFILE are set. See `checklists/pre-flight.md`.

## 3. Implementation & Quality Gates

- **Quality Tools**: Prefer `ctx workspace check --quick` over individual lints. Use structured test reporters or `grep` to analyze results; avoid `tail` as it misses exit codes.
- **Modular Design**: Extract logic into custom hooks early. Use barrel exports (index.ts) when splitting modules to maintain clean import paths.
- **Dynamic UI**: Prioritize extensible, dynamic data mapping over hardcoded views. Address information density concerns by enhancing existing components rather than overwriting.

## 4. Commits & PR Lifecycle

- **Migration Safety**: For data/schema changes, implement validation scripts and 'dry-run' modes. Use `checklists/migration-safety.md`.
- **PR Generation**: Summarize from the full diff (`git diff main...HEAD`). Ensure Jira tickets transition only after successful integration.
- **Final Cleanup**: Return all sub-repos to `main`. Navigate to the context root before ending.

## 5. Checklists

- [ ] **Pre-flight Check**: Memory invoked, git up-to-date, environment verified (`checklists/pre-flight.md`).
- [ ] **Discovery Sweep**: Existing patterns found, strategy docs read (`examples/discovery-sweep.md`).
- [ ] **UI/UX Alignment**: Dynamic mapping used, layout injection considered (`checklists/ui-ux-standards.md`).
- [ ] **Quality Verification**: `ctx workspace check` passed, no `tail` used for summaries.
- [ ] **Cleanup**: No floating branches, repos on main.

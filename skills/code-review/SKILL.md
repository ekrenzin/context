---
name: code-review
description: Apply code review standards for your organization. Use when reviewing code changes, completing features, or before committing. Covers security, infra, UI reuse, and cross-repo impact.
triggers:
  - security-audit
  - pre-commit-check
  - infra-migration
  - ui-refactor
related_skills:
  - refactoring
  - modular-design
  - cross-repo-check
  - file-analysis
---

# Code Review Standards

Apply this checklist systematically. Every change must pass these criteria. Refer to linked checklists for deep dives.

## Discovery & Strategy

- **Strategy Docs**: Before cross-cutting changes (auth, logging, events), search for `Standard` or `Strategy` docs (e.g., `Unified Structured Logging`).
- **UI Patterns**: Search for existing UI components (e.g., `drawer`, `logs`, `viewer`) before creating new ones. Use `rg` on UI strings to find entry points.
- **Zero-Guessing**: Avoid manual directory traversing. Use `rg` on unique identifiers immediately.
- **Memory**: Ensure the `/memory` skill was invoked to align with prior decisions.
- See [checklists/discovery-heuristics.md](checklists/discovery-heuristics.md).

## Validation & Testing

- **Full Check**: Run `ctx workspace check --quick --repo <name>`. Do not rely on targeted lints or wait for hook failures.
- **Test Integrity**: If modifying logging or infrastructure, update tests to capture `stdout/stderr` for verification.
- **Summary Quality**: Use `grep` or structured reporters for test summaries; avoid `tail` which can miss exit codes and critical summary lines.
- **Timing**: Use polling or event-based waits; avoid arbitrary `sleep` commands.

## UI & UX Excellence

- **CSS Audit**: Audit existing CSS files for class duplicates before adding new UI components.
- **Dynamic Mapping**: Prefer dynamic data mapping over hardcoded fields for generic tools (e.g., log viewers).
- **Layouts**: For system-wide requirements, consider global layout injection over per-page components.
- **Embedded Viewport**: If this component can render inside a smaller
  container (preview panel, card, modal), does it degrade gracefully? Controls
  must not overlap content at small sizes. Provide a `compact` prop or move
  controls to the parent container's chrome.
- **Activation Pattern**: Does the feature require explicit user action when
  contextual activation would suffice? Prefer auto-detection (e.g.,
  proximity-based selection on zoom) over click-to-activate when user intent
  is unambiguous.
- See [checklists/ui-ux-review.md](checklists/ui-ux-review.md) and [checklists/ui-reuse-audit.md](checklists/ui-reuse-audit.md).

## Infrastructure & Safe-Mode

- **macOS Sync**: Use mtime-based polling over `fs.watch` for reliable cross-process synchronization on macOS.
- **Logging**: Use `encryptedField` for at-rest encryption. Follow the pass-through context pattern for logger portability.
- **Builds**: For VS Code extensions, use `npm run build` to verify the `dist/` relationship.
- See [checklists/infrastructure-changes.md](checklists/infrastructure-changes.md).

## Maintainability & Architecture

- **Name Things Once**: No redundant context (e.g., `org.name`, not `org.orgName`). Apply dots-to-underscores test.
- **Modularity**: Use barrel exports (`index.ts`) early when splitting modules. Audit for dead code exports after refactoring.
- **Limits**: Files < 200 lines (max 400), functions < 50 lines. Extract logic to utilities.
- **Clarity**: Comments explain *why*, not *what*. No emojis in code or UI.

## Git & PR Readiness

- **Remote Check**: Proactively check for remote branch changes before proposing PRs in high-activity repositories.
- **Cleanup**: Remove unused dependencies and dead code. Ensure `package.json` and `requirements.txt` are hygienic.

## Additional Resources

- [checklists/security-deep-dive.md](checklists/security-deep-dive.md)
- [checklists/ui-reuse-audit.md](checklists/ui-reuse-audit.md)
- [checklists/infrastructure-changes.md](checklists/infrastructure-changes.md)
- [checklists/discovery-heuristics.md](checklists/discovery-heuristics.md)
- [checklists/dependency-hygiene.md](checklists/dependency-hygiene.md)

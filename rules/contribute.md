# Contribute

Every agent session is an opportunity to grow the ecosystem. After completing any
task that produces code, reusable patterns, or operational knowledge, evaluate
whether your work should propagate to the broader tooling surface.

## The Manifest

`tools/manifest.yaml` is the single source of truth for all tooling. The
VS Code extension, tooling registry docs, and validation all derive from it.

When you add an entry, the ecosystem grows:
- The tool appears in `docs/tooling-registry.md` (run `ctx workspace validate registry`)
- Adding `dashboard: actions` to a tool makes it a Quick Action in the extension
- Adding a `tests` entry makes it appear in the extension's Tests panel
- Adding a `log_prefixes` entry makes it appear in the Logs dropdown

## Contribution Checklist

Before finishing a session that produced code, evaluate these quickly. Most
sessions will have zero contributions -- that is fine. The bar is: "Would another
agent or developer benefit from this existing?"

1. **Reusable script?** If you created a utility in `playground/scripts/` that
   proved useful, promote it to `tools/scripts/` and register it in the manifest.

2. **Repeatable workflow?** If you followed a multi-step process that other
   agents would benefit from, create a skill definition for it.

3. **Developer-facing tool?** If devs would want quick access, add
   `dashboard: actions` to the tool's manifest entry so it appears in the
   extension.

4. **New test suite?** If you set up tests for a new module, add a `tests` entry
   to the manifest so it appears in the extension.

5. **New log source?** If you discovered a useful CloudWatch log group prefix,
   add it to `log_prefixes` in the manifest.

6. **Architectural decision?** If you made a non-obvious technical choice,
   document it in `docs/decisions/`.

## Do Not Over-Contribute

Skip when:
- The script is truly one-off (leave it in `playground/scripts/`)
- The workflow is specific to a single ticket with no generalizable pattern
- The change is a routine bug fix

Organic growth means growing intentionally, not reflexively.

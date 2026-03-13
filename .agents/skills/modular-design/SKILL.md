---
name: modular-design
description: Enforce modular, bite-sized file design across all repos. Use when creating new files, reviewing code, or refactoring. Files should be single-responsibility, under 200 lines, and organized into cohesive packages. Apply when touching any file over 200 lines or creating new functionality.
triggers:
  - file-analysis
related_skills:
  - refactoring
  - code-review
---

# Modular Design

Every file should do one thing and be small enough to read in a single pass.
This is not a suggestion -- it is the design target for all codebases.

## Hard Limits

| Metric          | Target      | Hard Limit | Action When Exceeded     |
| --------------- | ----------- | ---------- | ------------------------ |
| File length     | < 150 lines | 200 lines  | Split immediately        |
| Function length | < 30 lines  | 50 lines   | Extract helpers          |
| Parameters      | < 4         | 5          | Introduce options object |
| Import depth    | < 3 levels  | 4 levels   | Flatten or re-export     |

These limits apply to all languages: TypeScript, Python, shell, CSS.

## Package Structure

Organize code into packages (directories) that group related functionality.
Each package has a clear public API and internal implementation.

### TypeScript Pattern

```
feature/
  index.ts          # Public API re-exports
  types.ts          # Shared types for this feature
  core.ts           # Primary logic (< 200 lines)
  helpers.ts        # Internal utilities
  constants.ts      # Feature-specific constants
```

### Python Pattern

```
feature/
  __init__.py       # Public API
  types.py          # Dataclasses, TypedDicts
  core.py           # Primary logic
  commands.py       # CLI subcommands
  formatters.py     # Output formatting
```

### Shell Pattern

```
scripts/
  feature.sh        # Entry point (arg parsing, dispatch)
  _feature-lib.sh   # Shared functions (sourced, not executed)
  feature-sub1.sh   # Subcommand implementation
  feature-sub2.sh   # Subcommand implementation
```

## Splitting Heuristics

When a file exceeds the limit, split along these seams:

1. **By responsibility**: Message handlers, data loaders, renderers, formatters
   are separate concerns. They should be separate files.
2. **By feature**: A dashboard with services, tunnels, sessions, and stats has
   four natural split points.
3. **By subcommand**: CLI tools with scan/report/query/analyze subcommands
   should have one file per subcommand.
4. **By layer**: Parsing, transformation, and output are separate layers.
   A function that reads a file, transforms data, and writes output should
   be three functions in up to three files.

## When Creating New Code

Before writing, decide the package structure:

- Will this be a single file or a directory with multiple files?
- If it might grow beyond 200 lines, start with a directory.
- Name the directory after the feature, not the file type.
  `tools/profiler/` not `tools/python-scripts/`.
- Create `index.ts` / `__init__.py` as the public API from day one.

## When Touching Existing Code

If the file you are editing is over 200 lines:

1. Check if your change makes it longer. If yes, extract something first.
2. If the file is over 400 lines, propose a split to the user before
   continuing.
3. Apply the Boy Scout Rule: leave the file shorter than you found it.

## Known Oversized Files (Split Backlog)

These files currently exceed limits and should be split when next touched:

| File                                | Lines | Suggested Split                                     |
| ----------------------------------- | ----- | --------------------------------------------------- |
| `tools/teams-bot/bot.py`            | 1864  | By feature: commands, handlers, graph-api, webhooks |
| `tools/cloudwatch/logs.py`          | 694   | By subcommand: tail, insights, groups, formatters   |
| `tools/profiler/analyze.py`         | 607   | Parsing, commands, anthropic-analysis               |
| `tools/tunnel/src/server.ts`        | 458   | Route handlers, tunnel management, state            |
| `tools/guardduty/findings.py`       | 426   | Formatters, commands, filtering                     |
| `tools/memory/scan.py`              | 347   | Discovery/scoring, commands, output                 |
| `tools/sos/workspace/checkout.py`   | -     | ctx workspace checkout; repo logic in helpers      |
| `tools/sos/workspace/check.py`      | -     | ctx workspace check; per-repo checks               |
| `tools/db/format.js`                | 302   | Extract formatters by output type                   |
| `tools/db/parse-models.js`          | 299   | Parser vs output                                    |

## Anti-Patterns

- **God files**: One file that handles everything for a feature. Split it.
- **Util dumps**: A `utils.ts` that grows indefinitely. Group utilities by
  domain (`string-utils.ts`, `date-utils.ts`, `api-utils.ts`).
- **Circular imports**: If splitting creates circular dependencies, the
  abstraction boundary is wrong. Re-draw it.
- **One-export-per-file**: Going too far. Files can have multiple related
  exports. Split at responsibility boundaries, not at function boundaries.

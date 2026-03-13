# Playground

`playground/` is a git-ignored scratch space for generated or temporary files.
The directory structure is tracked via `.gitkeep`; everything else is ignored.

## Structure

```
playground/
  csv/       -- generated CSVs, spreadsheets, tabular exports
  scripts/   -- throwaway scripts, one-off utilities, quick automation
  data/      -- raw data files, JSON dumps, API responses
  output/    -- command output, logs, report artifacts
  scratch/   -- anything else: notes, experiments, prototypes
```

## Rules

- When asked to generate a file (CSV, script, data, etc.) that is not part of a
  tracked feature, write it to the appropriate `playground/` subdirectory.
- If no subdirectory fits, use `playground/scratch/`.
- New subdirectories may be created inside `playground/` as needed -- they will
  be automatically ignored by git.
- NEVER commit playground content to the repository.
- Playground files are ephemeral. Do not rely on them persisting across worktree
  cleanups or system resets.

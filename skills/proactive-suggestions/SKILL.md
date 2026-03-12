---
name: proactive-suggestions
description: Offer related improvements alongside the requested work. Use at the end of any implementation task to surface adjacent opportunities the user may not have asked for. Addresses 30 identified gaps where the agent completed the task but missed obvious related improvements.
triggers: []
related_skills:
  - retrospective
  - code-review
  - contribute
---

# Proactive Suggestions

After completing the requested work, scan for adjacent improvements and offer
them to the user. Do not implement them without permission -- just surface
them.

## When to Suggest

At the end of any implementation task that touches 3+ files or takes more
than a few minutes, pause and check for:

### Dead Code and Cleanup

- Did the change make any existing code unused? Imports, functions, variables,
  CSS classes, config entries that are no longer referenced.
- Are there commented-out blocks near the code you touched?
- Did you notice any `TODO` or `FIXME` comments in the area?

### Related Fixes

- While reading the surrounding code, did you notice any bugs or issues
  unrelated to the current task? Note them without fixing.
- Does the component you modified have sibling components that need the same
  change? (e.g., if you fixed a pattern in one form, do other forms have the
  same problem?)
- Are there related config files that should be updated? (`.gitignore`,
  `tsconfig`, `package.json` scripts, VS Code settings)

### Tooling Gaps

- Could the manual work you just did be automated with a script?
- Is there a VS Code extension that would help with this kind of work?
- Would a new entry in `tools/manifest.yaml` make this operation discoverable
  from the command center?

### Documentation Opportunities

- Did the change introduce behavior that is not obvious from the code alone?
- Would a memory entry help future sessions avoid re-discovering what you
  just learned?
- Is there a `docs/repos/<name>.md` that should be updated?

## How to Suggest

At the end of your work summary, add a brief section:

> **Related opportunities I noticed:**
> - [description of improvement] -- [which file/area]
> - [description of improvement] -- [which file/area]
>
> Want me to tackle any of these?

Keep it to 2-4 suggestions. More than that becomes noise. Prioritize by
impact: security issues first, then bugs, then cleanup, then nice-to-haves.

## What Not to Suggest

- Style-only changes with no functional benefit.
- Refactors that would require extensive testing to validate.
- Changes outside the repo you are currently working in (use
  `/cross-repo-check` instead).
- Anything that would derail the current task's PR scope.

---
name: contribute
description: Register a new tool, test, log source, or skill in your organization's ecosystem. Use when you have created reusable tooling that should be discoverable by other agents and developers.
triggers:
  - memory
related_skills:
  - proactive-suggestions
  - feature-dev
---

# Contribute

Register new tooling in the ecosystem so it is discoverable by agents, the
VS Code extension, and validation.

## When to Use

- You created a script in `tools/scripts/` or `tools/<domain>/`
- You built a workflow that should become a skill
- You added a test suite that should appear in the extension
- You discovered a CloudWatch log group useful for debugging

## Prerequisites

- The tool exists and works (test it first)
- You know which category it belongs to (check `tools/manifest.yaml` for the list)

## Steps

### 1. Register the Tool

Open `tools/manifest.yaml` and add an entry under `tools`:

```yaml
  - path: ctx my-tool action
    language: python
    category: dev
    description: What it does in one line
```

Available fields:

| Field | Required | Purpose |
|-------|----------|---------|
| `path` | yes | Path relative to workspace root |
| `language` | yes | bash, python, node, node/ts, -- |
| `category` | yes | Must match a category id in the manifest |
| `description` | yes | One-line summary |
| `prerequisites` | no | What must be set up first (e.g., "AWS SSO session") |
| `skill` | no | Name of the agent skill that wraps this tool |
| `dashboard` | no | Set to `actions` to surface as a Quick Action |
| `dashboard_label` | no | Override the auto-derived dashboard label |

### 2. Surface in the VS Code Extension (Optional)

To make the tool a Quick Action in the Command Center, add:

```yaml
    dashboard: actions
    dashboard_label: Human-Friendly Label
```

If `dashboard_label` is omitted, the label is derived from the filename:
`my-tool.sh` becomes "My Tool".

To add a test runner, add under the `tests` section:

```yaml
  - name: My Module
    command: npm test
    cwd: repos/your-app
```

To add a log source, add under `log_prefixes`:

```yaml
  - label: My Service
    value: /aws/lambda/my-service
```

### 3. Sync the Registry

```bash
ctx workspace validate registry
```

This regenerates `docs/tooling-registry.md` from the manifest.

### 4. Create a Skill (Optional)

If the tool should be agent-invokable, create `.cursor/skills/<name>/SKILL.md`:

```yaml
---
name: <name>
description: When and why to invoke this skill
---
```

Include: when to use, prerequisites, step-by-step instructions, and which
tools/scripts it calls by their manifest paths.

If the skill should be **discoverable** (listed in `docs/tooling-registry.md` and visible to agents scanning the manifest), also register the skill file itself in `tools/manifest.yaml` as a `language: markdown` tool entry, then re-run:

```bash
ctx workspace validate registry
```

### 5. Validate

```bash
ctx workspace validate docs
```

This verifies:
- All manifest tool paths exist on disk
- The registry is in sync with the manifest
- Skill references in `.cursorrules` resolve

### 6. Add a New Category (Rare)

If no existing category fits, add one under `categories` in the manifest:

```yaml
  - id: my-category
    label: My Category
    note: Optional explanatory note that appears in the registry
```

## Format Rules

The manifest uses flat YAML parseable by the VS Code extension's built-in
loader. Follow these constraints:

- All values on one line (no YAML block scalars)
- Top-level keys flush left
- Array items indented 2 spaces with `- `
- Item properties indented 4 spaces
- No tabs

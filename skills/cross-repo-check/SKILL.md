---
name: cross-repo-check
description: Cross-repo impact analysis for multi-service changes. Use when modifying shared contracts -- database schemas, MQTT topics, SQS message formats, API endpoints consumed by other services, or event structures. Low frequency but high severity when missed.
triggers: []
related_skills:
  - mqtt
  - feature-dev
  - database-ops
  - deploy
  - code-review
  - api-design
---

# Cross-Repo Check

Run this analysis when a change touches a shared boundary between
services. Missing cross-repo impact is rare (2% of gaps) but causes the
hardest-to-diagnose production issues.

## When to Trigger

Apply this check if the change involves any of:

- Database schema (models, migrations, triggers) -- the notifier and platform
  share the same PostgreSQL database.
- MQTT topic structure or payload format -- shared between platform, Home
  Assistant, your-gateway, and local dev tooling (`ctx/cc/*` topics for
  Command Center, VS Code extension, Teams bot).
- SQS/Kinesis message schemas -- platform writes, your-service consumes.
- API endpoint contracts -- if the endpoint is called by external services
  or other repos.
- Event types or webhook payload structures.
- Shared environment variables or secrets.

## Analysis Steps

### 1. Identify the Contract

What exactly is changing? Name the specific:
- Table/column/trigger being modified
- MQTT topic and payload field
- SQS message type and field
- API endpoint and request/response field

### 2. Find All Consumers

Search across all repos for references to the contract:

```bash
# From the workspace root
for repo in repos/*/; do
  echo "=== $repo ==="
  grep -r "<contract-name>" "$repo" --include="*.{js,ts,py,yaml,json}" -l 2>/dev/null
done
```

Check `docs/architecture.md` for the data flow diagram to identify services
you might miss with grep.

### 3. Assess Impact

For each consumer found:
- Will it break if the contract changes? (breaking vs additive change)
- Does it need a coordinated update? (deploy order matters)
- Is there a graceful degradation path? (can it handle both old and new format?)

### 4. Coordinate the Change

- **Additive changes** (new field, new topic): Deploy the producer first, then
  update consumers. No coordination needed.
- **Breaking changes** (rename, remove, type change): Deploy consumers to
  handle both formats first, then deploy the producer change, then clean up
  the old format handling.
- **Database triggers**: These are invisible to grep. Check for triggers on
  any table being modified: `SELECT * FROM information_schema.triggers WHERE
  event_object_table = '<table>';`

### 5. Document

If the change affects cross-repo contracts, note it in:
- The PR description (which other repos are affected)
- `memory/decisions/` if the contract change is non-obvious
- The commit message (reference affected repos)

## Known Landmines

- **Platform DB triggers affecting notifier**: The platform has triggers that
  fire on certain table changes. The notifier reads the same tables. A
  migration that changes trigger behavior can silently break notifications.
- **MQTT topic naming**: Topic structure is hierarchical and position-dependent.
  Changing a level affects all subscribers at that level and below.
- **Contact list normalization**: Phone number formatting differs between
  services. A normalization change in one repo can corrupt routing in another.

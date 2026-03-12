# Migration & Data Safety

Avoid 'Infrastructure Ghosts' and data corruption during feature deployment.

## Schema & Fields
- [ ] **Field Validation**: Every new DB field has a validation script or check.
- [ ] **Fallback Logic**: If falling back to a legacy path, log a `WARNING` or `ERROR` explicitly.
- [ ] **Idempotency**: Migrations can be run multiple times without failure.

## Data-at-Rest
- [ ] **Legacy Records**: Migration handles existing data (e.g., retroactive redaction/encryption).
- [ ] **Dry-Run**: Implementation includes a `--dry-run` flag to show impacted records without modification.
- [ ] **Verification**: Scripted check to confirm data state after migration completes.

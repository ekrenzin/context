---
name: database-ops
description: Database schema, migrations, and model operations for the platform. Use when creating migrations, modifying Sequelize models, fixing schema drift, generating context, or working with encryption at the model level.
triggers:
  - cross-repo-check
related_skills:
  - deploy
  - feature-dev
  - security-audit
---

# Database Operations

Apply these patterns when working with the PostgreSQL database, Sequelize
models, or migrations in `repos/your-app/`.

## Schema Ownership

- The platform repo owns the database schema. All migrations live in the
  platform's migration directory.
- The `context/` directory in the root repo contains generated artifacts
  (schema dumps, drift reports, TypeScript interfaces). These are derived
  from the live DB and models -- never edit them manually.

## Migrations

- Every schema change requires a migration file. Never modify the database
  directly.
- Migrations must be reversible. The `down` function must undo exactly what
  `up` does.
- Use transactions in migrations. Wrap the entire `up` and `down` in a
  transaction so partial failures do not leave the schema in a broken state.
- Name migrations descriptively:
  `YYYYMMDDHHMMSS-add-encryption-to-webhook-secrets.js`
- When adding encryption to existing plaintext columns, write a data migration
  that: (a) reads existing values, (b) encrypts them, (c) writes them back,
  with a guard against double-encryption and a rollback path.

## Sequelize Models

- Models define the source of truth for column types, constraints, and
  associations.
- Use getters/setters for transparent field-level encryption. The application
  code should not need to know that a field is encrypted.
- Validate model definitions against the actual DB state using drift reports.
  The `tools/db/` scripts generate these.

## Schema Drift Detection

- Drift reports compare Sequelize model definitions against the live database
  schema. Discrepancies indicate either a missing migration or a model that
  is out of sync.
- After fixing drift, regenerate context artifacts to keep them current.
- Common drift sources: default values that differ between model and migration,
  column types that were changed in the DB but not the model, indexes added
  directly via SQL.

## Query Patterns

- Use Sequelize query methods (findAll, findOne, create, update, destroy)
  over raw SQL unless performance requires it.
- Always scope queries by organization. Multi-tenant data leakage is a
  critical security concern.
- Include appropriate `attributes` lists to avoid selecting unnecessary columns,
  especially encrypted fields.

## Before Completing Database Work

1. Verify the migration runs cleanly: `up` then `down` then `up` again.
2. Check drift reports before and after to confirm the change resolved the
   discrepancy.
3. If the change touches encrypted fields, verify the encryption roundtrip.
4. Regenerate context artifacts if the schema changed.
5. Run `/code-review` and `/security-audit` for any encryption-related changes.

## Additional Resources

- For migration templates, encryption data migration, and drift workflow, see [references/migration-patterns.md](references/migration-patterns.md)

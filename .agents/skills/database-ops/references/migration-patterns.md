# Migration Patterns

## Reversible Migration Template

```javascript
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn("TableName", "newColumn", {
        type: DataTypes.STRING,
        allowNull: true,
      }, { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn("TableName", "newColumn", { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};
```

Wrap entire `up` and `down` in a transaction. Roll back on error. The `down` must undo exactly what `up` does.

## Data Migration for Encrypting Plaintext Columns

1. **Add column** (if needed): New column for encrypted value, or use existing.
2. **Read existing rows**: `SELECT id, plaintext_column FROM Table WHERE plaintext_column IS NOT NULL`.
3. **Guard against double-encryption**: If value matches `iv:hex` pattern, skip.
4. **Encrypt**: Use platform `encrypt(value, key)`. Key must be available; migrations run before app context, so encryption may need to happen in a separate post-deploy step or lazily in the model (see reencrypt-integration-auth).
5. **Write back**: `UPDATE Table SET column = encrypted WHERE id = ?`.
6. **Rollback path**: `down` can drop the column or restore from backup. Document that data rollback is lossy.

**Double-encryption guard**:
```javascript
const ENCRYPTED_PATTERN = /^[0-9a-f]{32}:[0-9a-f]+$/i;
for (const row of rows) {
  if (!row.plaintext_column || ENCRYPTED_PATTERN.test(row.plaintext_column)) continue;
  const encrypted = encrypt(row.plaintext_column, key);
  await queryInterface.sequelize.query(
    `UPDATE "Table" SET column = ? WHERE id = ?`,
    { replacements: [encrypted, row.id], transaction: t }
  );
}
```

## Writing the Down Function

- Reverse schema changes in opposite order (e.g., drop FK before dropping column).
- For data migrations, `down` typically cannot decrypt and restore; document this.
- For additive changes (new column, new table), `down` removes them.
- Test: `up` then `down` then `up` again. Schema should match after the second `up`.

## Schema Drift Detection Workflow

1. **Prerequisites**: AWS SSO login, root `.env` with `SECRET_NAME`, `STAGE`, `AWS_PROFILE`, `AWS_REGION`.
2. **Run**: `node tools/db/index.js` (or `--all`). This runs schema introspection, model parsing, and comparison.
3. **Output**: `context/db/platform/schema/`, `context/db/platform/models/`, `context/db/platform/drift/`.
4. **Interpret drift**: `drift/*.md` lists discrepancies: columns in DB but not model, columns in model but not DB, type mismatches, missing indexes.
5. **Fix**: Either add a migration to align DB with model, or update the model to match a migration that was applied manually. Re-run to verify.

Common drift sources: default values that differ, column types changed in DB but not model, indexes added via raw SQL.

## Regenerating Context After Schema Changes

After migrations that change the schema:
1. Run migrations: `npx sequelize-cli db:migrate` (or equivalent).
2. Run `node tools/db/index.js` to regenerate `context/db/platform/` artifacts.
3. The generated TypeScript interfaces and schema docs in `context/` are derived outputs. Do not edit them manually.

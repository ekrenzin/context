# Encryption Patterns

## Sequelize Getter/Setter Encryption

The platform uses transparent field-level encryption. Application code reads/writes plaintext; the model encrypts on write and decrypts on read.

**Pattern** (from Gateway, Camera, Integration models):
```javascript
// In model definition
authorization: {
  type: DataTypes.STRING,
  get() {
    const value = this.getDataValue("authorization");
    if (!value) return null;
    try {
      return decrypt(value, GATEWAY_ENCRYPTION_KEY);
    } catch (e) {
      console.error("Error decrypting...", e);
      return null;
    }
  },
  set(value) {
    if (!value) return this.setDataValue("authorization", null);
    try {
      const encrypted = encrypt(value, GATEWAY_ENCRYPTION_KEY);
      this.setDataValue("authorization", encrypted);
    } catch (e) {
      console.error("Error encrypting...", e);
    }
  },
}
```

Keys are loaded at model init from AWS Secrets Manager. The `encrypt`/`decrypt` utils use AES-256-CBC; format is `iv:encryptedData` (hex).

## AWS Secrets Manager Key Fetching

- Platform: `getSecretValue(process.env.SECRET_NAME)` from `server/aws/secrets.js`. Returns parsed JSON merged with env.
- Keys used: `WEBHOOK_ENCRYPTION_KEY`, `INTEGRATION_ENCRYPTION_KEY`, `CAMERA_ENCRYPTION_KEY`, `GATEWAY_ENCRYPTION_KEY`, `SIREN_ENCRYPTION_KEY`.
- Keys must be 64 hex characters (32 bytes). Validation happens in your-service `credentials.js`.
- Never read keys from env vars directly for production; use Secrets Manager. Dev may fall back to env if secret load fails.

## Data Migration for Adding Encryption

1. Add new column (or prepare existing) with migration.
2. In migration `up`: Read existing plaintext, encrypt with key, write back. Use a transaction.
3. Guard against double-encryption: Check if value matches encrypted format (e.g., `iv:hex` pattern) before encrypting.
4. Provide `down` that reverses schema changes. Data rollback of encrypted->plaintext is usually not feasible; document that.
5. Re-encryption from one key to another can happen lazily in the model getter/setter at runtime (see `20260225000000-reencrypt-integration-auth.js`), since migrations run before app has IAM context.

## Double-Encryption Guard

Before encrypting, detect if the value is already encrypted:
```javascript
const ENCRYPTED_PATTERN = /^[0-9a-f]{32}:[0-9a-f]+$/i;
if (ENCRYPTED_PATTERN.test(value)) return; // Already encrypted, skip
```

Apply in migrations and in model setters when migrating from plaintext to encrypted.

## Webhook Secret Rotation with Grace Period

When rotating webhook secrets:
1. Generate new secret, encrypt with current key.
2. Store both old and new secrets temporarily (or support multiple keys in validation).
3. Validate incoming webhook signatures against both during grace period.
4. After grace period, remove old secret. Document the rotation window for consumers.

**Webhook reset flow** (`controllers/webhooks/Update.js`): Calls `getSecretValue(process.env.SECRET_NAME)` to obtain `WEBHOOK_ENCRYPTION_KEY`. If the key is missing or Secrets Manager fails, `encrypt()` receives undefined and can throw. Always verify the key exists before attempting re-encryption.

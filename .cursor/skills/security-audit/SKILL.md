---
name: security-audit
description: Code-level security audit for platform features. Use when implementing authentication, encryption, access control, webhook security, secret management, or any feature that handles sensitive data. Distinct from /guardduty which covers AWS-level threat detection.
triggers:
  - code-review
related_skills:
  - guardduty
  - cross-repo-check
  - deploy
  - database-ops
---

# Security Audit

Apply this checklist when writing or modifying code that touches authentication,
authorization, encryption, secrets, or sensitive data flows.

## Authentication and Authorization

- Every API endpoint has an explicit auth check. No endpoint should be
  accessible without authentication unless intentionally public.
- Role-based access control (RBAC) is enforced at the route/controller level,
  not just the UI. The frontend hides elements but the backend must reject.
- Token validation checks expiration, signature, and issuer. Do not trust
  client-supplied claims without server-side verification.
- Session invalidation works correctly on logout and password change.

## Encryption and Secrets

- Sensitive fields (webhook URLs, API keys, phone numbers) use model-level
  encryption via Sequelize getters/setters. Follow the existing pattern in
  the codebase.
- Encryption keys come from AWS Secrets Manager, never from environment
  variables or hardcoded values.
- When adding encryption to existing plaintext fields, write a reversible
  migration with transaction guards and rollback capability.
- Never log decrypted values. Redact sensitive fields in all log output.

## Webhook Security

- Webhook endpoints validate request signatures before processing.
- Webhook secret rotation must not break in-flight deliveries. Support a
  grace period with both old and new secrets.
- Webhook reset flows must verify the encryption key exists before attempting
  re-encryption. Missing keys cause crash-level bugs.

## Secret Management

- AWS SSO + Secrets Manager is the standard auth pattern. Replicate it when
  adding new services.
- Scan all new scripts (shell, JS, Python) for hardcoded secrets before
  staging. Check for patterns: API keys, tokens, passwords, connection strings.
- `.env` files are gitignored. Verify this before committing.

## Data Handling

- Implement two-tier redaction where appropriate: write-time redaction for
  permanent removal, read-time redaction for display masking that preserves
  the original for authorized users.
- PII fields require encryption at rest. Audit new model fields against this
  requirement.
- Error messages must not leak internal details (stack traces, query structures,
  file paths) to API consumers.

## IDOR / Tenant Boundary Audit

For permission/exposure review (IDOR risks, tenant boundary checks, and cross-repo routing impact), run `/idor-audit`.

## Before Completing Security-Sensitive Work

1. Grep the diff for secrets patterns: `password`, `apikey`, `secret`, `token`,
   `bearer`, connection strings.
2. Verify encryption roundtrip: write -> read -> compare.
3. Confirm RBAC enforcement with a test scenario for an unauthorized role.
4. Run `/code-review` with extra attention to the security section.

## Additional Resources

- For encryption and secret management patterns, see [references/encryption-patterns.md](references/encryption-patterns.md)
- For RBAC and auth enforcement, see [references/rbac-patterns.md](references/rbac-patterns.md)

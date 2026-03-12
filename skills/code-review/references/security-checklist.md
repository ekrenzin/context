# Security Review Checklist

## SQL Injection Patterns to Look For

- **String concatenation in queries**: `"SELECT * FROM t WHERE id = " + id`
- **Template literals in raw SQL**: `` sequelize.query(`SELECT * FROM t WHERE id = ${id}`) ``
- **Unescaped user input** in ORDER BY, LIMIT, or table/column names

**Correct pattern**: Parameterized queries. `sequelize.query('SELECT * FROM t WHERE id = ?', { replacements: [id] })` or Sequelize methods (`findAll`, `findOne`) with `where` objects.

## XSS Prevention in React

- **dangerouslySetInnerHTML**: Never use with user-supplied content. If required, sanitize with a library (e.g., DOMPurify) and restrict to a minimal HTML subset.
- **User input rendering**: Ensure user-controlled strings are rendered as text, not HTML. React escapes by default for `{userInput}`; avoid `dangerouslySetInnerHTML={{ __html: userInput }}`.
- **URLs in links**: Validate `href` values. `javascript:` URLs are an XSS vector. Prefer allowlists for protocols.

## Secret Leak Patterns to Grep For

Before staging, grep the diff for:
- `password`, `apikey`, `api_key`, `secret`, `token`, `bearer`
- Connection strings: `postgres://`, `mongodb://`, `redis://` with embedded credentials
- AWS keys: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (should come from env/Secrets Manager, not literals)
- Hardcoded hex keys (64-char strings that look like encryption keys)

Exclude test fixtures and mock data, but ensure those are not committed with real credentials.

## Encryption Field Audit Checklist

For each new or modified model field, ask:
- Does it contain PII? (names, emails, phones, addresses) -> encrypt at rest.
- Does it contain credentials? (passwords, API keys, webhook secrets) -> encrypt at rest.
- Is it a URL that might contain tokens? -> consider encryption.
- Is it non-sensitive metadata? (IDs, timestamps, flags) -> no encryption needed.

Reference: Gateway `authorization`, Camera `password`, Integration `auth`, Webhook `secret`. Follow the existing getter/setter encryption pattern.

## Auth Bypass Patterns

- **Missing middleware**: Every protected route must pass through `checkAuthenticated` or equivalent. Grep for route definitions and verify auth is applied.
- **Role check gaps**: Endpoints that modify data must run the authorizer (`canUpdate`, `canCreate`, etc.). A 403 from the authorizer must occur before any business logic.
- **Client-supplied org_id**: Never trust `req.body.org_id` or `req.query.org_id` for authorization. Use `getUserOrgIds(req)` and intersect.
- **Conditional auth**: Ensure no code path skips the auth check (e.g., early return before authorizer, or authorizer only on certain branches).

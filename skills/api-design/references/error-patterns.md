# Error Response Patterns

## Standard Error Shape

```json
{
  "code": "VALIDATION_ERROR",
  "message": "One or more fields failed validation",
  "errors": {
    "org_id": "Organization is required",
    "name": "Name must be at least 2 characters"
  }
}
```

- `code`: Machine-readable string (e.g., `PIN_INVALID_FORMAT`, `ACCESS_DENIED`, `TRIGGER_FAILED`). Use UPPER_SNAKE_CASE.
- `message`: Human-readable summary. Never expose stack traces, SQL, or file paths.
- `errors`: Optional. Map of field names to error messages for validation failures.

## Validation Error Responses

List **all** failing fields, not just the first. Example from `middleware/requirePinForWrite.ts`:

```json
{
  "errors": {
    "verificationPin": "A PIN is required to perform this action."
  }
}
```

For request body validation, use `errors` with field keys. Return 400 for validation errors.

## Sequelize vs Business Logic Errors

- **Sequelize validation errors**: `Model.validate()` or DB constraint violations. Map to `errors` object with field names. Return 400.
- **Business logic errors**: e.g., "Cannot delete zone with active devices". Set `error.code` to a specific code, return 409 (conflict) or 403 (forbidden).
- **Not found**: Return 404 with `{ error: "Resource not found" }` or similar. Do not leak whether the resource exists.

## CORS and Auth Error Handling

- **401 Unauthenticated**: No valid token or session. Response should not include auth-specific headers that could aid probing.
- **403 Forbidden**: Valid auth but insufficient permissions. Distinguish from 401 in logs; to the client, both mean "access denied".
- **CORS**: Preflight and error responses must include appropriate CORS headers. Ensure 4xx/5xx responses are not blocked by CORS middleware.

## Internal Error Sanitization

Never send to the client:
- Stack traces
- SQL query strings
- Internal file paths
- AWS or internal service error details

Log these server-side. Return a generic error message and a correlation ID if available for support lookup.

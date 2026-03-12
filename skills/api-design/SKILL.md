---
name: api-design
description: API endpoint design and contract conventions. Use when creating or modifying REST endpoints, refactoring API consumers, or aligning with OpenAPI specs. Covers route structure, request/response contracts, error responses, and cross-service consistency.
triggers:
  - cross-repo-check
  - code-review
related_skills:
  - feature-dev
  - security-audit
  - database-ops
  - frontend-patterns
---

# API Design

Apply these conventions when designing or modifying API endpoints in your
application (`repos/your-app/server/`).

## Route Structure

- RESTful resource naming: plural nouns, nested for ownership.
  `/organizations/:orgId/zones/:zoneId/devices`
- Use HTTP verbs correctly: GET (read), POST (create), PUT (full replace),
  PATCH (partial update), DELETE (remove).
- Avoid action verbs in URLs. Prefer resource state changes over RPC-style
  endpoints (`POST /alerts/:id/acknowledge` not `POST /acknowledgeAlert`).
- Version the API if breaking changes are unavoidable. The current codebase
  uses unversioned routes -- maintain consistency unless migrating.

## Request and Response Contracts

- Request bodies use camelCase keys (JavaScript convention).
- Response envelopes follow the existing pattern in the codebase. Check sibling
  endpoints before inventing a new shape.
- Pagination uses `limit` and `offset` query parameters with a default limit.
- Timestamps are ISO 8601 strings in UTC.

## Error Responses

- Use standard HTTP status codes: 400 (validation), 401 (unauthenticated),
  403 (unauthorized), 404 (not found), 409 (conflict), 500 (server error).
- Error bodies include a machine-readable `code` and human-readable `message`.
- Never expose stack traces, SQL queries, or internal paths in error responses.
- Validation errors list all failing fields, not just the first one.

## Maintaining API Stability

- When refactoring an endpoint, verify that existing consumers (React
  components, tests, external integrations) still work.
- Run `grep` for the endpoint path across the client codebase to find all
  callers before changing the contract.
- If an endpoint has tests, ensure they still pass without modification after
  your change. This was a key win pattern: maintaining public API stability
  so existing test files remain valid.

## Cross-Service APIs

- The platform communicates with the notifier via SQS/Kinesis. Message schemas
  are contracts -- changes require coordination.
- MQTT topic structures are shared between platform, Home Assistant, and the
  gateway. Check `docs/architecture.md` before modifying.
- When integrating with external APIs (Graph API, Jira, etc.), prefer raw
  REST calls with explicit error handling over SDK dependencies.

## Additional Resources

- For route structure and response envelope examples, see [references/endpoint-examples.md](references/endpoint-examples.md)
- For error response patterns and validation, see [references/error-patterns.md](references/error-patterns.md)

## Before Completing API Work

1. Test the endpoint with valid input, invalid input, and missing auth.
2. Verify all existing callers in the client still compile and function.
3. Check that error responses are informative but do not leak internals.
4. Run `/code-review` to validate the change.

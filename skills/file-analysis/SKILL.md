---
name: file-analysis
description: Structured file analysis for your organization's codebases. Use when examining, understanding, or preparing to modify a file. Covers responsibility identification, dependency tracing, code quality, security posture, and testability assessment.
triggers: []
related_skills:
  - code-review
  - refactoring
  - cross-repo-check
  - modular-design
---

# File Analysis Standards

When examining or modifying a file, apply this structured analysis to understand
the file's role, quality, and security posture before making changes.

## Identify Responsibility

- What is this file's single responsibility? If it has multiple, flag for
  potential splitting.
- Which repository does this file belong to? Check `AGENTS.md` for that repo's
  ownership boundaries.
- Is this file a handler, service, utility, model, controller, component, or
  configuration? Understand its architectural layer.

## Trace Dependencies

- Map the file's imports: what does it depend on?
- Map the file's exports: what depends on it?
- Identify cross-repo touchpoints:
  - Does it read/write to the shared PostgreSQL database?
  - Does it publish/subscribe to MQTT topics?
  - Does it produce/consume SQS or Kinesis messages?
  - Does it call external APIs (Twilio, SendGrid, RapidResponse, CAD)?
- Flag circular dependencies or overly deep import chains.

## Assess Code Quality

- **Size**: Is the file approaching or exceeding ~400 lines? Consider splitting.
- **Complexity**: Are there deeply nested conditionals or long function bodies?
  Flag for extraction.
- **Naming**: Do variables, functions, and classes clearly convey intent?
- **Dead code**: Are there unused imports, unreachable branches, or
  commented-out blocks?
- **Duplication**: Is logic repeated that could be extracted to a shared utility?
- **Error handling**: Are errors caught, logged with context, and propagated
  appropriately?

## Assess Security Posture

- Are user inputs validated and sanitized before use?
- Are database queries parameterized (no string concatenation for SQL)?
- Is sensitive data (passwords, tokens, PII) handled securely?
  - Not logged in plaintext
  - Encrypted at rest and in transit
  - Not exposed in error messages
- Are authentication/authorization checks present where needed?
- Are external service calls made over HTTPS with proper certificate validation?
- Are secrets fetched from environment variables or a secrets manager (not
  hardcoded)?

## Assess Testability

- Can the core logic be tested without I/O (network, DB, filesystem)?
- Are side effects isolated at the edges, or entangled with business logic?
- Does the file have corresponding test coverage? If not, flag the gap.
- Are there implicit dependencies (global state, singletons) that make
  testing difficult?

## Report Format

When analyzing a file, provide a concise assessment covering:
1. **Purpose**: One-sentence description of the file's responsibility.
2. **Layer**: Architectural layer (handler, service, utility, model, component).
3. **Dependencies**: Key imports and what depends on this file.
4. **Issues**: Any code quality, security, or maintainability concerns.
5. **Recommendations**: Specific, actionable improvements if applicable.

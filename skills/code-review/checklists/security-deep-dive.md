# Security Deep Dive Checklist

## Encryption & Redaction
- **At-Rest**: Use `encryptedField` pattern. Never use silent plaintext fallbacks if encryption fails.
- **Redaction**: Implement two-tier recursive redaction for sensitive data in record snapshots/logs.
- **Heuristics**: Ensure encryption detection (e.g., checking for colons) doesn't collide with standard formats (e.g., Basic Auth).

## Node.js & Async
- **Race Conditions**: Module-level async initialization must be guarded. Implement a `.onReady()` promise or state flag to prevent access before initialization completes.
- **Timing**: Ensure crypto operations are constant-time where applicable.

## Input & Execution
- **Sanitization**: All user-controlled data must be sanitized. Use parameterized queries for all DB interactions.
- **RCE**: Audit all `child_process` calls for shell injection. Prefer `execFile` over `exec`.

# Infrastructure & Migration Checklist

1. **Logging Verification**:
   - If switching to Pino or structured logs, update test mocks to capture and verify `process.stdout` output.
   - Verify that log context (UUIDs, request IDs) persists through all architectural layers.
2. **Sync & Timing**:
   - Prefer polling with `mtime` checks over `fs.watch` for cross-process triggers on macOS.
   - Use exponential backoff or event-based triggers instead of arbitrary `sleep` commands.
3. **Bulk Refactoring**:
   - Use a single-pass regex for repository-wide replacements to ensure consistency before delegating logic-heavy changes to sub-agents.
   - Audit for "forgotten" exports or dead code immediately after a major migration.
4. **Build Integrity**:
   - Verify build artifacts (e.g., `dist/`, `build/`) match source changes, especially in environments like VS Code extensions where the relationship is not 1:1.

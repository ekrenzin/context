# Subagent Exploration Strategy

When a feature spans multiple repositories or deep architectural layers, use a subagent to gather context efficiently.

## Patterns
- **Symbol Trace**: Find all definitions and usages of a specific model (e.g., `Camera`) across `your-app` and `your-service`.
- **Config Audit**: Scan for how sensitive keys are referenced across services to identify reuse vs. dedicated keys.
- **Pattern Match**: Look for how other "gateway" types are implemented to follow established ENUM patterns.

## Execution
1. Define the scope (e.g., `repos/your-app`, `repos/your-service`).
2. Provide specific symbols or patterns to search for.
3. Consolidate results into a brief summary before starting implementation.

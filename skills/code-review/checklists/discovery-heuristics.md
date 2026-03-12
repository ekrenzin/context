# Discovery Heuristics

1. **String Search**: Use `rg` on specific UI labels or error messages to find the relevant code entry point immediately.
2. **Pattern Matching**: Look for "Strategy" or "Standard" documents in `docs/` or `context/` before touching core systems (auth, logging, messaging).
3. **Dependency Trace**: Check `package.json` or `go.mod` to see what libraries are already used for the task at hand before adding new ones.
4. **Layout Navigation**: Examine common layout files early if a task affects multiple related resources or page types.
5. **Component Audit**: Search `repos/` for keywords like `Drawer`, `Modal`, `Table`, `Viewer` before starting a "new" UI feature.

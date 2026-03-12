# UI Reuse Audit

Before implementing a new UI component or view, perform this audit:

1. **Component Search**: Search for existing implementations of similar patterns (e.g., `LogsDrawer`, `BaseModal`).
2. **Style Search**: Audit existing `.css` or styled-components for similar layout patterns to prevent class duplication.
3. **Hook Extraction**: If logic is coupled to a component, move it to a `use[Feature]` hook to enable reuse across different view types.
4. **Layout Check**: Can this feature be injected into a global layout (e.g., `MainLayout.tsx`) instead of being added to multiple individual pages?
5. **Dynamic Data**: Ensure the component accepts generic data mappings rather than hardcoded object shapes to maximize future utility.

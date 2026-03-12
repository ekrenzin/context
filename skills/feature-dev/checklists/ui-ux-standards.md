# UI/UX Standards

## Architectural Choices
- **Global Layouts**: For system-wide features (e.g., global log viewer), consider layout injection in `App.tsx` or `Layout.tsx` rather than per-page components.
- **Custom Hooks**: Extract complex state/logic from components into reusable hooks.
- **Barrel Exports**: Use `index.ts` to simplify imports and prevent import rot.

## Data Handling
- **Dynamic Mapping**: Use generic, schema-aware components for data display (e.g., log payloads) to ensure extensibility.
- **Information Density**: If users complain about "steps" or "clutter", prioritize information density and drill-down previews over adding navigation levels.

## Verification
- **Cross-Browser**: Check rendering in different viewports if the change affects global layout.
- **Dependencies**: Verify `@mui/x-*` or similar optional packages are explicitly listed in `package.json`.

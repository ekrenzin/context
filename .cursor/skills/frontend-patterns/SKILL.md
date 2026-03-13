---
name: frontend-patterns
description: React frontend patterns and conventions. Use when building or modifying UI components, dashboard views, modals, forms, or CSS in your-app. Covers component structure, state management, styling, and accessibility.
triggers:
  - code-review
  - staging-test
  - ui-design
related_skills:
  - feature-dev
  - api-design
  - ui-design
  - security-audit
  - sos-branding
---

# Frontend Patterns

Apply these patterns when working on React components in the platform
frontend (`repos/your-app/client/`).

## Component Structure

- One component per file unless tightly coupled (e.g., a list + list item).
- Prefer functional components with hooks over class components.
- Extract reusable logic into custom hooks (`useAlerts`, `useZones`, etc.).
- Keep components under ~200 lines. Split into sub-components at that threshold.
- Co-locate component-specific styles, types, and test files.

## State Management

- Local state (`useState`) for UI-only concerns (modals, form inputs, toggles).
- Context for cross-component state that does not need persistence (auth user,
  theme, active organization).
- API state via the existing fetch/cache pattern in the codebase -- check how
  sibling components handle data loading before introducing new patterns.
- Avoid prop drilling beyond 2 levels. Lift state or use context.

## Compact / Embedded Mode

Components that appear in both full-size views and embedded previews (e.g.,
InteractiveMap inside FloorplanPreviewPanel) should accept a `compact` prop.

- When `compact` is true, hide chrome that only makes sense at full size:
  toolbars, filter panels, floor selectors, settings overlays.
- Move essential controls (e.g., floor navigation) to the parent container's
  header instead of overlaying them on the embedded content.
- Design for this from the start when building any component that may be
  reused in a card, panel, or modal.

## Imperative Libraries + React Lifecycle

Map libraries (Mapbox GL, Leaflet), canvas-based renderers, and D3 manage
their own DOM. React's useEffect teardown/recreate cycle conflicts with this.

- **Separate mount from update.** One effect for adding the source/layer
  (runs on mount, cleans up on unmount). A second effect for updating
  properties in-place (`updateImage()`, `setPaintProperty()`).
- **Use refs for mutable state** (`addedRef`) to track whether the
  imperative resource exists, avoiding redundant add/remove cycles.
- **Use stable IDs.** Key imperative resources on identity (e.g., `orgId`),
  not on volatile props (e.g., `floor`, `timestamp`). Update those properties
  in-place instead of destroying and recreating.
- **Set fade/transition durations to 0** for programmatic updates. Animated
  transitions during data-driven repaints look like flicker.

## Proximity-Based Auto-Selection

For map views where a zoomed-in state should activate context (overlays,
panels, details) for the nearest entity:

- Compute nearest entity to viewport center using squared-distance (no sqrt
  needed for comparison).
- Use a `didAutoSelect` ref to prevent re-running on every pan while zoomed.
- Clear the selection and reset the ref when zoom drops below threshold so
  re-detection works on the next zoom-in.
- Still allow manual selection (pin click) to override the auto-selected
  entity.

## Common Pitfalls in This Codebase

- **React lifecycle re-mount resets**: Modal state resets when the parent
  re-renders and the modal component unmounts/remounts. Use stable keys or
  lift state above the conditional render.
- **AlertNotificationBadge and AppBar coupling**: These share UserAlerts API
  data. Changes to one often require changes to the other.
- **Form validation**: Validate on blur and on submit. Server-side validation
  errors must surface in the UI, not just console.
- **useEffect placement**: If an effect references variables from hooks or
  memos, define the effect after those declarations. ESLint's
  `no-use-before-define` will reject the commit otherwise.

## CSS Conventions

- Use the existing variable system (`--sos-gold`, `--sos-gold-light`, etc.)
  for brand colors. Never hardcode hex values for brand colors. The
  authoritative palette is in `/sos-branding` -- consult it when adding new
  tokens or verifying existing ones.
- Responsive breakpoints: mobile at 500px, tablet at 768px.
- Prefer CSS Grid for layout, Flexbox for alignment within rows.

## Before Completing Frontend Work

1. Verify the component renders without console errors.
2. Check that interactive elements have hover/focus states.
3. Confirm the change works at the narrowest responsive breakpoint.
4. Run `/code-review` to validate naming, security, and maintainability.
5. For platform changes, run `/staging-test` or `/browser-checker` to confirm
   the UI renders correctly in the running app.

## Additional Resources

- For component structure examples and common patterns, see [references/component-examples.md](references/component-examples.md)
- For CSS variable reference and styling guide, see [references/css-variables.md](references/css-variables.md)

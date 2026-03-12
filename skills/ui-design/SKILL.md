---
name: ui-design
description: >-
  UI design thinking for adaptive, data-driven interfaces. Use when building or
  modifying any visual component -- React, HTML, dashboards, modals, lists,
  forms, graphs, or layout containers. Enforces dynamic values over hardcoding,
  flexible layouts over fixed dimensions, graceful edge-case handling, and
  composition patterns that don't box the UI into a corner. Apply alongside
  /frontend-patterns (structural conventions) and /code-review (quality gates).
related_skills:
  - frontend-patterns
  - branding
  - code-review
---

# UI Design

These heuristics govern how agents think about UI. They sit above
framework-specific conventions (covered by `/frontend-patterns`) and focus on
the design decisions that determine whether a component survives contact with
real data.

## Core Principle

**The UI serves the data, not the other way around.**

Every value the user sees should trace back to a variable, prop, API response,
or derived computation. If a value is typed directly into JSX/HTML as a literal,
it must be either a true constant (a label that will never change) or a
design token. Everything else is a hardcode waiting to break.

## Heuristics

### 1. Derive, Don't Hardcode

Render from data. Counts, labels, column headers, list lengths, status
text, badge colors, empty-state messages -- all of these come from state or
props, never from literals scattered across the template.

```jsx
// rigid -- breaks when categories change
<Tabs>
  <Tab label="Active" />
  <Tab label="Resolved" />
  <Tab label="Pending" />
</Tabs>

// adaptive -- tabs follow the data
<Tabs>
  {categories.map((c) => (
    <Tab key={c.id} label={c.name} />
  ))}
</Tabs>
```

Ask: "If the data changes shape or size tomorrow, does this component still
render correctly without a code change?"

### 2. Design for the Extremes

Every component will encounter:

- **Zero items** -- show an empty state, not a broken layout.
- **One item** -- no plural labels, no unnecessary chrome.
- **Hundreds of items** -- paginate, virtualize, or summarize.
- **Very long strings** -- truncate with a tooltip or wrap gracefully.
- **Missing/null fields** -- fallback text or conditional render, never crash.

Handle all five before considering the component done.

### 3. Flexible Containers, Not Fixed Boxes

Prefer constraints that describe relationships (`min-width`, `max-width`,
`flex`, `grid` fractions, `clamp()`) over absolute pixel values. A fixed
`width: 320px` is a commitment that the content will always be exactly that
wide -- it almost never will be.

Reserve hard pixel values for design-token spacing (4px, 8px, 16px grid) and
icon sizes. Everything else should be fluid or bounded.

### 4. Compose, Don't Configure

When a component needs variants, prefer composition (children, slots, render
props) over a growing props API. A component with 15 boolean props is
harder to maintain than one that accepts children.

```jsx
// configuration explosion
<Card showHeader showFooter showBadge badgeColor="red" headerSize="lg" />

// composable -- each concern is a separate, testable piece
<Card>
  <Card.Header size="lg" />
  <Card.Badge color="red" />
  <Card.Footer />
</Card>
```

The composable version survives new requirements without modifying the Card
component itself.

### 5. Separate Structure from Content

Layout components (Grid, Stack, Page, Sidebar) should know nothing about the
domain data they contain. Data components (AlertRow, ZoneCard, DeviceList)
should know nothing about where they sit on the page. When structure and content
are entangled, every layout change risks breaking data rendering.

### 6. Name by Role, Not by Data

Use semantic/role-based names (`primary`, `secondary`, `danger`, `muted`) for
colors, sizes, and variants. Not `red`, `large`, or `bold`. Role names survive
theme changes and rebrandings; literal names don't. For the canonical palette
and token names, see `/branding`.

### 7. Make State Transitions Visible

If a component has loading, error, empty, and populated states, all four should
be explicitly handled in the render path -- not left to fall through as a blank
screen. Users interpret a blank screen as broken.

```jsx
if (isLoading) return <Skeleton />;
if (error) return <ErrorBanner message={error.message} />;
if (!data?.length) return <EmptyState prompt="No alerts yet." />;
return <AlertList alerts={data} />;
```

### 8. Contextual Activation Over Explicit Activation

Default to showing relevant context automatically when the user's intent is
clear from their actions (zooming, navigating, filtering). Reserve explicit
activation (click-to-open, button-to-show) for destructive or expensive
operations.

Ask: "Can the system infer what the user wants from what they just did?"
If yes, activate contextually. If the inference could be wrong, make it easy
to dismiss or override -- but still default to showing it.

Examples:
- Zooming into an area near one entity on a map -> auto-show that entity's
  overlay and details panel.
- Opening a device page -> auto-expand the most recent alert, not a blank
  state requiring a click.
- Filtering a list to one result -> auto-select it.

### 9. Embedded Viewport Awareness

When a component may render inside a smaller container (preview panel, card,
modal sidebar), ask: "Do the controls still make sense at half the size?"

- If controls overlap content at small sizes, move them to the container
  chrome (header bar, footer) or hide them entirely.
- Provide a `compact` prop for suppressing chrome rather than relying on
  CSS media queries, since embedded size has no relationship to screen size.

## Decision Checklist

Before completing any UI work, verify:

| Question | If no... |
|---|---|
| Could this component render 0, 1, and 1000 items? | Add boundary handling. |
| Are all user-visible strings derived from data or i18n? | Extract literals. |
| Would a theme or brand change break the layout? | Use role-based tokens. |
| Does the layout survive 2x the expected text length? | Add truncation/wrap. |
| Can a new variant be added without modifying this file? | Refactor to compose. |
| Are loading, error, and empty states explicit? | Add missing branches. |
| Is every pixel value either a design token or fluid? | Replace magic numbers. |
| Can the system infer activation from user context? | Add contextual activation. |
| Does this work at half the viewport size (embedded)? | Add compact mode. |

## Anti-Patterns Reference

For concrete bad-to-good rewrites covering the most common agent mistakes, see
[references/anti-patterns.md](references/anti-patterns.md).

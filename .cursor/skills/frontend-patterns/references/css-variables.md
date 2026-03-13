# CSS Variables and Styling Reference

## Brand CSS Variables

Used across the UI:

| Variable | Value | Use |
|----------|-------|-----|
| `--brand-gold` | #C9A84C | Primary brand accent |
| `--brand-gold-light` | #D9BC6E | Hover, secondary accent |
| `--brand-gold-dim` | rgba(201, 168, 76, 0.10) | Subtle background |
| `--brand-gold-border` | rgba(201, 168, 76, 0.28) | Borders, dividers |
| `--brand-gold-glow` | rgba(201, 168, 76, 0.06) | Gradient backgrounds |

**Naming pattern**: `--brand-gold[-modifier]`. Modifiers: base (none), `-light`, `-dim`, `-border`, `-glow`. Never hardcode these hex/rgba values; always use the variable.

## Responsive Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| Mobile | 500px | Single column, stacked controls |
| Tablet | 768px | Two-column layouts where appropriate |

**Media query pattern**:
```css
/* Mobile-first: base styles for mobile */
.container { flex-direction: column; }

@media (min-width: 500px) {
  .container { flex-direction: row; }
}

@media (min-width: 768px) {
  .container { max-width: 960px; }
}
```

**Max-width for mobile-only overrides**:
```css
@media (max-width: 500px) {
  .sidebar { display: none; }
}
```

## Grid vs Flexbox Decision Guide

**Use CSS Grid when**:
- Two-dimensional layout (rows and columns)
- Dashboard cards, form sections with multiple fields per row
- Layout structure is the primary concern

**Use Flexbox when**:
- One-dimensional alignment (row or column)
- Aligning items within a single row (e.g., AppBar, button groups)
- Content-driven sizing (flex-grow, flex-shrink)

**Convention**: Prefer Grid for page-level layout; Flexbox for alignment within rows (e.g., `display: flex; align-items: center; gap: 8px`).

# CSS Variables and Styling Reference

## Brand CSS Variables

Defined in `tools/vscode-ext/media/dashboard.css` and used across the UI:

| Variable | Value | Use |
|----------|-------|-----|
| `--brand-gold` | #C9A84C | Primary brand accent |
| `--brand-gold-light` | #D9BC6E | Hover, secondary accent |
| `--brand-gold-dim` | rgba(201, 168, 76, 0.10) | Subtle background |
| `--brand-gold-border` | rgba(201, 168, 76, 0.28) | Borders, dividers |
| `--brand-gold-glow` | rgba(201, 168, 76, 0.06) | Gradient backgrounds |

**Naming pattern**: `--brand-gold[-modifier]`. Modifiers: base (none), `-light`, `-dim`, `-border`, `-glow`. Never hardcode these hex/rgba values; always use the variable.

## VS Code Extension Theming

Webviews in the VS Code extension use `var(--vscode-*)` tokens so the UI adapts to the user's theme (light/dark/high contrast).

**Common tokens**:
- `--vscode-foreground` - primary text
- `--vscode-editor-background` - main background
- `--vscode-font-family`, `--vscode-font-size`
- `--vscode-sideBar-background`, `--vscode-panel-border`
- `--vscode-input-background`, `--vscode-input-foreground`, `--vscode-input-border`
- `--vscode-button-secondaryBackground`, `--vscode-button-secondaryHoverBackground`
- `--vscode-list-hoverBackground`
- `--vscode-testing-iconPassed`, `--vscode-testing-iconFailed`
- `--vscode-descriptionForeground` - muted text

**Fallback pattern**: `var(--vscode-token, fallbackValue)` for tokens that may be undefined in older VS Code versions.

**Test**: Toggle between light and dark themes in VS Code and verify contrast and readability.

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

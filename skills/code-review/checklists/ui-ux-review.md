# UI/UX Code Review

## Components & Layout
- **Tooltips**: Test tooltips near screen edges. Ensure they don't cause horizontal scroll or appear off-screen.
- **Icons**: Centralize icon definitions in a configuration map or manifest. Avoid hardcoding SVG paths in components.
- **Responsiveness**: Check how header actions collapse on smaller viewports.

## Data & Strings
- **Abstraction**: Differentiate between 'infrastructure paths' (stable) and 'user configuration' (volatile) before abstracting to YAML/Manifests.
- **Labels**: Use short, descriptive labels. If an action is common, prefer an icon with a tooltip over a long text button.
- **Fallbacks**: Always provide a default icon or 'N/A' state for missing manifest entries.

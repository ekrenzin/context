---
name: desktop-automation
description: Automate native desktop applications via nut.js and nib. Use for anything outside a browser -- native apps, Electron, legacy GUIs, OS-level interactions.
---

# Desktop Automation

MCP server wrapping nut.js (Solo subscription) and nib CLI. Provides 45 tools
for controlling native desktop applications via mouse, keyboard, screen capture,
window management, accessibility tree inspection, OCR, and element interaction.

## When to Use

- **Native desktop apps** -- anything that is not a web page in a browser.
  For browser automation, use the Playwright MCP server instead.
- **Electron apps** -- including Context itself.
- **Legacy GUI apps** -- no API, no CLI, only a GUI.
- **Cross-application workflows** -- copy from one app, paste into another.
- **Computer-use agent loops** -- screenshot/snapshot, reason, act, verify.

## Prerequisites

### macOS (required)

Grant your terminal app **both** permissions in System Settings > Privacy:

1. **Accessibility** -- required for mouse/keyboard control
2. **Screen Recording** -- required for screenshots and OCR

### Linux

- X11 required (Wayland not supported)
- `libXtst` must be installed
- For headless/CI: use Xvfb

### Node.js

- v22 or later

### npm Auth

The nut.js Solo packages require an authenticated npm registry. The `.npmrc`
in `tools/desktop-mcp/` handles this. If packages fail to install, check that
the auth token is valid.

## Primary Workflow: Accessibility-First

Prefer the accessibility tree over pixel coordinates. Element refs survive
layout changes, theme switches, and resolution differences.

```
1. desktop_snapshot  -- get interactive elements with semantic refs
2. Decide which element to interact with
3. desktop_click_element / desktop_type_element  -- act on refs
4. desktop_diff  -- verify what changed
```

### Element Ref Format

| Pattern | Meaning | Example |
|---------|---------|---------|
| `@abbrev:label` | Unique element | `@btn:Save` |
| `@abbrev~N:label` | Nth element with same type+label | `@btn~2:OK` |
| `@abbrev~N` | Nth untitled element of type | `@btn~3` |

Common abbreviations: `btn` (button), `txt` (textfield), `chk` (checkbox),
`mnu` (menuitem), `tab` (tab), `lnk` (link), `rad` (radio), `sld` (slider),
`cmb` (combobox), `txa` (textarea), `lst` (listitem).

## Fallback Workflows

### Screenshot + Vision (when accessibility is unavailable)

For canvas-based UIs, games, or apps with poor accessibility support:

```
1. desktop_screenshot  -- capture as base64 image
2. Vision model reasons about the image
3. desktop_click / desktop_type  -- act on coordinates
4. desktop_screenshot  -- verify
```

### OCR (when you need to read text)

```
desktop_read_text                        -- read all text on screen
desktop_read_text --region 0,0,800,600   -- read text in a region
desktop_find_text "Error"                -- find specific text
desktop_find_text "\\d{3}" --regex       -- find by pattern
```

## Tool Categories

### Mouse (8 tools)
`desktop_mouse_move`, `desktop_mouse_move_smooth`, `desktop_mouse_position`,
`desktop_click`, `desktop_double_click`, `desktop_right_click`,
`desktop_drag`, `desktop_scroll`

### Keyboard (4 tools)
`desktop_type`, `desktop_press`, `desktop_key_down`, `desktop_key_up`

Key names: use `desktop_list_keys` to see all. Common: `LeftCmd`, `LeftControl`,
`LeftShift`, `LeftAlt`, `Enter`, `Tab`, `Escape`, `Space`, `Backspace`,
`Delete`, `Up`, `Down`, `Left`, `Right`, `F1`-`F12`.

### Screen (6 tools)
`desktop_screenshot`, `desktop_screen_size`, `desktop_color_at`,
`desktop_highlight`, `desktop_find_text`, `desktop_read_text`

### Windows (9 tools)
`desktop_list_windows`, `desktop_active_window`, `desktop_focus_window`,
`desktop_window_region`, `desktop_resize_window`, `desktop_move_window`,
`desktop_minimize_window`, `desktop_restore_window`, `desktop_wait_for_window`

### Clipboard (2 tools)
`desktop_clipboard_get`, `desktop_clipboard_set`

### Elements / Accessibility (13 tools)
`desktop_snapshot`, `desktop_diff`, `desktop_click_element`,
`desktop_double_click_element`, `desktop_right_click_element`,
`desktop_type_element`, `desktop_focus_element`, `desktop_hover_element`,
`desktop_scroll_element`, `desktop_find_element`, `desktop_get_element`,
`desktop_check_element`, `desktop_window_elements`

### System (3 tools)
`desktop_status`, `desktop_wait`, `desktop_list_keys`

## Window Targeting

Most tools accept window targeting options:

| Option | Description |
|--------|-------------|
| `window` | Title (case-insensitive match) |
| `app` | Application name |
| `pid` | Process ID |
| `bundleId` | Bundle identifier (macOS) |

These can be combined to narrow the match.

## Starting the Server

```bash
npx tsx tools/desktop-mcp/src/index.ts
```

Or add to your MCP client configuration as a stdio server.

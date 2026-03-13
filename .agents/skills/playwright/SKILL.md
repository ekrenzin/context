---
name: playwright
description: Browser automation and E2E testing via Playwright MCP. Triggers on UI verification, E2E tests, browser testing, visual confirmation, click-through testing, or when a user asks to verify something works in the browser.
triggers:
  - feature-dev
  - test-plan
  - frontend-patterns
related_skills:
  - test-plan
  - code-review
  - preflight
---

# Playwright

Use the Playwright MCP server to drive a real browser for E2E verification,
visual confirmation, and automated testing. The server exposes browser
automation as MCP tools -- no Playwright API code needed.

## MCP Tools (provided by `@playwright/mcp`)

The Playwright MCP server provides snapshot-based and interaction tools.
Use snapshot tools by default (faster, more reliable). Vision tools are
available when coordinate-based interaction is needed.

### Core tools

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Go to a URL |
| `browser_click` | Click an element (by `ref` from snapshot) |
| `browser_type` | Type into an input field |
| `browser_snapshot` | Get accessibility tree of current page |
| `browser_take_screenshot` | Capture a screenshot |
| `browser_wait` | Wait for a specified duration |
| `browser_close` | Close the current tab |

### Form and interaction

| Tool | Purpose |
|------|---------|
| `browser_select_option` | Select from dropdown |
| `browser_hover` | Hover over element |
| `browser_press_key` | Press keyboard key |
| `browser_drag` | Drag element to target |

### Tab and navigation

| Tool | Purpose |
|------|---------|
| `browser_tab_list` | List open tabs |
| `browser_tab_new` | Open new tab |
| `browser_tab_select` | Switch to tab |
| `browser_tab_close` | Close a tab |
| `browser_back` | Navigate back |
| `browser_forward` | Navigate forward |

### Advanced

| Tool | Purpose |
|------|---------|
| `browser_console_messages` | Read browser console logs |
| `browser_evaluate` | Execute JS in page context |
| `browser_file_upload` | Upload file to input |
| `browser_generate_playwright_test` | Generate a `.spec.ts` from session |
| `browser_network_requests` | View network activity |
| `browser_pdf_save` | Save page as PDF |
| `browser_resize` | Resize viewport |

## When to use

- **After UI changes**: Navigate to the affected page, take a snapshot, verify
  elements render correctly.
- **Form flows**: Fill out forms, submit, verify success/error states.
- **Regression checks**: Click through adjacent features to confirm they still
  work after a change.
- **Visual confirmation**: Screenshot a page to verify layout, styling, or
  responsiveness.
- **Console errors**: Check `browser_console_messages` for JS errors after
  navigation.
- **Generate test files**: Use `browser_generate_playwright_test` after a
  manual walkthrough to produce a reusable `.spec.ts`.

## Verification workflow

When the user asks you to verify something works, or after completing a UI
change:

1. **Navigate** to the relevant URL (`browser_navigate`).
2. **Snapshot** the page (`browser_snapshot`) to inspect the accessibility tree.
3. **Interact** if needed (click, type, submit).
4. **Assert** by reading the snapshot or screenshot -- confirm expected elements
   are present, text matches, no error banners.
5. **Check console** (`browser_console_messages`) for errors.
6. **Generate test** (`browser_generate_playwright_test`) if the flow should be
   repeatable.

## Test generation

After verifying a flow manually, use `browser_generate_playwright_test` to
produce a Playwright test file. Save generated tests to the repo's test
directory (e.g., `tests/e2e/`).

Generated tests serve as regression guards -- they capture the exact flow
that was just verified and can be re-run in CI.

## Configuration

The Playwright MCP server runs as a stdio subprocess. Configuration is in
`.cursor/mcp.json` (Cursor) or `.claude/mcp.json` (Claude Code).

Key flags:

| Flag | Purpose |
|------|---------|
| `--browser chromium` | Browser engine (chromium, firefox, webkit) |
| `--caps testing` | Enable assertion and test generation tools |
| `--viewport-size 1280,720` | Default viewport |
| `--headless` | Run without visible browser (CI mode) |

## Limitations

- Snapshot-based tools use accessibility refs, not CSS selectors. Use
  `browser_snapshot` to discover available refs before interacting.
- The browser session persists across tool calls within a conversation but
  resets between conversations.
- Auth state is not preserved by default. Use `--storage-state` for persistent
  login, or log in via `browser_click`/`browser_type` each session.

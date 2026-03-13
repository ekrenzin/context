# Preview

Show files to the user in a browser-based gallery. Use this instead of
printing file paths when you produce visual output.

## Tools

### `preview`

Open a single file in the preview UI.

```
preview({ path: "/absolute/path/to/file.png", title: "Revenue Chart" })
```

### `preview_gallery`

Open multiple files as a gallery.

```
preview_gallery({
  files: [
    { path: "/path/to/chart1.png", title: "Q1 Revenue" },
    { path: "/path/to/chart2.png", title: "Q2 Revenue" },
  ],
  gallery_title: "Quarterly Comparison"
})
```

## Supported Types

Images (PNG, JPG, GIF, WebP), SVG, PDF, HTML, CSV, JSON, Markdown.

## When to Use

- After generating an image, chart, or screenshot
- After writing an HTML file the user should see
- After exporting CSV/JSON data the user should inspect
- After capturing a Playwright screenshot

## How It Works

The first `preview` call starts a local HTTP server and opens a browser tab.
Subsequent calls push files into the same tab via SSE. A sidebar shows all
previews from the session.

When the Command Center is running, previews are served through its HTTP
server and appear at `/previews`. When standalone, the MCP server runs its
own server on port 3456.

## Configuration

- `PREVIEW_PORT`: HTTP server port (default: 3456, standalone only)
- `PREVIEW_AUTO_OPEN`: Auto-open browser on first preview (default: true)

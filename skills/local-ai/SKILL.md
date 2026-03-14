---
name: local-ai
description: Interact with the local Ollama model running on the MQTT bus. Supports tool use (web fetch, search, file operations), hybrid cloud routing, and model management. Triggers on mentions of local model, Ollama, quick draft, free inference, or local AI.
---

# Local AI

A local Ollama model runs as an MQTT background service on the workspace bus.
Zero cost, zero latency for simple tasks. Automatically routes complex tasks
to cloud APIs when hybrid mode is enabled.

## MCP Tools

| Tool | Use case |
|------|----------|
| `cc_local_ai_prompt` | Send a prompt with optional tool use and routing (local/cloud/auto) |
| `cc_local_ai_status` | Check model, tier, tool support, routing mode, Ollama health |
| `cc_local_ai_mqtt_prompt` | Async prompt via MQTT -- fire-and-forget, reply on a topic |
| `cc_local_ai_models` | List available models with capability tiers, or switch the active model |

## When to Use

- **Session naming**: Handled automatically. The service listens to `ctx/session/+/started` and labels sessions.
- **Quick drafts**: Commit messages, PR titles, short descriptions. Use `cc_local_ai_prompt`.
- **Web research**: Set `tools: true` to let the model fetch URLs and search the web.
- **File exploration**: With tools enabled, the model can read files, grep, and glob the workspace.
- **Brainstorming**: Generate name ideas, taglines, or alternatives. Fast iteration at zero cost.
- **Summaries**: Condense log output, error traces, or long text into a short summary.
- **Triage**: Pipe an error message through and get a one-line explanation.

## Tool Use

When `tools: true` is passed, the local model can call these built-in tools:

| Tool | What it does |
|------|-------------|
| `web_fetch` | Fetch a URL, strip HTML, return text |
| `web_search` | Search the web via SearXNG or DuckDuckGo |
| `file_read` | Read a workspace file (path-contained) |
| `grep` | Search file contents with regex |
| `glob` | Find files by pattern |

Tool use requires a medium or large model (7B+ parameters). Small models
(0.5B) skip tool use and return raw text.

## Hybrid Routing

The router decides where to send each prompt based on:

| Signal | Route |
|--------|-------|
| Simple prompt, small token count | Local (free) |
| Tools requested, capable model loaded | Local |
| High token count or complex reasoning | Cloud (if API key configured) |
| Explicit `route: "local"` or `route: "cloud"` | Honored |
| Ollama unavailable | Cloud fallback |

Configure routing via settings or `PUT /api/local-ai/routing`:
- `local-only` (default): Never use cloud APIs
- `hybrid`: Local-first with cloud fallback
- `cloud-only`: Always use cloud APIs

## Model Tiers

| Tier | Examples | Capabilities |
|------|----------|-------------|
| Small | qwen2.5:0.5b, phi-3-mini | Text only, ~200 tokens, no tools |
| Medium | qwen2.5:7b, llama3.1:8b | Tool use, ~1K tokens, basic reasoning |
| Large | qwen2.5:32b, llama3.1:70b | Full tool use, ~4K tokens, solid reasoning |

Switch models via `cc_local_ai_models` or `PUT /api/local-ai/model`.

## MQTT Protocol

**Request** -- publish to `ctx/local-ai/prompt`:
```json
{
  "prompt": "Search the web for TypeScript MQTT libraries",
  "maxTokens": 500,
  "temperature": 0.7,
  "tools": true,
  "route": "auto",
  "replyTo": "ctx/my-service/ai-reply"
}
```

**Response** -- arrives on `replyTo` (default `ctx/local-ai/reply`):
```json
{
  "ok": true,
  "response": "...",
  "backend": "local",
  "toolCalls": 2,
  "iterations": 3
}
```

**Routing events** -- published to `ctx/local-ai/routed`:
```json
{
  "backend": "cloud",
  "reason": "requested 2000 tokens exceeds threshold 1000",
  "model": "qwen2.5:0.5b",
  "tokens": 2000
}
```

## REST API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/local-ai/status` | Full status (model, tier, tools, routing, cloud key) |
| POST | `/api/local-ai/prompt` | Synchronous prompt (with tools and routing) |
| GET | `/api/local-ai/models` | List models with capability tiers |
| PUT | `/api/local-ai/model` | Switch active model |
| POST | `/api/local-ai/pull` | Pull a new model from Ollama registry |
| GET | `/api/local-ai/routing` | Get routing config |
| PUT | `/api/local-ai/routing` | Set routing mode and threshold |

## Limitations

- Tool use requires 7B+ model. 0.5B models get raw text only.
- First call after cold start has ~8s model load latency.
- Web search uses DuckDuckGo HTML scrape by default. For better results,
  configure SearXNG (`searxng_url` setting).
- Cloud fallback requires an API key (`anthropic_api_key` or `openai_api_key`).

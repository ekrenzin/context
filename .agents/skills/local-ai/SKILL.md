---
name: local-ai
description: Interact with the local Ollama model running on the MQTT bus. Use when you need zero-cost, low-latency inference -- drafting text, naming things, summarizing, brainstorming, or triaging errors. Triggers on mentions of local model, Ollama, quick draft, or free inference.
---

# Local AI

A tiny Ollama model runs as an MQTT background service on the workspace bus.
Zero cost, zero latency, runs entirely on the user's machine.

## MCP Tools

| Tool | Use case |
|------|----------|
| `cc_local_ai_prompt` | Synchronous prompt -- send text, get a response back immediately |
| `cc_local_ai_status` | Check if the local model is running and which model is loaded |
| `cc_local_ai_mqtt_prompt` | Async prompt via MQTT -- fire-and-forget, reply on a topic |

## When to Use

- **Session naming**: Handled automatically. The service listens to `ctx/session/+/started` and labels sessions.
- **Quick drafts**: Commit messages, PR titles, short descriptions. Use `cc_local_ai_prompt`.
- **Brainstorming**: Generate name ideas, taglines, or alternatives. Fast iteration at zero cost.
- **Summaries**: Condense log output, error traces, or long text into a short summary.
- **Triage**: Pipe an error message through and get a one-line explanation.

## MQTT Protocol

Any service on the bus can use the local AI by publishing to MQTT:

**Request** -- publish to `ctx/local-ai/prompt`:
```json
{
  "prompt": "Summarize this error: ...",
  "maxTokens": 200,
  "temperature": 0.7,
  "replyTo": "ctx/my-service/ai-reply"
}
```

**Response** -- arrives on `replyTo` (default `ctx/local-ai/reply`):
```json
{ "ok": true, "response": "..." }
```

## Limitations

- Model is small (qwen2.5:0.5b by default) -- good for short generation, not complex reasoning.
- First call after cold start has ~8s model load latency. Subsequent calls are ~100ms.
- Max useful output is ~200 tokens. Beyond that, quality degrades.

## Checking Status

Use `cc_local_ai_status` or read the retained MQTT topic:

```
Topic: ctx/local-ai/status
Payload: { "status": "online", "model": "qwen2.5:0.5b" }
```

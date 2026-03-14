#!/usr/bin/env bash
# Bridge Claude Code hook events to the Context MQTT bus.
# Receives JSON on stdin from Claude Code hooks (PostToolUse, Stop).
# Posts to the Command Center agent emit endpoint.
# Fire-and-forget: failures are silent, never blocks Claude Code.

set -euo pipefail

CC_URL="http://localhost:19471/api/agent/emit"

# Read hook JSON from stdin, build the emit payload in one Python pass
PAYLOAD=$(python3 << 'PYEOF'
import sys, json

try:
    hook = json.load(sys.stdin)
except Exception:
    sys.exit(0)

event_name = hook.get("hook_event_name", "")
session_id = hook.get("session_id", "")

if event_name == "PostToolUse":
    tool_input = hook.get("tool_input", {})
    if isinstance(tool_input, dict):
        for k, v in list(tool_input.items()):
            if isinstance(v, str) and len(v) > 200:
                tool_input[k] = v[:200] + "..."
    payload = {
        "tool": "claude-code",
        "event": "tool/used",
        "data": {
            "name": hook.get("tool_name", "unknown"),
            "sessionId": session_id,
            "input": tool_input,
        },
    }
elif event_name == "Stop":
    payload = {
        "tool": "claude-code",
        "event": "session/ended",
        "data": {"sessionId": session_id},
    }
else:
    sys.exit(0)

print(json.dumps(payload))
PYEOF
) || exit 0

# Empty payload means Python exited early
[ -z "$PAYLOAD" ] && exit 0

# Post to CC -- timeout 2s, fail silently
curl -s -X POST "$CC_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  --connect-timeout 1 \
  --max-time 2 \
  > /dev/null 2>&1 || true

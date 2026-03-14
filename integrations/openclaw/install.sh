#!/usr/bin/env bash
set -euo pipefail

# Install Context workspace integration for OpenClaw.
#
# Usage:
#   curl -fsSL <raw-url>/install.sh | bash
#   -- or --
#   ./install.sh
#
# Prerequisites:
#   - Node >= 22
#   - A Context workspace (workspace.yaml in some parent dir)
#   - OpenClaw installed and running

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_SKILLS="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills"
SKILL_DIR="$OPENCLAW_SKILLS/context-workspace"

echo "==> Installing Context workspace skill for OpenClaw"

# Find Context workspace root
CTX_ROOT=""
dir="$SCRIPT_DIR"
while [ "$dir" != "/" ]; do
  if [ -f "$dir/workspace.yaml" ]; then
    CTX_ROOT="$dir"
    break
  fi
  dir="$(dirname "$dir")"
done

if [ -z "$CTX_ROOT" ]; then
  echo "  Looking for workspace.yaml..."
  if [ -n "${CTX_WORKSPACE:-}" ] && [ -f "$CTX_WORKSPACE/workspace.yaml" ]; then
    CTX_ROOT="$CTX_WORKSPACE"
  else
    echo "ERROR: Could not find Context workspace (no workspace.yaml found)."
    echo "Set CTX_WORKSPACE env var to your workspace root."
    exit 1
  fi
fi

echo "  Context workspace: $CTX_ROOT"

# Build the MCP server
echo "==> Building MCP server..."
cd "$SCRIPT_DIR"
npm install --ignore-scripts 2>/dev/null
npm run build

# Copy skill to OpenClaw workspace
echo "==> Installing skill to $SKILL_DIR"
mkdir -p "$SKILL_DIR"
cp SKILL.md "$SKILL_DIR/SKILL.md"

# Write OpenClaw MCP config snippet
MCP_CMD="node $SCRIPT_DIR/dist/index.js"
CONFIG_SNIPPET=$(cat <<EOF
{
  "context-workspace": {
    "command": "$MCP_CMD",
    "env": {
      "CTX_WORKSPACE": "$CTX_ROOT"
    }
  }
}
EOF
)

echo ""
echo "==> Done! Add this to your OpenClaw MCP config:"
echo ""
echo "$CONFIG_SNIPPET"
echo ""
echo "Or set the environment variable and the skill handles discovery:"
echo "  export CTX_WORKSPACE=$CTX_ROOT"
echo ""
echo "The skill is installed at: $SKILL_DIR/SKILL.md"
echo "The MCP server binary is: $MCP_CMD"

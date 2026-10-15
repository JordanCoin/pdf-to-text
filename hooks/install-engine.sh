#!/usr/bin/env bash
# Claude Code plugin SessionStart hook: make sure the native engine is
# installed. Delegates to the same universal installer every other agent
# uses, so there is exactly one install path to maintain.
set -euo pipefail

PLUGIN_DIR="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
ENGINE_DIR="${PDF_TO_TEXT_HOME:-$HOME/.pdf-to-text}"
WANT="$(tr -d '[:space:]' < "$PLUGIN_DIR/VERSION" 2>/dev/null || echo latest)"
HAVE="$(cat "$ENGINE_DIR/VERSION" 2>/dev/null || true)"

# Already installed at the plugin's pinned version: nothing to do.
if [ -x "$ENGINE_DIR/bin/pdf-to-text" ] && [ "$HAVE" = "v$WANT" ]; then
  exit 0
fi

echo "[pdf-to-text] Installing engine v${WANT}..."
if [ -n "$HAVE" ]; then echo "$HAVE" > "$ENGINE_DIR/just-upgraded-from"; fi
bash "$PLUGIN_DIR/install.sh" --engine-only --version "v$WANT"

# The MCP server ships as TypeScript; dist/ is not committed. Build it once
# so .mcp.json's `node mcp-server/dist/index.js` has something to run.
MCP="$PLUGIN_DIR/mcp-server"
if [ ! -f "$MCP/dist/index.js" ] && command -v npm >/dev/null 2>&1; then
  echo "[pdf-to-text] Building MCP server..."
  (cd "$MCP" && npm ci --no-audit --no-fund --silent && npx tsc -p .) \
    || echo "[pdf-to-text] MCP build failed; the pdf-to-text skill still works via the CLI." >&2
fi

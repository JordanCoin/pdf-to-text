#!/usr/bin/env bash
set -euo pipefail

PLUGIN_DIR="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
INSTALL_DIR="${CLAUDE_PLUGIN_DATA:-${HOME}/.config/pdf-to-text}"
VERSION_FILE="${PLUGIN_DIR}/VERSION"
INSTALLED_VERSION_FILE="${INSTALL_DIR}/.version"
MARKER_FILE="${INSTALL_DIR}/just-upgraded-from"

RELEASE_BASE="https://github.com/JordanCoin/glyph-api/releases/download"

TARGET_VERSION="$(cat "$VERSION_FILE" 2>/dev/null | tr -d '[:space:]')"
INSTALLED_VERSION="$(cat "$INSTALLED_VERSION_FILE" 2>/dev/null | tr -d '[:space:]' || true)"

# Already at target version — nothing to do
if [ "$INSTALLED_VERSION" = "$TARGET_VERSION" ]; then
  exit 0
fi

echo "[pdf-to-text] Installing engine v${TARGET_VERSION}..."
mkdir -p "$INSTALL_DIR"

RELEASE_URL="${RELEASE_BASE}/v${TARGET_VERSION}"

download() {
  local url="$1" dest="$2" name="$3"
  echo "  Downloading ${name}..."
  if ! curl -sfL --max-time 60 "$url" -o "${dest}.tmp"; then
    echo "  [ERROR] Failed to download ${name}" >&2
    rm -f "${dest}.tmp"
    return 1
  fi
  if [ ! -s "${dest}.tmp" ]; then
    echo "  [ERROR] Empty download for ${name}" >&2
    rm -f "${dest}.tmp"
    return 1
  fi
  mv "${dest}.tmp" "$dest"
}

WASM_FILE="${INSTALL_DIR}/glyph_api_bg.wasm"
JS_FILE="${INSTALL_DIR}/glyph_api.js"
MD_FILE="${INSTALL_DIR}/markdown.js"

# Download all three files — atomic (all succeed or none committed)
if download "${RELEASE_URL}/glyph_api_bg.wasm" "$WASM_FILE" "glyph_api_bg.wasm" \
  && download "${RELEASE_URL}/glyph_api.js" "$JS_FILE" "glyph_api.js" \
  && download "${RELEASE_URL}/markdown.js" "$MD_FILE" "markdown.js"; then

  # Write upgrade marker if this was an upgrade (not first install)
  if [ -n "$INSTALLED_VERSION" ] && [ "$INSTALLED_VERSION" != "$TARGET_VERSION" ]; then
    echo "$INSTALLED_VERSION" > "$MARKER_FILE"
  fi

  echo "$TARGET_VERSION" > "$INSTALLED_VERSION_FILE"
  echo "[pdf-to-text] Engine v${TARGET_VERSION} ready at ${INSTALL_DIR}"
else
  # Cleanup partial downloads — don't leave corrupted state
  rm -f "${WASM_FILE}.tmp" "${JS_FILE}.tmp" "${MD_FILE}.tmp"
  echo "[pdf-to-text] Install failed. extract_pdf unavailable until engine is installed." >&2
  echo "[pdf-to-text] Retry: delete ${INSTALL_DIR} and restart your session." >&2
  exit 1
fi

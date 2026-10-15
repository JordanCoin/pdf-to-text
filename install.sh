#!/usr/bin/env bash
# PDF to Text — universal agent installer.
#
#   curl -fsSL https://jordancoin.github.io/pdf-to-text/install.sh | bash -s -- [--agent X] [--global|--project] [--engine-only]
#
# Installs the pdf-extract engine (native binary + open-source font pack)
# to ~/.pdf-to-text and drops the same SKILL.md into each agent's skill
# directory. One engine, one skill, many agents.
#
#   --agent   claude | codex | cursor | gemini | copilot | all   (default: auto)
#   --global  install skills under $HOME (default when not inside a git repo)
#   --project install skills under the current git repo (default inside one)
#   --engine-only  skip skill files, just install the binary + fonts
#   --version vX.Y.Z  pin an engine release (default: latest)
set -euo pipefail

REPO="JordanCoin/pdf-to-text"
ENGINE_DIR="${PDF_TO_TEXT_HOME:-$HOME/.pdf-to-text}"
SKILL_NAME="pdf-to-text"
AGENT="auto"; SCOPE=""; ENGINE_ONLY=0; PIN=""

while [ $# -gt 0 ]; do
  case "$1" in
    --agent) AGENT="$2"; shift 2 ;;
    --agent=*) AGENT="${1#*=}"; shift ;;
    --global) SCOPE="global"; shift ;;
    --project) SCOPE="project"; shift ;;
    --engine-only) ENGINE_ONLY=1; shift ;;
    --version) PIN="$2"; shift 2 ;;
    -h|--help) sed -n 2,15p "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

say()  { printf '\033[1;34m→\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ── Platform ─────────────────────────────────────────────────────────
os="$(uname -s)"; arch="$(uname -m)"
case "$os" in
  Darwin) os="macos" ;;
  Linux) os="linux" ;;
  MINGW*|MSYS*|CYGWIN*) os="windows" ;;
  *) die "unsupported OS: $os" ;;
esac
case "$arch" in
  x86_64|amd64) arch="x86_64" ;;
  aarch64|arm64) arch="aarch64" ;;
  *) die "unsupported arch: $arch" ;;
esac
asset="pdf-extract-${os}-${arch}"
[ "$os" = "windows" ] && asset="${asset}.exe"

# ── Engine ───────────────────────────────────────────────────────────
if [ -n "$PIN" ]; then base="https://github.com/$REPO/releases/download/$PIN"
else base="https://github.com/$REPO/releases/latest/download"; fi

mkdir -p "$ENGINE_DIR/bin"
say "Downloading engine ($asset)"
curl -fsSL "$base/$asset" -o "$ENGINE_DIR/bin/pdf-extract.tmp" || die "download failed: $base/$asset"
expected="$(curl -fsSL "$base/$asset.sha256" | awk '{print $1}')" || die "no checksum published for $asset"
if command -v sha256sum >/dev/null; then actual="$(sha256sum "$ENGINE_DIR/bin/pdf-extract.tmp" | awk '{print $1}')"
else actual="$(shasum -a 256 "$ENGINE_DIR/bin/pdf-extract.tmp" | awk '{print $1}')"; fi
[ "$expected" = "$actual" ] || { rm -f "$ENGINE_DIR/bin/pdf-extract.tmp"; die "checksum mismatch for $asset"; }
mv "$ENGINE_DIR/bin/pdf-extract.tmp" "$ENGINE_DIR/bin/pdf-extract"
chmod +x "$ENGINE_DIR/bin/pdf-extract"
ok "Engine installed"

say "Downloading font pack (open-source fonts for glyph fingerprint matching)"
if curl -fsSL "$base/fonts.tar.gz" -o "$ENGINE_DIR/fonts.tar.gz.tmp"; then
  rm -rf "$ENGINE_DIR/fonts"
  tar -xzf "$ENGINE_DIR/fonts.tar.gz.tmp" -C "$ENGINE_DIR"
  rm -f "$ENGINE_DIR/fonts.tar.gz.tmp"
  ok "Fonts installed ($(ls "$ENGINE_DIR/fonts" | wc -l | tr -d ' ') files)"
else
  echo "  fonts.tar.gz not in this release; Level 5 fingerprint matching stays off" >&2
fi

# Wrapper: points the engine at the font pack, keeps the CLI name stable.
cat > "$ENGINE_DIR/bin/pdf-to-text" <<'EOF'
#!/usr/bin/env bash
# Usage: pdf-to-text <file.pdf|https://...pdf> [--markdown|--json]
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
export GLYPH_API_FONTS_DIR="${GLYPH_API_FONTS_DIR:-$HERE/fonts}"
export GLYPH_FONTS_DIR="$GLYPH_API_FONTS_DIR"
src="${1:-}"; [ -n "$src" ] || { echo "usage: pdf-to-text <file.pdf|url> [--markdown|--json]" >&2; exit 2; }
shift
case "$src" in
  http://*|https://*)
    tmp="$(mktemp -t pdf-to-text.XXXXXX).pdf"; trap 'rm -f "$tmp"' EXIT
    curl -fsSL "$src" -o "$tmp"; src="$tmp" ;;
esac
exec "$HERE/bin/pdf-extract" "$src" "$@" 2>/dev/null
EOF
chmod +x "$ENGINE_DIR/bin/pdf-to-text"
ver="$("$ENGINE_DIR/bin/pdf-extract" --json /dev/null 2>/dev/null | sed -n 's/.*"version":"\([^"]*\)".*/\1/p' | head -1 || true)"
echo "${PIN:-latest}" > "$ENGINE_DIR/VERSION"
ok "CLI ready: $ENGINE_DIR/bin/pdf-to-text"

[ "$ENGINE_ONLY" = 1 ] && exit 0

# ── Skill ────────────────────────────────────────────────────────────
skill_src="$(mktemp -t skill.XXXXXX)"
curl -fsSL "https://raw.githubusercontent.com/$REPO/main/skills/extract-pdf/SKILL.md" -o "$skill_src" \
  || die "could not fetch SKILL.md"

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$SCOPE" ]; then [ -n "$root" ] && SCOPE="project" || SCOPE="global"; fi
if [ "$SCOPE" = "project" ]; then base_dir="${root:-$PWD}"; else base_dir="$HOME"; fi

# Where each agent reads skills. `.agents/skills` is the shared convention
# (Codex, Cursor, Gemini CLI, Copilot all read it); the per-agent primary
# directory is added for agents that prefer their own.
dirs_for() {
  case "$1" in
    claude)  echo ".claude/skills" ;;
    codex)   echo ".agents/skills" ;;
    cursor)  echo ".agents/skills .cursor/skills" ;;
    gemini)  echo ".agents/skills .gemini/skills" ;;
    copilot) if [ "$SCOPE" = "project" ]; then echo ".agents/skills .github/skills"; else echo ".agents/skills .copilot/skills"; fi ;;
    *) die "unknown agent: $1 (claude|codex|cursor|gemini|copilot|all)" ;;
  esac
}

detect_agents() {
  local found=""
  command -v claude >/dev/null 2>&1 || [ -d "$HOME/.claude" ] && found="$found claude"
  command -v codex >/dev/null 2>&1 || [ -d "$HOME/.codex" ] && found="$found codex"
  command -v cursor >/dev/null 2>&1 || [ -d "$HOME/.cursor" ] && found="$found cursor"
  command -v gemini >/dev/null 2>&1 || [ -d "$HOME/.gemini" ] && found="$found gemini"
  command -v copilot >/dev/null 2>&1 || [ -d "$HOME/.copilot" ] && found="$found copilot"
  echo "${found:- all}"
}

case "$AGENT" in
  auto) agents="$(detect_agents)" ;;
  all) agents="claude codex cursor gemini copilot" ;;
  *) agents="$(echo "$AGENT" | tr ',' ' ')" ;;
esac
[ "$agents" = "all" ] || [ "$agents" = " all" ] && agents="claude codex cursor gemini copilot"

installed=""
for a in $agents; do
  for d in $(dirs_for "$a"); do
    dest="$base_dir/$d/$SKILL_NAME"
    case " $installed " in *" $dest "*) continue ;; esac
    mkdir -p "$dest"
    sed "s|__ENGINE_DIR__|$ENGINE_DIR|g" "$skill_src" > "$dest/SKILL.md"
    installed="$installed $dest"
    ok "$a → $dest/SKILL.md"
  done
done
rm -f "$skill_src"

echo
echo "Try it:  $ENGINE_DIR/bin/pdf-to-text https://bitcoin.org/bitcoin.pdf --markdown | head"
echo "Claude Code users can also install the full plugin (MCP tools): /plugin install pdf-to-text@$REPO"

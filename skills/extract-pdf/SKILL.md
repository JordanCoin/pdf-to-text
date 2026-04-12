---
name: extract-pdf
description: Extract clean text and markdown from any PDF. Fixes broken Unicode mappings that make Chrome's copy-paste produce gibberish. Returns plain text, basic markdown, or structured markdown with TOC, headings, page markers, and token counts. Works locally via WASM — your PDFs never leave your machine.
---

## Preamble (run first)

```bash
_PLUGIN_DIR="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." 2>/dev/null && pwd || echo "$HOME/.config/pdf-to-text")}"
_UPD=$("$_PLUGIN_DIR/bin/update-check" 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
```

If `UPGRADE_AVAILABLE <old> <new>` is output: tell the user a new version is available and ask if they want to upgrade. If yes, run `$_PLUGIN_DIR/hooks/install-engine.sh`. If `JUST_UPGRADED <old> <new>`: tell the user "PDF to Text engine updated to v{new}!" and continue.

# PDF to Text

A local PDF-to-markdown extraction engine with a 7-level
fallback cascade that recovers text from PDFs whose embedded Unicode
mappings are broken or missing. It outputs three markdown formats:
**plain**, **basic** (one `# Page N` per page), and **structured**
(YAML frontmatter + TOC + font-detected headings + fenced code blocks).

Use this skill when you need clean text from a PDF, **not** when you need
the visual layout. For tables, figures, and images, look elsewhere.

## When to invoke

**Use glyph-api when:**

- The user asks you to read, summarize, or extract content from a PDF
- The user hits "gibberish on paste" from a PDF in their browser or editor
- The user wants to feed a PDF into an LLM (RAG ingest, summarization,
  question-answering, extraction pipeline)
- The user has a URL that ends in `.pdf` and wants the content
- Chrome's native PDF viewer or `cat`/`pdftotext` produced garbage on a
  particular PDF
- You need structured output (TOC, heading hierarchy, page markers) for
  navigation or agentic querying

**Do NOT use glyph-api for:**

- Tables — current extraction collapses tabular data into flat prose. Use
  a real table-aware tool (`camelot`, `tabula-py`, `pdfplumber`).
- Figures / diagrams / images — glyph-api extracts their text labels but
  not the visual structure. Images are ignored.
- Scanned PDFs with no text layer — glyph-api is not an OCR engine. Use
  `tesseract` or a cloud OCR service first, then feed the resulting
  text-layered PDF to glyph-api.
- Non-Latin scripts (CJK, Arabic, Hebrew, Devanagari) — MVP is Latin-only;
  complex script support is on the roadmap.

## How to invoke

Four invocation paths, ordered by agent-friendliness.

### Path 0 — MCP tools (preferred for Claude Code agents)

This plugin registers MCP tools automatically. Use them directly:

- `extract_pdf` — pass `url` or `path`, get plain/basic/structured markdown + stats
- `render_markdown` — fetch and parse any .md URL, get sections + token count
- `list_recent` — see recently extracted PDFs from the local cache

```
Use the extract_pdf tool with path: "/path/to/document.pdf" and format: "structured"
```

### Path 1 — Chrome extension agentic API (for browser-automation agents)

If you're driving a browser (Claude in Chrome, Playwright, Puppeteer, CDP):

```js
// Navigate to any .pdf URL. The extension's DNR rule intercepts and
// redirects to the viewer. The viewer runs the WASM extractor and
// publishes the result to a page-world global.
await navigate("https://example.com/document.pdf");

// Wait for extraction to finish.
await waitFor(() => window.__glyph?.status === "ready");

// Read the three markdown formats (all pre-computed).
const plain      = window.__glyph.markdown.plain;
const basic      = window.__glyph.markdown.basic;
const structured = window.__glyph.markdown.structured;
```

The viewer also fires a `glyph:status` CustomEvent and sets
`document.body.dataset.glyphStatus` to `loading` / `ready` / `error`, so
agents that prefer selector-based waits can use:

```js
await waitForSelector('body[data-glyph-status="ready"]');
```

Iframe-embedding pages receive a `postMessage` with `{type: "glyph:status",
status, markdown}` once ready.

**Requirements:** the Glyph Chrome extension must be installed (unpacked
or from the Chrome Web Store). The extension ID is stable for a given
store listing; print it from any viewer tab via `chrome.runtime.id` in
the DevTools console.

### Path 2 — Native Rust CLI (preferred for shell/pipeline agents)

```bash
cd /Users/jordan/Code/glyph-api
./target/release/glyph-api path/to/document.pdf
```

Outputs plain text to stdout. One form-feed (`\f`) between pages. No
frontmatter, no headings, no markdown syntax — just the extracted text.

To build the binary from source (~5s):

```bash
cd /Users/jordan/Code/glyph-api
cargo build --release --bin glyph-api
```

### Path 3 — WASM module from Node/TypeScript

```js
import initWasm, { extract_chars_with_positions } from "./pkg/glyph_api.js";
import { readFileSync } from "node:fs";

await initWasm({ module_or_path: readFileSync("./pkg/glyph_api_bg.wasm") });

const pdfBytes = readFileSync("document.pdf");
const json = extract_chars_with_positions(pdfBytes);
const parsed = JSON.parse(json);
// parsed.pages[i].text  — per-page extracted text
// parsed.pages[i].chars — per-char position metadata (for spatial queries)
// parsed.total_chars, total_resolved, total_unresolved
```

To also get the three markdown formats, import the markdown module:

```js
import {
  toPlain,
  toBasicMarkdown,
  toStructuredMarkdown,
} from "./extension/dist/markdown.js";

const structured = toStructuredMarkdown(parsed, {
  srcUrl: "https://example.com/document.pdf",
});
```

## Output format reference

### Plain

```
<page 1 text>

<page 2 text>

...
```

No markdown. Blank line between pages. Use for embeddings and keyword search.

### Basic

```markdown
# Page 1

<escaped page 1 text>

---

# Page 2

<escaped page 2 text>
```

Page headers, minimal escaping. Use when you want page-boundary awareness
without heading detection.

### Structured (RAG-ready)

```markdown
---
source: https://example.com/document.pdf
pages: 9
chars: 21146
tokens: ~5.3k
headings: 13
extracted_at: 2026-04-11T17:00:00.000Z
extractor: glyph-api
---

## Table of Contents

- Bitcoin: A Peer-to-Peer Electronic Cash System _(p.1)_
- 1. Introduction _(p.1)_
- 2. Transactions _(p.2)_
...

<!-- page 1 -->

## Bitcoin: A Peer-to-Peer Electronic Cash System

Satoshi Nakamoto
satoshin@gmx.com
www.bitcoin.org

## Abstract

A purely peer-to-peer version of electronic cash...

## 1. Introduction

Commerce on the Internet has come to rely...
```

Notable features:
- **YAML frontmatter** with source URL, page/char/token counts, ISO timestamp
- **Auto-generated TOC** from detected headings
- **`<!-- page N -->` markers** — invisible when rendered, queryable for
  per-page chunking in RAG pipelines
- **Heading detection** via three channels: font-size clustering, bold-font
  promotion, and a numbered-section pattern (`^\d+\.\s+[A-Z]`)
- **Known section words** (Abstract, References, Acknowledgements,
  Bibliography, Appendix, Conclusion) promoted to H2 even when set in
  body-size bold
- **Fenced code blocks** for C (`#include`), Python (`def`), math formulas
  (`∑ ⋅ ≤`), and diagram labels — keeps GitHub's markdown renderer from
  choking on them

## Gotchas / current limitations

- **Synthetic stress-test PDFs look repetitive** — `dense_20p_70l_r2.pdf`
  contains the same sentence repeated 1400 times by design. That's the
  input, not an extraction bug.
- **The arxiv `fi` ligature bug** — papers using ligatures (`fi`, `fl`,
  `ffi`, `ffl`) may emit raw glyph codes like `002gures` instead of
  `figures`. Future work: extend the L3/L4 cascade to recognize ligature
  glyph names.
- **Form field glue** — IRS-style forms that position each digit with a
  separate `Tj` operator produce `Form10 4 0 2025` instead of `Form 1040
  (2025)`. Future work: detect tight-spacing runs and apply word grouping.
- **Letter-spaced titles** — `110TH CONGRESS` set with positive
  letter-tracking extracts as `110 TH C ONGRESS`. Future work: detect
  heading-level letter-spacing and collapse.
- **Math formulas are not LaTeX** — they're fenced as `\`\`\`text` for
  legibility but won't render via MathJax. Future work: `$$...$$` wrapping
  for paragraphs where symbol density is high enough.
- **Tables are prose** — glyph-api doesn't emit GFM tables. Multi-column
  data collapses into rows that may or may not align.

## Verification

If you're unsure whether glyph-api improved on Chrome's native extraction
for a given PDF, look at the **frontmatter's `headings:` count** and the
**structured output's TOC** — both should be non-empty for any real
document. For the famous "Attention Is All You Need" paper (arxiv
1706.03762), the `structured` output has:

- 31 sections in the TOC
- The H2 title + all section numbers 1–7 + sub-sub-sections like 3.2.1
- Cross-validates clean against `docmap --type code --lang c` on the
  appendix

If the output has `headings: 0` and no TOC, the PDF likely has unusual
content structure — try feeding it back and reporting the file shape.

## Cross-validate with docmap

If you have `docmap` (v0.4.0+) installed, you can verify the output's
structural integrity:

```bash
docmap extracted.structured.md           # section tree
docmap extracted.structured.md --type code --lang c     # find C blocks
docmap extracted.structured.md --type math              # find math blocks
docmap extracted.structured.md --json | jq '.documents[0].sections'
```

This gives independent confirmation that the extracted markdown is
semantically navigable — agents can jump to sections, count constructs,
and reason about document structure.

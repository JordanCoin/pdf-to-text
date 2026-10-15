---
name: pdf-to-text
description: Extract clean text and markdown from any PDF, including ones whose copy-paste comes out as gibberish. Local native binary, no network, no API key. Use when the user asks to read, summarize, quote, or convert a PDF, has a .pdf URL, or got garbage from pdftotext or a browser.
---

# PDF to Text

Local PDF extraction with a 7-level fallback cascade that repairs broken
Unicode mappings. Same engine as the PDF to Text Chrome extension. Works
in any agent that reads SKILL.md: Claude Code, Codex, Cursor, Gemini CLI,
Copilot.

## When to use

- The user asks you to read, summarize, quote, or extract from a PDF
- The user has a URL ending in `.pdf`
- `pdftotext`, `cat`, or a browser produced garbage characters
- You need structured markdown (headings, TOC, page markers) to navigate a document

Do not use for tables (flattened to prose), figures (text labels only),
scanned image-only PDFs (no OCR here), or non-Latin scripts (not yet).

## How to run

The engine lives at `__ENGINE_DIR__/bin/pdf-to-text`. It accepts a file
path or an https URL.

```bash
# Structured markdown: frontmatter, TOC, headings, page markers. Best for reading.
__ENGINE_DIR__/bin/pdf-to-text document.pdf --markdown

# JSON: per-page text plus a quality verdict per page. Best for programmatic use.
__ENGINE_DIR__/bin/pdf-to-text https://example.com/paper.pdf --json

# Plain text, one form-feed between pages.
__ENGINE_DIR__/bin/pdf-to-text document.pdf
```

Diagnostics go to stderr and are suppressed by the wrapper. Exit code is
nonzero on an unreadable or encrypted file.

If the binary is missing, install it (no sudo, about 3 MB plus a 24 MB
font pack):

```bash
curl -fsSL https://jordancoin.github.io/pdf-to-text/install.sh | bash -s -- --engine-only
```

For large documents, run `--json` first, read `summary` and the per-page
`verdict`s, then pull only the pages that matter. A 300-page PDF as
markdown will not fit in context.

## Reading the output

- `--markdown` starts with YAML frontmatter (creator, producer, creation
  date when the PDF carries them), then the document with font-detected
  headings as `#`/`##`. Pages flow together; there are no page markers.
- `--json` returns `{engine, version, pages: [{n, text, chars, unresolved,
  verdict}], summary}`. Verdicts per page: `text_layer` (real text, trust
  it), `garbled` (text layer present but mostly unresolvable, quote with
  care), `image_only` (scan or figure page, nothing to extract here).
  `summary.verdicts` counts them, so check it first on long documents.

## Claude Code extras

If installed as the Claude Code plugin (`/plugin install pdf-to-text@JordanCoin/pdf-to-text`),
three MCP tools are also available and preferred: `extract_pdf`,
`render_markdown`, `list_recent`. They wrap the same engine.

## Browser agents

If you are driving Chrome with the PDF to Text extension installed,
navigate to any `.pdf` URL and read `window.__glyph.markdown.structured`
once `document.body.dataset.glyphStatus === "ready"`. No binary needed.

## Verify before trusting

After extracting, spot-check: the first heading should match the
document title, and a sentence from the middle of the PDF should appear
verbatim in the output. If `garbled` or `image_only` pages exist, say so
rather than quoting them as fact.

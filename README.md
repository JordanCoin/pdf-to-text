# PDF to Text — Claude Code Plugin

The agent interface for [PDF to Text](https://jordancoin.github.io/pdf-to-text/), the Chrome extension that fixes broken copy-paste from PDFs.

Chrome extension = humans. This plugin = agents. Same extraction engine.

## Install (any agent)

```
curl -fsSL https://jordancoin.github.io/pdf-to-text/install.sh | bash -s -- --agent claude   # or codex, cursor, gemini, copilot, all
```

Installs the native engine to `~/.pdf-to-text` and a `SKILL.md` where your agent looks for skills (`.claude/skills`, `.agents/skills`, and the agent's own folder). Add `--project` to install into the current repo instead of your home directory. Details and a per-agent picker: [install page](https://jordancoin.github.io/pdf-to-text/install.html).

Claude Code can additionally install the full plugin, which adds MCP tools:

```
/plugin install pdf-to-text@JordanCoin/pdf-to-text
```

The plugin's SessionStart hook installs the same native engine on first use. No build step.

## What you get

**3 MCP tools** available in every Claude Code session:

| Tool | What it does |
|---|---|
| `extract_pdf` | Extract text from any PDF (URL or local path). Returns plain text, basic markdown, or structured markdown with TOC, headings, and token counts. |
| `render_markdown` | Fetch and parse any .md file. Returns sections, headings, and token estimate. |
| `list_recent` | Show recently extracted PDFs from the local cache. |

**1 skill** that routes automatically:

When you mention a PDF or ask to extract text, Claude invokes `/pdf-to-text:extract-pdf` which calls the MCP tools.

## Usage

Once installed, just talk to Claude:

- "Extract text from this PDF" (with a URL or file path)
- "Summarize this paper" (give it a .pdf URL)
- "Convert this PDF to markdown"

Or call the tools directly:

```
Use the extract_pdf tool on /path/to/document.pdf with format structured
```

## How it works

The extraction engine uses a 7-level fallback cascade to recover text from PDFs with broken Unicode mappings — the ones where Chrome's copy-paste gives you gibberish. Everything runs locally via WebAssembly. Your PDFs never leave your machine.

The same engine powers the [PDF to Text Chrome extension](https://jordancoin.github.io/pdf-to-text/). Install both for full coverage: the extension fixes copy-paste in the browser, this plugin gives agents the same capability.

## Output formats

- **plain** — raw text, blank lines between pages. For embeddings and search.
- **basic** — `# Page N` headers per page. Quick and simple.
- **structured** — YAML frontmatter + auto-generated TOC + detected headings + `<!-- page N -->` markers. For RAG pipelines and LLM consumption.

## Updates

The plugin checks for new versions automatically. When an update is available, Claude will ask before upgrading. The engine binary updates independently of the plugin code.

## Privacy

All extraction happens locally. No PDF data is sent to any server. The only network request is checking for engine updates from GitHub Releases.

## License

Plugin wrapper: MIT. Extraction engine: proprietary.

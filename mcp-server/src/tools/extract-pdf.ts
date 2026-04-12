import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractChars } from "../lib/wasm-extract.js";
import { toAllFormats } from "../lib/markdown.js";

const MAX_PDF_BYTES = 100 * 1024 * 1024;

export const definition = {
  name: "extract_pdf",
  description:
    "Extract text from a PDF file. Returns plain text, basic markdown, and structured markdown with headings/TOC. Works on PDFs with broken Unicode mappings that other tools can't handle.",
  inputSchema: {
    type: "object" as const,
    properties: {
      url: {
        type: "string",
        description: "URL of the PDF to download and extract",
      },
      path: {
        type: "string",
        description: "Local file path to a PDF",
      },
      format: {
        type: "string",
        enum: ["plain", "basic", "structured", "all"],
        description: "Output format. Defaults to 'structured'.",
      },
    },
    oneOf: [{ required: ["url"] }, { required: ["path"] }],
  },
};

interface ExtractArgs {
  url?: string;
  path?: string;
  format?: "plain" | "basic" | "structured" | "all";
}

export async function execute(args: ExtractArgs): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const format = args.format ?? "structured";
  let pdfBytes: Uint8Array;
  let source: string;

  if (args.url) {
    source = args.url;
    const resp = await fetch(args.url);
    if (!resp.ok) {
      throw new Error(`Failed to download PDF: ${resp.status} ${resp.statusText}`);
    }
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > MAX_PDF_BYTES) {
      throw new Error(`PDF too large: ${(buf.byteLength / 1024 / 1024).toFixed(1)} MB (max 100 MB)`);
    }
    pdfBytes = new Uint8Array(buf);
  } else if (args.path) {
    source = args.path;
    const absPath = resolve(args.path);
    const buf = readFileSync(absPath);
    if (buf.byteLength > MAX_PDF_BYTES) {
      throw new Error(`PDF too large: ${(buf.byteLength / 1024 / 1024).toFixed(1)} MB (max 100 MB)`);
    }
    pdfBytes = new Uint8Array(buf);
  } else {
    throw new Error("Either 'url' or 'path' is required");
  }

  const result = await extractChars(pdfBytes);
  const formats = await toAllFormats(result, source);

  const stats = {
    pages: result.pages.length,
    chars: result.total_chars,
    resolved: result.total_resolved,
    unresolved: result.total_unresolved,
    rescued_pct:
      result.total_chars > 0
        ? ((result.total_resolved / result.total_chars) * 100).toFixed(1) + "%"
        : "N/A",
  };

  if (format === "all") {
    return {
      content: [
        { type: "text", text: `## Stats\n\`\`\`json\n${JSON.stringify(stats, null, 2)}\n\`\`\`\n\n## Structured\n\n${formats.structured}` },
      ],
    };
  }

  const text = format === "plain" ? formats.plain : format === "basic" ? formats.basic : formats.structured;

  return {
    content: [
      { type: "text", text: `<!-- stats: ${JSON.stringify(stats)} -->\n\n${text}` },
    ],
  };
}

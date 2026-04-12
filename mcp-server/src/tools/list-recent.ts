import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

const CACHE_DIR = resolve(homedir(), ".config", "glyph-api", "cache");
const RECENT_FILE = resolve(CACHE_DIR, "recent.json");

interface RecentEntry {
  url?: string;
  filename?: string;
  chars: number;
  pages: number;
  extractedAt: string;
}

export const definition = {
  name: "list_recent",
  description:
    "List recently extracted PDFs from the local cache. Shows URL/filename, page count, char count, and extraction timestamp.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

export async function execute(): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  if (!existsSync(RECENT_FILE)) {
    return {
      content: [
        { type: "text", text: "No recent extractions found. Extract a PDF first with extract_pdf." },
      ],
    };
  }

  const raw = readFileSync(RECENT_FILE, "utf-8");
  const entries: RecentEntry[] = JSON.parse(raw);

  if (entries.length === 0) {
    return {
      content: [
        { type: "text", text: "No recent extractions found." },
      ],
    };
  }

  const lines = entries.map((e, i) => {
    const name = e.url ?? e.filename ?? "unknown";
    return `${i + 1}. ${name}\n   ${e.pages} pages, ${e.chars.toLocaleString()} chars — ${e.extractedAt}`;
  });

  return {
    content: [
      { type: "text", text: `## Recent Extractions (${entries.length})\n\n${lines.join("\n\n")}` },
    ],
  };
}

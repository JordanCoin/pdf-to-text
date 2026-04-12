import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const definition = {
  name: "render_markdown",
  description:
    "Fetch or read a markdown file and return its structure: headings, sections, and estimated token count.",
  inputSchema: {
    type: "object" as const,
    properties: {
      url: {
        type: "string",
        description: "URL to fetch raw markdown from",
      },
      path: {
        type: "string",
        description: "Local file path to a .md file",
      },
      content: {
        type: "string",
        description: "Raw markdown content to parse directly",
      },
    },
  },
};

interface RenderArgs {
  url?: string;
  path?: string;
  content?: string;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function extractSections(md: string): string[] {
  return [...md.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1]);
}

export async function execute(args: RenderArgs): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  let raw: string;

  if (args.content) {
    raw = args.content;
  } else if (args.url) {
    const resp = await fetch(args.url);
    if (!resp.ok) {
      throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`);
    }
    raw = await resp.text();
  } else if (args.path) {
    raw = readFileSync(resolve(args.path), "utf-8");
  } else {
    throw new Error("One of 'url', 'path', or 'content' is required");
  }

  const sections = extractSections(raw);
  const tokens = estimateTokens(raw);

  const result = {
    text: raw,
    sections,
    tokens,
  };

  return {
    content: [
      { type: "text", text: JSON.stringify(result, null, 2) },
    ],
  };
}

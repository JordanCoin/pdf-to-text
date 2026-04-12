import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as extractPdf from "./tools/extract-pdf.js";
import * as renderMarkdown from "./tools/render-markdown.js";
import * as listRecent from "./tools/list-recent.js";

const server = new McpServer({
  name: "pdf-to-text",
  version: "0.1.0",
});

server.registerTool(
  extractPdf.definition.name,
  {
    description: extractPdf.definition.description,
    inputSchema: z.object({
      url: z.string().optional(),
      path: z.string().optional(),
      format: z.enum(["plain", "basic", "structured", "all"]).optional(),
    }),
  },
  async (args) => extractPdf.execute(args),
);

server.registerTool(
  renderMarkdown.definition.name,
  {
    description: renderMarkdown.definition.description,
    inputSchema: z.object({
      url: z.string().optional(),
      path: z.string().optional(),
      content: z.string().optional(),
    }),
  },
  async (args) => renderMarkdown.execute(args),
);

server.registerTool(
  listRecent.definition.name,
  {
    description: listRecent.definition.description,
    inputSchema: z.object({}),
  },
  async () => listRecent.execute(),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

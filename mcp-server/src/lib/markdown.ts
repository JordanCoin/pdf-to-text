import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import type { CharsExtractionResult } from "./wasm-extract.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function findMarkdownModule(): string {
  const pluginData = process.env["CLAUDE_PLUGIN_DATA"];
  const configDir = resolve(homedir(), ".config", "pdf-to-text");

  const candidates = [
    ...(pluginData ? [resolve(pluginData, "markdown.js")] : []),
    resolve(configDir, "markdown.js"),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  throw new Error(
    "markdown.js not found. Searched:\n" + candidates.map((p) => `  - ${p}`).join("\n"),
  );
}

interface MarkdownModule {
  toPlain(result: CharsExtractionResult, source?: string): string;
  toBasicMarkdown(result: CharsExtractionResult, source?: string): string;
  toStructuredMarkdown(result: CharsExtractionResult, source?: string): string;
}

let mod: MarkdownModule | null = null;

async function getModule(): Promise<MarkdownModule> {
  if (mod) return mod;
  const path = findMarkdownModule();
  mod = await import(path) as unknown as MarkdownModule;
  return mod;
}

export async function toAllFormats(
  result: CharsExtractionResult,
  source?: string,
): Promise<{ plain: string; basic: string; structured: string }> {
  const m = await getModule();
  return {
    plain: m.toPlain(result, source),
    basic: m.toBasicMarkdown(result, source),
    structured: m.toStructuredMarkdown(result, source),
  };
}

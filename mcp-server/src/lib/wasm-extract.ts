import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));

function findWasmPaths(): { wasm: string; js: string } {
  const pluginData = process.env["CLAUDE_PLUGIN_DATA"];
  const configDir = resolve(homedir(), ".config", "pdf-to-text");

  const candidates = [
    ...(pluginData ? [pluginData] : []),
    configDir,
  ];

  for (const dir of candidates) {
    const wasmPath = resolve(dir, "glyph_api_bg.wasm");
    const jsPath = resolve(dir, "glyph_api.js");
    if (existsSync(wasmPath) && existsSync(jsPath)) {
      return { wasm: wasmPath, js: jsPath };
    }
  }

  throw new Error(
    [
      "WASM engine not found. Searched:",
      ...candidates.map((d) => `  - ${d}`),
      "",
      "Install the engine by running the SessionStart hook,",
      "or build from source: cd glyph-api && wasm-pack build --target web",
    ].join("\n"),
  );
}

let initialized = false;

interface WasmModule {
  initSync(opts: { module: WebAssembly.Module }): void;
  extract_chars_with_positions(data: Uint8Array, profile?: string, maxWorkers?: number): string;
  extract_text_from_pdf(data: Uint8Array, profile?: string, maxWorkers?: number): string;
}

let wasm: WasmModule;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  const paths = findWasmPaths();
  wasm = await import(paths.js) as unknown as WasmModule;
  const wasmBytes = readFileSync(paths.wasm);
  wasm.initSync({ module: new WebAssembly.Module(wasmBytes) });
  initialized = true;
}

export interface CharEntry {
  c: string;
  x: number;
  y: number;
  s: number;
  f: number;
  l: number;
}

export interface CharsPage {
  page: number;
  text: string;
  chars: CharEntry[];
  fonts: string[];
  resolution: Record<string, number>;
}

export interface CharsExtractionResult {
  pages: CharsPage[];
  success: boolean;
  total_chars: number;
  total_resolved: number;
  total_unresolved: number;
}

export async function extractChars(pdfBytes: Uint8Array): Promise<CharsExtractionResult> {
  await ensureInit();
  const json = wasm.extract_chars_with_positions(pdfBytes);
  return JSON.parse(json) as CharsExtractionResult;
}

export async function extractText(pdfBytes: Uint8Array): Promise<string> {
  await ensureInit();
  const json = wasm.extract_text_from_pdf(pdfBytes);
  const data = JSON.parse(json);
  return data.pages.map((p: { text: string }) => p.text).join("\n\n");
}

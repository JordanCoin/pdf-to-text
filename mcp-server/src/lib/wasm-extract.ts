// Engine bridge. Historically this loaded a WASM build; the plugin now ships
// the native `pdf-extract` binary (installed by install.sh / the
// SessionStart hook) and shells out to it. Interfaces are unchanged so the
// tools above do not care.
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface CharEntry {
  c: string;
  x: number;
  y: number;
  f: number;
  l: number;
}

export interface CharsPage {
  page: number;
  text: string;
  chars: CharEntry[];
  fonts: string[];
  resolution: Record<string, number>;
  verdict?: "text_layer" | "garbled" | "image_only";
}

export interface CharsExtractionResult {
  pages: CharsPage[];
  success: boolean;
  total_chars: number;
  total_resolved: number;
  total_unresolved: number;
}

export function engineDir(): string {
  return process.env["PDF_TO_TEXT_HOME"] ?? resolve(homedir(), ".pdf-to-text");
}

export function enginePath(): string {
  const p = resolve(engineDir(), "bin", "pdf-to-text");
  if (!existsSync(p)) {
    throw new Error(
      `pdf-to-text engine not found at ${p}.\n` +
        "Install it: curl -fsSL https://jordancoin.github.io/pdf-to-text/install.sh | bash -s -- --engine-only",
    );
  }
  return p;
}

/** Write bytes to a temp file, run the engine with `flag`, return stdout. */
export async function runEngine(pdfBytes: Uint8Array, flag?: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "pdf-to-text-"));
  const file = join(dir, "input.pdf");
  try {
    writeFileSync(file, pdfBytes);
    const args = flag ? [file, flag] : [file];
    const { stdout } = await run(enginePath(), args, { maxBuffer: 256 * 1024 * 1024 });
    return stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

interface EngineJson {
  pages: Array<{ n: number; text: string; chars: number; unresolved: number; verdict: CharsPage["verdict"] }>;
  summary: { pages: number; chars: number; unresolved: number };
}

export async function extractChars(pdfBytes: Uint8Array): Promise<CharsExtractionResult> {
  const data = JSON.parse(await runEngine(pdfBytes, "--json")) as EngineJson;
  return {
    pages: data.pages.map((p) => ({
      page: p.n,
      text: p.text,
      chars: [], // per-char positions are not exposed by the native CLI
      fonts: [],
      resolution: { unresolved: p.unresolved },
      verdict: p.verdict,
    })),
    success: true,
    total_chars: data.summary.chars,
    total_resolved: data.summary.chars - data.summary.unresolved,
    total_unresolved: data.summary.unresolved,
  };
}

export async function extractText(pdfBytes: Uint8Array): Promise<string> {
  const r = await extractChars(pdfBytes);
  return r.pages.map((p) => p.text).join("\n\n");
}

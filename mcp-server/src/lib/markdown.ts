// Three output shapes from one extraction. `structured` is the engine's own
// --markdown rendering (frontmatter + font-detected headings); `plain` and
// `basic` are derived from the per-page JSON text.
import type { CharsExtractionResult } from "./wasm-extract.js";
import { runEngine } from "./wasm-extract.js";

function escapeMd(s: string): string {
  return s.replace(/^(#{1,6})(\s)/gm, "\\$1$2");
}

export function toPlain(result: CharsExtractionResult): string {
  return result.pages.map((p) => p.text).join("\n\n");
}

export function toBasicMarkdown(result: CharsExtractionResult, source?: string): string {
  const head = source ? `<!-- source: ${source} -->\n\n` : "";
  return head + result.pages.map((p) => `# Page ${p.page}\n\n${escapeMd(p.text)}`).join("\n\n---\n\n");
}

export async function toAllFormats(
  result: CharsExtractionResult,
  source?: string,
  pdfBytes?: Uint8Array,
): Promise<{ plain: string; basic: string; structured: string }> {
  const plain = toPlain(result);
  const basic = toBasicMarkdown(result, source);
  // Structured needs a second engine pass over the bytes; fall back to basic
  // when the caller did not keep them.
  const structured = pdfBytes ? await runEngine(pdfBytes, "--markdown") : basic;
  return { plain, basic, structured };
}

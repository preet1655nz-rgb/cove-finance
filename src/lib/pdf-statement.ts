import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { extractPdfFallback, hasText, installPakoInflate, itemsToText, looksLikeLedger } from "./pdf-fallback";

export { extractPdfFallback, hasText, looksLikeLedger };

function publicWorkerSrc() {
  if (typeof window === "undefined") return pdfWorkerUrl || "/pdf.worker.min.mjs";
  return pdfWorkerUrl || `${window.location.origin}/pdf.worker.min.mjs`;
}

let workerBoot: Promise<void> | null = null;

export function preloadPdfEngine() {
  return bootWorker();
}

function bootWorker() {
  if (!workerBoot) {
    workerBoot = (async () => {
      installPakoInflate();
      try {
        GlobalWorkerOptions.workerSrc = publicWorkerSrc();
      } catch {
        /* ignore */
      }
      try {
        // Worker bundle has no types; it assigns globalThis.pdfjsWorker.
        // @ts-expect-error pdfjs worker is untyped
        await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
      } catch {
        /* pdf.js will try workerSrc / fake worker on its own */
      }
    })();
  }
  return workerBoot;
}

export class PdfOpenError extends Error {
  constructor(
    message: string,
    readonly kind: "password" | "empty" | "corrupt",
  ) {
    super(message);
    this.name = "PdfOpenError";
  }
}

export type PdfProgress = { page: number; pages: number };

function isPasswordError(err: unknown) {
  const e = err as { name?: string; code?: number; message?: string } | null;
  if (!e) return false;
  if (e.name === "PasswordException") return true;
  if (e.code === 1 || e.code === 2) return true;
  return /password/i.test(String(e.message ?? ""));
}

function copyBytes(data: ArrayBuffer) {
  const src = new Uint8Array(data);
  const out = new Uint8Array(src.byteLength);
  out.set(src);
  return out;
}

async function extractWithPdfJs(
  data: Uint8Array,
  password: string | undefined,
  onProgress?: (info: PdfProgress) => void,
) {
  await bootWorker();
  const task = getDocument({
    data,
    password: password || "",
    disableAutoFetch: true,
    disableStream: true,
    stopAtErrors: false,
    useWasm: false,
    useWorkerFetch: false,
    useSystemFonts: true,
    enableXfa: false,
    disableFontFace: true,
    isOffscreenCanvasSupported: false,
  });
  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    const loosePages: string[] = [];
    const total = pdf.numPages;
    for (let i = 1; i <= total; i++) {
      onProgress?.({ page: i, pages: total });
      const page = await pdf.getPage(i);
      let content: { items: unknown[] };
      try {
        content = await page.getTextContent({ includeMarkedContent: true });
      } catch {
        content = await page.getTextContent();
      }
      const { lines, loose } = itemsToText(content.items as unknown[]);
      pages.push(lines);
      loosePages.push(loose);
      await new Promise((r) => setTimeout(r, 0));
    }
    const lined = pages.join("\n");
    const loose = loosePages.join("\n");
    return lined.length >= loose.length ? lined : `${lined}\n${loose}`;
  } finally {
    try {
      await task.destroy();
    } catch {
      /* ignore */
    }
  }
}

function ledgerScore(t: string) {
  if (!t) return 0;
  let n = 0;
  for (const line of t.split("\n")) {
    if (/(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}/.test(line) && /\d/.test(line)) n += 1;
  }
  return n * 10 + Math.min(t.length, 50_000) / 1000;
}

function betterText(a: string, b: string) {
  return ledgerScore(a) >= ledgerScore(b) ? a : b;
}

function pagesDeclared(text: string) {
  const seen = new Set<number>();
  let total = 0;
  for (const m of text.matchAll(/Page\s+(\d+)\s+of\s+(\d+)/gi)) {
    seen.add(Number(m[1]));
    total = Math.max(total, Number(m[2]));
  }
  return { seen, total };
}

export async function extractPdfText(
  data: ArrayBuffer,
  password?: string,
  onProgress?: (info: PdfProgress) => void,
): Promise<string> {
  installPakoInflate();
  let fallback = "";
  try {
    fallback = await extractPdfFallback(data);
  } catch {
    fallback = "";
  }

  if (looksLikeLedger(fallback) && !password) {
    const { seen, total } = pagesDeclared(fallback);
    if (!total || seen.size >= total) {
      onProgress?.({ page: Math.max(1, seen.size), pages: Math.max(1, total) });
      return fallback;
    }
  }

  let pdfjsText = "";
  try {
    pdfjsText = await extractWithPdfJs(copyBytes(data), password, onProgress);
  } catch (err) {
    if (isPasswordError(err)) {
      throw new PdfOpenError(
        "This PDF is locked. Enter the password from your bank (often your date of birth or customer number).",
        "password",
      );
    }
    if (!hasText(fallback)) {
      throw new PdfOpenError(
        "That PDF could not be read. Try another export, or download the CSV from internet banking.",
        "corrupt",
      );
    }
  }

  const text = betterText(pdfjsText, fallback);
  if (hasText(text) || looksLikeLedger(text)) return text;
  throw new PdfOpenError(
    "That PDF could not be read. Try another export, or download the CSV from internet banking.",
    "corrupt",
  );
}

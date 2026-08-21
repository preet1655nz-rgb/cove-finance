import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { extractPdfFallback, hasText, itemsToText, looksLikeLedger } from "./pdf-fallback";

export { extractPdfFallback, hasText, looksLikeLedger };

function publicWorkerSrc() {
  if (typeof window === "undefined") return pdfWorkerUrl || "/pdf.worker.min.mjs";
  return pdfWorkerUrl || `${window.location.origin}/pdf.worker.min.mjs`;
}

let workerBoot: Promise<void> | null = null;

function bootWorker() {
  if (!workerBoot) {
    workerBoot = (async () => {
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
    readonly kind: "password" | "empty" | "corrupt" | "timeout",
  ) {
    super(message);
    this.name = "PdfOpenError";
  }
}

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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function extractOnce(data: Uint8Array, password: string | undefined) {
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
  });
  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    const loosePages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
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

export async function extractPdfText(data: ArrayBuffer, password?: string): Promise<string> {
  let fallback = "";
  try {
    fallback = await extractPdfFallback(data);
  } catch {
    fallback = "";
  }
  if (looksLikeLedger(fallback)) return fallback;

  let last: unknown;
  try {
    const text = await withTimeout(extractOnce(copyBytes(data), password), 8000, "pdfjs-timeout");
    if (hasText(text)) return text;
  } catch (err) {
    last = err;
    if (isPasswordError(err)) {
      throw new PdfOpenError(
        "This PDF is locked. Enter the password from your bank (often your date of birth or customer number).",
        "password",
      );
    }
  }

  if (hasText(fallback)) return fallback;

  if (last instanceof PdfOpenError) throw last;
  if (isPasswordError(last)) {
    throw new PdfOpenError(
      "This PDF is locked. Enter the password from your bank (often your date of birth or customer number).",
      "password",
    );
  }
  throw new PdfOpenError(
    "That PDF could not be read. Try another export, or download the CSV from internet banking.",
    "corrupt",
  );
}

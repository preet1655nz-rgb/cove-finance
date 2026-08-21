import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
// Vite emits a hashed worker asset. We still load the worker into the main
// thread so reading a statement does not depend on `new Worker(..., { type: "module" })`
// (that path breaks in iOS Safari, PWAs, and some iframes).
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

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

function hasText(text: string) {
  return text.replace(/\s+/g, "").length >= 8;
}

type TextItem = { str?: string; transform?: number[] };

function itemsToText(items: unknown[]) {
  const buckets = new Map<number, { x: number; str: string }[]>();
  const loose: string[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as TextItem;
    const str = String(item.str ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!str) continue;
    loose.push(str);
    const x = item.transform?.[4] ?? 0;
    const y = Math.round((item.transform?.[5] ?? 0) / 2) * 2;
    const row = buckets.get(y) ?? [];
    row.push({ x, str });
    buckets.set(y, row);
  }
  const ys = [...buckets.keys()].sort((a, b) => b - a);
  const merged: number[] = [];
  const remap = new Map<number, number>();
  for (const y of ys) {
    const prev = merged[merged.length - 1];
    if (prev != null && Math.abs(prev - y) <= 3) remap.set(y, prev);
    else {
      merged.push(y);
      remap.set(y, y);
    }
  }
  const combined = new Map<number, { x: number; str: string }[]>();
  for (const [y, cells] of buckets) {
    const key = remap.get(y) ?? y;
    const row = combined.get(key) ?? [];
    row.push(...cells);
    combined.set(key, row);
  }
  const lines = [...combined.keys()]
    .sort((a, b) => b - a)
    .map((y) =>
      (combined.get(y) ?? [])
        .sort((a, b) => a.x - b.x)
        .map((c) => c.str)
        .join(" "),
    );
  return { lines: lines.join("\n"), loose: loose.join(" ") };
}

type OpenOpts = {
  enableXfa?: boolean;
  useSystemFonts?: boolean;
  disableFontFace?: boolean;
  workerSrc?: string;
};

async function extractOnce(data: Uint8Array, password: string | undefined, opts: OpenOpts) {
  await bootWorker();
  if (opts.workerSrc) GlobalWorkerOptions.workerSrc = opts.workerSrc;
  const task = getDocument({
    data,
    password: password || "",
    disableAutoFetch: true,
    disableStream: true,
    stopAtErrors: false,
    useWasm: false,
    useWorkerFetch: false,
    useSystemFonts: opts.useSystemFonts ?? true,
    enableXfa: opts.enableXfa ?? false,
    disableFontFace: opts.disableFontFace ?? true,
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

const ATTEMPTS: OpenOpts[] = [
  { enableXfa: false, useSystemFonts: true, disableFontFace: true },
  { enableXfa: true, useSystemFonts: true, disableFontFace: false },
  { enableXfa: false, useSystemFonts: false, disableFontFace: true, workerSrc: "/pdf.worker.min.mjs" },
];

export async function extractPdfText(data: ArrayBuffer, password?: string): Promise<string> {
  let last: unknown;
  for (const opts of ATTEMPTS) {
    try {
      const text = await extractOnce(copyBytes(data), password, opts);
      if (hasText(text)) return text;
      last = new PdfOpenError(
        "That PDF has no selectable text — it is probably a photo or scan. In ANZ go to Statements and download the PDF, or export a CSV.",
        "empty",
      );
    } catch (err) {
      last = err;
      if (isPasswordError(err)) {
        throw new PdfOpenError(
          "This PDF is locked. Enter the password from your bank (often your date of birth or customer number).",
          "password",
        );
      }
    }
  }

  try {
    const fallback = await extractPdfFallback(data);
    if (hasText(fallback)) return fallback;
  } catch (err) {
    last = last ?? err;
  }

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

function decodePdfLiteral(inner: string) {
  return inner
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\([0-7]{1,3})/g, (_, oct: string) => String.fromCharCode(Number.parseInt(oct, 8) & 0xff))
    .replace(/\\([()\\])/g, "$1");
}

async function inflateBytes(payload: Uint8Array) {
  for (const format of ["deflate", "deflate-raw"] as const) {
    try {
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      await writer.write(new Uint8Array(payload));
      await writer.close();
      const buf = await new Response(ds.readable).arrayBuffer();
      if (buf.byteLength) return new Uint8Array(buf);
    } catch {
      /* try the other wrapper */
    }
  }
  return null;
}

function flatePayloads(bytes: Uint8Array) {
  const latin = new TextDecoder("latin1").decode(bytes);
  const out: Uint8Array[] = [];
  const re = /\/FlateDecode\b[\s\S]{0,400}?stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(latin))) {
    const start = match.index + match[0].length;
    const end = latin.indexOf("endstream", start);
    if (end < 0) continue;
    let slice = bytes.subarray(start, end);
    if (slice.length && slice[slice.length - 1] === 10) slice = slice.subarray(0, slice.length - 1);
    if (slice.length && slice[slice.length - 1] === 13) slice = slice.subarray(0, slice.length - 1);
    if (slice.length > 32) out.push(slice);
  }
  return out;
}

function itemsFromContent(decoded: string) {
  const items: { str: string; transform: number[] }[] = [];
  let x = 0;
  let y = 0;
  const token =
    /(?:([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+Tm)|(?:\(\s*((?:\\.|[^\\)])*)\)\s*Tj)|(?:\[([\s\S]*?)\]\s*TJ)/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(decoded))) {
    if (match[1] != null) {
      x = Number(match[5]);
      y = Number(match[6]);
      continue;
    }
    if (match[7] != null) {
      const str = decodePdfLiteral(match[7]);
      if (str) items.push({ str, transform: [1, 0, 0, 1, x, y] });
      x += str.length * 8;
      continue;
    }
    const arr = match[8] ?? "";
    for (const piece of arr.matchAll(/\((?:\\.|[^\\)])*\)/g)) {
      const inner = piece[0].slice(1, -1);
      const str = decodePdfLiteral(inner);
      if (str) items.push({ str, transform: [1, 0, 0, 1, x, y] });
      x += str.length * 8;
    }
  }
  return items;
}

/** Last-resort reader for simple FlateDecode bank PDFs (ANZ Go) when pdf.js cannot start. */
export async function extractPdfFallback(data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(data);
  const pages: string[] = [];
  const loosePages: string[] = [];
  for (const payload of flatePayloads(bytes)) {
    const inflated = await inflateBytes(payload);
    if (!inflated) continue;
    const decoded = new TextDecoder("latin1").decode(inflated);
    if (/AdobeFont|FontInfo|%!PS-AdobeFont|ICC_PROFILE|acsp/i.test(decoded.slice(0, 200))) continue;
    if (!/\bTj\b|\bTJ\b/.test(decoded)) continue;
    const { lines, loose } = itemsToText(itemsFromContent(decoded));
    if (hasText(lines) || hasText(loose)) {
      pages.push(lines);
      loosePages.push(loose);
    }
  }
  const lined = pages.join("\n");
  const loose = loosePages.join("\n");
  return lined.length >= loose.length ? lined : `${lined}\n${loose}`;
}

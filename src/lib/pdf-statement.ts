import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

function workerSrc() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/pdf.worker.min.mjs`;
}

function configureWorker() {
  if (typeof window === "undefined") return;
  GlobalWorkerOptions.workerSrc = workerSrc();
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

async function extractOnce(data: Uint8Array, password?: string) {
  configureWorker();
  const task = getDocument({
    data,
    password: password || "",
    disableAutoFetch: true,
    disableStream: true,
    useSystemFonts: true,
    enableXfa: true,
  });
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
}

export async function extractPdfText(data: ArrayBuffer, password?: string): Promise<string> {
  try {
    const text = await extractOnce(copyBytes(data), password);
    if (!text.replace(/\s+/g, "").length) {
      throw new PdfOpenError(
        "That PDF has no selectable text — it is probably a photo or scan. Export a CSV from internet banking instead.",
        "empty",
      );
    }
    return text;
  } catch (err) {
    if (err instanceof PdfOpenError) throw err;
    if (isPasswordError(err)) {
      throw new PdfOpenError(
        "This PDF is locked. Enter the password from your bank (often your date of birth or customer number).",
        "password",
      );
    }
    try {
      const text = await extractOnce(copyBytes(data), password);
      if (!text.replace(/\s+/g, "").length) {
        throw new PdfOpenError(
          "That PDF has no selectable text — it is probably a photo or scan. Export a CSV from internet banking instead.",
          "empty",
        );
      }
      return text;
    } catch (err2) {
      if (err2 instanceof PdfOpenError) throw err2;
      if (isPasswordError(err2)) {
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
  }
}

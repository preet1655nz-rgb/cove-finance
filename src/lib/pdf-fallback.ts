import { inflate } from "pako";

/** Worker-free reader for bank PDFs (FlateDecode and uncompressed content). */

export function hasText(text: string) {
  return text.replace(/\s+/g, "").length >= 8;
}

export function looksLikeLedger(text: string) {
  if (!text) return false;
  let hits = 0;
  for (const line of text.split("\n")) {
    const hasMoney = /(?:\$\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}/.test(line);
    if (!hasMoney) continue;
    if (/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(line)) hits += 1;
    else if (/\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/.test(line)) hits += 1;
    else if (/\b(?:DD|DC|BP|AP|VT|EP|AT)\b/.test(line)) hits += 1;
  }
  return hits >= 2;
}

type TextItem = { str?: string; transform?: number[] };

export function itemsToText(items: unknown[]) {
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
    if (prev != null && Math.abs(prev - y) <= 4) remap.set(y, prev);
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

function decodePdfLiteral(inner: string) {
  return inner
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\([0-7]{1,3})/g, (_, oct: string) => String.fromCharCode(Number.parseInt(oct, 8) & 0xff))
    .replace(/\\([()\\])/g, "$1");
}

function decodePdfHex(hex: string) {
  const h = hex.replace(/\s+/g, "");
  let out = "";
  for (let i = 0; i < h.length; i += 2) {
    out += String.fromCharCode(Number.parseInt(h.slice(i, i + 2).padEnd(2, "0"), 16) & 0xff);
  }
  return out;
}

function inflateBytes(payload: Uint8Array) {
  try {
    return inflate(payload);
  } catch {
    try {
      return inflate(payload, { raw: true });
    } catch {
      return null;
    }
  }
}

/**
 * Native DecompressionStream("deflate") hangs on some ANZ Go Flate streams
 * (page-3 content). pdf.js 6 uses that API first; pako does not hang.
 * Patch before loading the pdf.js worker (fake-worker shares this realm).
 */
let inflatePatched = false;

export function installPakoInflate() {
  if (inflatePatched) return;
  inflatePatched = true;
  const Native = globalThis.DecompressionStream;
  globalThis.DecompressionStream = class DecompressionStream {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<BufferSource>;
    constructor(format: string) {
      if (format === "deflate" || format === "deflate-raw" || format === "gzip") {
        const stream = pakoDecompressStream(format);
        this.readable = stream.readable;
        this.writable = stream.writable;
        return;
      }
      if (typeof Native === "function") {
        const inner = new Native(format as CompressionFormat);
        this.readable = inner.readable as ReadableStream<Uint8Array>;
        this.writable = inner.writable;
        return;
      }
      throw new TypeError(`Unsupported compression format: ${format}`);
    }
  } as unknown as typeof globalThis.DecompressionStream;
}

function pakoDecompressStream(format: string) {
  const chunks: Uint8Array[] = [];
  return new TransformStream<BufferSource, Uint8Array>({
    transform(chunk) {
      if (chunk instanceof Uint8Array) chunks.push(chunk);
      else if (ArrayBuffer.isView(chunk)) {
        chunks.push(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      } else chunks.push(new Uint8Array(chunk as ArrayBuffer));
    },
    flush(controller) {
      const total = chunks.reduce((n, c) => n + c.byteLength, 0);
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.byteLength;
      }
      const raw = format === "deflate-raw";
      try {
        controller.enqueue(format === "gzip" ? inflate(bytes) : inflate(bytes, { raw }));
      } catch {
        try {
          controller.enqueue(inflate(bytes, { raw: !raw }));
        } catch {
          const fallback = inflateBytes(bytes);
          if (!fallback) throw new Error("deflate failed");
          controller.enqueue(fallback);
        }
      }
    },
  });
}

type PdfStream = { bytes: Uint8Array; flate: boolean };

function allStreams(bytes: Uint8Array): PdfStream[] {
  const latin = new TextDecoder("latin1").decode(bytes);
  const out: PdfStream[] = [];
  const re = /(?<!end)stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(latin))) {
    const dict = latin.slice(Math.max(0, match.index - 2500), match.index);
    if (/\/Subtype\s*\/Image\b/i.test(dict)) continue;
    if (/\/Type\s*\/XRef\b/i.test(dict)) continue;
    if (/\/Type\s*\/Metadata\b/i.test(dict)) continue;
    if (/\/Type\s*\/ObjStm\b/i.test(dict)) continue;
    const start = match.index + match[0].length;
    const end = latin.indexOf("endstream", start);
    if (end < 0) continue;
    const flate = /\/FlateDecode\b/.test(dict);
    const indirectLength = /\/Length\s+\d+\s+\d+\s+R\b/.test(dict);
    const lengthMatch = !indirectLength ? dict.match(/\/Length\s+(\d+)\b/) : null;
    let slice = bytes.subarray(start, end);
    if (lengthMatch) {
      const n = Number(lengthMatch[1]);
      if (n > 0 && start + n <= bytes.byteLength) slice = bytes.subarray(start, start + n);
    } else {
      if (slice.length && slice[slice.length - 1] === 10) slice = slice.subarray(0, slice.length - 1);
      if (slice.length && slice[slice.length - 1] === 13) slice = slice.subarray(0, slice.length - 1);
    }
    if (slice.length >= 8) out.push({ bytes: slice, flate });
  }
  return out;
}

function emit(items: { str: string; transform: number[] }[], str: string, x: number, y: number) {
  if (str) items.push({ str, transform: [1, 0, 0, 1, x, y] });
  return x + str.length * 5;
}

function itemsFromContent(decoded: string) {
  const items: { str: string; transform: number[] }[] = [];
  let x = 0;
  let y = 0;
  let leading = 12;
  const num = "[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?";
  const re = new RegExp(
    `\\bBT\\b|\\bET\\b` +
      `|((?:${num}\\s+){5}${num})\\s+Tm` +
      `|(${num})\\s+(${num})\\s+Td` +
      `|(${num})\\s+(${num})\\s+TD` +
      `|(${num})\\s+TL` +
      `|(T\\*)` +
      `|\\(((?:\\\\.|[^\\\\)])*)\\)\\s*Tj` +
      `|\\[([\\s\\S]*?)\\]\\s*TJ` +
      `|\\(((?:\\\\.|[^\\\\)])*)\\)\\s*'` +
      `|<((?:[0-9A-Fa-f]|\\s)+)>\\s*Tj`,
    "g",
  );
  let match: RegExpExecArray | null;
  while ((match = re.exec(decoded))) {
    const token = match[0];
    if (token === "BT" || token === "ET") {
      x = 0;
      y = 0;
      continue;
    }
    if (match[1] != null) {
      const nums = match[1].trim().split(/\s+/).map(Number);
      x = nums[4] ?? x;
      y = nums[5] ?? y;
      continue;
    }
    if (match[2] != null && match[3] != null) {
      x += Number(match[2]);
      y += Number(match[3]);
      continue;
    }
    if (match[4] != null && match[5] != null) {
      x += Number(match[4]);
      y += Number(match[5]);
      continue;
    }
    if (match[6] != null && match[7] == null) {
      const next = Number(match[6]);
      if (Number.isFinite(next) && next !== 0) leading = Math.abs(next);
      continue;
    }
    if (match[7] === "T*") {
      y -= leading;
      continue;
    }
    if (match[9] != null) {
      for (const piece of match[9].matchAll(/\((?:\\.|[^\\)])*\)/g)) {
        const inner = decodePdfLiteral(piece[0].slice(1, -1));
        x = emit(items, inner, x, y);
      }
      continue;
    }
    if (match[11] != null) {
      const inner = decodePdfHex(match[11]);
      x = emit(items, inner, x, y);
      continue;
    }
    const raw = match[8] ?? match[10];
    if (raw == null) continue;
    if (token.endsWith("'")) y -= leading;
    x = emit(items, decodePdfLiteral(raw), x, y);
  }
  return items;
}

export async function extractPdfFallback(data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(data);
  const pages: string[] = [];
  const loosePages: string[] = [];
  for (const stream of allStreams(bytes)) {
    const inflated = stream.flate ? inflateBytes(stream.bytes) : stream.bytes;
    if (!inflated) continue;
    const decoded = new TextDecoder("latin1").decode(inflated);
    const head = decoded.slice(0, 240);
    if (/AdobeFont|FontInfo|%!PS-AdobeFont|ICC_PROFILE|acspAPPL|acspMSFT/i.test(head)) continue;
    if (!/\bTj\b|\bTJ\b|\bBT\b/.test(decoded)) continue;
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

import { inflate } from "pako";

/** Worker-free reader for simple FlateDecode bank PDFs (ANZ Go and similar). */

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
  return hits >= 3;
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

function decodePdfLiteral(inner: string) {
  return inner
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\([0-7]{1,3})/g, (_, oct: string) => String.fromCharCode(Number.parseInt(oct, 8) & 0xff))
    .replace(/\\([()\\])/g, "$1");
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
    if (slice.length > 80 && slice.length < 400_000) out.push(slice);
    if (out.length >= 24) break;
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

export async function extractPdfFallback(data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(data);
  const pages: string[] = [];
  const loosePages: string[] = [];
  for (const payload of flatePayloads(bytes)) {
    const inflated = inflateBytes(payload);
    if (!inflated) continue;
    const decoded = new TextDecoder("latin1").decode(inflated);
    const head = decoded.slice(0, 200);
    if (/AdobeFont|FontInfo|%!PS-AdobeFont|ICC_PROFILE|acsp/i.test(head)) continue;
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

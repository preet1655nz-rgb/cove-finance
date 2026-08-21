import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined") {
  GlobalWorkerOptions.workerSrc = pdfWorker;
}

type TextItem = { str: string; transform: number[] };

export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdf = await getDocument({
    data: new Uint8Array(data),
    disableAutoFetch: true,
    disableStream: true,
    useSystemFonts: true,
  }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const buckets = new Map<number, { x: number; str: string }[]>();
    for (const raw of content.items) {
      if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
      const item = raw as TextItem;
      const str = item.str.replace(/\s+/g, " ").trim();
      if (!str) continue;
      const x = item.transform[4] ?? 0;
      const y = Math.round((item.transform[5] ?? 0) * 2) / 2;
      const row = buckets.get(y) ?? [];
      row.push({ x, str });
      buckets.set(y, row);
    }
    const ys = [...buckets.keys()].sort((a, b) => b - a);
    const lines = ys.map((y) =>
      (buckets.get(y) ?? [])
        .sort((a, b) => a.x - b.x)
        .map((c) => c.str)
        .join(" "),
    );
    pages.push(lines.join("\n"));
  }
  return pages.join("\n");
}

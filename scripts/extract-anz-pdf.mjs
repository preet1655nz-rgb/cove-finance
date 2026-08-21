import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseBankStatement } from "../src/lib/statement.ts";

const data = new Uint8Array(readFileSync("scripts/fixtures/statements/anz-go.pdf"));
const pdf = await getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
let text = "";
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  const buckets = new Map();
  for (const raw of content.items) {
    if (!raw?.str) continue;
    const str = String(raw.str).replace(/\s+/g, " ").trim();
    if (!str) continue;
    const x = raw.transform[4] ?? 0;
    const y = Math.round((raw.transform[5] ?? 0) * 2) / 2;
    const row = buckets.get(y) ?? [];
    row.push({ x, str });
    buckets.set(y, row);
  }
  const ys = [...buckets.keys()].sort((a, b) => b - a);
  text += ys.map((y) => (buckets.get(y) || []).sort((a, b) => a.x - b.x).map((c) => c.str).join(" ")).join("\n") + "\n";
}
console.log(text.slice(0, 1800));
console.log("---");
const r = parseBankStatement(text, "anz-go.pdf");
const income = r.rows.filter((x) => x.type === "income").reduce((s, x) => s + x.amount, 0);
const expense = r.rows.filter((x) => x.type === "expense").reduce((s, x) => s + x.amount, 0);
const summary = {
  ok: r.ok,
  format: r.format,
  rows: r.rows.length,
  skipped: r.skipped,
  error: r.error,
  income: Number(income.toFixed(2)),
  expense: Number(expense.toFixed(2)),
};
console.log(JSON.stringify(summary, null, 2));
if (!r.ok || r.rows.length !== 47 || summary.income !== 6919.71 || summary.expense !== 6888.99) {
  console.log(r.rows.map((x) => `${x.date} ${x.type} ${x.amount} ${x.note.slice(0, 72)}`).join("\n"));
  process.exit(1);
}

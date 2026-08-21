import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { jsPDF } from "jspdf";
import { extractPdfFallback, looksLikeLedger } from "../src/lib/pdf-fallback.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "scripts/fixtures/statements/generated");
mkdirSync(outDir, { recursive: true });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function makeAnzPdf(pageCount, perPage) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  let n = 0;
  let income = 0;
  let expense = 0;
  for (let p = 0; p < pageCount; p++) {
    if (p) doc.addPage();
    let y = 48;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Go - continued`, 40, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Statement period 01 Jan 2026 – 31 Dec 2026    Page ${p + 1} of ${pageCount}`, 40, y);
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.text("Date", 40, y);
    doc.text("Transaction type and details", 88, y);
    doc.text("Withdrawals", 430, y, { align: "right" });
    doc.text("Deposits", 500, y, { align: "right" });
    doc.text("Balance", 560, y, { align: "right" });
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.text("Balance brought forward from previous page 100.00", 40, y);
    y += 14;
    for (let i = 0; i < perPage; i++) {
      n += 1;
      const day = (n % 27) + 1;
      const mon = MONTHS[Math.floor((n / 27) % 12)];
      const isIn = n % 5 === 0;
      const code = isIn ? "DC" : "VT";
      const amt = Math.round((((n * 17) % 9000) + 100) ) / 100;
      const note = `COVEID${String(n).padStart(4, "0")} MERCHANT${n}`;
      doc.text(`${day} ${mon}`, 40, y);
      doc.text(`${code} ${note}`, 88, y);
      if (isIn) {
        doc.text(amt.toFixed(2), 500, y, { align: "right" });
        income += amt;
      } else {
        doc.text(amt.toFixed(2), 430, y, { align: "right" });
        expense += amt;
      }
      doc.text((100 + n).toFixed(2), 560, y, { align: "right" });
      y += 13;
    }
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Totals at end of page 10.00 20.00 130.00", 40, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.text("Your available credit $427.77", 40, y);
    y += 10;
    doc.text("Payment dates displayed are as recorded by ANZ", 40, y);
  }
  const buf = Buffer.from(doc.output("arraybuffer"));
  return { buf, expected: n, income: Number(income.toFixed(2)), expense: Number(expense.toFixed(2)) };
}

function jpegStub() {
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i2ur6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLq6wsPExcbHyMnK0tLU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oACAEBAAA/APn+iiigD//Z",
    "base64",
  );
}

const cases = [
  { id: "1p", ...makeAnzPdf(1, 15) },
  { id: "3p", ...makeAnzPdf(3, 20) },
  { id: "20p", ...makeAnzPdf(20, 20) },
  { id: "50p", ...makeAnzPdf(50, 20) },
];

const extractResults = [];
for (const c of cases) {
  const path = join(outDir, `anz-${c.id}.pdf`);
  writeFileSync(path, c.buf);
  c.path = path;
  const t0 = Date.now();
  const text = await extractPdfFallback(c.buf.buffer.slice(c.buf.byteOffset, c.buf.byteOffset + c.buf.byteLength));
  const dateLines = text.split("\n").filter(
    (l) =>
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(l) &&
      /COVEID/.test(l) &&
      /\d+\.\d{2}/.test(l),
  );
  extractResults.push({
    id: c.id,
    pages: c.id.replace("p", ""),
    bytes: c.buf.length,
    ms: Date.now() - t0,
    dateLines: dateLines.length,
    expected: c.expected,
    ledger: looksLikeLedger(text),
    ok: dateLines.length === c.expected && looksLikeLedger(text),
  });
}

const real = [
  ["/workspace/attachments/State.pdf", 78, "State.pdf"],
  [join(root, "public/sample-anz-go.pdf"), 47, "sample-anz-go.pdf"],
];
for (const [path, min, label] of real) {
  const buf = readFileSync(path);
  const t0 = Date.now();
  const text = await extractPdfFallback(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const dateLines = text.split("\n").filter(
    (l) =>
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(l) &&
      /(?:\$\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}/.test(l),
  );
  extractResults.push({
    id: label,
    bytes: buf.length,
    ms: Date.now() - t0,
    dateLines: dateLines.length,
    expected: min,
    ledger: looksLikeLedger(text),
    ok: looksLikeLedger(text) && dateLines.length >= Math.min(40, min),
  });
}

writeFileSync(join(outDir, "empty.pdf"), Buffer.from("%PDF"));
writeFileSync(join(outDir, "broken.pdf"), Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"));
writeFileSync(join(outDir, "photo.jpg"), jpegStub());

console.log("extract", JSON.stringify(extractResults, null, 2));
if (extractResults.some((r) => !r.ok)) {
  console.error("extract failed");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const logs = [];
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") logs.push(`error: ${m.text()}`);
});

await page.goto("http://127.0.0.1:8080/calendar", { waitUntil: "networkidle" });

async function openImport() {
  const dlg = page.getByRole("dialog");
  if (await dlg.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.getByRole("button", { name: /statement/i }).first().click();
  await dlg.waitFor({ timeout: 8000 });
}

async function upload(path, waitMs = 20000) {
  await openImport();
  await page.locator('input[type="file"]').setInputFiles(path);
  await page.getByText(/to import|could not|photo|empty|locked|No dates/i).waitFor({ timeout: waitMs });
  return page.getByRole("dialog").innerText();
}

const ui = [];

async function expectImport(path, n, extra = {}) {
  const wait = extra.wait ?? Math.max(20000, n * 40);
  const body = await upload(path, wait);
  const m = body.match(/(\d+) to import/);
  const got = m ? Number(m[1]) : 0;
  const ok =
    got === n &&
    !/could not be read|too long|one-month/i.test(body) &&
    (extra.income == null || new RegExp(`${extra.income} in`).test(body) || body.includes(`${extra.income} in`));
  ui.push({ path: path.split("/").pop(), expected: n, got, ok, head: body.slice(0, 180).replace(/\n/g, " | ") });
  return body;
}

await expectImport("/workspace/attachments/State.pdf", 78, { income: 20 });
await expectImport(join(root, "public/sample-anz-go.pdf"), 47);
for (const c of cases) {
  await expectImport(c.path, c.expected, { wait: c.expected > 200 ? 120000 : 30000 });
}

const csvBody = await upload(join(root, "public/sample-anz-go.csv"));
ui.push({
  path: "sample-anz-go.csv",
  ok: /47 to import/.test(csvBody),
  head: csvBody.slice(0, 140).replace(/\n/g, " | "),
});

const ofxBody = await upload(join(root, "scripts/fixtures/statements/household.ofx"));
ui.push({
  path: "household.ofx",
  ok: /to import/.test(ofxBody) && !/could not/i.test(ofxBody),
  head: ofxBody.slice(0, 140).replace(/\n/g, " | "),
});

const jpgBody = await upload(join(outDir, "photo.jpg"));
ui.push({
  path: "photo.jpg",
  ok: /photo|screenshot/i.test(jpgBody) && !/to import/.test(jpgBody),
  head: jpgBody.slice(0, 160).replace(/\n/g, " | "),
});

const emptyBody = await upload(join(outDir, "empty.pdf"));
ui.push({
  path: "empty.pdf",
  ok: /empty|could not be read|No dates/i.test(emptyBody) && !/to import/.test(emptyBody),
  head: emptyBody.slice(0, 160).replace(/\n/g, " | "),
});

const brokenBody = await upload(join(outDir, "broken.pdf"));
ui.push({
  path: "broken.pdf",
  ok: /could not be read|No dates/i.test(brokenBody) && !/too long/i.test(brokenBody),
  head: brokenBody.slice(0, 160).replace(/\n/g, " | "),
});

await page.screenshot({ path: "/workspace/screenshots/pdf-matrix.png" });
await browser.close();

const failed = ui.filter((r) => !r.ok);
console.log(JSON.stringify({ ui, logs: logs.slice(0, 20), failed: failed.length }, null, 2));
if (failed.length) process.exit(1);
console.log("pdf-matrix ok");

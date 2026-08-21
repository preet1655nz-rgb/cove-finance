import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = join(root, "scripts/fixtures/statements/anz-go.csv");
const csv = readFileSync(csvPath, "utf8");

copyFileSync(csvPath, join(root, "public/sample-anz-go.csv"));

function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      cells.push(cur);
      cur = "";
    } else cur += c;
  }
  cells.push(cur);
  return cells;
}

const nzd = (v) =>
  Number(v).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const rows = csv
  .trim()
  .split("\n")
  .slice(1)
  .map(parseCsvLine)
  .map(([date, details, wd, dep, bal]) => ({
    date: date.trim(),
    details: details.trim(),
    wd: wd.trim(),
    dep: dep.trim(),
    bal: bal.trim(),
  }));

const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
const pageW = doc.internal.pageSize.getWidth();
const xDate = 40;
const xDetails = 88;
const xWd = 430;
const xDep = 500;
const xBal = 570;
let y = 48;

function ensurePage() {
  if (y < 800) return;
  doc.addPage();
  y = 48;
}

function header() {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(43, 106, 122);
  doc.text("Go - continued", xDate, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text("Statement period 26 Jun 2026 – 27 Jul 2026    Orig date 01/07/2026", xDate, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(43, 106, 122);
  doc.text("Date", xDate, y);
  doc.text("Transaction type and details", xDetails, y);
  doc.text("Withdrawals", xWd, y, { align: "right" });
  doc.text("Deposits", xDep, y, { align: "right" });
  doc.text("Balance", xBal, y, { align: "right" });
  y += 4;
  doc.setDrawColor(43, 106, 122);
  doc.setLineWidth(0.6);
  doc.line(xDate, y, pageW - 36, y);
  y += 12;
}

header();

for (const r of rows) {
  ensurePage();
  const isTotal = /totals at end/i.test(r.details);
  const isOpen = /brought forward/i.test(r.details);
  doc.setFont("helvetica", isTotal || isOpen ? "bold" : "normal");
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);
  if (isTotal) {
    doc.setFillColor(232, 238, 240);
    doc.rect(36, y - 9, pageW - 72, 14, "F");
  }
  if (r.date) doc.text(r.date, xDate, y);
  const details = r.details.replace(/\s+/g, " ");
  const card = details.match(/^(.*?)(\d{6}\*{4,}\d+.*)$/);
  if (card) {
    doc.text(card[1].trim(), xDetails, y);
    y += 10;
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(card[2].trim(), xDetails, y);
    doc.setFontSize(8);
    doc.setTextColor(20, 20, 20);
  } else {
    doc.text(details.slice(0, 62), xDetails, y);
  }
  const prefix = isTotal ? "$" : "";
  if (r.wd) doc.text(prefix + nzd(r.wd), xWd, y, { align: "right" });
  if (r.dep) doc.text(prefix + nzd(r.dep), xDep, y, { align: "right" });
  if (r.bal) doc.text(prefix + nzd(r.bal), xBal, y, { align: "right" });
  y += 13;
}

y += 10;
doc.setFont("helvetica", "normal");
doc.setFontSize(7);
doc.setTextColor(90, 90, 90);
doc.text("AP Automatic Payment   BP Bill Payment   DC Direct Credit   DD Direct Debit", xDate, y);
y += 10;
doc.text("EP EFTPOS Transaction  VT Visa Transaction                            Page 2 of 3", xDate, y);

const pdfPath = join(root, "public/sample-anz-go.pdf");
const fixPath = join(root, "scripts/fixtures/statements/anz-go.pdf");
mkdirSync(join(root, "scripts/fixtures/statements"), { recursive: true });
const buf = Buffer.from(doc.output("arraybuffer"));
writeFileSync(pdfPath, buf);
writeFileSync(fixPath, buf);
console.log(`wrote ${pdfPath} (${buf.length} bytes)`);

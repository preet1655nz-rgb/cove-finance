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
const margin = 36;
let y = 40;

function line(text, size = 8, style = "normal") {
  if (y > 780) {
    doc.addPage();
    y = 40;
  }
  doc.setFont("courier", style);
  doc.setFontSize(size);
  doc.text(text, margin, y);
  y += size + 4;
}

doc.setTextColor(40, 90, 110);
line("Go - continued", 14, "bold");
doc.setTextColor(20, 20, 20);
line("Statement period 26 Jun 2026 – 27 Jul 2026    Orig date 01/07/2026", 9);
y += 6;
line("Date   Transaction type and details                          Withdrawals   Deposits    Balance", 8, "bold");
doc.setDrawColor(40, 90, 110);
doc.line(margin, y - 2, pageW - margin, y - 2);
y += 4;

for (const r of rows) {
  if (!r.date) {
    const label = r.details.padEnd(52, " ").slice(0, 52);
    const wd = (r.wd ? Number(r.wd).toLocaleString("en-NZ", { minimumFractionDigits: 2 }) : "").padStart(12, " ");
    const dep = (r.dep ? Number(r.dep).toLocaleString("en-NZ", { minimumFractionDigits: 2 }) : "").padStart(12, " ");
    const bal = Number(r.bal).toLocaleString("en-NZ", { minimumFractionDigits: 2 }).padStart(10, " ");
    const prefix = r.details.toLowerCase().includes("total") ? "$" : " ";
    line(`${label}${prefix}${wd.trim() ? wd : "            "}${prefix}${dep.trim() ? dep : "            "} ${prefix}${bal}`.replace(/\s+$/, ""), 8, "bold");
    continue;
  }
  const date = r.date.padEnd(7, " ");
  const details = r.details.replace(/\s+/g, " ").slice(0, 48).padEnd(48, " ");
  const wd = r.wd ? Number(r.wd).toLocaleString("en-NZ", { minimumFractionDigits: 2 }).padStart(12, " ") : "            ";
  const dep = r.dep ? Number(r.dep).toLocaleString("en-NZ", { minimumFractionDigits: 2 }).padStart(12, " ") : "            ";
  const bal = Number(r.bal).toLocaleString("en-NZ", { minimumFractionDigits: 2 }).padStart(10, " ");
  line(`${date}${details}${wd}${dep}  ${bal}`);
}

y += 10;
line("AP Automatic Payment   BP Bill Payment   DC Direct Credit   DD Direct Debit", 7);
line("EP EFTPOS Transaction  VT Visa Transaction   Page 2 of 3", 7);

const pdfPath = join(root, "public/sample-anz-go.pdf");
const fixPath = join(root, "scripts/fixtures/statements/anz-go.pdf");
mkdirSync(join(root, "scripts/fixtures/statements"), { recursive: true });
const buf = Buffer.from(doc.output("arraybuffer"));
writeFileSync(pdfPath, buf);
writeFileSync(fixPath, buf);
console.log(`wrote ${pdfPath} (${buf.length} bytes)`);

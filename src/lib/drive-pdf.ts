import type { jsPDF } from "jspdf";
import { plainMoney } from "./format";
import type { DriveLine } from "./rideshare";

function lastY(doc: jsPDF) {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;
}

async function docShell(title: string, subtitle: string, name: string) {
  const [{ default: jsPDFCtor }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDFCtor({ unit: "pt", format: "a4" });
  const ink: [number, number, number] = [22, 22, 22];
  const muted: [number, number, number] = [109, 109, 104];
  doc.setFillColor(22, 22, 22);
  doc.rect(0, 0, 595, 78, "F");
  doc.setTextColor(246, 246, 244);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Drive", 48, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(title, 48, 54);
  doc.text(subtitle, 547, 34, { align: "right" });
  doc.text(name, 547, 54, { align: "right" });
  return { doc, autoTable: autoTableMod.default, ink, muted };
}

function moneyRow(amount: number) {
  return plainMoney(amount);
}

export async function downloadDriveProfitAndLoss(opts: {
  name: string;
  period: string;
  incomeLines: DriveLine[];
  expenseLines: DriveLine[];
  income: number;
  fees: number;
  gross: number;
  deduction: number;
  net: number;
  methodNote: string;
}) {
  const { doc, autoTable, ink, muted } = await docShell("Statement of profit or loss", opts.period, opts.name);
  const body = [
    ...opts.incomeLines.map((line) => [line.label, "", moneyRow(line.amount)]),
    ["Total income", "", moneyRow(opts.income)],
    ["Platform fees", "", moneyRow(opts.fees)],
    ["Gross surplus", "", moneyRow(opts.gross)],
    ...opts.expenseLines.filter((line) => line.label !== "Platform fees").map((line) => [line.label, line.hint ?? "", moneyRow(line.amount)]),
    ["Total deduction", "", moneyRow(opts.deduction)],
    ["Net surplus", "", moneyRow(opts.net)],
  ];
  autoTable(doc, {
    startY: 104,
    head: [["", "Note", "NZD"]],
    body,
    margin: { left: 48, right: 48 },
    styles: { fontSize: 9, textColor: ink, cellPadding: 6 },
    headStyles: { fillColor: [22, 22, 22], textColor: [246, 246, 244] },
    columnStyles: { 2: { halign: "right" } },
    theme: "plain",
  });
  const y = lastY(doc) + 28;
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(opts.methodNote, 48, y, { maxWidth: 500 });
  doc.text("Prepared from the Cove ledger. This is not an IR3 and not tax advice.", 48, 820);
  doc.save("drive-profit-and-loss.pdf");
}

export async function downloadDriveBalanceSheet(opts: {
  name: string;
  asAt: string;
  equity: number;
  methodNote: string;
}) {
  const { doc, autoTable, ink, muted } = await docShell("Statement of financial position", `As at ${opts.asAt}`, opts.name);
  const asset = opts.equity > 0 ? opts.equity : 0;
  const liability = opts.equity < 0 ? Math.abs(opts.equity) : 0;
  autoTable(doc, {
    startY: 104,
    head: [["", "NZD"]],
    body: [
      ["Assets", ""],
      ["Surplus of driving held in the household books", moneyRow(asset)],
      ["Total assets", moneyRow(asset)],
      ["Liabilities", ""],
      ["Shortfall owed back to the household", moneyRow(liability)],
      ["Total liabilities", moneyRow(liability)],
      ["Equity", ""],
      ["Owner's equity — driving activity", moneyRow(opts.equity)],
      ["Total equity", moneyRow(opts.equity)],
    ],
    margin: { left: 48, right: 48 },
    styles: { fontSize: 9, textColor: ink, cellPadding: 6 },
    headStyles: { fillColor: [22, 22, 22], textColor: [246, 246, 244] },
    columnStyles: { 1: { halign: "right" } },
    theme: "plain",
  });
  const y = lastY(doc) + 28;
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  const note =
    "Drive does not keep a separate bank account. Assets equal liabilities plus equity for the driving activity only. " +
    opts.methodNote;
  doc.text(note, 48, y, { maxWidth: 500 });
  doc.text("Prepared from the Cove ledger. This is not an IR3 and not tax advice.", 48, 820);
  doc.save("drive-balance-sheet.pdf");
}

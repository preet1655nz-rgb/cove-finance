import type { jsPDF } from "jspdf";
import { getCategory } from "./categories";
import { formatMonth, money } from "./format";
import { monthlySeries, spentInCategory } from "./period";
import type { Budget, Transaction } from "./types";
import { endOfMonth, inRange, startOfMonth } from "./utils";

function lastY(doc: jsPDF) {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 192;
}

export async function downloadMonthlyPdf(opts: {
  month: string;
  transactions: Transaction[];
  budgets: Budget[];
  currency: string;
  name: string;
}) {
  const [{ default: jsPDFCtor }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableMod.default;
  const { month, transactions, budgets, currency, name } = opts;
  const from = startOfMonth(`${month}-01`);
  const to = endOfMonth(from);
  const slice = transactions
    .filter((t) => inRange(t.date, from, to))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const income = slice.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = slice.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = income - expense;

  const byCat = new Map<string, number>();
  for (const t of slice.filter((t) => t.type === "expense")) {
    byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
  }
  const catRows = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, amt]) => [getCategory(id).name, money(amt, currency), `${Math.round((amt / (expense || 1)) * 100)}%`]);

  const doc = new jsPDFCtor({ unit: "pt", format: "a4" });
  const ink: [number, number, number] = [28, 27, 24];
  const muted: [number, number, number] = [111, 108, 100];
  const rule: [number, number, number] = [226, 222, 213];

  doc.setFillColor(243, 241, 236);
  doc.rect(0, 0, 595, 92, "F");
  doc.setTextColor(...ink);
  doc.setFont("times", "italic");
  doc.setFontSize(22);
  doc.text("Cove", 48, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text("Monthly statement", 48, 64);
  doc.setTextColor(...ink);
  doc.setFontSize(12);
  doc.text(formatMonth(from), 547, 44, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(`Prepared for ${name}`, 547, 64, { align: "right" });

  const cards = [
    { label: "Income", value: money(income, currency) },
    { label: "Spending", value: money(expense, currency) },
    { label: "Net", value: money(net, currency) },
    { label: "Transactions", value: String(slice.length) },
  ];
  cards.forEach((c, i) => {
    const x = 48 + i * 125;
    doc.setDrawColor(...rule);
    doc.roundedRect(x, 112, 116, 58, 6, 6);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(c.label.toUpperCase(), x + 12, 132);
    doc.setFontSize(12);
    doc.setTextColor(...ink);
    doc.text(c.value, x + 12, 154);
  });

  autoTable(doc, {
    startY: 192,
    head: [["Category", "Spent", "Share"]],
    body: catRows.length ? catRows : [["—", money(0, currency), "0%"]],
    margin: { left: 48, right: 48 },
    styles: { fontSize: 9, textColor: ink, cellPadding: 6 },
    headStyles: { fillColor: [28, 27, 24], textColor: [243, 241, 236], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [251, 249, 245] },
    theme: "plain",
  });

  const budgetRows = budgets.map((b) => {
    const spent = spentInCategory(transactions, b.categoryId, from, to);
    return [
      getCategory(b.categoryId).name,
      money(b.amount, currency),
      money(spent, currency),
      `${Math.round((spent / (b.amount || 1)) * 100)}%`,
    ];
  });

  const afterCat = lastY(doc);

  if (budgetRows.length) {
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.text("Budgets", 48, afterCat + 28);
    autoTable(doc, {
      startY: afterCat + 38,
      head: [["Category", "Budget", "Spent", "Used"]],
      body: budgetRows,
      margin: { left: 48, right: 48 },
      styles: { fontSize: 9, textColor: ink, cellPadding: 6 },
      headStyles: { fillColor: [28, 27, 24], textColor: [243, 241, 236], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [251, 249, 245] },
      theme: "plain",
    });
  }

  const afterBudget = lastY(doc);

  const txRows = slice.map((t) => [
    t.date,
    getCategory(t.categoryId).name,
    t.note || "—",
    (t.type === "income" ? "+" : "−") + money(t.amount, currency),
  ]);

  doc.setFontSize(11);
  doc.setTextColor(...ink);
  doc.text("Activity", 48, afterBudget + 28);
  autoTable(doc, {
    startY: afterBudget + 38,
    head: [["Date", "Category", "Note", "Amount"]],
    body: txRows.length ? txRows : [["—", "—", "No activity", "—"]],
    margin: { left: 48, right: 48 },
    styles: { fontSize: 8, textColor: ink, cellPadding: 5 },
    headStyles: { fillColor: [28, 27, 24], textColor: [243, 241, 236], fontStyle: "bold" },
    columnStyles: { 3: { halign: "right" } },
    alternateRowStyles: { fillColor: [251, 249, 245] },
    theme: "plain",
  });

  const series = monthlySeries(transactions, 6);
  const footer = series.map((s) => `${s.key.slice(5)}  ${money(s.net, currency)}`).join("    ");
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...rule);
    doc.line(48, 812, 547, 812);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("Cove  ·  Private statement  ·  Figures stay on this device", 48, 826);
    doc.text(`${i} / ${pages}`, 547, 826, { align: "right" });
    if (i === pages) doc.text(footer, 48, 800);
  }

  doc.save(`cove-${month}.pdf`);
}

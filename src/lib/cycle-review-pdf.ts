import { money, signedMoney } from "./format";
import type { CycleReview } from "./cycle-review";

function wrap(doc: import("jspdf").jsPDF, text: string, x: number, y: number, max = 500, size = 10) {
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(text, max) as string[];
  doc.text(lines, x, y);
  return y + lines.length * (size + 4);
}

export async function downloadCycleReviewPdf(review: CycleReview) {
  const { default: jsPDFCtor } = await import("jspdf");
  const doc = new jsPDFCtor({ unit: "pt", format: "a4" });
  const r = review;
  const W = 595;
  const ink: [number, number, number] = [28, 27, 24];
  const paper: [number, number, number] = [251, 247, 241];
  const cream: [number, number, number] = [243, 241, 236];
  const teal: [number, number, number] = [46, 125, 107];
  const rust: [number, number, number] = [176, 74, 58];
  const gold: [number, number, number] = [196, 149, 74];
  const slate: [number, number, number] = [70, 90, 110];
  const muted: [number, number, number] = [111, 108, 100];

  doc.setFillColor(...cream);
  doc.rect(0, 0, W, 842, "F");
  doc.setFillColor(...ink);
  doc.rect(0, 0, W, 108, "F");
  doc.setTextColor(246, 244, 239);
  doc.setFont("times", "italic");
  doc.setFontSize(26);
  doc.text("Cove", 40, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Pay-cycle review", 40, 66);
  doc.setFontSize(10);
  doc.text(r.scoreLine, 40, 88);
  doc.text(`${r.currency} · no account numbers`, 555, 44, { align: "right" });

  const cards = [
    { label: "Income", value: money(r.income, r.currency, true), color: teal },
    { label: "Living", value: money(r.living, r.currency, true), color: rust },
    { label: "Debt", value: money(r.debt, r.currency, true), color: slate },
    { label: "Saved+", value: money(r.savings + r.investing, r.currency, true), color: gold },
    { label: "Left", value: signedMoney(r.left, r.currency), color: r.left >= 0 ? teal : rust },
  ];
  cards.forEach((c, i) => {
    const x = 28 + i * 108;
    doc.setFillColor(...paper);
    doc.roundedRect(x, 124, 100, 64, 8, 8, "F");
    doc.setFillColor(...c.color);
    doc.rect(x, 124, 6, 64, "F");
    doc.setTextColor(...muted);
    doc.setFontSize(8);
    doc.text(c.label.toUpperCase(), x + 14, 142);
    doc.setTextColor(...ink);
    doc.setFontSize(11);
    doc.text(c.value, x + 14, 166);
  });

  doc.setFontSize(12);
  doc.setTextColor(...ink);
  doc.text("50 / 30 / 20 board", 40, 216);
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text("Needs · Wants · Save & invest  (Elizabeth Warren split, used as a yardstick only)", 40, 232);

  const board = [
    { label: `Needs ${r.needPct}%`, target: 50, actual: r.needPct, color: rust },
    { label: `Wants ${r.wantPct}%`, target: 30, actual: r.wantPct, color: gold },
    { label: `Save ${r.savePct}%`, target: 20, actual: r.savePct, color: teal },
  ];
  board.forEach((b, i) => {
    const y = 248 + i * 28;
    doc.setTextColor(...ink);
    doc.setFontSize(9);
    doc.text(b.label, 40, y + 8);
    doc.setFillColor(226, 222, 213);
    doc.roundedRect(140, y, 360, 12, 3, 3, "F");
    const w = Math.min(360, Math.max(8, (b.actual / 80) * 360));
    doc.setFillColor(...b.color);
    doc.roundedRect(140, y, w, 12, 3, 3, "F");
    doc.setTextColor(...muted);
    doc.text(`target ${b.target}%`, 510, y + 9);
  });

  doc.setTextColor(...ink);
  doc.setFontSize(12);
  doc.text("Living mix", 40, 348);
  const maxLive = Math.max(...r.topLiving.map((t) => t.amount), 1);
  r.topLiving.forEach((t, i) => {
    const y = 364 + i * 22;
    doc.setFontSize(9);
    doc.setTextColor(...ink);
    doc.text(t.name, 40, y + 8);
    doc.setFillColor(226, 222, 213);
    doc.roundedRect(150, y, 300, 10, 3, 3, "F");
    doc.setFillColor(70, 90, 110);
    doc.roundedRect(150, y, Math.max(6, (t.amount / maxLive) * 300), 10, 3, 3, "F");
    doc.setTextColor(...muted);
    doc.text(money(t.amount, r.currency, true), 460, y + 8);
  });
  if (!r.topLiving.length) {
    doc.setTextColor(...muted);
    doc.setFontSize(10);
    doc.text("No living spend in this cycle.", 40, 372);
  }

  let y = 490;
  doc.setTextColor(...ink);
  doc.setFontSize(12);
  doc.text("What the cycle did", 40, y);
  y += 16;
  doc.setTextColor(60, 58, 54);
  for (const line of r.patterns) y = wrap(doc, `• ${line}`, 40, y, 515, 10);

  y += 10;
  doc.setTextColor(...ink);
  doc.setFontSize(12);
  doc.text("Budget moves", 40, y);
  y += 16;
  doc.setTextColor(60, 58, 54);
  for (const line of r.suggestions) y = wrap(doc, `• ${line}`, 40, y, 515, 10);

  if (y > 740) {
    doc.addPage();
    doc.setFillColor(...cream);
    doc.rect(0, 0, W, 842, "F");
    y = 48;
  }

  y += 10;
  doc.setTextColor(...ink);
  doc.setFontSize(12);
  doc.text("Watch-outs", 40, y);
  y += 16;
  doc.setTextColor(...rust);
  for (const line of r.watchouts) y = wrap(doc, `• ${line}`, 40, y, 515, 10);

  if (r.budgetRows.length) {
    y += 14;
    doc.setTextColor(...ink);
    doc.setFontSize(12);
    doc.text("Envelopes this month", 40, y);
    y += 8;
    r.budgetRows.slice(0, 8).forEach((b) => {
      y += 16;
      const over = b.delta < 0;
      doc.setFontSize(9);
      doc.setTextColor(...ink);
      doc.text(`${b.name}  ${money(b.spent, r.currency, true)} / ${money(b.budget, r.currency, true)}`, 40, y);
      doc.setTextColor(...(over ? rust : teal));
      doc.text(over ? "over" : "under", 420, y);
    });
  }

  doc.setTextColor(...muted);
  doc.setFontSize(8);
  doc.text("Cove · figures only · names and account numbers are not included", 40, 820);

  const slug = r.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cycle";
  doc.save(`cove-cycle-${slug}.pdf`);
}

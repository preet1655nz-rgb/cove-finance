import { money } from "./format";
import type { InsightsBrief } from "./insights-brief";

function wrap(doc: { splitTextToSize: (t: string, w: number) => string[] }, text: string, width: number) {
  return doc.splitTextToSize(text, width) as string[];
}

export async function downloadCycleInsightsPdf(brief: InsightsBrief) {
  const { default: jsPDFCtor } = await import("jspdf");
  const doc = new jsPDFCtor({ unit: "pt", format: "a4" });
  const pageW = 595;
  const pageH = 842;
  const ink: [number, number, number] = [28, 27, 24];
  const cream: [number, number, number] = [243, 241, 236];
  const card: [number, number, number] = [251, 249, 245];
  const muted: [number, number, number] = [111, 108, 100];
  const green: [number, number, number] = [58, 90, 72];
  const rust: [number, number, number] = [138, 67, 54];
  const slate: [number, number, number] = [92, 107, 115];
  const moss: [number, number, number] = [107, 124, 110];
  const clay: [number, number, number] = [122, 107, 92];
  const colors = [green, rust, slate, moss, clay];

  doc.setFillColor(...cream);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(...ink);
  doc.rect(0, 0, pageW, 118, "F");
  doc.setTextColor(246, 244, 239);
  doc.setFont("times", "italic");
  doc.setFontSize(26);
  doc.text("Cove", 40, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Pay-cycle insight report", 40, 70);
  doc.setFontSize(10);
  doc.text(brief.label, 40, 90);
  doc.text(`${brief.from}  →  ${brief.to}`, pageW - 40, 90, { align: "right" });

  const tiles = [
    { label: "Income", value: money(brief.income, brief.currency, true), color: green },
    { label: "Living", value: money(brief.living, brief.currency, true), color: rust },
    { label: "Debt", value: money(brief.debt, brief.currency, true), color: clay },
    { label: "Savings", value: money(brief.savings, brief.currency, true), color: moss },
    { label: "Investing", value: money(brief.investing, brief.currency, true), color: slate },
  ];
  tiles.forEach((t, i) => {
    const x = 40 + i * 103;
    doc.setFillColor(...card);
    doc.roundedRect(x, 140, 96, 72, 8, 8, "F");
    doc.setFillColor(...t.color);
    doc.rect(x, 140, 6, 72, "F");
    doc.setTextColor(...muted);
    doc.setFontSize(8);
    doc.text(t.label.toUpperCase(), x + 14, 158);
    doc.setTextColor(...ink);
    doc.setFontSize(12);
    doc.text(t.value, x + 14, 180);
  });

  doc.setFillColor(...card);
  doc.roundedRect(40, 230, 515, 70, 8, 8, "F");
  doc.setTextColor(...muted);
  doc.setFontSize(8);
  doc.text("LEFT AFTER THE SPLIT", 56, 252);
  doc.setTextColor(...(brief.left >= 0 ? green : rust));
  doc.setFontSize(20);
  doc.text(money(brief.left, brief.currency, true), 56, 280);
  doc.setTextColor(...muted);
  doc.setFontSize(10);
  doc.text(`${brief.leftPct}% of income`, 240, 278);

  const mix = [
    { label: "Living", value: brief.livingPct, color: rust },
    { label: "Debt", value: brief.debtPct, color: clay },
    { label: "Savings", value: brief.savingsPct, color: moss },
    { label: "Investing", value: brief.investingPct, color: slate },
    { label: "Left", value: Math.max(0, brief.leftPct), color: green },
  ];
  doc.setTextColor(...ink);
  doc.setFontSize(12);
  doc.text("Where the pay went", 40, 334);
  let x = 40;
  mix.forEach((m) => {
    const w = Math.max(8, (515 * Math.max(0, m.value)) / 100);
    doc.setFillColor(...m.color);
    doc.roundedRect(x, 348, Math.max(4, w - 3), 18, 3, 3, "F");
    x += w;
  });
  let lx = 40;
  mix.forEach((m) => {
    doc.setFillColor(...m.color);
    doc.circle(lx + 5, 386, 4, "F");
    doc.setTextColor(...muted);
    doc.setFontSize(8);
    doc.text(`${m.label} ${m.value}%`, lx + 14, 389);
    lx += 105;
  });

  doc.setTextColor(...ink);
  doc.setFontSize(12);
  doc.text("Top living categories", 40, 420);
  const maxCat = Math.max(1, ...brief.topLiving.map((c) => c.amount));
  brief.topLiving.forEach((c, i) => {
    const y = 438 + i * 36;
    doc.setTextColor(...ink);
    doc.setFontSize(10);
    doc.text(c.name, 40, y);
    doc.setTextColor(...muted);
    doc.text(money(c.amount, brief.currency, true), 555, y, { align: "right" });
    doc.setFillColor(226, 222, 213);
    doc.roundedRect(40, y + 6, 515, 8, 4, 4, "F");
    doc.setFillColor(...colors[i % colors.length]);
    doc.roundedRect(40, y + 6, Math.max(8, (515 * c.amount) / maxCat), 8, 4, 4, "F");
  });

  doc.addPage();
  doc.setFillColor(...cream);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(...ink);
  doc.rect(0, 0, pageW, 72, "F");
  doc.setTextColor(246, 244, 239);
  doc.setFont("times", "italic");
  doc.setFontSize(20);
  doc.text("How this cycle went", 40, 44);

  const blocks: { title: string; lines: string[]; tint: [number, number, number] }[] = [
    { title: "Patterns", lines: brief.patterns, tint: slate },
    { title: "How we did", lines: brief.howWeDid, tint: green },
    { title: "Look out for", lines: brief.watchouts, tint: rust },
    { title: "Budget next cycle", lines: brief.suggestions, tint: moss },
  ];

  let y = 96;
  for (const block of blocks) {
    const body = block.lines.flatMap((line) => wrap(doc, `•  ${line}`, 470));
    const h = 36 + body.length * 14;
    doc.setFillColor(...card);
    doc.roundedRect(40, y, 515, h, 10, 10, "F");
    doc.setFillColor(...block.tint);
    doc.rect(40, y, 7, h, "F");
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(block.title, 60, y + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    body.forEach((line, i) => {
      doc.text(line, 60, y + 42 + i * 14);
    });
    y += h + 16;
    if (y > 760) break;
  }

  if (brief.budgetLines.length) {
    if (y > 620) {
      doc.addPage();
      doc.setFillColor(...cream);
      doc.rect(0, 0, pageW, pageH, "F");
      y = 48;
    }
    doc.setTextColor(...ink);
    doc.setFontSize(12);
    doc.text("Budgets this window", 40, y);
    y += 16;
    brief.budgetLines.slice(0, 8).forEach((b) => {
      doc.setFillColor(...card);
      doc.roundedRect(40, y, 515, 28, 6, 6, "F");
      doc.setFontSize(10);
      doc.setTextColor(...ink);
      doc.text(b.name, 54, y + 18);
      const label = `${money(b.spent, brief.currency, true)} / ${money(b.budget, brief.currency, true)} · ${b.status}`;
      doc.setTextColor(...(b.status === "over" ? rust : b.status === "under" ? green : muted));
      doc.text(label, 555, y + 18, { align: "right" });
      y += 34;
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text("Cove · numbers only · no account numbers · generated from this pay cycle", 40, 812);

  const stamp = brief.from.replaceAll("-", "");
  doc.save(`cove-cycle-${stamp}.pdf`);
}

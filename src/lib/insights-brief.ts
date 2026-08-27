import { getCategory } from "./categories";
import { money } from "./format";
import { isTransferTx, livingTxs } from "./intelligence";
import { cashBuckets } from "./period";
import type { Budget, Transaction } from "./types";

export type InsightsBrief = {
  label: string;
  from: string;
  to: string;
  currency: string;
  income: number;
  living: number;
  debt: number;
  savings: number;
  investing: number;
  left: number;
  livingPct: number;
  debtPct: number;
  savingsPct: number;
  investingPct: number;
  leftPct: number;
  topLiving: { name: string; amount: number }[];
  budgetLines: { name: string; spent: number; budget: number; status: "over" | "under" | "on" }[];
  patterns: string[];
  howWeDid: string[];
  watchouts: string[];
  suggestions: string[];
  grokText: string;
};

function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function fmtPct(part: number, whole: number) {
  if (!whole) return "—";
  return `${pct(part, whole)}%`;
}

export function buildInsightsBrief(opts: {
  txs: Transaction[];
  allTxs: Transaction[];
  budgets: Budget[];
  currency: string;
  label: string;
  from: string;
  to: string;
  prev?: Transaction[];
}): InsightsBrief {
  const { txs, budgets, currency, label, from, to, prev } = opts;
  const buckets = cashBuckets(txs);
  const debt = buckets.debt + buckets.credit;
  const left = buckets.variance;
  const lived = livingTxs(txs.filter((t) => t.type === "expense" && !isTransferTx(t)));
  const byCat = new Map<string, number>();
  for (const t of lived) {
    const id = t.categoryId === "credit-card" ? "debt" : t.categoryId;
    byCat.set(id, (byCat.get(id) ?? 0) + t.amount);
  }
  const topCats = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, amount]) => ({ name: getCategory(id).name.toLowerCase(), amount }));

  const budgetLines = budgets.map((b) => {
    const spent = opts.allTxs
      .filter((t) => t.categoryId === b.categoryId && t.date >= from && t.date <= to && t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    const status: "over" | "under" | "on" = spent > b.amount * 1.03 ? "over" : spent < b.amount * 0.85 ? "under" : "on";
    return { name: getCategory(b.categoryId).name.toLowerCase(), spent, budget: b.amount, status };
  });

  const patterns: string[] = [];
  const howWeDid: string[] = [];
  const watchouts: string[] = [];
  const suggestions: string[] = [];

  const livingPct = pct(buckets.expense, buckets.income);
  const savePct = pct(buckets.savings + buckets.investing, buckets.income);
  const debtPct = pct(debt, buckets.income);

  if (buckets.income > 0) {
    patterns.push(`Savings-plus-investing rate is ${savePct}% of income (a common target is 20%+).`);
    patterns.push(`Living spend is ${livingPct}% of income (a common ceiling for needs is about 50%).`);
    if (debtPct) patterns.push(`Debt and card payments took ${debtPct}% of income this period.`);
  } else {
    patterns.push("No income landed in this window, so ratios are not meaningful yet.");
  }

  const housing = byCat.get("housing") ?? 0;
  if (buckets.income && housing) {
    const hp = pct(housing, buckets.income);
    patterns.push(`Housing is ${hp}% of income (research often flags stress above ~30%).`);
    if (hp > 30) watchouts.push(`Housing is high at ${hp}% of pay. Look at rent, rates, or board before cutting groceries.`);
  }

  if (topCats[0]) {
    patterns.push(`Biggest living slice is ${topCats[0].name} at ${money(topCats[0].amount, currency, true)}.`);
  }

  if (prev && prev.length) {
    const pb = cashBuckets(prev);
    const livingDelta = buckets.expense - pb.expense;
    const incomeDelta = buckets.income - pb.income;
    if (incomeDelta) {
      patterns.push(
        `Income ${incomeDelta > 0 ? "rose" : "fell"} ${money(Math.abs(incomeDelta), currency, true)} versus the previous cycle.`,
      );
    }
    if (livingDelta) {
      patterns.push(
        `Living ${livingDelta > 0 ? "rose" : "fell"} ${money(Math.abs(livingDelta), currency, true)} versus the previous cycle.`,
      );
    }
    if (livingDelta > 0 && incomeDelta <= 0) {
      watchouts.push("Living went up while pay did not. That is lifestyle creep on a short cycle.");
    }
  }

  if (left >= 0) howWeDid.push(`This window kept ${money(left, currency, true)} after living, debt, savings and investing.`);
  else howWeDid.push(`This window ran ${money(Math.abs(left), currency, true)} short after living, debt, savings and investing.`);

  if (livingPct <= 50 && savePct >= 15) howWeDid.push("Allocation looks healthy against 50/30/20-style rules of thumb.");
  else if (livingPct > 65) howWeDid.push("Living is eating most of the pay. The cycle is tight before bills even hit.");
  else howWeDid.push("The mix is workable, but savings or debt room is thinner than a 20% target.");

  const overs = budgetLines.filter((b) => b.status === "over");
  const unders = budgetLines.filter((b) => b.status === "under");
  if (overs.length) howWeDid.push(`Over budget: ${overs.map((b) => b.name).join(", ")}.`);
  if (unders.length) howWeDid.push(`Under budget: ${unders.map((b) => b.name).join(", ")}.`);

  if (debtPct > 20) watchouts.push("Debt service is above 20% of income. That leaves little shock-absorber.");
  if (!buckets.savings && buckets.income) watchouts.push("No savings tagged this period. The next odd bill has to come from living.");
  if (left < 0) watchouts.push("Leftover is negative. The next pay cycle starts behind.");
  if (!watchouts.length) watchouts.push("No hard red flags in the ratios. Keep the same split and watch one category.");

  if (overs[0]) {
    const gap = overs[0].spent - overs[0].budget;
    suggestions.push(`Trim ${overs[0].name} by about ${money(gap, currency, true)} to land on the cap.`);
  }
  if (livingPct > 50 && topCats[1]) {
    suggestions.push(`After housing, the next lever is ${topCats[1].name}. Cap it next cycle and leave rent alone.`);
  }
  if (savePct < 20 && left > 0) {
    suggestions.push(`Move ${money(Math.min(left * 0.4, buckets.income * 0.05), currency, true)} of leftover into savings on payday.`);
  }
  if (debt && left > 0) {
    suggestions.push("Pay the highest-interest card first with any leftover (avalanche). Keep minimums on the rest.");
  }
  if (!suggestions.length) {
    suggestions.push("Hold the current split for one more cycle. Change one category only if it blows the cap.");
  }

  const livingLine = topCats.map((c) => `${c.name} ${Math.round(c.amount)}`).join(", ");
  const budgetText = budgetLines
    .slice(0, 6)
    .map((b) => `${b.name} ${Math.round(b.budget)} (${b.status})`)
    .join(", ");

  const grokText = [
    `${currency}, ${label}`,
    `Income ${Math.round(buckets.income)}`,
    `Living ${Math.round(buckets.expense)} (${fmtPct(buckets.expense, buckets.income)})`,
    `Debt ${Math.round(debt)} (${fmtPct(debt, buckets.income)})`,
    `Savings ${Math.round(buckets.savings)} (${fmtPct(buckets.savings, buckets.income)})`,
    `Investing ${Math.round(buckets.investing)} (${fmtPct(buckets.investing, buckets.income)})`,
    `Left ${Math.round(left)}`,
    livingLine ? `Top living: ${livingLine}` : "Top living: —",
    budgetText ? `Budgets: ${budgetText}` : "Budgets: none set",
  ].join("\n");

  return {
    label,
    from,
    to,
    currency,
    income: buckets.income,
    living: buckets.expense,
    debt,
    savings: buckets.savings,
    investing: buckets.investing,
    left,
    livingPct,
    debtPct,
    savingsPct: pct(buckets.savings, buckets.income),
    investingPct: pct(buckets.investing, buckets.income),
    leftPct: pct(left, buckets.income),
    topLiving: topCats,
    budgetLines,
    patterns,
    howWeDid,
    watchouts,
    suggestions,
    grokText,
  };
}

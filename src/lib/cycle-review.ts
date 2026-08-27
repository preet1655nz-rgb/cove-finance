import { getCategory } from "./categories";
import { money } from "./format";
import { isTransferTx, livingTxs, payeeBreakdown } from "./intelligence";
import { cashBuckets } from "./period";
import type { Budget, Transaction } from "./types";
import { addDays, inRange } from "./utils";

const NEED_IDS = new Set(["housing", "groceries", "transport", "utilities", "health", "insurance", "tax", "household", "education"]);
const WANT_IDS = new Set(["dining", "entertainment", "shopping", "drinks", "travel", "subscriptions"]);

export type CycleReview = {
  label: string;
  from: string;
  to: string;
  days: number;
  currency: string;
  income: number;
  living: number;
  debt: number;
  savings: number;
  investing: number;
  left: number;
  moved: number;
  saveRate: number;
  needAmt: number;
  wantAmt: number;
  needPct: number;
  wantPct: number;
  savePct: number;
  topLiving: { name: string; amount: number }[];
  budgetRows: { name: string; spent: number; budget: number; delta: number }[];
  patterns: string[];
  suggestions: string[];
  watchouts: string[];
  scoreLine: string;
};

function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

export function buildCycleReview(opts: {
  txs: Transaction[];
  budgets: Budget[];
  currency: string;
  from: string;
  to: string;
  label: string;
}): CycleReview {
  const { txs, budgets, currency, from, to, label } = opts;
  const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
  const slice = txs.filter((t) => inRange(t.date, from, to));
  const lived = livingTxs(slice);
  const buckets = cashBuckets(slice);
  const debt = buckets.debt + buckets.credit;
  const left = buckets.variance;
  const moved = slice.filter((t) => t.type === "expense" && isTransferTx(t)).reduce((s, t) => s + t.amount, 0);

  let needAmt = 0;
  let wantAmt = 0;
  const livingMap = new Map<string, number>();
  for (const t of lived.filter((t) => t.type === "expense")) {
    livingMap.set(t.categoryId, (livingMap.get(t.categoryId) ?? 0) + t.amount);
    if (NEED_IDS.has(t.categoryId)) needAmt += t.amount;
    else if (WANT_IDS.has(t.categoryId)) wantAmt += t.amount;
    else needAmt += t.amount;
  }

  const topLiving = [...livingMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, amount]) => ({ name: getCategory(id).name, amount }));

  const today = to;
  const monthStart = `${today.slice(0, 8)}01`;
  const budgetRows = budgets.map((b) => {
    const spent = txs
      .filter((t) => t.categoryId === b.categoryId && t.type === "expense" && t.date >= monthStart && t.date <= to)
      .reduce((s, t) => s + t.amount, 0);
    return {
      name: getCategory(b.categoryId).name,
      spent,
      budget: b.amount,
      delta: b.amount - spent,
    };
  });

  const prevTo = addDays(from, -1);
  const prevFrom = addDays(from, -days);
  const prev = cashBuckets(txs.filter((t) => inRange(t.date, prevFrom, prevTo)));
  const livingDelta = buckets.expense - prev.expense;
  const incomeDelta = buckets.income - prev.income;

  const needPct = pct(needAmt, buckets.income);
  const wantPct = pct(wantAmt, buckets.income);
  const savePct = pct(buckets.savings + buckets.investing, buckets.income);
  const saveRate = buckets.income ? (buckets.savings + buckets.investing) / buckets.income : 0;

  const patterns: string[] = [];
  if (buckets.income && incomeDelta) {
    patterns.push(`Income ${incomeDelta > 0 ? "rose" : "fell"} ${money(Math.abs(incomeDelta), currency)} versus the previous ${days}-day window.`);
  }
  if (buckets.expense && livingDelta) {
    patterns.push(`Living spend ${livingDelta > 0 ? "rose" : "fell"} ${money(Math.abs(livingDelta), currency)} versus the last cycle.`);
  }
  if (topLiving[0] && buckets.expense) {
    const share = pct(topLiving[0].amount, buckets.expense);
    if (share >= 35) patterns.push(`${topLiving[0].name} is ${share}% of living spend — a concentrated envelope.`);
  }
  const payees = payeeBreakdown(lived.filter((t) => t.type === "expense")).slice(0, 3);
  if (payees[0]) patterns.push(`Largest named living payee: ${payees[0].name} at ${money(payees[0].amount, currency)}.`);
  if (debt && buckets.income) patterns.push(`Debt and card payments took ${pct(debt, buckets.income)}% of income this cycle.`);
  if (!patterns.length) patterns.push("Not enough history in this window yet to compare cycles. Import another statement or wait one cycle.");

  const suggestions: string[] = [];
  if (needPct > 55) suggestions.push(`Needs are ${needPct}% of income (50/30/20 target is ~50%). Hold housing, groceries and transport before cutting savings.`);
  else suggestions.push(`Needs are ${needPct}% of income — inside a 50/30/20 “needs” band.`);
  if (wantPct > 30) suggestions.push(`Wants are ${wantPct}% of income (target ~30%). Trim dining, leisure or shopping first — envelope those three.`);
  if (savePct < 20 && buckets.income) {
    const gap = Math.max(0, buckets.income * 0.2 - (buckets.savings + buckets.investing));
    suggestions.push(`Pay-yourself-first is ${savePct}% (aim 20%+). Move ${money(gap, currency)} to savings on payday before living spend starts.`);
  } else if (buckets.income) {
    suggestions.push(`Savings plus investing are ${savePct}% of income. Keep that automatic.`);
  }
  const over = budgetRows.filter((row) => row.budget > 0 && row.spent > row.budget);
  if (over[0]) suggestions.push(`${over[0].name} is over envelope by ${money(over[0].spent - over[0].budget, currency)}. Freeze that category until the next cycle.`);
  if (!suggestions.length) suggestions.push("Set two or three category envelopes next cycle so variance has a target, not just a leftover.");

  const watchouts: string[] = [];
  if (left < 0) watchouts.push(`This cycle ran ${money(Math.abs(left), currency)} negative after living, debt, savings and investing.`);
  if (moved) watchouts.push(`${money(moved, currency)} moved between accounts — ignored as spending.`);
  if (buckets.expense / days > (buckets.income || 1) / days) watchouts.push("Daily living is outrunning daily income in this window.");
  const other = livingMap.get("other") ?? 0;
  if (other && buckets.expense && other / buckets.expense > 0.15) {
    watchouts.push(`${money(other, currency)} sits in Other. Retag those rows so the next cycle report is cleaner.`);
  }
  if (!watchouts.length) watchouts.push("No red flags in this window. Keep the same pay-cycle habit and review again next cycle.");

  const grade =
    left >= 0 && savePct >= 15 && needPct <= 55 ? "Solid cycle" : left < 0 ? "Tight cycle" : "Mixed cycle";

  return {
    label,
    from,
    to,
    days,
    currency,
    income: buckets.income,
    living: buckets.expense,
    debt,
    savings: buckets.savings,
    investing: buckets.investing,
    left,
    moved,
    saveRate,
    needAmt,
    wantAmt,
    needPct,
    wantPct,
    savePct,
    topLiving,
    budgetRows,
    patterns,
    suggestions,
    watchouts,
    scoreLine: `${grade} · ${label} · ${from} → ${to}`,
  };
}

export function formatGrokCopy(r: CycleReview) {
  const p = (n: number, whole: number) => (whole ? `${pct(n, whole)}%` : "—");
  const top = r.topLiving.map((t) => `${t.name.toLowerCase()} ${Math.round(t.amount)}`).join(", ");
  const budgets = r.budgetRows
    .slice(0, 6)
    .map((b) => `${b.name.toLowerCase()} ${Math.round(b.budget)} (${b.delta < 0 ? "over" : "under"})`)
    .join(", ");
  return [
    `${r.currency}, ${r.label.toLowerCase()}`,
    `Income ${Math.round(r.income)}`,
    `Living ${Math.round(r.living)} (${p(r.living, r.income)})`,
    `Debt ${Math.round(r.debt)} (${p(r.debt, r.income)})`,
    `Savings ${Math.round(r.savings)} (${p(r.savings, r.income)})`,
    `Investing ${Math.round(r.investing)} (${p(r.investing, r.income)})`,
    `Left ${Math.round(r.left)}`,
    top ? `Top living: ${top}` : "Top living: —",
    budgets ? `Budgets: ${budgets}` : "Budgets: none set",
  ].join("\n");
}

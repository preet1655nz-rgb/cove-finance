import { isAllocationCategory, isTransferCategory } from "./categories";
import { payCycleRange } from "./cycle";
import { isTransferTx } from "./intelligence";
import { isWashTx } from "./reversals";
import { addDays, addMonths, endOfMonth, endOfWeek, inRange, startOfMonth, startOfWeek, todayISO } from "./utils";
import type { Period, Transaction } from "./types";

export type DateSpan = { from?: string; to?: string } | null | undefined;

export function periodRange(period: Period, custom?: DateSpan): { from: string; to: string; label: string } {
  const today = todayISO();
  if (period === "custom") {
    const from = custom?.from || `${today.slice(0, 8)}01`;
    const to = custom?.to || today;
    return { from, to: to < from ? from : to, label: "Custom" };
  }
  if (period === "this-week") {
    return { from: startOfWeek(today), to: endOfWeek(today), label: "This week" };
  }
  if (period === "fortnight") {
    return { from: addDays(today, -13), to: today, label: "Last 14 days" };
  }
  if (period === "this-month") {
    return { from: startOfMonth(today), to: endOfMonth(today), label: "This month" };
  }
  if (period === "last-month") {
    const prev = addMonths(startOfMonth(today), -1);
    return { from: startOfMonth(prev), to: endOfMonth(prev), label: "Last month" };
  }
  if (period === "quarter") {
    return { from: addMonths(startOfMonth(today), -2), to: today, label: "Last 3 months" };
  }
  if (period === "year") {
    return { from: `${today.slice(0, 4)}-01-01`, to: today, label: "This year" };
  }
  return { from: "1970-01-01", to: today, label: "All time" };
}

export function activeRange(
  txs: Transaction[],
  period: Period,
  cycleMode: boolean,
  cycleOffset = 0,
  custom?: DateSpan,
) {
  if (cycleMode) return payCycleRange(txs, cycleOffset);
  return periodRange(period, custom);
}

export function inPeriod(tx: Transaction, period: Period, custom?: DateSpan) {
  const { from, to } = periodRange(period, custom);
  return inRange(tx.date, from, to);
}

export function cashBuckets(txs: Transaction[]) {
  let income = 0;
  let expense = 0;
  let investing = 0;
  let savings = 0;
  let credit = 0;
  let debt = 0;
  for (const t of txs) {
    if (isTransferTx(t) || isTransferCategory(t.categoryId) || isWashTx(t)) continue;
    if (t.type === "income") {
      income += t.amount;
      continue;
    }
    if (t.categoryId === "investing") investing += t.amount;
    else if (t.categoryId === "savings") savings += t.amount;
    else if (t.categoryId === "credit-card") credit += t.amount;
    else if (t.categoryId === "debt") debt += t.amount;
    else expense += t.amount;
  }
  const leftover = income - expense;
  const allocated = expense + investing + savings + credit + debt;
  const variance = income - allocated;
  const cash = leftover - investing - savings - credit - debt;
  return { income, expense, investing, savings, credit, debt, leftover, allocated, variance, cash };
}

export function sumBy(
  txs: Transaction[],
  type: Transaction["type"],
  period?: Period,
) {
  const list = period ? txs.filter((t) => inPeriod(t, period)) : txs;
  return cashBuckets(list)[type === "income" ? "income" : "expense"];
}

export function netOf(txs: Transaction[], period?: Period) {
  const list = period ? txs.filter((t) => inPeriod(t, period)) : txs;
  return cashBuckets(list).cash;
}

export function spentInCategory(
  txs: Transaction[],
  categoryId: string,
  from: string,
  to: string,
) {
  return txs
    .filter((t) => t.type === "expense" && t.categoryId === categoryId && inRange(t.date, from, to) && !isWashTx(t))
    .reduce((s, t) => s + t.amount, 0);
}

export function monthlySeries(txs: Transaction[], months = 6) {
  const today = todayISO();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    keys.push(addMonths(startOfMonth(today), -i).slice(0, 7));
  }
  return keys.map((key) => {
    const from = `${key}-01`;
    const to = endOfMonth(from);
    const slice = txs.filter((t) => inRange(t.date, from, to));
    const b = cashBuckets(slice);
    return { key, income: b.income, expense: b.expense, investing: b.investing, savings: b.savings, net: b.cash };
  });
}

export function isLivingExpenseTx(t: Transaction) {
  return t.type === "expense" && !isTransferTx(t) && !isWashTx(t) && !isAllocationCategory(t.categoryId);
}

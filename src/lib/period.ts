import { addMonths, endOfMonth, inRange, startOfMonth, todayISO } from "./utils";
import type { Period, Transaction } from "./types";

export function periodRange(period: Period): { from: string; to: string; label: string } {
  const today = todayISO();
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

export function inPeriod(tx: Transaction, period: Period) {
  const { from, to } = periodRange(period);
  return inRange(tx.date, from, to);
}

export function sumBy(
  txs: Transaction[],
  type: Transaction["type"],
  period?: Period,
) {
  const list = period ? txs.filter((t) => inPeriod(t, period)) : txs;
  return list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
}

export function netOf(txs: Transaction[], period?: Period) {
  return sumBy(txs, "income", period) - sumBy(txs, "expense", period);
}

export function spentInCategory(
  txs: Transaction[],
  categoryId: string,
  from: string,
  to: string,
) {
  return txs
    .filter((t) => t.type === "expense" && t.categoryId === categoryId && inRange(t.date, from, to))
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
    const income = slice.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = slice.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { key, income, expense, net: income - expense };
  });
}

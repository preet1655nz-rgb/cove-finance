import { isTransferCategory } from "./categories";
import { isTransferTx } from "./intelligence";
import { money } from "./format";
import type { Transaction } from "./types";
import { addDays, todayISO } from "./utils";

export function isSalaryTx(t: Transaction) {
  if (t.type !== "income") return false;
  if (t.categoryId === "salary") return true;
  return /wage\/salary|inland revenue.*wage|ird.*salary|\bsalary\b/i.test(t.note);
}

function gapDays(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export function detectPayCycle(txs: Transaction[]) {
  const dates = [...new Set(txs.filter(isSalaryTx).map((t) => t.date))].sort();
  const buckets = { 7: 0, 14: 0, 28: 0 };
  for (let i = 1; i < dates.length; i++) {
    const g = gapDays(dates[i - 1]!, dates[i]!);
    if (g >= 5 && g <= 9) buckets[7] += 1;
    else if (g >= 12 && g <= 18) buckets[14] += 1;
    else if (g >= 25 && g <= 35) buckets[28] += 1;
  }
  const scored = (Object.entries(buckets) as [string, number][]).sort((a, b) => b[1] - a[1]);
  const interval = (scored[0]![1] > 0 ? Number(scored[0]![0]) : 14) as 7 | 14 | 28;
  const kind = interval === 7 ? "weekly" : interval === 28 ? "monthly" : "fortnightly";
  return { dates, interval, kind, last: dates.at(-1) ?? null };
}

export function payCycleRange(txs: Transaction[], offset = 0, today = todayISO()) {
  const detected = detectPayCycle(txs);
  const { dates, interval, kind } = detected;
  const lastOnOrBefore = [...dates].reverse().find((d) => d <= today);
  let from = lastOnOrBefore ?? addDays(today, -(interval - 1));
  if (offset > 0) {
    from = addDays(from, -interval * offset);
    const snap = dates.filter((d) => d <= from).at(-1);
    if (snap) from = snap;
  }
  if (offset < 0) {
    from = addDays(from, -interval * offset);
  }
  const rawTo = addDays(from, interval - 1);
  const to = offset === 0 && rawTo > today ? today : rawTo;
  const nextPay = addDays(from, interval);
  const found = Boolean(lastOnOrBefore);
  const label = found
    ? offset === 0
      ? `This ${kind} pay · ${from.slice(8)}–${to.slice(8)} ${to.slice(5, 7)}`
      : `${kind[0]!.toUpperCase()}${kind.slice(1)} pay from ${from}`
    : `No salary found · last ${interval} days`;
  return { from, to, label, interval, kind, nextPay, lastPay: from, found };
}

export function explainNegativeCash(txs: Transaction[], currency = "NZD") {
  const ordered = [...txs]
    .filter((t) => !isTransferTx(t) && !isTransferCategory(t.categoryId))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let running = 0;
  let crossed: { date: string; before: number; after: number; day: Transaction[] } | null = null;
  const byDate = new Map<string, Transaction[]>();
  for (const t of ordered) {
    const list = byDate.get(t.date) ?? [];
    list.push(t);
    byDate.set(t.date, list);
  }
  for (const date of [...byDate.keys()].sort()) {
    const day = byDate.get(date)!;
    const before = running;
    for (const t of day) running += t.type === "income" ? t.amount : -t.amount;
    if (before >= 0 && running < 0 && !crossed) {
      crossed = { date, before, after: running, day };
    }
  }
  if (running >= 0) return { negative: false as const, running, message: null as string | null, date: null as string | null };
  if (!crossed) {
    return {
      negative: true as const,
      running,
      date: ordered[0]?.date ?? todayISO(),
      message: `Cash in this account is ${money(running, currency)} all time. Inflows have not covered living, investing, savings and card payments.`,
    };
  }
  const hits = crossed.day
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
  const names = hits.map((t) => `${t.note || t.categoryId} ${money(t.amount, currency)}`).join(", ");
  const message = `Cash went negative on ${crossed.date} (from ${money(crossed.before, currency)} to ${money(crossed.after, currency)})${names ? ` after ${names}` : ""}. Nothing was changed — this is a read of the ledger.`;
  return { negative: true as const, running, date: crossed.date, message };
}

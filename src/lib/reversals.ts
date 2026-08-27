import type { Transaction } from "./types";

const REVERSAL =
  /\b(payment reversal|unpaid item reversal|failed payment|reversal|dishonour|dishonor|insufficient funds|\bnsf\b|payment returned)\b/i;
const FAILED = /\b(failed payment|dishonour|dishonor|insufficient funds|unpaid item)\b/i;

export function isReversalNote(note: string) {
  return REVERSAL.test(note);
}

export function isWashTx(t: { note: string; categoryId?: string }) {
  return t.categoryId === "reversal" || isReversalNote(t.note);
}

function dayOffset(a: string, b: string) {
  return Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);
}

function token(note: string) {
  return note
    .toLowerCase()
    .replace(REVERSAL, " ")
    .replace(/\b(direct debit|automatic payment|bill payment|payment|credit|debit)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 24);
}

function score(rev: Transaction, t: Transaction) {
  if (Math.abs(t.amount - rev.amount) > 0.009) return -1;
  if (dayOffset(t.date, rev.date) > 10) return -1;
  let s = 10 - dayOffset(t.date, rev.date);
  if (FAILED.test(t.note) || FAILED.test(rev.note)) s += 20;
  if (isReversalNote(t.note) && t.id !== rev.id) s += 8;
  const a = token(rev.note);
  const b = token(t.note);
  if (a && b && (a.includes(b.slice(0, 8)) || b.includes(a.slice(0, 8)))) s += 6;
  return s;
}

/** Pair a bounce with the failed/original debit so neither hits living spend. */
export function netReversals(txs: Transaction[]): Transaction[] {
  const next = txs.map((t) => ({ ...t }));
  const used = new Set<string>();
  const reverses = next.filter((t) => isReversalNote(t.note));

  for (const rev of reverses) {
    if (used.has(rev.id)) continue;
    let best: Transaction | null = null;
    let bestScore = 0;
    for (const t of next) {
      if (used.has(t.id) || t.id === rev.id) continue;
      const sc = score(rev, t);
      if (sc > bestScore) {
        bestScore = sc;
        best = t;
      }
    }
    rev.categoryId = "reversal";
    rev.transfer = undefined;
    used.add(rev.id);
    if (best && bestScore >= 8) {
      best.categoryId = "reversal";
      best.transfer = undefined;
      used.add(best.id);
    }
  }
  return next;
}

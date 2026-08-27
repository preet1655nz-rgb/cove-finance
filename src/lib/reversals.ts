import type { Transaction } from "./types";

const REVERSAL =
  /\b(payment reversal|unpaid item reversal|failed payment|reversal|dishonour|dishonor|insufficient funds|\bnsf\b|payment returned)\b/i;

export function isReversalNote(note: string) {
  return REVERSAL.test(note);
}

export function isWashTx(t: { note: string; categoryId?: string; transfer?: unknown }) {
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

/** Pair a bounce/reversal with the original debit so neither hits the books. */
export function netReversals(txs: Transaction[]): Transaction[] {
  const next = txs.map((t) => ({ ...t }));
  const used = new Set<string>();
  const reverses = next.filter((t) => isReversalNote(t.note));

  for (const rev of reverses) {
    if (used.has(rev.id)) continue;
    const needle = token(rev.note);
    const match = next.find((t) => {
      if (used.has(t.id) || t.id === rev.id) return false;
      if (isReversalNote(t.note) && t.type === rev.type) return false;
      if (Math.abs(t.amount - rev.amount) > 0.009) return false;
      if (dayOffset(t.date, rev.date) > 10) return false;
      if (!needle) return true;
      const other = token(t.note);
      if (!other) return true;
      return other.includes(needle.slice(0, 8)) || needle.includes(other.slice(0, 8));
    });
    rev.categoryId = "reversal";
    rev.transfer = undefined;
    used.add(rev.id);
    if (match) {
      match.categoryId = "reversal";
      match.transfer = undefined;
      used.add(match.id);
    }
  }
  return next;
}

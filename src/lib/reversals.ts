import type { Transaction } from "./types";

const REVERSAL =
  /\b(payment reversal|unpaid item reversal|failed payment|reversal|dishonour|dishonor|insufficient funds|\bnsf\b|payment returned)\b/i;
const FAILED = /\b(failed payment|dishonour|dishonor|insufficient funds|unpaid item)\b/i;
const REVERSAL_CREDIT = /\b(payment reversal|unpaid item reversal|payment returned)\b/i;

export function isReversalNote(note: string) {
  return REVERSAL.test(note);
}

export function isWashTx(t: { note: string; categoryId?: string }) {
  return t.categoryId === "reversal" || isReversalNote(t.note);
}

function daySigned(from: string, to: string) {
  return (Date.parse(to) - Date.parse(from)) / 86400000;
}

function token(note: string) {
  return note
    .toLowerCase()
    .replace(REVERSAL, " ")
    .replace(/\b(direct debit|automatic payment|bill payment|payment|credit|debit|from|to)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 28);
}

function merchantOverlap(a: string, b: string) {
  const ta = token(a);
  const tb = token(b);
  if (!ta || !tb) return false;
  return ta.includes(tb.slice(0, 8)) || tb.includes(ta.slice(0, 8));
}

function markWash(t: Transaction) {
  t.categoryId = "reversal";
  t.transfer = undefined;
}

function scoreAgainstCredit(rev: Transaction, t: Transaction) {
  if (Math.abs(t.amount - rev.amount) > 0.009) return -1;
  const ahead = daySigned(rev.date, t.date);
  const behind = daySigned(t.date, rev.date);
  if (ahead > 1 || behind > 10) return -1;
  let s = 10 - Math.abs(ahead);
  if (FAILED.test(t.note)) s += 20;
  if (merchantOverlap(rev.note, t.note)) s += 6;
  if (t.type === "expense") s += 4;
  return s;
}

/**
 * Bounced payments must vanish from the books.
 * Unpaid Item Reversal + same-day One NZ debit = 0.
 * Failed Payment + Payment Reversal + original Quinovic debit = 0.
 * A later successful retry still counts.
 */
export function netReversals(txs: Transaction[]): Transaction[] {
  const next = txs.map((t) => ({ ...t }));

  for (const t of next) {
    if (isReversalNote(t.note)) markWash(t);
  }

  const credits = next.filter((t) => REVERSAL_CREDIT.test(t.note) || (isReversalNote(t.note) && t.type === "income"));

  for (const rev of credits) {
    const originals: Transaction[] = [];
    for (const t of next) {
      if (t.id === rev.id) continue;
      if (scoreAgainstCredit(rev, t) < 8) continue;
      if (FAILED.test(t.note) || isReversalNote(t.note)) {
        markWash(t);
        continue;
      }
      if (t.type === "expense") originals.push(t);
    }
    originals.sort((a, b) => scoreAgainstCredit(rev, b) - scoreAgainstCredit(rev, a));
    if (originals[0]) markWash(originals[0]);
  }

  return next;
}

import type { TxType } from "./types";

const CREDIT_HINT =
  /\b(direct credit|\bdc\b|credit transfer|payment received|deposit|salary|wages?|payroll|refund|interest|dividend|wage\/salary)\b/i;
const DEBIT_HINT =
  /\b(direct debit|\bdd\b|visa purchase|eftpos|automatic payment|\bap\b|bill payment|\bbp\b|atm|withdrawal|purchase|pos)\b/i;
const OWN_PARTY = /\b(saini|gurpree|gurpreet|guri self|gurpreet joint)\b/i;

export function looksLikeCredit(note: string, typeRaw = "") {
  const blob = `${typeRaw} ${note}`;
  if (DEBIT_HINT.test(blob) && !CREDIT_HINT.test(blob)) return false;
  if (CREDIT_HINT.test(blob)) return true;
  if (/^\s*(?:\d{4}\s+)?credit\b/i.test(note)) return true;
  if (/\bcredit\b/i.test(note) && !DEBIT_HINT.test(blob)) return true;
  return false;
}

export function looksLikeOwnAccountMove(note: string) {
  if (looksLikeSavings(note) || looksLikeCardPayment(note) || looksLikeReversal(note)) return false;
  return OWN_PARTY.test(note) || /\b(credit transfer|debit transfer|internal transfer)\b/i.test(note);
}

export function looksLikeSavings(note: string) {
  const blob = note.replace(/\s+/g, " ");
  if (/\b(interest|dividend)\b/i.test(blob)) return false;
  if (/\b(kiwisaver|emergency fund|term deposit)\b/i.test(blob)) return true;
  if (/\bguri\s+(wstpac|westpac)\b/i.test(blob)) return true;
  return /\b(wstpac|westpac)\b/i.test(blob) && /\bsav(?:ing|ings)?\b/i.test(blob);
}

export function looksLikeCardPayment(note: string) {
  return /\b9554[-\s*]|\bgem visa\b|\bgemvisa\b/i.test(note);
}

export function looksLikeReversal(note: string) {
  return /\b(payment reversal|unpaid item reversal|failed payment|reversal|dishonour|dishonor|insufficient funds|\bnsf\b|payment returned)\b/i.test(
    note,
  );
}

export function looksLikeReversalCredit(note: string, typeRaw = "") {
  return /\b(payment reversal|unpaid item reversal|payment returned)\b/i.test(`${typeRaw} ${note}`);
}

export function inferStatementType(note: string, fallback: TxType, typeRaw = "") {
  const blob = `${typeRaw} ${note}`;
  if (looksLikeReversalCredit(note, typeRaw)) return "income";
  if (/\bfailed payment\b/i.test(blob)) return "expense";
  if (looksLikeSavings(note)) return "expense";
  if (looksLikeCredit(note, typeRaw)) return "income";
  if (DEBIT_HINT.test(blob)) return "expense";
  if (/\b(unpaid item reversal|payment reversal|direct credit|credit transfer)\b/i.test(blob)) return "income";
  return fallback;
}

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
  return OWN_PARTY.test(note) || /\b(credit transfer|debit transfer|internal transfer)\b/i.test(note);
}

export function inferStatementType(note: string, fallback: TxType, typeRaw = ""): TxType {
  if (looksLikeCredit(note, typeRaw)) return "income";
  if (DEBIT_HINT.test(`${typeRaw} ${note}`)) return "expense";
  return fallback;
}

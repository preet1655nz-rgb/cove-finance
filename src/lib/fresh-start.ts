/** One-time wipe of demo / leftover Cove storage so the ledger starts empty. */
export const LEDGER_KEY = "cove-finance-v3:guest";
const FLAG = "cove-empty-once";
const FLAG_VAL = "2026-08-27-accounts";
const KEEP = new Set(["cove-accounts-v1", "cove-session-v1", FLAG]);

type Sampleish = { note: string; amount: number; id?: string };

export function isSampleLedger(txs: Sampleish[] | undefined) {
  if (!txs?.length) return false;
  return txs.some(
    (t) =>
      (t.note === "Monthly salary" && t.amount === 7400) ||
      (t.note === "Farro Fresh" && t.id?.startsWith("tx-")),
  );
}

export function wipeCoveStorage() {
  if (typeof window === "undefined") return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      if (KEEP.has(key)) continue;
      if (/cove/i.test(key)) storage.removeItem(key);
    }
  }
}

/** Returns true if this visit just discarded leftover sample data. */
export function takeEmptyStart() {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(FLAG) === FLAG_VAL) return false;
    wipeCoveStorage();
    window.localStorage.setItem(FLAG, FLAG_VAL);
    return true;
  } catch {
    return false;
  }
}

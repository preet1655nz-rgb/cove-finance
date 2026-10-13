import { coveApiUrl } from "./site";
import { useFinanceStore } from "./store";

type VaultPayload = {
  transactions: unknown[];
  budgets: unknown[];
  bills: unknown[];
  accounts: unknown[];
  rules: unknown[];
  facts: unknown[];
  settings: unknown;
  customCategories: unknown[];
};

function snapshot(): VaultPayload {
  const s = useFinanceStore.getState();
  return {
    transactions: s.transactions,
    budgets: s.budgets,
    bills: s.bills,
    accounts: s.accounts,
    rules: s.rules,
    facts: s.facts,
    settings: s.settings,
    customCategories: s.customCategories,
  };
}

export const ERASED_KEY = "cove-erased";

export function markErased() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ERASED_KEY, "1");
}

export function clearErased() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ERASED_KEY);
}

function wasErased() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ERASED_KEY) === "1";
}

export async function pullCloudLedger(email: string) {
  try {
    if (wasErased()) return false;
    const res = await fetch(coveApiUrl(`/api/vault?email=${encodeURIComponent(email)}`));
    if (!res.ok) return false;
    const data = (await res.json()) as { row?: { payload?: VaultPayload } | null };
    const payload = data.row?.payload;
    if (!payload || !Array.isArray(payload.transactions)) return false;
    const remoteCount = payload.transactions.length;
    const localCount = useFinanceStore.getState().transactions.length;
    if (remoteCount === 0) return false;
    if (remoteCount < localCount) return false;
    if (localCount === 0 && wasErased()) return false;
    useFinanceStore.getState().importData(payload);
    return true;
  } catch {
    return false;
  }
}

export async function pushCloudLedger(email: string, opts?: { allowEmpty?: boolean }) {
  const payload = snapshot();
  const empty = !Array.isArray(payload.transactions) || payload.transactions.length === 0;
  const erase = Boolean(opts?.allowEmpty || wasErased());
  if (empty && !erase) return;
  try {
    const res = await fetch(coveApiUrl("/api/vault"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, payload, erase }),
    });
    const body = (await res.json().catch(() => null)) as { kept?: boolean; ok?: boolean } | null;
    if (empty && res.ok && body?.ok !== false && body?.kept !== true) clearErased();
  } catch {
    /* local ledger still saved; erased flag stays so a refresh cannot pull the old books */
  }
}

let timer: number | undefined;
export function startCloudSync(email: string) {
  const kick = () => {
    void pullCloudLedger(email).then((had) => {
      if (!had) void pushCloudLedger(email);
    });
  };

  if (useFinanceStore.getState().hydrated) kick();
  else {
    const unsubHydrate = useFinanceStore.subscribe((s) => {
      if (s.hydrated) {
        unsubHydrate();
        kick();
      }
    });
  }

  const unsub = useFinanceStore.subscribe(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      void pushCloudLedger(email);
    }, 800);
  });
  return () => {
    unsub();
    window.clearTimeout(timer);
  };
}

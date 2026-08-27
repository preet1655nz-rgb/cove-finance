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

export async function pullCloudLedger(email: string) {
  try {
    const res = await fetch(coveApiUrl(`/api/vault?email=${encodeURIComponent(email)}`));
    if (!res.ok) return false;
    const data = (await res.json()) as { row?: { payload?: VaultPayload } | null };
    const payload = data.row?.payload;
    if (!payload || !Array.isArray(payload.transactions)) return false;
    const remoteCount = payload.transactions.length;
    const localCount = useFinanceStore.getState().transactions.length;
    if (remoteCount === 0 && localCount > 0) return false;
    if (remoteCount < localCount) return false;
    useFinanceStore.getState().importData(payload);
    return true;
  } catch {
    return false;
  }
}

export async function pushCloudLedger(email: string) {
  try {
    await fetch(coveApiUrl("/api/vault"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, payload: snapshot() }),
    });
  } catch {
    /* local ledger still saved */
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

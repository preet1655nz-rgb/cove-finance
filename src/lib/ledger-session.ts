import { ledgerStorageKey, readSession } from "./account-vault";
import { LEDGER_KEY } from "./fresh-start";
import { useFinanceStore } from "./store";

let attachedTo: string | null | undefined;

function persistSlice() {
  const s = useFinanceStore.getState();
  return {
    state: {
      transactions: s.transactions,
      budgets: s.budgets,
      bills: s.bills,
      notices: s.notices,
      settings: s.settings,
      accounts: s.accounts,
      rules: s.rules,
      facts: s.facts,
      chat: s.chat,
      covePending: s.covePending,
      customCategories: s.customCategories,
      cycleMode: s.cycleMode,
    },
    version: 5,
  };
}

function readPersisted(name: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(name);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { transactions?: unknown[] } };
    return parsed;
  } catch {
    return null;
  }
}

export function saveLedgerNow() {
  if (typeof window === "undefined") return;
  const name = ledgerStorageKey(readSession()?.userId ?? null);
  useFinanceStore.persist.setOptions({ name });
  window.localStorage.setItem(name, JSON.stringify(persistSlice()));
}

export function attachLedgerForUser(userId: string | null) {
  const name = ledgerStorageKey(userId);
  if (typeof window !== "undefined" && userId) {
    const userPersisted = readPersisted(name);
    const guestPersisted = readPersisted(LEDGER_KEY);
    const userEmpty = !userPersisted?.state?.transactions?.length;
    const guestHas = Boolean(guestPersisted?.state?.transactions?.length);
    if (userEmpty && guestHas && guestPersisted) {
      window.localStorage.setItem(name, JSON.stringify(guestPersisted));
    }
  }

  useFinanceStore.persist.setOptions({ name });

  if (attachedTo === userId && useFinanceStore.getState().hydrated) {
    return;
  }

  const keep =
    attachedTo === userId && useFinanceStore.getState().transactions.length > 0
      ? useFinanceStore.getState().transactions
      : null;

  attachedTo = userId;

  if (!keep) {
    useFinanceStore.setState({
      hydrated: false,
    });
  }

  void Promise.resolve(useFinanceStore.persist.rehydrate()).finally(() => {
    const s = useFinanceStore.getState();
    if (keep && !s.transactions.length) {
      s.importData({
        transactions: keep,
        budgets: s.budgets,
        bills: s.bills,
        settings: s.settings,
      });
    }
    s.setHydrated(true);
    s.refreshNotices();
    saveLedgerNow();
  });
}

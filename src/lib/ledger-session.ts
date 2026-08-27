import { ledgerStorageKey } from "./account-vault";
import { useFinanceStore } from "./store";

export function attachLedgerForUser(userId: string | null) {
  const name = ledgerStorageKey(userId);
  useFinanceStore.persist.setOptions({ name });
  useFinanceStore.setState({
    transactions: [],
    budgets: [],
    bills: [],
    notices: [],
    accounts: [],
    rules: [],
    facts: [],
    chat: [],
    covePending: null,
    customCategories: [],
    hydrated: false,
  });
  void Promise.resolve(useFinanceStore.persist.rehydrate()).finally(() => {
    useFinanceStore.getState().setHydrated(true);
    useFinanceStore.getState().refreshNotices();
  });
}

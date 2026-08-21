import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getCategory } from "./categories";
import { buildNotices } from "./notify";
import { spentInCategory } from "./period";
import { buildSeed, defaultSettings } from "./seed";
import { txFingerprint } from "./statement";
import type { Budget, Notice, RecurringBill, Settings, Transaction, TxType } from "./types";
import { endOfMonth, startOfMonth, todayISO, uid } from "./utils";

type Draft = {
  type: TxType;
  amount: string;
  categoryId: string;
  note: string;
  date: string;
};

export type ImportRow = {
  date: string;
  amount: number;
  type: TxType;
  note: string;
  categoryId: string;
};

type FinanceState = {
  transactions: Transaction[];
  budgets: Budget[];
  bills: RecurringBill[];
  notices: Notice[];
  settings: Settings;
  period: "this-month" | "last-month" | "quarter" | "year" | "all";
  addOpen: boolean;
  settingsOpen: boolean;
  importOpen: boolean;
  editingId: string | null;
  draft: Draft;
  hydrated: boolean;
  focusMonth: string | null;
  setHydrated: (v: boolean) => void;
  setPeriod: (p: FinanceState["period"]) => void;
  setAddOpen: (open: boolean, preset?: Partial<Draft>) => void;
  setSettingsOpen: (open: boolean) => void;
  setImportOpen: (open: boolean) => void;
  setFocusMonth: (month: string | null) => void;
  updateDraft: (patch: Partial<Draft>) => void;
  addTransaction: () => boolean;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  removeTransaction: (id: string) => void;
  startEdit: (tx: Transaction) => void;
  upsertBudget: (categoryId: string, amount: number) => void;
  removeBudget: (id: string) => void;
  upsertBill: (bill: Omit<RecurringBill, "id"> & { id?: string }) => void;
  removeBill: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  markNoticeRead: (id: string) => void;
  markAllRead: () => void;
  refreshNotices: () => void;
  resetSample: () => void;
  clearAll: () => void;
  importData: (raw: unknown) => boolean;
  importTransactions: (rows: ImportRow[]) => { added: number; skipped: number };
};

const emptyDraft = (): Draft => ({
  type: "expense",
  amount: "",
  categoryId: "groceries",
  note: "",
  date: todayISO(),
});

function withNotices(partial: Partial<FinanceState> & Pick<FinanceState, "transactions" | "budgets" | "bills" | "notices" | "settings">) {
  return {
    ...partial,
    notices: buildNotices(partial.transactions, partial.budgets, partial.bills, partial.notices, partial.settings.currency),
  };
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      transactions: [],
      budgets: [],
      bills: [],
      notices: [],
      settings: defaultSettings,
      period: "this-month",
      addOpen: false,
      settingsOpen: false,
      importOpen: false,
      editingId: null,
      draft: emptyDraft(),
      hydrated: false,
      focusMonth: null,
      setHydrated: (v) => set({ hydrated: v }),
      setPeriod: (period) => set({ period }),
      setAddOpen: (open, preset) =>
        set({
          addOpen: open,
          editingId: null,
          draft: open
            ? { ...emptyDraft(), ...preset, date: preset?.date ?? todayISO() }
            : emptyDraft(),
        }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setImportOpen: (importOpen) => set({ importOpen }),
      setFocusMonth: (focusMonth) => set({ focusMonth }),
      updateDraft: (patch) => set({ draft: { ...get().draft, ...patch } }),
      addTransaction: () => {
        const { draft, editingId, transactions } = get();
        const amount = Number(draft.amount);
        if (!Number.isFinite(amount) || amount <= 0) return false;
        const cat = getCategory(draft.categoryId);
        const type = cat.type;
        if (editingId) {
          const next = transactions.map((t) =>
            t.id === editingId
              ? {
                  ...t,
                  type,
                  amount: Math.round(amount * 100) / 100,
                  categoryId: draft.categoryId,
                  note: draft.note.trim(),
                  date: draft.date,
                }
              : t,
          );
          set(
            withNotices({
              ...get(),
              transactions: next,
              addOpen: false,
              editingId: null,
              draft: emptyDraft(),
            }),
          );
          return true;
        }
        const row: Transaction = {
          id: uid(),
          type,
          amount: Math.round(amount * 100) / 100,
          categoryId: draft.categoryId,
          note: draft.note.trim(),
          date: draft.date,
          createdAt: new Date().toISOString(),
        };
        set(
          withNotices({
            ...get(),
            transactions: [row, ...transactions],
            addOpen: false,
            draft: emptyDraft(),
          }),
        );
        return true;
      },
      updateTransaction: (id, patch) => {
        const transactions = get().transactions.map((t) => (t.id === id ? { ...t, ...patch } : t));
        set(withNotices({ ...get(), transactions }));
      },
      removeTransaction: (id) => {
        const transactions = get().transactions.filter((t) => t.id !== id);
        set(withNotices({ ...get(), transactions, addOpen: false, editingId: null }));
      },
      startEdit: (tx) =>
        set({
          addOpen: true,
          editingId: tx.id,
          draft: {
            type: tx.type,
            amount: String(tx.amount),
            categoryId: tx.categoryId,
            note: tx.note,
            date: tx.date,
          },
        }),
      upsertBudget: (categoryId, amount) => {
        const { budgets } = get();
        const existing = budgets.find((b) => b.categoryId === categoryId);
        const next = existing
          ? budgets.map((b) => (b.categoryId === categoryId ? { ...b, amount } : b))
          : [...budgets, { id: uid(), categoryId, amount }];
        set(withNotices({ ...get(), budgets: next }));
      },
      removeBudget: (id) => {
        const budgets = get().budgets.filter((b) => b.id !== id);
        set(withNotices({ ...get(), budgets }));
      },
      upsertBill: (bill) => {
        const { bills } = get();
        const next = bill.id
          ? bills.map((b) => (b.id === bill.id ? { ...b, ...bill, id: bill.id } : b))
          : [...bills, { ...bill, id: uid() }];
        set(withNotices({ ...get(), bills: next }));
      },
      removeBill: (id) => {
        const bills = get().bills.filter((b) => b.id !== id);
        set(withNotices({ ...get(), bills }));
      },
      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      markNoticeRead: (id) =>
        set({
          notices: get().notices.map((n) => (n.id === id ? { ...n, read: true } : n)),
        }),
      markAllRead: () => set({ notices: get().notices.map((n) => ({ ...n, read: true })) }),
      refreshNotices: () => {
        const current = get();
        const next = buildNotices(current.transactions, current.budgets, current.bills, current.notices, current.settings.currency);
        const prev = current.notices;
        if (
          next.length === prev.length &&
          next.every((n, i) => n.fingerprint === prev[i]?.fingerprint && n.read === prev[i]?.read && n.title === prev[i]?.title)
        ) {
          return;
        }
        set({ notices: next });
      },
      resetSample: () => {
        const fresh = buildSeed();
        set(
          withNotices({
            ...get(),
            transactions: fresh.transactions,
            budgets: fresh.budgets,
            bills: fresh.bills,
            notices: [],
            settings: { ...fresh.settings, currency: get().settings.currency },
          }),
        );
      },
      clearAll: () =>
        set(
          withNotices({
            ...get(),
            transactions: [],
            budgets: [],
            bills: [],
            notices: [],
          }),
        ),
      importData: (raw) => {
        if (!raw || typeof raw !== "object") return false;
        const data = raw as Record<string, unknown>;
        const transactions = Array.isArray(data.transactions) ? (data.transactions as Transaction[]) : null;
        if (!transactions) return false;
        set(
          withNotices({
            ...get(),
            transactions,
            budgets: Array.isArray(data.budgets) ? (data.budgets as Budget[]) : get().budgets,
            bills: Array.isArray(data.bills) ? (data.bills as RecurringBill[]) : get().bills,
            settings:
              data.settings && typeof data.settings === "object"
                ? { ...get().settings, ...(data.settings as Settings) }
                : get().settings,
            notices: [],
          }),
        );
        return true;
      },
      importTransactions: (incoming) => {
        const existing = get().transactions;
        const seen = new Set(existing.map((t) => txFingerprint(t.date, t.amount, t.note)));
        const added: Transaction[] = [];
        let skipped = 0;
        for (const row of incoming) {
          if (!Number.isFinite(row.amount) || row.amount <= 0 || !row.date) {
            skipped += 1;
            continue;
          }
          const note = row.note.trim();
          const fp = txFingerprint(row.date, row.amount, note);
          if (seen.has(fp)) {
            skipped += 1;
            continue;
          }
          seen.add(fp);
          const type = getCategory(row.categoryId).type;
          added.push({
            id: uid(),
            type,
            amount: Math.round(row.amount * 100) / 100,
            categoryId: row.categoryId,
            note,
            date: row.date,
            createdAt: new Date().toISOString(),
          });
        }
        if (added.length) {
          const latest = added.reduce((m, t) => (t.date > m ? t.date : m), added[0].date);
          set(
            withNotices({
              ...get(),
              transactions: [...added, ...existing],
              importOpen: false,
              focusMonth: latest.slice(0, 7),
            }),
          );
        } else {
          set({ importOpen: false });
        }
        return { added: added.length, skipped };
      },
    }),
    {
      name: "cove-finance-v2",
      skipHydration: true,
      partialize: (s) => ({
        transactions: s.transactions,
        budgets: s.budgets,
        bills: s.bills,
        notices: s.notices,
        settings: s.settings,
      }),
    },
  ),
);

export function monthSpent(categoryId: string) {
  const txs = useFinanceStore.getState().transactions;
  const today = todayISO();
  return spentInCategory(txs, categoryId, startOfMonth(today), endOfMonth(today));
}

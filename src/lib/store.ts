import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getCategory } from "./categories";
import { interpretChat } from "./chat-brain";
import { applyCoveActions, buildSnapshot } from "./cove-expert";
import { applyRulesToTxs, classifyNote, pairTransfers } from "./intelligence";
import { buildNotices } from "./notify";
import { spentInCategory } from "./period";
import { buildSeed, defaultSettings } from "./seed";
import { txFingerprint } from "./statement";
import { isSampleLedger, LEDGER_KEY } from "./fresh-start";
import type { BankAccount, Budget, ChatMessage, CoveFact, MemoryRule, Notice, RecurringBill, Settings, Transaction, TxType } from "./types";
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
  accountId?: string;
};

type FinanceState = {
  transactions: Transaction[];
  budgets: Budget[];
  bills: RecurringBill[];
  notices: Notice[];
  accounts: BankAccount[];
  rules: MemoryRule[];
  facts: CoveFact[];
  chat: ChatMessage[];
  chatOpen: boolean;
  chatBusy: boolean;
  importAccountId: string | null;
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
  importTransactions: (rows: ImportRow[], accountId?: string) => { added: number; skipped: number };
  upsertAccount: (account: Omit<BankAccount, "id"> & { id?: string }) => string;
  removeAccount: (id: string) => void;
  setImportAccountId: (id: string | null) => void;
  setChatOpen: (open: boolean) => void;
  askCove: (text: string) => Promise<string>;
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
      accounts: [],
      rules: [],
      facts: [],
      chat: [],
      chatOpen: false,
      chatBusy: false,
      importAccountId: null,
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
      importTransactions: (incoming, accountId) => {
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
          const type = row.type || getCategory(row.categoryId).type;
          const tagged = classifyNote(note, type, get().rules);
          added.push({
            id: uid(),
            type,
            amount: Math.round(row.amount * 100) / 100,
            categoryId: tagged.categoryId,
            note,
            date: row.date,
            createdAt: new Date().toISOString(),
            accountId: row.accountId ?? accountId,
            counterparty: tagged.counterparty,
            transfer: tagged.transfer,
          });
        }
        if (added.length) {
          const latest = added.reduce((m, t) => (t.date > m ? t.date : m), added[0].date);
          const merged = pairTransfers(applyRulesToTxs([...added, ...existing], get().rules), get().accounts);
          set(
            withNotices({
              ...get(),
              transactions: merged,
              importOpen: false,
              focusMonth: latest.slice(0, 7),
            }),
          );
        } else {
          set({ importOpen: false });
        }
        return { added: added.length, skipped };
      },
      upsertAccount: (account) => {
        const id = account.id || uid();
        const accounts = get().accounts.some((a) => a.id === id)
          ? get().accounts.map((a) => (a.id === id ? { ...a, ...account, id } : a))
          : [...get().accounts, { ...account, id, bank: account.bank || "other", name: account.name || "Account" }];
        set({ accounts });
        return id;
      },
      removeAccount: (id) => set({ accounts: get().accounts.filter((a) => a.id !== id) }),
      setImportAccountId: (importAccountId) => set({ importAccountId }),
      setChatOpen: (chatOpen) => set({ chatOpen }),
      askCove: async (text) => {
        const trimmed = text.trim();
        if (!trimmed) return "";
        const user: ChatMessage = { id: uid(), role: "user", text: trimmed, at: new Date().toISOString() };
        set({ chat: [...get().chat, user].slice(-60), chatBusy: true, chatOpen: true });
        const s = get();
        const ledger = {
          transactions: s.transactions,
          accounts: s.accounts,
          rules: s.rules,
          budgets: s.budgets,
          bills: s.bills,
          facts: s.facts,
          settings: s.settings,
        };
        const compact = (next: Partial<FinanceState>) =>
          Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)) as Partial<FinanceState>;
        const finish = (reply: string, next: Partial<FinanceState> = {}) => {
          const cove: ChatMessage = { id: uid(), role: "cove", text: reply, at: new Date().toISOString() };
          const chat = [...get().chat, cove].slice(-60);
          const patch = compact(next);
          if (patch.transactions || patch.budgets || patch.bills) {
            set(withNotices({ ...get(), ...patch, chat, chatBusy: false, notices: get().notices }));
          } else {
            set({ ...patch, chat, chatBusy: false });
          }
          return reply;
        };
        try {
          const { askCoveExpert } = await import("./cove-ai");
          const grok = await askCoveExpert({
            data: {
              message: trimmed,
              history: get().chat.slice(-8).map((m) => ({ role: m.role, text: m.text })),
              snapshot: buildSnapshot(ledger),
            },
          });
          if (grok && "ok" in grok && grok.ok) {
            const applied = applyCoveActions(ledger, grok.actions);
            const extra = applied.notes.length ? `\n\n${applied.notes.join(" · ")}` : "";
            return finish(grok.reply + extra, applied.next);
          }
        } catch (err) {
          console.error(err);
        }
        const effect = interpretChat(trimmed, {
          ...ledger,
          currency: s.settings.currency,
        });
        return finish(effect.reply, {
          rules: effect.rules,
          accounts: effect.accounts,
          transactions: effect.transactions,
          budgets: effect.budgets,
          bills: effect.bills,
          facts: effect.facts,
          settings: effect.settings,
        });
      },
    }),
    {
      name: LEDGER_KEY,
      skipHydration: true,
      version: 5,
      partialize: (s) => ({
        transactions: s.transactions,
        budgets: s.budgets,
        bills: s.bills,
        notices: s.notices,
        settings: s.settings,
        accounts: s.accounts,
        rules: s.rules,
        facts: s.facts,
        chat: s.chat,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FinanceState>;
        if (isSampleLedger(p.transactions)) return current;
        return { ...current, ...p };
      },
      onRehydrateStorage: () => (state) => {
        if (state && isSampleLedger(state.transactions)) state.clearAll();
      },
    },
  ),
);

export function monthSpent(categoryId: string) {
  const txs = useFinanceStore.getState().transactions;
  const today = todayISO();
  return spentInCategory(txs, categoryId, startOfMonth(today), endOfMonth(today));
}


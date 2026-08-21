import { CATEGORIES, getCategory, isTransferCategory } from "./categories";
import { money } from "./format";
import { applyRulesToTxs, isTransferTx, livingTxs, pairTransfers, payeeBreakdown, prettyPayee, transferFlows } from "./intelligence";
import { explainTax, parseMoneyish } from "./nz-finance";
import type { BankAccount, Budget, CoveFact, MemoryRule, RecurringBill, Settings, Transaction } from "./types";
import { todayISO, uid } from "./utils";

export type CoveAction =
  | { type: "add_rule"; pattern: string; kind: "category" | "transfer"; categoryId?: string; accountName?: string }
  | { type: "forget_rule"; pattern: string }
  | { type: "add_transaction"; txType: "income" | "expense"; amount: number; categoryId: string; note: string; date?: string }
  | { type: "update_amount"; id: string; amount: number }
  | { type: "retag"; pattern: string; categoryId: string }
  | { type: "delete_matching"; pattern: string }
  | { type: "set_budget"; categoryId: string; amount: number }
  | { type: "remove_budget"; categoryId: string }
  | { type: "upsert_bill"; name: string; amount: number; categoryId: string; dayOfMonth: number }
  | { type: "remove_bill"; name: string }
  | { type: "upsert_account"; name: string; bank?: string }
  | { type: "rename_account"; from: string; to: string }
  | { type: "set_currency"; code: string }
  | { type: "remember"; fact: string };

export type LedgerState = {
  transactions: Transaction[];
  accounts: BankAccount[];
  rules: MemoryRule[];
  budgets: Budget[];
  bills: RecurringBill[];
  facts: CoveFact[];
  settings: Settings;
};

const CAT_IDS = new Set(CATEGORIES.map((c) => c.id));
const CURRENCIES = new Set(["NZD", "USD", "AUD", "GBP", "EUR", "CAD"]);

export function buildSnapshot(state: LedgerState) {
  const txs = state.transactions;
  const lived = livingTxs(txs);
  const income = lived.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = lived.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const transferred = txs.filter((t) => t.type === "expense" && isTransferTx(t)).reduce((s, t) => s + t.amount, 0);
  const byCat = new Map<string, number>();
  for (const t of lived) byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
  const categories = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([id, amount]) => ({ id, name: getCategory(id).name, type: getCategory(id).type, amount: round2(amount) }));
  const accounts = state.accounts.map((a) => {
    const list = txs.filter((t) => t.accountId === a.id);
    const balance = list.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
    return { id: a.id, name: a.name, bank: a.bank, balance: round2(balance), entries: list.length };
  });
  const recent = [...txs]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 24)
    .map((t) => ({
      id: t.id,
      date: t.date,
      type: t.type,
      amount: t.amount,
      category: getCategory(t.categoryId).name,
      categoryId: t.categoryId,
      note: t.note.slice(0, 80),
      account: state.accounts.find((a) => a.id === t.accountId)?.name,
      transferTo: t.transfer?.otherLabel,
    }));
  return {
    currency: state.settings.currency,
    livedIncome: round2(income),
    livedSpend: round2(expense),
    net: round2(income - expense),
    savingsRate: income ? Math.round(((income - expense) / income) * 100) : null,
    transferred: round2(transferred),
    transferFlows: transferFlows(txs).slice(0, 8).map((f) => ({ to: f.to, amount: round2(f.amount), count: f.count })),
    categories,
    payees: payeeBreakdown(lived).slice(0, 12).map((p) => ({ name: p.name, amount: round2(p.amount) })),
    other: payeeBreakdown(lived.filter((t) => t.categoryId === "other" || t.categoryId === "other-income"))
      .slice(0, 8)
      .map((p) => ({ name: p.name, amount: round2(p.amount) })),
    accounts,
    budgets: state.budgets.map((b) => ({
      categoryId: b.categoryId,
      name: getCategory(b.categoryId).name,
      amount: b.amount,
    })),
    bills: state.bills.map((b) => ({ name: b.name, amount: b.amount, category: getCategory(b.categoryId).name, day: b.dayOfMonth })),
    rules: state.rules.map((r) => ({
      pattern: r.pattern,
      kind: r.kind,
      category: r.categoryId ? getCategory(r.categoryId).name : undefined,
      account: r.accountName,
    })),
    facts: state.facts.map((f) => f.text),
    recent,
    entryCount: txs.length,
  };
}

export type CoveSnapshot = ReturnType<typeof buildSnapshot>;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function validCat(id?: string) {
  return id && CAT_IDS.has(id) ? id : null;
}

function validAmount(n: unknown) {
  const x = Number(n);
  return Number.isFinite(x) && x > 0 && x < 10_000_000 ? Math.round(x * 100) / 100 : null;
}

export function applyCoveActions(state: LedgerState, actions: CoveAction[]): { next: LedgerState; notes: string[] } {
  let transactions = [...state.transactions];
  let accounts = [...state.accounts];
  let rules = [...state.rules];
  let budgets = [...state.budgets];
  let bills = [...state.bills];
  let facts = [...state.facts];
  let settings = { ...state.settings };
  const notes: string[] = [];
  const list = Array.isArray(actions) ? actions.slice(0, 20) : [];

  for (const raw of list) {
    if (!raw || typeof raw !== "object" || !("type" in raw)) continue;
    const action = raw as CoveAction;
    try {
      if (action.type === "add_rule") {
        const pattern = String(action.pattern ?? "").trim().slice(0, 80);
        if (!pattern) continue;
        rules = rules.filter((r) => r.pattern.toLowerCase() !== pattern.toLowerCase());
        if (action.kind === "transfer") {
          const accountName = String(action.accountName ?? pattern).trim().slice(0, 60);
          rules.push({ id: uid(), pattern, kind: "transfer", accountName });
          if (!accounts.some((a) => a.name.toLowerCase() === accountName.toLowerCase())) {
            accounts.push({ id: uid(), name: accountName, bank: "other" });
          }
          notes.push(`Rule: “${pattern}” → transfer to ${accountName}`);
        } else {
          const categoryId = validCat(action.categoryId);
          if (!categoryId) continue;
          rules.push({ id: uid(), pattern, kind: "category", categoryId });
          notes.push(`Rule: “${pattern}” → ${getCategory(categoryId).name}`);
        }
        transactions = pairTransfers(applyRulesToTxs(transactions, rules), accounts);
      } else if (action.type === "forget_rule") {
        const pattern = String(action.pattern ?? "").trim().toLowerCase();
        const before = rules.length;
        rules = rules.filter((r) => r.pattern.toLowerCase() !== pattern);
        if (rules.length !== before) notes.push(`Forgot rule “${action.pattern}”`);
      } else if (action.type === "retag") {
        const pattern = String(action.pattern ?? "").trim().toLowerCase();
        const categoryId = validCat(action.categoryId);
        if (!pattern || !categoryId) continue;
        let n = 0;
        transactions = transactions.map((t) => {
          if (!t.note.toLowerCase().includes(pattern) && !(t.counterparty ?? "").toLowerCase().includes(pattern)) return t;
          n += 1;
          return { ...t, categoryId, type: getCategory(categoryId).type };
        });
        if (n) notes.push(`Retagged ${n} as ${getCategory(categoryId).name}`);
      } else if (action.type === "add_transaction") {
        const amount = validAmount(action.amount);
        const categoryId = validCat(action.categoryId) ?? (action.txType === "income" ? "other-income" : "other");
        if (!amount) continue;
        const type = action.txType === "income" || getCategory(categoryId).type === "income" ? "income" : "expense";
        const note = String(action.note || prettyPayee(categoryId)).slice(0, 120);
        const date = /^\d{4}-\d{2}-\d{2}$/.test(action.date ?? "") ? action.date! : todayISO();
        transactions = [
          {
            id: uid(),
            type,
            amount,
            categoryId: getCategory(categoryId).type === type ? categoryId : type === "income" ? "other-income" : categoryId,
            note,
            date,
            createdAt: new Date().toISOString(),
          },
          ...transactions,
        ];
        notes.push(`Added ${type} ${money(amount, settings.currency)} ${note}`);
      } else if (action.type === "update_amount") {
        const amount = validAmount(action.amount);
        if (!amount || !action.id) continue;
        let hit = false;
        transactions = transactions.map((t) => {
          if (t.id !== action.id) return t;
          hit = true;
          return { ...t, amount };
        });
        if (hit) notes.push(`Updated amount to ${money(amount, settings.currency)}`);
      } else if (action.type === "delete_matching") {
        const pattern = String(action.pattern ?? "").trim().toLowerCase();
        if (!pattern || pattern.length < 3) continue;
        const keep: Transaction[] = [];
        let n = 0;
        for (const t of transactions) {
          if (n < 20 && (t.note.toLowerCase().includes(pattern) || t.id === pattern)) {
            n += 1;
            continue;
          }
          keep.push(t);
        }
        transactions = keep;
        if (n) notes.push(`Removed ${n} matching “${action.pattern}”`);
      } else if (action.type === "set_budget") {
        const amount = validAmount(action.amount);
        const categoryId = validCat(action.categoryId);
        if (!amount || !categoryId || isTransferCategory(categoryId)) continue;
        const existing = budgets.find((b) => b.categoryId === categoryId);
        budgets = existing
          ? budgets.map((b) => (b.categoryId === categoryId ? { ...b, amount } : b))
          : [...budgets, { id: uid(), categoryId, amount }];
        notes.push(`${getCategory(categoryId).name} budget ${money(amount, settings.currency)}`);
      } else if (action.type === "remove_budget") {
        const categoryId = validCat(action.categoryId);
        if (!categoryId) continue;
        budgets = budgets.filter((b) => b.categoryId !== categoryId);
        notes.push(`Removed ${getCategory(categoryId).name} budget`);
      } else if (action.type === "upsert_bill") {
        const amount = validAmount(action.amount);
        const name = String(action.name ?? "").trim().slice(0, 60);
        const categoryId = validCat(action.categoryId) ?? "utilities";
        const day = Math.min(28, Math.max(1, Number(action.dayOfMonth) || 1));
        if (!amount || !name) continue;
        const existing = bills.find((b) => b.name.toLowerCase() === name.toLowerCase());
        bills = existing
          ? bills.map((b) => (b.id === existing.id ? { ...b, amount, categoryId, dayOfMonth: day, enabled: true } : b))
          : [...bills, { id: uid(), name, amount, categoryId, dayOfMonth: day, enabled: true }];
        notes.push(`Bill “${name}” ${money(amount, settings.currency)} on the ${day}th`);
      } else if (action.type === "remove_bill") {
        const name = String(action.name ?? "").trim().toLowerCase();
        const before = bills.length;
        bills = bills.filter((b) => b.name.toLowerCase() !== name);
        if (bills.length !== before) notes.push(`Removed bill “${action.name}”`);
      } else if (action.type === "upsert_account") {
        const name = String(action.name ?? "").trim().slice(0, 60);
        if (!name) continue;
        if (!accounts.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
          accounts.push({ id: uid(), name, bank: String(action.bank || "other").slice(0, 20) });
          notes.push(`Linked account ${name}`);
        }
      } else if (action.type === "rename_account") {
        const from = String(action.from ?? "").trim().toLowerCase();
        const to = String(action.to ?? "").trim().slice(0, 60);
        if (!from || !to) continue;
        accounts = accounts.map((a) => (a.name.toLowerCase() === from || a.bank === from ? { ...a, name: to } : a));
        notes.push(`Account now called ${to}`);
      } else if (action.type === "set_currency") {
        const code = String(action.code ?? "").toUpperCase();
        if (!CURRENCIES.has(code)) continue;
        settings = { ...settings, currency: code };
        notes.push(`Currency ${code}`);
      } else if (action.type === "remember") {
        const text = String(action.fact ?? "").trim().slice(0, 200);
        if (!text) continue;
        facts = [...facts.filter((f) => f.text.toLowerCase() !== text.toLowerCase()), { id: uid(), text }].slice(-40);
        notes.push("Remembered.");
      }
    } catch {
      // skip a bad action, never throw — the books stay intact
    }
  }

  return {
    next: { transactions, accounts, rules, budgets, bills, facts, settings },
    notes,
  };
}

export function formatSnapshotBrief(snap: CoveSnapshot) {
  const c = snap.currency;
  const lines = [
    `Lived in ${money(snap.livedIncome, c)} · lived out ${money(snap.livedSpend, c)} · net ${money(snap.net, c)}`,
    snap.savingsRate != null ? `Savings rate ${snap.savingsRate}% (transfers excluded)` : "",
    snap.transferred ? `Moved between own accounts ${money(snap.transferred, c)}` : "",
    snap.transferFlows.length
      ? `Transfers: ${snap.transferFlows.map((f) => `${money(f.amount, c)} to ${f.to}`).join("; ")}`
      : "",
    snap.accounts.length
      ? `Accounts: ${snap.accounts.map((a) => `${a.name} ${money(a.balance, c)}`).join("; ")}`
      : "No linked accounts yet",
    `Top payees: ${snap.payees.slice(0, 6).map((p) => `${p.name} ${money(p.amount, c)}`).join("; ") || "none"}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function answerFromSnapshot(question: string, snap: CoveSnapshot) {
  const q = question.toLowerCase();
  const c = snap.currency;
  const taxQ = q.match(/(?:tax|take-?home|take home).{0,20}?(\d[\d,]*(?:\.\d+)?)/) || q.match(/(\d[\d,]*(?:\.\d+)?).{0,12}(gross|salary|a year)/);
  if (/(tax|kiwisaver|take-?home|paye|ird)/.test(q) && taxQ) {
    const gross = parseMoneyish(taxQ[1] ?? taxQ[0]);
    if (gross && gross >= 1000) return explainTax(gross);
  }
  if (/emergency fund/.test(q) && snap.livedSpend) {
    const monthly = snap.livedSpend;
    return `Using your lived spend of ${money(monthly, c)} in this ledger window, a 3-month emergency fund is about ${money(monthly * 3, c)} and 6 months is ${money(monthly * 6, c)}. Transfers between your own accounts are not counted.`;
  }
  if (/savings rate|how am i doing|overspend/.test(q)) {
    return `Lived income ${money(snap.livedIncome, c)}, lived spend ${money(snap.livedSpend, c)}, net ${money(snap.net, c)}${snap.savingsRate != null ? `, savings rate ${snap.savingsRate}%` : ""}. ${snap.transferred ? `${money(snap.transferred, c)} was only moved between accounts.` : ""}`;
  }
  return null;
}

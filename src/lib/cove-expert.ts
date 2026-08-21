import { CATEGORIES, getCategory, isTransferCategory } from "./categories";
import { money } from "./format";
import { applyRulesToTxs, isTransferTx, livingTxs, pairTransfers, payeeBreakdown, prettyPayee, resolveCategoryAlias, transferFlows } from "./intelligence";
import { annualize, explainTax, gstExclusive, gstInclusive, gstPortion, mortgageComfort, parseMoneyish, split503020, takeHome } from "./nz-finance";
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
  const dates = txs.map((t) => t.date).filter(Boolean).sort();
  const from = dates[0] ?? "";
  const to = dates[dates.length - 1] ?? "";
  const days = Math.max(1, dates.length ? daySpan(from, to) : 1);
  const needsIds = new Set(["housing", "groceries", "transport", "utilities", "health", "tax", "education"]);
  const wantsIds = new Set(["dining", "drinks", "entertainment", "shopping", "travel", "subscriptions"]);
  const saveIds = new Set(["investing", "savings"]);
  let needs = 0;
  let wants = 0;
  let save = 0;
  for (const t of lived.filter((x) => x.type === "expense")) {
    if (needsIds.has(t.categoryId)) needs += t.amount;
    else if (wantsIds.has(t.categoryId)) wants += t.amount;
    else if (saveIds.has(t.categoryId)) save += t.amount;
  }
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
  const payeeCounts = new Map<string, { name: string; n: number; amount: number; type: string }>();
  for (const t of lived) {
    const name = prettyPayee(t.note);
    const key = name.toLowerCase().slice(0, 28);
    const cur = payeeCounts.get(key) ?? { name, n: 0, amount: 0, type: t.type };
    cur.n += 1;
    cur.amount += t.amount;
    payeeCounts.set(key, cur);
  }
  const recurring = [...payeeCounts.values()].filter((p) => p.n >= 2).sort((a, b) => b.amount - a.amount).slice(0, 8);
  const monthsMap = new Map<string, { in: number; out: number }>();
  for (const t of lived) {
    const k = t.date.slice(0, 7);
    const row = monthsMap.get(k) ?? { in: 0, out: 0 };
    if (t.type === "income") row.in += t.amount;
    else row.out += t.amount;
    monthsMap.set(k, row);
  }
  const months = [...monthsMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, in: round2(v.in), out: round2(v.out), net: round2(v.in - v.out) }));
  const outliers = [...lived]
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6)
    .map((t) => ({ date: t.date, amount: round2(t.amount), note: prettyPayee(t.note).slice(0, 60), category: getCategory(t.categoryId).name }));
  return {
    currency: state.settings.currency,
    from,
    to,
    days,
    annualizedIncome: annualize(income, days),
    monthlySpend: round2((expense * 30) / days),
    needs: round2(needs),
    wants: round2(wants),
    save: round2(save),
    livedIncome: round2(income),
    livedSpend: round2(expense),
    net: round2(income - expense),
    savingsRate: income ? Math.round(((income - expense) / income) * 100) : null,
    transferred: round2(transferred),
    transferFlows: transferFlows(txs).slice(0, 8).map((f) => ({ to: f.to, amount: round2(f.amount), count: f.count })),
    categories,
    payees: payeeBreakdown(lived).slice(0, 12).map((p) => ({ name: p.name, amount: round2(p.amount) })),
    recurring: recurring.map((p) => ({ name: p.name, n: p.n, amount: round2(p.amount), type: p.type })),
    months,
    outliers,
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

export function analyzeBooks(snap: CoveSnapshot, txs: Transaction[]) {
  const c = snap.currency;
  const m = (n: number) => money(n, c);
  if (!txs.length) {
    return "No entries yet. Upload a statement or say “add uber income $400” and I’ll log it.";
  }
  const lines: string[] = [];
  lines.push(
    `Across ${snap.from || "this ledger"} to ${snap.to || "now"} you brought in ${m(snap.livedIncome)} and spent ${m(snap.livedSpend)} (net ${m(snap.net)}${snap.savingsRate != null ? `, savings rate ${snap.savingsRate}%` : ""}). Transfers between your own accounts (${m(snap.transferred)}) are not counted as spend.`,
  );
  if (snap.categories.length) {
    const top = snap.categories.filter((x) => x.type === "expense").slice(0, 4);
    if (top.length) {
      const share = (n: number) => (snap.livedSpend ? Math.round((n / snap.livedSpend) * 100) : 0);
      lines.push(`Biggest lived costs: ${top.map((x) => `${x.name} ${m(x.amount)} (${share(x.amount)}%)`).join(", ")}.`);
    }
  }
  if (snap.recurring.length) {
    lines.push(
      `Repeats I can see: ${snap.recurring
        .slice(0, 5)
        .map((p) => `${p.name} ×${p.n} (${m(p.amount)})`)
        .join("; ")}. Those are the habits — change those first if you want the monthly number to move.`,
    );
  }
  if (snap.months.length >= 2) {
    const last = snap.months[snap.months.length - 1]!;
    const prev = snap.months[snap.months.length - 2]!;
    const delta = last.out - prev.out;
    lines.push(
      `${last.month} spend ${m(last.out)} vs ${prev.month} ${m(prev.out)} (${delta >= 0 ? "+" : "−"}${m(Math.abs(delta))}). Income ${last.month} ${m(last.in)}.`,
    );
  }
  if (snap.outliers.length) {
    const biggest = snap.outliers[0]!;
    lines.push(`Largest single out: ${biggest.note} ${m(biggest.amount)} on ${biggest.date} (${biggest.category}).`);
  }
  const flex = snap.categories.filter((x) => ["dining", "drinks", "entertainment", "shopping", "subscriptions"].includes(x.id));
  if (flex.length) {
    const flexTotal = flex.reduce((s, x) => s + x.amount, 0);
    lines.push(`Flexible lines you can cut without touching rent: ${flex.map((x) => `${x.name} ${m(x.amount)}`).join(", ")} — ${m(flexTotal)} in this window.`);
  }
  if (snap.other.length) {
    lines.push(`Still in Other: ${snap.other.slice(0, 4).map((p) => p.name).join(", ")}. Tell me what those really are and I’ll retag them from now on.`);
  }
  if (snap.facts.length) {
    lines.push(`I’m holding ${snap.facts.length} lesson${snap.facts.length === 1 ? "" : "s"} from you (e.g. “${snap.facts[0]}”). I’ll keep using those.`);
  }
  return lines.join("\n\n");
}

export function grokLedgerPayload(snap: CoveSnapshot) {
  return {
    currency: snap.currency,
    window: { from: snap.from, to: snap.to, days: snap.days, entries: snap.entryCount },
    totals: {
      livedIn: snap.livedIncome,
      livedOut: snap.livedSpend,
      net: snap.net,
      savingsRate: snap.savingsRate,
      transferred: snap.transferred,
      monthlySpend: snap.monthlySpend,
      annualizedIncome: snap.annualizedIncome,
    },
    months: snap.months,
    categories: snap.categories.slice(0, 10),
    payees: snap.payees.slice(0, 10),
    recurring: snap.recurring,
    outliers: snap.outliers,
    accounts: snap.accounts,
    budgets: snap.budgets,
    bills: snap.bills,
    rules: snap.rules,
    facts: snap.facts,
    otherUntagged: snap.other,
    recent: snap.recent.slice(0, 16),
    transferFlows: snap.transferFlows,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function daySpan(from: string, to: string) {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
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

export function answerFromSnapshot(question: string, snap: CoveSnapshot, txs: Transaction[] = []) {
  const q = question.toLowerCase().replace(/[’']/g, "'");
  const c = snap.currency;
  const m = (n: number) => money(n, c);

  const gstQ = q.match(/gst (?:on|of|in|for|from)?\s*\$?([\d,]+(?:\.\d{1,2})?)/) || q.match(/(?:add|plus|including) gst (?:to |on )?\$?([\d,]+(?:\.\d{1,2})?)/);
  if (gstQ) {
    const n = parseMoneyish(gstQ[1]);
    if (n && n > 0) {
      if (/add|plus|including|exclusive/.test(q)) {
        return `${n.toFixed(2)} + 15% GST = ${gstInclusive(n).toFixed(2)} (GST ${(gstInclusive(n) - n).toFixed(2)}).`;
      }
      return `If ${n.toFixed(2)} is GST-inclusive, GST is ${gstPortion(n).toFixed(2)} and the exclusive amount is ${gstExclusive(n).toFixed(2)}. If it is exclusive, add GST to get ${gstInclusive(n).toFixed(2)}.`;
    }
  }

  const taxQ =
    q.match(/(?:student loan|sl repay).{0,24}?(\d[\d,]*(?:\.\d+)?)/) ||
    q.match(/(?:tax|take-?home|take home|paye|kiwisaver).{0,24}?(\d[\d,]*(?:\.\d+)?)/) ||
    q.match(/(\d[\d,]*(?:\.\d+)?).{0,16}(gross|salary|a year|annum)/);
  if (taxQ) {
    const gross = parseMoneyish(taxQ[1] ?? taxQ[0]);
    if (gross && gross >= 1000) {
      if (/student loan|sl repay/.test(q)) {
        const sl = takeHome(gross, 0.035, true);
        return `Student loan on $${gross.toLocaleString("en-NZ")}: 12% of income above $24,128 = $${sl.studentLoan.toLocaleString("en-NZ")} a year. Combined with PAYE, ACC and 3.5% KiwiSaver, take-home about ${m(sl.net)} a year.`;
      }
      return explainTax(gross, 0.035, /student loan/.test(q));
    }
  }

  if (/(tax|take-?home|paye).*(salary|income|mine|my pay|books|ledger)|tax on (my )?(salary|income)/.test(q) && snap.annualizedIncome >= 1000) {
    return `Your books show about ${m(snap.livedIncome)} lived income over ${snap.days} day${snap.days === 1 ? "" : "s"} (annualised ${m(snap.annualizedIncome)}). ${explainTax(snap.annualizedIncome)}`;
  }

  if (/emergency fund|rainy day|cash buffer/.test(q) && (snap.livedSpend || snap.monthlySpend)) {
    const monthly = snap.monthlySpend || snap.livedSpend;
    return `Using lived spend of ${m(monthly)} per 30 days in this ledger, a 3-month emergency fund is about ${m(monthly * 3)} and 6 months is ${m(monthly * 6)}. Transfers between your own accounts are not counted.`;
  }

  if (/50\s*\/\s*30\s*\/\s*20|50-30-20/.test(q)) {
    const base = snap.livedIncome || 0;
    const s = split503020(base);
    return `50/30/20 on lived income of ${m(base)} in this window: needs ${m(s.needs)}, wants ${m(s.wants)}, save ${m(s.save)}. Your books: needs ${m(snap.needs)}, wants ${m(snap.wants)}, investing/savings ${m(snap.save)}.`;
  }

  if (/mortgage|how much (house|rent) can i|home loan/.test(q) && snap.annualizedIncome) {
    const monthly = takeHome(snap.annualizedIncome).monthly;
    const band = mortgageComfort(monthly);
    return `Annualised from your books, take-home is about ${m(monthly)} a month. A 25% housing band is ${m(band.conservative)}; 30% is ${m(band.stretch)}. Banks use their own test — this is only a comfort check.`;
  }

  if (/savings rate|overspend|am i ok|health (of )?my (money|books)/.test(q) && !/how am i doing/.test(q)) {
    const cut = snap.categories.filter((x) => ["dining", "drinks", "entertainment", "shopping"].includes(x.id));
    const hint = cut.length
      ? ` Biggest flex lines: ${cut.slice(0, 3).map((x) => `${x.name} ${m(x.amount)}`).join(", ")}.`
      : "";
    return `Lived income ${m(snap.livedIncome)}, lived spend ${m(snap.livedSpend)}, net ${m(snap.net)}${snap.savingsRate != null ? `, savings rate ${snap.savingsRate}%` : ""}. ${snap.transferred ? `${m(snap.transferred)} was only moved between accounts.` : ""}${hint}`;
  }

  if (/what should i cut|where can i save|reduce spend/.test(q)) {
    const flex = snap.categories.filter((x) => ["dining", "drinks", "entertainment", "shopping", "subscriptions"].includes(x.id) && x.amount > 0);
    if (!flex.length) return "I don’t see dining, cafés, leisure, shopping or subscriptions in this window. Import a statement or log those payees and I’ll point at the fat.";
    return `Cut from the flexible lines first:\n${flex.map((x) => `• ${x.name} · ${m(x.amount)}`).join("\n")}\nNeeds (housing, groceries, transport, utilities) are harder to move overnight.`;
  }

  const afford = q.match(/can i afford (?:\$)?([\d,]+(?:\.\d{1,2})?)/) || q.match(/afford (?:\$)?([\d,]+(?:\.\d{1,2})?)/);
  if (afford) {
    const want = parseMoneyish(afford[1]);
    if (want) {
      const leftover = snap.net;
      const ok = leftover >= want;
      return `${ok ? "Yes, on these books" : "Tight"}. Lived net in this window is ${m(leftover)}. ${want.toFixed(2)} is ${ok ? "inside" : "above"} that. After a 3-month emergency fund (${m((snap.monthlySpend || snap.livedSpend) * 3)}) is filled, extras are safer.`;
    }
  }

  if (/budget/.test(q) && snap.budgets.length && !/set |make |change |update /.test(q)) {
    const lines = snap.budgets.map((b) => {
      const spent = snap.categories.find((x) => x.id === b.categoryId)?.amount ?? 0;
      return `• ${b.name}: ${m(spent)} of ${m(b.amount)}`;
    });
    return `Budgets vs this ledger window:\n${lines.join("\n")}`;
  }

  const tail = (q.match(/(?:on|at|for|to)\s+(.+?)\??$/) || [])[1]?.replace(/^(my|the)\s+/, "").trim() ?? "";
  const catId = resolveCategoryAlias(q.replace(/how much(?: did i)?(?: spend| pay)?(?: on| at| for)?/g, "").replace(/[?]/g, "").trim())
    || resolveCategoryAlias(tail);
  if (catId && /how much|spent|spend|total|what.+on/.test(q)) {
    const row = snap.categories.find((x) => x.id === catId);
    const amount = row?.amount ?? 0;
    return `${getCategory(catId).name}: ${m(amount)} in this ledger window${amount ? "" : " (nothing tagged yet)"}.`;
  }

  if (txs.length && /how much|spent|spend|paid|pay|sent|total/.test(q)) {
    const needle = (q.match(/(?:to|on|at|from|for)\s+(.+?)\??$/) || q.match(/how much(?: is| was)?\s+(.+?)\??$/))?.[1]
      ?.replace(/^(my|the)\s+/, "")
      .trim();
    if (needle && needle.length > 1) {
      const n = needle.toLowerCase();
      const hits = txs.filter(
        (t) => t.note.toLowerCase().includes(n) || (t.counterparty ?? "").toLowerCase().includes(n) || t.categoryId === resolveCategoryAlias(n),
      );
      if (hits.length) {
        const out = hits.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        const inn = hits.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const bits = [];
        if (out) bits.push(`${m(out)} out`);
        if (inn) bits.push(`${m(inn)} in`);
        return `${prettyPayee(needle)}: ${bits.join(", ")} across ${hits.length} ${hits.length === 1 ? "entry" : "entries"}.`;
      }
    }
  }

  if (/biggest|top (payee|spend|expense)/.test(q) && snap.payees.length) {
    return `Largest payees: ${snap.payees.slice(0, 6).map((p) => `${p.name} ${m(p.amount)}`).join("; ")}.`;
  }

  return null;
}

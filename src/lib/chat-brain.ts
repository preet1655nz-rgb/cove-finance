import { getCategory } from "./categories";
import { money } from "./format";
import {
  applyRulesToTxs,
  classifyNote,
  livingTxs,
  pairTransfers,
  payeeBreakdown,
  prettyPayee,
  resolveCategoryAlias,
  transferFlows,
} from "./intelligence";
import { analyzeBooks, answerFromSnapshot, buildSnapshot, formatSnapshotBrief } from "./cove-expert";
import { formatCards, retrieveKnowledge } from "./cove-knowledge";
import { explainTax, parseMoneyish } from "./nz-finance";
import { parseDate } from "./statement";
import type { BankAccount, Budget, CoveFact, MemoryRule, RecurringBill, Settings, Transaction, TxType } from "./types";
import { todayISO, uid } from "./utils";

export type PendingIntent = {
  kind: "add" | "edit" | "delete";
  txType?: TxType;
  amount?: number;
  note?: string;
  date?: string;
  categoryId?: string;
  match?: string;
  matchId?: string;
  asked?: "date" | "amount" | "which" | "confirm";
};

export type BrainContext = {
  transactions: Transaction[];
  accounts: BankAccount[];
  rules: MemoryRule[];
  budgets: Budget[];
  bills: RecurringBill[];
  facts: CoveFact[];
  settings: Settings;
  currency: string;
  pending?: PendingIntent | null;
};

export type BrainEffect = {
  reply: string;
  rules?: MemoryRule[];
  accounts?: BankAccount[];
  transactions?: Transaction[];
  budgets?: Budget[];
  bills?: RecurringBill[];
  facts?: CoveFact[];
  settings?: Settings;
  pending?: PendingIntent | null;
  handled?: boolean;
  needsAi?: boolean;
};

function sum(txs: Transaction[]) {
  return txs.reduce((s, t) => s + t.amount, 0);
}

function matching(txs: Transaction[], needle: string) {
  const n = needle.trim().toLowerCase();
  if (!n) return [];
  return txs.filter(
    (t) =>
      t.note.toLowerCase().includes(n) ||
      (t.counterparty ?? "").toLowerCase().includes(n) ||
      prettyPayee(t.note).toLowerCase().includes(n),
  );
}

function fmt(amount: number, currency: string) {
  return money(amount, currency);
}

function learnPayee(ctx: BrainContext, note: string, categoryId: string): { rules: MemoryRule[]; facts: CoveFact[] } {
  const pattern = prettyPayee(note)
    .replace(/^(DD|DC|BP|AP|VT|EP|AT)\s+/i, "")
    .split(/\s+/)
    .slice(0, 3)
    .join(" ")
    .trim()
    .slice(0, 40);
  if (pattern.length < 3) return { rules: ctx.rules, facts: ctx.facts };
  const rules = [
    ...ctx.rules.filter((r) => r.pattern.toLowerCase() !== pattern.toLowerCase()),
    { id: uid(), pattern, kind: "category" as const, categoryId },
  ];
  const text = `${pattern} is ${getCategory(categoryId).name}`;
  const facts = [...ctx.facts.filter((f) => f.text.toLowerCase() !== text.toLowerCase()), { id: uid(), text }].slice(-40);
  return { rules, facts };
}

function parseLooseDate(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^(on|date|dated|the date(?: is)?|it's|it is|date is)\s+/i, "")
    .replace(/[?.!]+$/, "")
    .trim();
  if (!cleaned) return null;
  const direct = parseDate(cleaned, true) ?? parseDate(cleaned.replace(/\s+/g, " "), true);
  if (direct) return direct;
  const embedded = cleaned.match(
    /\b(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b/i,
  );
  if (embedded) return parseDate(embedded[1], true);
  return null;
}

function extractAmountToken(q: string): number | null {
  const dollar = q.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (dollar) return parseMoneyish(dollar[1]);
  const asDollars = q.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(?:dollars?|nzd)\b/i);
  if (asDollars) return parseMoneyish(asDollars[1]);
  const bare = q.match(/(?:^|\s)([\d,]+(?:\.\d{1,2})?)(?=\s|$)/g);
  if (bare) {
    for (const token of bare) {
      const n = parseMoneyish(token);
      if (n && n >= 1 && n < 10_000_000 && n !== 2025 && n !== 2026 && n !== 2027) return n;
    }
  }
  return null;
}

function inferType(q: string, note: string): TxType | undefined {
  if (/\b(income|earned|earning|inflow|deposit|refund|got paid|was paid|salary)\b/i.test(q)) return "income";
  if (/\b(expense|spent|paid|outflow|purchase|cost)\b/i.test(q)) return "expense";
  const tagged = classifyNote(note || q, "expense");
  if (tagged.categoryId === "other-income" || tagged.categoryId === "salary" || tagged.categoryId === "freelance" || tagged.categoryId === "gig" || tagged.categoryId === "investments" || tagged.categoryId === "gifts") {
    return "income";
  }
  return undefined;
}

function stripCommandNoise(q: string) {
  return q
    .replace(/^(add|log|record|enter|create|edit|change|update|fix|amend|delete|remove|drop|erase)\b/i, " ")
    .replace(/\b(income|expense|entry|entries|transaction|transactions|an|a|the|for|of|as|to|from|on|dated|date|dollars?|nzd|nz)\b/gi, " ")
    .replace(/\$\s*[\d,]+(?:\.\d{1,2})?/g, " ")
    .replace(/\b[\d,]+(?:\.\d{1,2})?\b/g, " ")
    .replace(/\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function describeTx(t: Transaction, currency: string) {
  return `${t.date} · ${t.type} ${fmt(t.amount, currency)} · ${t.note || getCategory(t.categoryId).name}`;
}

function buildAdd(
  ctx: BrainContext,
  parts: { amount: number; note: string; date: string; txType: TxType },
): BrainEffect {
  const tagged = classifyNote(parts.note || parts.txType, parts.txType, ctx.rules);
  let categoryId = tagged.categoryId;
  if (parts.txType === "income" && getCategory(categoryId).type !== "income") {
    categoryId = classifyNote(parts.note, "income", ctx.rules).categoryId;
  }
  if (parts.txType === "expense" && getCategory(categoryId).type !== "expense") {
    categoryId = classifyNote(parts.note, "expense", ctx.rules).categoryId;
  }
  const row: Transaction = {
    id: uid(),
    type: parts.txType,
    amount: parts.amount,
    categoryId,
    note: prettyPayee(parts.note) || getCategory(categoryId).name,
    date: parts.date,
    createdAt: new Date().toISOString(),
    counterparty: tagged.counterparty,
    transfer: tagged.transfer,
  };
  const learned = learnPayee(ctx, row.note, categoryId);
  return {
    reply: `Entry added for ${row.type} ${row.note} ${fmt(row.amount, ctx.currency)} dated ${row.date}.`,
    transactions: [row, ...ctx.transactions],
    rules: learned.rules,
    facts: learned.facts,
    pending: null,
    handled: true,
  };
}

function completePending(input: string, q: string, ctx: BrainContext): BrainEffect | null {
  const pending = ctx.pending;
  if (!pending) return null;

  if (pending.asked === "date" || (!pending.date && pending.kind === "add")) {
    const date = parseLooseDate(input);
    if (date && pending.kind === "add" && pending.amount && pending.note) {
      return buildAdd(ctx, {
        amount: pending.amount,
        note: pending.note,
        date,
        txType: pending.txType ?? "expense",
      });
    }
    if (date && pending.kind === "edit") {
      pending.date = date;
    }
  }

  if (pending.asked === "amount" || (pending.kind !== "delete" && !pending.amount)) {
    const amount = extractAmountToken(q);
    if (amount && pending.kind === "add" && pending.note) {
      const date = pending.date || parseLooseDate(input);
      if (!date) {
        return {
          reply: "What date should I use?",
          pending: { ...pending, amount, asked: "date" },
          handled: true,
        };
      }
      return buildAdd(ctx, {
        amount,
        note: pending.note,
        date,
        txType: pending.txType ?? inferType(q, pending.note) ?? "expense",
      });
    }
    if (amount && pending.kind === "edit") {
      pending.amount = amount;
    }
  }

  if (pending.kind === "delete" && /^(yes|y|ok|okay|confirm|do it|please)$/i.test(q.trim())) {
    const hits = pending.matchId
      ? ctx.transactions.filter((t) => t.id === pending.matchId)
      : matching(ctx.transactions, pending.match ?? pending.note ?? "");
    if (!hits.length) return { reply: "Nothing left to delete.", pending: null, handled: true };
    const ids = new Set(hits.slice(0, 1).map((t) => t.id));
    const removed = hits[0]!;
    return {
      reply: `Deleted ${describeTx(removed, ctx.currency)}.`,
      transactions: ctx.transactions.filter((t) => !ids.has(t.id)),
      pending: null,
      handled: true,
    };
  }

  if (pending.kind === "edit") {
    const hits = pending.matchId
      ? ctx.transactions.filter((t) => t.id === pending.matchId)
      : matching(ctx.transactions, pending.match ?? pending.note ?? "");
    const target = hits[0];
    if (!target) return { reply: "I can’t find that entry any more.", pending: null, handled: true };
    const date = pending.date ?? parseLooseDate(input) ?? target.date;
    const amount = pending.amount ?? extractAmountToken(q) ?? target.amount;
    const txType = pending.txType ?? target.type;
    const note = pending.note ?? target.note;
    const categoryId = pending.categoryId ?? (txType !== target.type ? classifyNote(note, txType, ctx.rules).categoryId : target.categoryId);
    const next = ctx.transactions.map((t) =>
      t.id === target.id ? { ...t, date, amount, type: txType, note, categoryId } : t,
    );
    return {
      reply: `Updated to ${txType} ${note} ${fmt(amount, ctx.currency)} dated ${date}.`,
      transactions: next,
      pending: null,
      handled: true,
    };
  }

  if (pending.kind === "add" && pending.amount && pending.note) {
    const date = parseLooseDate(input);
    if (date) {
      return buildAdd(ctx, {
        amount: pending.amount,
        note: pending.note,
        date,
        txType: pending.txType ?? "expense",
      });
    }
    return { reply: "What date should I use? (e.g. 08/08/2026)", pending, handled: true };
  }

  return null;
}

function handleAdd(input: string, q: string, ctx: BrainContext): BrainEffect | null {
  if (!/^(add|log|record|enter|create)\b/.test(q)) return null;
  if (/\bgst\b/.test(q) || /\bbudget\b/.test(q) || /\brule\b/.test(q)) return null;
  const amount = extractAmountToken(q);
  const date = parseLooseDate(
    (input.match(/\b(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b/i) ?? [])[0] ??
      (/\btoday\b/.test(q) ? todayISO() : ""),
  );
  const note = stripCommandNoise(input) || "Entry";
  const txType = inferType(q, note);
  if (!amount) {
    return {
      reply: `What amount for ${prettyPayee(note)}?`,
      pending: { kind: "add", note, txType, date: date ?? undefined, asked: "amount" },
      handled: true,
    };
  }
  if (!date && !/\btoday\b/.test(q)) {
    return {
      reply: "What date should I use?",
      pending: { kind: "add", amount, note, txType: txType ?? "expense", asked: "date" },
      handled: true,
    };
  }
  return buildAdd(ctx, {
    amount,
    note,
    date: date || todayISO(),
    txType: txType ?? "expense",
  });
}

function handleEdit(input: string, q: string, ctx: BrainContext): BrainEffect | null {
  if (!/^(edit|change|update|fix|amend)\b/.test(q)) return null;
  if (/\bbudget\b/.test(q) || /\brule\b/.test(q)) return null;
  const amount = extractAmountToken(q);
  const date = parseLooseDate(
    (input.match(/\b(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2})\b/) ?? [])[0] ?? "",
  );
  const last = /last|latest|previous/.test(q);
  const needle = stripCommandNoise(input);
  const hits = last
    ? [...ctx.transactions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 1)
    : matching(ctx.transactions, needle);
  if (!hits.length) {
    return { reply: needle ? `I can’t find an entry matching “${needle}”.` : "Which entry should I change?", handled: true };
  }
  if (hits.length > 1 && !amount && !date) {
    const lines = hits.slice(0, 6).map((t) => `• ${describeTx(t, ctx.currency)}`).join("\n");
    return {
      reply: `A few match. Tell me the date or amount, or say “delete the ${fmt(hits[0]!.amount, ctx.currency)} one”.\n${lines}`,
      pending: { kind: "edit", match: needle, note: needle, asked: "which" },
      handled: true,
    };
  }
  const target = hits[0]!;
  const txType = inferType(q, needle) ?? target.type;
  const nextAmount = amount ?? target.amount;
  const nextDate = date ?? target.date;
  const nextNote = needle.length >= 2 ? prettyPayee(needle) : target.note;
  const categoryId = txType !== target.type ? classifyNote(nextNote, txType, ctx.rules).categoryId : target.categoryId;
  return {
    reply: `Updated to ${txType} ${nextNote} ${fmt(nextAmount, ctx.currency)} dated ${nextDate}.`,
    transactions: ctx.transactions.map((t) =>
      t.id === target.id ? { ...t, amount: nextAmount, date: nextDate, type: txType, note: nextNote, categoryId } : t,
    ),
    pending: null,
    handled: true,
  };
}

function handleDelete(input: string, q: string, ctx: BrainContext): BrainEffect | null {
  if (!/^(delete|remove|drop|erase)\b/.test(q)) return null;
  if (/\bbudget\b/.test(q) || /\brule\b/.test(q) || /\bbill\b/.test(q)) return null;
  const last = /last|latest|previous/.test(q);
  const needle = stripCommandNoise(input);
  const amount = extractAmountToken(q);
  let hits = last
    ? [...ctx.transactions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 1)
    : matching(ctx.transactions, needle);
  if (amount) hits = hits.filter((t) => Math.abs(t.amount - amount) < 0.009) ;
  if (!hits.length) return { reply: needle ? `Nothing matching “${needle}” to delete.` : "Which entry should I delete?", handled: true };
  if (hits.length > 1 && !last) {
    const lines = hits.slice(0, 6).map((t) => `• ${describeTx(t, ctx.currency)}`).join("\n");
    return {
      reply: `I found ${hits.length} matching entries. Reply “yes” to delete the most recent, or name the date.\n${lines}`,
      pending: { kind: "delete", match: needle, matchId: hits[0]!.id, note: needle, asked: "confirm" },
      handled: true,
    };
  }
  const removed = hits[0]!;
  return {
    reply: `Deleted ${describeTx(removed, ctx.currency)}.`,
    transactions: ctx.transactions.filter((t) => t.id !== removed.id),
    pending: null,
    handled: true,
  };
}

export function interpretChat(input: string, ctx: BrainContext): BrainEffect {
  const text = input.trim();
  const q = text.toLowerCase().replace(/[’']/g, "'");
  const currency = ctx.currency || ctx.settings?.currency || "NZD";
  ctx = {
    ...ctx,
    budgets: ctx.budgets ?? [],
    bills: ctx.bills ?? [],
    facts: ctx.facts ?? [],
    rules: ctx.rules ?? [],
    accounts: ctx.accounts ?? [],
    transactions: ctx.transactions ?? [],
  };
  const snap = buildSnapshot({
    transactions: ctx.transactions,
    accounts: ctx.accounts,
    rules: ctx.rules,
    budgets: ctx.budgets ?? [],
    bills: ctx.bills ?? [],
    facts: ctx.facts ?? [],
    settings: ctx.settings ?? { displayName: "", currency, browserNotifications: false, budgetAlertPct: 80 },
  });

  if (!q || /^(help|what can you do|\?)$/i.test(q)) {
    return {
      reply:
        "I can add, edit or delete entries, read your statement, and analyse patterns in the books. Try “add uber income $400”, “delete the uber on 08/08/2026”, “how am I doing?”, or “what patterns do you see?”.",
      handled: true,
    };
  }

  if (/^(hi|hello|hey)\b/.test(q)) {
    return { reply: "Cove here — I can see your ledger. Add, edit, or delete entries, or ask me what the numbers actually mean.", handled: true };
  }

  if (ctx.pending) {
    const isNewCommand = /^(add|log|record|enter|create|edit|change|update|delete|remove|how|what|set|tax|gst|list|remember)\b/.test(q);
    if (!isNewCommand) {
      const done = completePending(text, q, ctx);
      if (done) return done;
    }
  }

  const added = handleAdd(text, q, ctx);
  if (added) return added;
  const edited = handleEdit(text, q, ctx);
  if (edited) return edited;
  const deleted = handleDelete(text, q, ctx);
  if (deleted) return deleted;

  const grounded = answerFromSnapshot(text, snap, ctx.transactions);
  if (grounded) return { reply: grounded, handled: true };

  const taxBare = q.match(/^(?:what(?:'s| is)|calculate|estimate)?\s*(?:the )?nzd? (?:income )?tax (?:on |for )\$?([\d,]+)/i)
    || q.match(/tax on (?:\$)?([\d,]+)/i);
  if (taxBare) {
    const gross = parseMoneyish(taxBare[1]);
    if (gross && gross >= 1000) return { reply: explainTax(gross), handled: true };
  }

  const budgetSet = q.match(/^(?:set|make|change|update)\s+(?:my\s+)?(.+?)\s+budget\s+(?:to\s+)?\$?([\d,]+(?:\.\d{1,2})?)/i)
    || q.match(/^budget\s+(.+?)\s+(?:at|to|=)\s+\$?([\d,]+(?:\.\d{1,2})?)/i);
  if (budgetSet) {
    const categoryId = resolveCategoryAlias(budgetSet[1]);
    const amount = parseMoneyish(budgetSet[2]);
    if (categoryId && amount) {
      const budgets = ctx.budgets.some((b) => b.categoryId === categoryId)
        ? ctx.budgets.map((b) => (b.categoryId === categoryId ? { ...b, amount } : b))
        : [...ctx.budgets, { id: uid(), categoryId, amount }];
      return { reply: `${getCategory(categoryId).name} budget is now ${fmt(amount, currency)}.`, budgets, handled: true };
    }
  }

  const remember = q.match(/^(?:remember|note that|save that|learn that)\s+(.+)/i);
  if (remember) {
    const fact = remember[1].trim();
    const facts = [...(ctx.facts ?? []).filter((f) => f.text.toLowerCase() !== fact.toLowerCase()), { id: uid(), text: fact }].slice(-40);
    return { reply: `I’ll remember: ${fact}`, facts, handled: true };
  }

  const isRule = q.match(/^(.+?)\s+(is|are|means|=|equals)\s+(?:an?\s+|the\s+)?(.+)$/i);
  const transferRule = q.match(/^(.+?)\s+is\s+(?:a\s+)?transfers?\s+to\s+(.+)$/i)
    || q.match(/^treat\s+(.+?)\s+as\s+(?:a\s+)?transfers?\s+to\s+(.+)$/i);

  if (transferRule) {
    const pattern = transferRule[1].replace(/^anything (to|from|with)\s+/i, "").trim();
    const accountName = transferRule[2].replace(/\.$/, "").trim();
    const rule: MemoryRule = { id: uid(), pattern, kind: "transfer", accountName };
    const rules = [...ctx.rules.filter((r) => r.pattern.toLowerCase() !== pattern.toLowerCase()), rule];
    let accounts = ctx.accounts;
    if (!accounts.some((a) => a.name.toLowerCase() === accountName.toLowerCase())) {
      accounts = [...accounts, { id: uid(), name: accountName, bank: "other" }];
    }
    const transactions = pairTransfers(applyRulesToTxs(ctx.transactions, rules), accounts);
    const hits = matching(transactions, pattern);
    return {
      reply: `Remembered: “${pattern}” is a transfer to ${accountName}. ${hits.length ? `Updated ${hits.length} ${hits.length === 1 ? "entry" : "entries"} (${fmt(sum(hits), currency)}).` : "I’ll use this on the next import."}`,
      rules,
      accounts,
      transactions,
      handled: true,
    };
  }

  if (isRule) {
    const pattern = isRule[1].replace(/^(treat|call|mark)\s+/i, "").trim();
    const target = isRule[3].replace(/\.$/, "").trim();
    if (/transfer/.test(target) && / to /.test(target)) {
      return interpretChat(`${pattern} is a transfer to ${target.replace(/^.*\bto\s+/i, "")}`, ctx);
    }
    const categoryId = resolveCategoryAlias(target);
    if (categoryId) {
      const rule: MemoryRule = { id: uid(), pattern, kind: "category", categoryId };
      const rules = [...ctx.rules.filter((r) => r.pattern.toLowerCase() !== pattern.toLowerCase()), rule];
      const transactions = pairTransfers(applyRulesToTxs(ctx.transactions, rules), ctx.accounts);
      const hits = matching(transactions, pattern);
      const cat = getCategory(categoryId);
      return {
        reply: `Got it — ${prettyPayee(pattern)} is ${cat.name}. ${hits.length ? `${hits.length} ${hits.length === 1 ? "entry" : "entries"} retagged (${fmt(sum(hits), currency)}).` : "I’ll apply this next time that name appears."}`,
        rules,
        transactions,
        handled: true,
      };
    }
  }

  const rename = q.match(/^rename(?:\s+account)?\s+(.+?)\s+to\s+(.+)$/i);
  if (rename) {
    const from = rename[1].trim();
    const to = rename[2].replace(/\.$/, "").trim();
    const accounts = ctx.accounts.map((a) =>
      a.name.toLowerCase() === from.toLowerCase() || a.bank === from.toLowerCase() ? { ...a, name: to } : a,
    );
    if (accounts.every((a, i) => a.name === ctx.accounts[i]?.name)) {
      return { reply: `I don’t have an account called ${from}. Link a statement first, or say “${from} is a transfer to ${to}”.`, handled: true };
    }
    return { reply: `I’ll call that account ${to}.`, accounts, handled: true };
  }

  if (/list (my )?rules|what do you remember|memory/.test(q)) {
    const bits: string[] = [];
    if (ctx.rules.length) {
      bits.push(ctx.rules.map((r) =>
        r.kind === "transfer"
          ? `• “${r.pattern}” → transfer to ${r.accountName}`
          : `• “${r.pattern}” → ${getCategory(r.categoryId ?? "other").name}`,
      ).join("\n"));
    }
    if (ctx.facts?.length) bits.push(ctx.facts.map((f) => `• ${f.text}`).join("\n"));
    if (!bits.length) return { reply: "No rules yet. Say something like “Sharesies is investing”.", handled: true };
    return { reply: bits.join("\n"), handled: true };
  }

  if (/list (my )?accounts|which accounts/.test(q)) {
    if (!ctx.accounts.length) return { reply: "No bank accounts linked yet. Upload a statement and I’ll attach it to an account.", handled: true };
    const lines = ctx.accounts.map((a) => {
      const slice = ctx.transactions.filter((t) => t.accountId === a.id);
      const bal = slice.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
      return `• ${a.name}${a.bank && a.bank !== "other" ? ` (${a.bank.toUpperCase()})` : ""} · ${fmt(bal, currency)} · ${slice.length} entries`;
    });
    return { reply: lines.join("\n"), handled: true };
  }

  if (/transfers?|moved between|sent to/.test(q) && /list|show|what|how much/.test(q)) {
    const flows = transferFlows(ctx.transactions);
    if (!flows.length) return { reply: "I haven’t spotted transfers yet. Link two statements, or tell me “X is a transfer to Y”.", handled: true };
    const lines = flows.map((f) => `• ${fmt(f.amount, currency)} → ${f.to} (${f.count} ${f.count === 1 ? "move" : "moves"})`);
    return { reply: `Money moved between your accounts:\n${lines.join("\n")}`, handled: true };
  }

  const howMuch = q.match(/how much(?: did i)?(?: (?:send|transfer|spend|pay|get|make))?(?:d)?\s+(?:to|on|at|from|for)\s+(.+?)[\?]?$/i)
    || q.match(/how much(?: is| was)?\s+(.+?)[\?]?$/i);
  if (howMuch && !/other$/.test(howMuch[1])) {
    const needle = howMuch[1].replace(/^(my|the)\s+/, "").trim();
    const hits = matching(ctx.transactions, needle);
    if (!hits.length) return { reply: `Nothing matching “${needle}” yet.`, handled: true };
    const out = sum(hits.filter((t) => t.type === "expense"));
    const inn = sum(hits.filter((t) => t.type === "income"));
    const bits = [];
    if (out) bits.push(`${fmt(out, currency)} out`);
    if (inn) bits.push(`${fmt(inn, currency)} in`);
    return { reply: `${prettyPayee(needle)}: ${bits.join(", ")} across ${hits.length} ${hits.length === 1 ? "entry" : "entries"}.`, handled: true };
  }

  if (/what('?s| is) (in )?(other|other income)|break down other/.test(q)) {
    const other = ctx.transactions.filter((t) => t.categoryId === "other" || t.categoryId === "other-income");
    if (!other.length) return { reply: "Nothing is sitting in Other right now.", handled: true };
    const top = payeeBreakdown(other).slice(0, 8);
    const lines = top.map((p) => `• ${p.name} · ${fmt(p.amount, currency)}`);
    return { reply: `Other is a mix of unnamed payees. Teach me (“${top[0]?.name} is groceries”) and I’ll retag them.\n${lines.join("\n")}`, handled: true };
  }

  if (/spending|spent|where did/.test(q) && !/pattern|unusual|trend/.test(q)) {
    const slice = livingTxs(ctx.transactions).filter((t) => t.type === "expense");
    const byCat = new Map<string, number>();
    for (const t of slice) byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
    const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (!top.length) return { reply: "No living spend recorded yet — transfers between your own accounts don’t count as spending.", handled: true };
    return {
      reply: `Lived spending (transfers excluded):\n${top.map(([id, n]) => `• ${getCategory(id).name} · ${fmt(n, currency)}`).join("\n")}`,
      handled: true,
    };
  }

  if (/undo last rule|forget last/.test(q)) {
    if (!ctx.rules.length) return { reply: "No rules to forget.", handled: true };
    const rules = ctx.rules.slice(0, -1);
    const dropped = ctx.rules[ctx.rules.length - 1];
    const transactions = pairTransfers(applyRulesToTxs(ctx.transactions, rules), ctx.accounts);
    return { reply: `Forgot the rule for “${dropped?.pattern}”.`, rules, transactions, handled: true };
  }

  if (/pattern|unusual|trend|analyse|analyze|insight|how am i|where does (my )?money|recurring|leak/.test(q)) {
    return { reply: analyzeBooks(snap, ctx.transactions), handled: true, needsAi: true };
  }

  const isQuestion = /\?|^(what|how|why|should|can|do|does|is|are|when|where|who|which|explain|tell|calculate|estimate|compare)\b/.test(q);
  const policyQ = /\b(tax band|kiwisaver|gst|pir|student loan|ird|paye|ocr|minimum wage|nz super)\b/.test(q) && !/\b(my|i spend|ledger|books|this month)\b/.test(q);
  const cards = retrieveKnowledge(text, isQuestion ? 3 : 2);
  if (isQuestion && policyQ && cards.length) {
    const extra = formatSnapshotBrief(snap);
    return { reply: `${formatCards(cards)}${snap.entryCount ? `\n\nYour books: ${extra.split("\n")[0]}.` : ""}`, handled: true };
  }

  if (snap.entryCount) {
    return { reply: analyzeBooks(snap, ctx.transactions), needsAi: true, handled: true };
  }

  const extra = cards.length ? `\n\n${formatCards(cards.slice(0, 1))}` : "";
  return {
    reply: `No entries yet. Upload a statement, or say “add uber income $400”.${extra}`,
    needsAi: true,
    handled: false,
  };
}

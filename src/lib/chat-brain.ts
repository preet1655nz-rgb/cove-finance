import { CATEGORIES, getCategory } from "./categories";
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
import type { BankAccount, MemoryRule, Transaction } from "./types";
import { uid } from "./utils";

export type BrainContext = {
  transactions: Transaction[];
  accounts: BankAccount[];
  rules: MemoryRule[];
  currency: string;
};

export type BrainEffect = {
  reply: string;
  rules?: MemoryRule[];
  accounts?: BankAccount[];
  transactions?: Transaction[];
};

function sum(txs: Transaction[]) {
  return txs.reduce((s, t) => s + t.amount, 0);
}

function matching(txs: Transaction[], needle: string) {
  const n = needle.trim().toLowerCase();
  return txs.filter((t) => t.note.toLowerCase().includes(n) || (t.counterparty ?? "").toLowerCase().includes(n));
}

function fmt(amount: number, currency: string) {
  return money(amount, currency);
}

export function interpretChat(input: string, ctx: BrainContext): BrainEffect {
  const text = input.trim();
  const q = text.toLowerCase().replace(/[’']/g, "'");
  const currency = ctx.currency || "NZD";

  if (!q || /^(help|what can you do|\?)$/i.test(q)) {
    return {
      reply:
        "Tell me how to classify things, and I remember. Try “Sharesies is investing”, “guri wstpac saving is a transfer to Westpac savings”, “how much to Westpac”, or “what is in Other”.",
    };
  }

  if (/^(hi|hello|hey)\b/.test(q)) {
    return { reply: "I’m Cove. I remember your accounts and rules. What should I learn?" };
  }

  const isRule = q.match(/^(.+?)\s+(is|are|means|=|equals)\s+(?:an?\s+|the\s+)?(.+)$/i);
  const transferRule = q.match(
    /^(.+?)\s+is\s+(?:a\s+)?transfers?\s+to\s+(.+)$/i,
  ) || q.match(/^treat\s+(.+?)\s+as\s+(?:a\s+)?transfers?\s+to\s+(.+)$/i);

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
    };
  }

  if (isRule) {
    const pattern = isRule[1].replace(/^(treat|call|mark)\s+/i, "").trim();
    const target = isRule[3].replace(/\.$/, "").trim();
    if (/transfer/.test(target) && / to /.test(target)) {
      const to = target.replace(/^.*\bto\s+/i, "");
      return interpretChat(`${pattern} is a transfer to ${to}`, ctx);
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
      return { reply: `I don’t have an account called ${from}. Link a statement first, or say “${from} is a transfer to ${to}”.` };
    }
    return { reply: `I’ll call that account ${to}.`, accounts };
  }

  if (/list (my )?rules|what do you remember|memory/.test(q)) {
    if (!ctx.rules.length) return { reply: "No rules yet. Say something like “Sharesies is investing”." };
    return {
      reply: ctx.rules
        .map((r) =>
          r.kind === "transfer"
            ? `• “${r.pattern}” → transfer to ${r.accountName}`
            : `• “${r.pattern}” → ${getCategory(r.categoryId ?? "other").name}`,
        )
        .join("\n"),
    };
  }

  if (/list (my )?accounts|which accounts/.test(q)) {
    if (!ctx.accounts.length) return { reply: "No bank accounts linked yet. Upload a statement and I’ll attach it to an account." };
    const lines = ctx.accounts.map((a) => {
      const slice = ctx.transactions.filter((t) => t.accountId === a.id);
      const bal = slice.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
      return `• ${a.name}${a.bank && a.bank !== "other" ? ` (${a.bank.toUpperCase()})` : ""} · ${fmt(bal, currency)} · ${slice.length} entries`;
    });
    return { reply: lines.join("\n") };
  }

  if (/transfers?|moved between|sent to/.test(q) && /list|show|what|how much/.test(q)) {
    const flows = transferFlows(ctx.transactions);
    if (!flows.length) return { reply: "I haven’t spotted transfers yet. Link two statements, or tell me “X is a transfer to Y”." };
    const lines = flows.map((f) => `• ${fmt(f.amount, currency)} → ${f.to} (${f.count} ${f.count === 1 ? "move" : "moves"})`);
    return { reply: `Money moved between your accounts:\n${lines.join("\n")}` };
  }

  const howMuch = q.match(/how much(?: did i)?(?: (?:send|transfer|spend|pay|get|make))?(?:d)?\s+(?:to|on|at|from|for)\s+(.+?)[\?]?$/i)
    || q.match(/how much(?: is| was)?\s+(.+?)[\?]?$/i);
  if (howMuch && !/other$/.test(howMuch[1])) {
    const needle = howMuch[1].replace(/^(my|the)\s+/, "").trim();
    const hits = matching(ctx.transactions, needle);
    if (!hits.length) return { reply: `Nothing matching “${needle}” yet.` };
    const out = sum(hits.filter((t) => t.type === "expense"));
    const inn = sum(hits.filter((t) => t.type === "income"));
    const bits = [];
    if (out) bits.push(`${fmt(out, currency)} out`);
    if (inn) bits.push(`${fmt(inn, currency)} in`);
    return { reply: `${prettyPayee(needle)}: ${bits.join(", ")} across ${hits.length} ${hits.length === 1 ? "entry" : "entries"}.` };
  }

  if (/what('?s| is) (in )?(other|other income)|break down other/.test(q)) {
    const other = ctx.transactions.filter((t) => t.categoryId === "other" || t.categoryId === "other-income");
    if (!other.length) return { reply: "Nothing is sitting in Other right now." };
    const top = payeeBreakdown(other).slice(0, 8);
    const lines = top.map((p) => `• ${p.name} · ${fmt(p.amount, currency)}`);
    return { reply: `Other is a mix of unnamed payees. Teach me (“${top[0]?.name} is groceries”) and I’ll retag them.\n${lines.join("\n")}` };
  }

  if (/spending|spent|where did/.test(q)) {
    const slice = livingTxs(ctx.transactions).filter((t) => t.type === "expense");
    const byCat = new Map<string, number>();
    for (const t of slice) byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
    const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (!top.length) return { reply: "No living spend recorded yet — transfers between your own accounts don’t count as spending." };
    return {
      reply: `Lived spending (transfers excluded):\n${top.map(([id, n]) => `• ${getCategory(id).name} · ${fmt(n, currency)}`).join("\n")}`,
    };
  }

  if (/undo last rule|forget last/.test(q)) {
    if (!ctx.rules.length) return { reply: "No rules to forget." };
    const rules = ctx.rules.slice(0, -1);
    const dropped = ctx.rules[ctx.rules.length - 1];
    const transactions = pairTransfers(applyRulesToTxs(ctx.transactions, rules), ctx.accounts);
    return { reply: `Forgot the rule for “${dropped?.pattern}”.`, rules, transactions };
  }

  const classified = classifyNote(text, "expense", ctx.rules);
  if (classified.categoryId !== "other") {
    return {
      reply: `I would file that under ${getCategory(classified.categoryId).name}. Say “${prettyPayee(text)} is …” if that’s wrong.`,
    };
  }

  const known = CATEGORIES.map((c) => c.name.toLowerCase());
  return {
    reply: `I can remember rules, retag entries, and track transfers between accounts. Names I know: ${known.slice(0, 8).join(", ")}…`,
  };
}

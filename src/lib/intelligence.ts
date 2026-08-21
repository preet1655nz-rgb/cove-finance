import { getCategory, isTransferCategory } from "./categories";
import type { BankAccount, MemoryRule, Transaction, TransferLeg, TxType } from "./types";
import { uid } from "./utils";

export const BUILTIN_RULES: { re: RegExp; id: string }[] = [
  { re: /\b(salary|salaire|wages?|payroll|paye|wage\/salary|employer|auckland dhb)\b/i, id: "salary" },
  { re: /\b(freelance|invoice|contract work|consult|north studio)\b/i, id: "freelance" },
  { re: /\b(didi mobility|didi|uber bv|ola rides|zoomy)\b/i, id: "gig" },
  { re: /\buber eats\b/i, id: "dining" },
  { re: /\b(uber trip|uber rides?|uber\s*\*trip)\b/i, id: "transport" },
  { re: /\b(dividend|interest earned|westpac interest|\binterest\b)\b/i, id: "investments" },
  { re: /\b(sharesies|hatch|investnow|kernel|smartshares|simplicity|stake\.app|tiger broker|shares nominee)\b/i, id: "investing" },
  { re: /\b(gift|birthday|present from)\b/i, id: "gifts" },
  { re: /\b(tax refund|gst return)\b/i, id: "other-income" },
  { re: /\b(ird|inland revenue).*\b(iit|tax|gst|debit)\b|\b(iit|provisional tax|paye tax)\b/i, id: "tax" },
  { re: /\binland revenue dept\b|\bdd inland revenue\b/i, id: "tax" },
  { re: /\binland revenue\b.*\bwage/i, id: "salary" },
  { re: /\b(rent|landlord|barfoot|harcourts|mortgage|kauri rentals|quinovic|seaview trust)\b/i, id: "housing" },
  { re: /\b(countdown|new world|pak'? ?n ?save|paknsave|farro|woolworths|fresh choice|four square|coles|aldi|tesco|grocery|fruit shop|vege|foodmart|yogiji|bombay bazaa|funky pumpki|5 rivers)\b/i, id: "groceries" },
  { re: /\b(uber eats|deliveroo|menulog|doordash|mcdonald|kfc|subway|dominos|pizza|burger|restaurant|bistro|kitchen|takeaway|amano|coco'?s|orphans|sweets)\b/i, id: "dining" },
  { re: /\b(allpress|starbucks|coffee|caf[eé]|espresso|l'?affare|gloria jean)\b/i, id: "drinks" },
  { re: /\b(netflix|spotify|icloud|disney|youtube|apple\.com\/bill|google one|dropbox|subscription)\b/i, id: "subscriptions" },
  { re: /\b(waitomo|bp connect|z energy|mobil|shell|gull |challenge |petrol|gasoline|at hop|auckland transport|uber trip|uber *rides|lyft|parking|wilson parking|transit|logmate)\b/i, id: "transport" },
  { re: /\b(genesis|mercury|contact energy|meridian|powershop|vector|watercare|spark|one new zealand|onenewzealand|one nz|2degrees|vodafone|chorus|fibre|broadband|internet|power|electri)\b/i, id: "utilities" },
  { re: /\b(pharmacy|chemist|physio|doctor|hospital|dental|dentist|cityfitness|city fitness|sprint fit|les mills|snap fitness|anytime fitness|gym)\b|\b(?:gp|acc)\b/i, id: "health" },
  { re: /\b(debit ?success|janssens?|southern cross|aia |aa insurance|insurance)\b/i, id: "insurance" },
  { re: /\b(airbnb|booking\.com|air new zealand|air nz|jetstar|qantas|hotel|motel|flight)\b/i, id: "travel" },
  { re: /\b(uniqlo|zara|h&m|kmart|warehous(?:e)?|amazon|cotton on|country road|two dollar|wsl eastgate|farmers|briscoes|perfume|rebel sport)\b/i, id: "shopping" },
  { re: /\b(in a spin|laundr|bunnings|mitre ?10)\b/i, id: "household" },
  { re: /\b(gem visa|gemvisa)\b/i, id: "credit-card" },
  { re: /\b(unarranged overdraft|overdraft fee)\b/i, id: "other" },
  { re: /\b(cinema|event cinemas|ticketmaster|concert|academy cinema|aotea)\b/i, id: "entertainment" },
  { re: /\b(university|course|udemy|workbook|tuition)\b/i, id: "education" },
  { re: /\b(kiwisaver|emergency fund)\b|wstpac sav|westpac sav/i, id: "savings" },
];


const OWN_ACCOUNT_HINTS: { re: RegExp; label: string; bank?: string; investing?: boolean }[] = [
  { re: /sharesies/i, label: "Sharesies", investing: true },
  { re: /hatch|investnow|kernel|smartshares/i, label: "Investment account", investing: true },
  { re: /westpac/i, label: "Westpac", bank: "westpac" },
  { re: /asb joint|asb /i, label: "ASB joint", bank: "asb" },
  { re: /\basb\b/i, label: "ASB", bank: "asb" },
  { re: /guri self|gurpreet joint|gurpreet|\bgurpree|\bsaini\b/i, label: "Saini" },
  { re: /\b\d{2}-\d{4}-\d{7}-\d{2}\b/, label: "Other ANZ account", bank: "anz" },
  { re: /kiwibank/i, label: "Kiwibank", bank: "kiwibank" },
  { re: /\bbnz\b/i, label: "BNZ", bank: "bnz" },
  { re: /\btsb\b/i, label: "TSB", bank: "tsb" },
  { re: /debit transfer|credit transfer/i, label: "Internal transfer" },
];

const NZ_ACCOUNT = /\b\d{2}-\d{4}-\d{7}-\d{2}\b/;

export function normalizePayee(note: string) {
  return note
    .toLowerCase()
    .replace(/\b(dd|dc|bp|ap|vt|ep|at|cq|visa purchase|direct debit|direct credit|automatic payment|bill payment|eftpos|debit transfer|credit transfer)\b/gi, " ")
    .replace(/[^a-z0-9&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function prettyPayee(note: string) {
  const cleaned = note
    .replace(/^(DD|DC|BP|AP|VT|EP|AT|CQ)\s+/i, "")
    .replace(/\b(debit transfer|credit transfer|automatic payment|bill payment|visa purchase|direct debit|direct credit)\b/gi, " ")
    .replace(/\b\d{4,8}\s*\*{2,}\s*\d{2,8}\b/g, " ")
    .replace(/\bOrig(?:inal)?\s*date\s+\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return note.trim() || "Unknown";
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

function ruleMatches(pattern: string, note: string) {
  const p = pattern.trim().toLowerCase();
  if (!p) return false;
  return normalizePayee(note).includes(p) || note.toLowerCase().includes(p);
}

function stripBankCode(note: string) {
  return note.replace(/^(DD|DC|BP|AP|VT|EP|AT|CQ|ED|FX|IA|IP|IF|TP|DR)\s+/i, "");
}

export function classifyNote(
  note: string,
  type: TxType,
  rules: MemoryRule[] = [],
): { categoryId: string; transfer?: TransferLeg; counterparty: string } {
  const counterparty = prettyPayee(note);
  for (const rule of rules) {
    if (!ruleMatches(rule.pattern, note)) continue;
    if (rule.kind === "transfer") {
      const direction = type === "income" ? "in" : "out";
      return {
        categoryId: direction === "in" ? "transfer-in" : "transfer-out",
        transfer: { direction, otherLabel: rule.accountName || counterparty },
        counterparty: rule.accountName || counterparty,
      };
    }
    if (rule.categoryId) {
      const cat = getCategory(rule.categoryId);
      if (cat.type === type) return { categoryId: rule.categoryId, counterparty };
      if (rule.categoryId === "investing" && type === "expense") return { categoryId: "investing", counterparty };
      if (rule.categoryId === "investments" && type === "income") return { categoryId: "investments", counterparty };
    }
  }

  const own = OWN_ACCOUNT_HINTS.find((h) => h.re.test(note));
  if (own?.investing && type === "expense") {
    return { categoryId: "investing", counterparty: own.label };
  }

  // Account-to-account is a transfer even if the reference says Electri or Rent.
  if (NZ_ACCOUNT.test(note) && !/\b(interest|dividend)\b/i.test(note)) {
    const direction = type === "income" ? "in" : "out";
    return {
      categoryId: direction === "in" ? "transfer-in" : "transfer-out",
      transfer: { direction, otherLabel: own?.label || "Other ANZ account" },
      counterparty: own?.label || "Other ANZ account",
    };
  }

  const merchantNote = stripBankCode(note);
  for (const rule of BUILTIN_RULES) {
    if (!rule.re.test(merchantNote) && !rule.re.test(note)) continue;
    const cat = getCategory(rule.id);
    if (cat.type === type) return { categoryId: rule.id, counterparty };
    if (rule.id === "investing" && type === "expense") return { categoryId: "investing", counterparty };
    if (rule.id === "investments" && type === "income") return { categoryId: "investments", counterparty };
    if (rule.id === "tax" && type === "expense") return { categoryId: "tax", counterparty };
    if (rule.id === "salary" && type === "income") return { categoryId: "salary", counterparty };
    if (rule.id === "gig" && type === "income") return { categoryId: "gig", counterparty };
    if (rule.id === "credit-card" && type === "expense") return { categoryId: "credit-card", counterparty };
    if (rule.id === "savings" && type === "expense") return { categoryId: "savings", counterparty };
  }

  if (own && (type === "expense" || type === "income") && !own.investing) {
    const notTransfer = /\b(interest|dividend|atm)\b/i.test(note);
    const looksInternal =
      !notTransfer &&
      (/debit transfer|credit transfer|automatic payment|bill payment|\bbp\b|\bap\b|\bdd\b|\bdc\b|\bdeposit\b/i.test(
        note,
      ) ||
        /saving|joint|self|visa|transfer/i.test(note) ||
        (Boolean(own.bank) && /\b\d{2}-\d{4}-\d{7}-\d{2}\b/.test(note)));
    if (looksInternal) {
      const direction = type === "income" ? "in" : "out";
      return {
        categoryId: direction === "in" ? "transfer-in" : "transfer-out",
        transfer: { direction, otherLabel: own.label },
        counterparty: own.label,
      };
    }
  }

  return { categoryId: type === "income" ? "other-income" : "other", counterparty };
}

export function isTransferTx(t: { categoryId: string; transfer?: TransferLeg }) {
  return isTransferCategory(t.categoryId) || Boolean(t.transfer);
}

export function livingTxs<T extends { categoryId: string; transfer?: TransferLeg }>(txs: T[]) {
  return txs.filter((t) => !isTransferTx(t));
}

export function needsReconcile(t: { categoryId: string; note: string; transfer?: TransferLeg; reviewed?: boolean }) {
  if (t.reviewed) return false;
  if (isTransferTx(t)) return false;
  if (t.categoryId === "other" || t.categoryId === "other-income") return true;
  const note = t.note.trim();
  if (!note) return true;
  if (/^(DD|DC|BP|AP|VT|EP|AT|CQ)\s*$/i.test(note)) return true;
  return false;
}

function dayOffset(a: string, b: string) {
  return Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);
}

export function pairTransfers(txs: Transaction[], accounts: BankAccount[]): Transaction[] {
  const nameOf = (id?: string) => accounts.find((a) => a.id === id)?.name;
  const next = txs.map((t) => ({ ...t, transfer: t.transfer ? { ...t.transfer } : t.transfer }));
  const used = new Set<string>();

  const outs = next.filter((t) => t.type === "expense" && (isTransferTx(t) || /transfer|saving|joint|self/i.test(t.note)));
  const ins = next.filter((t) => t.type === "income");

  for (const out of outs) {
    if (used.has(out.id)) continue;
    const match = ins.find((inn) => {
      if (used.has(inn.id) || inn.id === out.id) return false;
      if (Math.abs(inn.amount - out.amount) > 0.009) return false;
      if (dayOffset(inn.date, out.date) > 2) return false;
      if (!out.accountId || !inn.accountId || out.accountId === inn.accountId) return false;
      return true;
    });
    if (!match) continue;
    used.add(out.id);
    used.add(match.id);
    const pairId = uid();
    const outLabel = nameOf(match.accountId) || match.transfer?.otherLabel || match.counterparty || prettyPayee(match.note);
    const inLabel = nameOf(out.accountId) || out.transfer?.otherLabel || out.counterparty || prettyPayee(out.note);
    out.categoryId = "transfer-out";
    match.categoryId = "transfer-in";
    out.transfer = { direction: "out", otherAccountId: match.accountId, otherLabel: outLabel, pairId };
    match.transfer = { direction: "in", otherAccountId: out.accountId, otherLabel: inLabel, pairId };
  }
  return next;
}

export function applyRulesToTxs(txs: Transaction[], rules: MemoryRule[]): Transaction[] {
  return txs.map((t) => {
    const tagged = classifyNote(t.note, t.type, rules);
    return {
      ...t,
      categoryId: tagged.categoryId,
      counterparty: tagged.counterparty,
      transfer: tagged.transfer ?? (isTransferCategory(tagged.categoryId) ? t.transfer : undefined),
    };
  });
}

export function inferAccountMeta(filename: string, format: string, sampleNotes: string[]) {
  const blob = `${filename} ${format} ${sampleNotes.slice(0, 8).join(" ")}`.toLowerCase();
  if (blob.includes("anz")) return { bank: "anz", name: "ANZ" };
  if (blob.includes("asb")) return { bank: "asb", name: "ASB" };
  if (blob.includes("westpac")) return { bank: "westpac", name: "Westpac" };
  if (blob.includes("kiwibank") || blob.includes("kiwi")) return { bank: "kiwibank", name: "Kiwibank" };
  if (blob.includes("bnz")) return { bank: "bnz", name: "BNZ" };
  if (blob.includes("tsb")) return { bank: "tsb", name: "TSB" };
  return { bank: "other", name: "Everyday" };
}

export function transferFlows(txs: Transaction[]) {
  const map = new Map<string, { from: string; to: string; amount: number; count: number }>();
  for (const t of txs) {
    if (t.type !== "expense" || !isTransferTx(t)) continue;
    const from = "this account";
    const to = t.transfer?.otherLabel || t.counterparty || prettyPayee(t.note);
    const key = `${from}|${to}`;
    const cur = map.get(key) ?? { from, to, amount: 0, count: 0 };
    cur.amount += t.amount;
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export function payeeBreakdown(txs: Transaction[], categoryId?: string) {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (categoryId && t.categoryId !== categoryId) continue;
    const label = t.counterparty || prettyPayee(t.note);
    map.set(label, (map.get(label) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export const CATEGORY_ALIASES: Record<string, string> = {
  investment: "investing",
  investments: "investing",
  investing: "investing",
  shares: "investing",
  sharesies: "investing",
  gig: "gig",
  uber: "gig",
  didi: "gig",
  grocery: "groceries",
  groceries: "groceries",
  food: "groceries",
  supermarket: "groceries",
  rent: "housing",
  housing: "housing",
  transfer: "transfer-out",
  transfers: "transfer-out",
  savings: "savings",
  save: "savings",
  salary: "salary",
  wages: "salary",
  tax: "tax",
  ird: "tax",
  cafe: "drinks",
  coffee: "drinks",
  dining: "dining",
  eating: "dining",
  transport: "transport",
  petrol: "transport",
  fuel: "transport",
  health: "health",
  gym: "health",
  fitness: "health",
  insurance: "insurance",
  household: "household",
  laundry: "household",
  shopping: "shopping",
  warehouse: "shopping",
  perfume: "shopping",
  bills: "utilities",
  utilities: "utilities",
  power: "utilities",
  "credit card": "credit-card",
  creditcard: "credit-card",
  visa: "credit-card",
  logmate: "transport",
  sub: "subscriptions",
  subscriptions: "subscriptions",
  netflix: "subscriptions",
  other: "other",
  freelance: "freelance",
  gift: "gifts",
  gifts: "gifts",
};

export function resolveCategoryAlias(raw: string) {
  const key = raw.trim().toLowerCase().replace(/s$/, "");
  return CATEGORY_ALIASES[raw.trim().toLowerCase()] ?? CATEGORY_ALIASES[key] ?? null;
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretChat } from "./chat-brain.ts";
import {
  applyRulesToTxs,
  classifyNote,
  isTransferTx,
  pairTransfers,
} from "./intelligence.ts";
import { parseBankStatement } from "./statement.ts";
import { readFileSync } from "node:fs";

test("Sharesies is investing, not other or savings", () => {
  const hit = classifyNote("AP Sharesies Nominee Li G s saini", "expense");
  assert.equal(hit.categoryId, "investing");
});

test("Westpac savings bill payment is savings, not a transfer", () => {
  const hit = classifyNote("BP guri wstpac saving", "expense");
  assert.equal(hit.categoryId, "savings");
});

test("IRD IIT debit is tax, wage credit is salary", () => {
  assert.equal(classifyNote("DD INLAND REVENUE DEPT IIT 117875377", "expense").categoryId, "tax");
  assert.equal(classifyNote("DC Inland Revenue Wage/salary Wage/salary", "income").categoryId, "salary");
});

test("truncated ANZ merchants and gig income get real categories", () => {
  assert.equal(classifyNote("VT THE WAREHOUS", "expense").categoryId, "shopping");
  assert.equal(classifyNote("VT THE WAREHOUSE 8.99", "expense").categoryId, "shopping");
  assert.equal(classifyNote("VT SPRINT FIT", "expense").categoryId, "health");
  assert.equal(classifyNote("BP Sp Nze Mobile Pmt Perfume", "expense").categoryId, "shopping");
  assert.equal(classifyNote("DC UBER BV UBER: TXN ID", "income").categoryId, "gig");
  assert.equal(classifyNote("DC DIDI MOBILITY (NEW Z NAAL/PAYMENT S", "income").categoryId, "gig");
  assert.equal(classifyNote("VT AIRBNB", "expense").categoryId, "travel");
  assert.equal(classifyNote("VT KMART - RICC", "expense").categoryId, "shopping");
});

test("this household statement tags rent, power, insurance, and internal transfers", () => {
  assert.equal(classifyNote("AP Quinovic AV160087.002 RENT 7LEAGUE", "expense").categoryId, "housing");
  assert.equal(classifyNote("AP Seaview trust AUTOMATIC PAYMENT", "expense").categoryId, "housing");
  assert.equal(classifyNote("DD One New Zealand Grou 516168007", "expense").categoryId, "utilities");
  assert.equal(classifyNote("DD CONTACT ENERGY L 000501700494", "expense").categoryId, "utilities");
  assert.equal(classifyNote("DD DEBITSUCCESS JANSSENS INS JNSN835675", "expense").categoryId, "insurance");
  assert.equal(classifyNote("VT Pak n Save M 483561", "expense").categoryId, "groceries");
  assert.equal(classifyNote("VT IN A SPIN LA", "expense").categoryId, "household");
  assert.equal(classifyNote("VT LOGMATE* LOG", "expense").categoryId, "transport");
  assert.equal(classifyNote("VT ESPRESSO STU", "expense").categoryId, "drinks");
  assert.equal(classifyNote("VT BP CONNECT D", "expense").categoryId, "transport");
  assert.equal(classifyNote("AP SAINI,GURPREE DEPOSIT", "income").categoryId, "transfer-in");
  assert.equal(classifyNote("DC 06-0807-0355363-00 CREDIT TRANSFER 195312", "income").categoryId, "transfer-in");
  assert.equal(classifyNote("DD 06-0807-0355363-00 DEBIT TRANSFER 140731", "expense").categoryId, "transfer-out");
  assert.equal(classifyNote("WESTPAC · INTEREST", "income").categoryId, "investments");
  assert.equal(classifyNote("DD 01-0798-0922177-00 Electri", "expense").categoryId, "transfer-out");
  assert.equal(classifyNote("DC 06-0807-0355363-00 Electri", "income").categoryId, "transfer-in");
  assert.equal(classifyNote("DC 06-0807-0355363-00 Rent", "income").categoryId, "transfer-in");
  assert.equal(classifyNote("AP Gem Visa saini gurpre", "expense").categoryId, "credit-card");
  assert.equal(classifyNote("BP guri wstpac saving", "expense").categoryId, "savings");
  assert.equal(classifyNote("DR INTEREST", "expense").categoryId, "other");
});

test("chat rule retags sharesies and transfer pairing", () => {
  const a = "acc-a";
  const b = "acc-b";
  const txs = [
    {
      id: "1",
      type: "expense" as const,
      amount: 10,
      categoryId: "other",
      note: "To B account",
      date: "2026-08-01",
      createdAt: "",
      accountId: a,
    },
    {
      id: "2",
      type: "income" as const,
      amount: 10,
      categoryId: "other-income",
      note: "From A account",
      date: "2026-08-01",
      createdAt: "",
      accountId: b,
    },
  ];
  const effect = interpretChat("To B account is a transfer to Everyday B", {
    transactions: txs,
    accounts: [
      { id: a, name: "Everyday A", bank: "anz" },
      { id: b, name: "Everyday B", bank: "westpac" },
    ],
    rules: [],
    budgets: [],
    bills: [],
    facts: [],
    settings: { displayName: "", currency: "NZD", browserNotifications: false, budgetAlertPct: 80 },
    currency: "NZD",
  });
  assert.match(effect.reply, /transfer/i);
  const paired = pairTransfers(effect.transactions ?? txs, effect.accounts ?? []);
  const out = paired.find((t) => t.id === "1");
  const inn = paired.find((t) => t.id === "2");
  assert.equal(out?.categoryId, "transfer-out");
  assert.equal(inn?.categoryId, "transfer-in");
  assert.equal(out?.transfer?.pairId, inn?.transfer?.pairId);
  assert.equal(isTransferTx(out!), true);
});

test("ANZ sample CSV tags Sharesies and savings transfers", () => {
  const text = readFileSync(new URL("../../public/sample-anz-go.csv", import.meta.url), "utf8");
  const parsed = parseBankStatement(text, "anz-go.csv");
  assert.equal(parsed.ok, true);
  const shares = parsed.rows.filter((r) => /sharesies/i.test(r.note));
  assert.ok(shares.length >= 1);
  assert.ok(shares.every((r) => r.categoryId === "investing"));
  const west = parsed.rows.filter((r) => /wstpac sav/i.test(r.note));
  assert.ok(west.length >= 1);
  assert.ok(west.every((r) => r.categoryId === "savings"));
  const gem = parsed.rows.filter((r) => /gem visa/i.test(r.note));
  assert.ok(gem.length >= 1);
  assert.ok(gem.every((r) => r.categoryId === "credit-card"));
});

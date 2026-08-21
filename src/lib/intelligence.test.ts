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

test("Westpac savings bill payment is a transfer out", () => {
  const hit = classifyNote("BP guri wstpac saving", "expense");
  assert.equal(hit.categoryId, "transfer-out");
  assert.equal(hit.transfer?.otherLabel, "Westpac savings");
});

test("IRD IIT debit is tax, wage credit is salary", () => {
  assert.equal(classifyNote("DD INLAND REVENUE DEPT IIT 117875377", "expense").categoryId, "tax");
  assert.equal(classifyNote("DC Inland Revenue Wage/salary Wage/salary", "income").categoryId, "salary");
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
  assert.ok(west.every((r) => r.categoryId === "transfer-out"));
});

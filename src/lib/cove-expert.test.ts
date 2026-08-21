import assert from "node:assert/strict";
import { test } from "node:test";
import { applyCoveActions, buildSnapshot } from "./cove-expert.ts";
import { interpretChat } from "./chat-brain.ts";
import { incomeTax, takeHome } from "./nz-finance.ts";
import type { LedgerState } from "./cove-expert.ts";

const empty = (): LedgerState => ({
  transactions: [
    {
      id: "g1",
      type: "expense",
      amount: 87.43,
      categoryId: "groceries",
      note: "Countdown Grey Lynn",
      date: "2026-08-13",
      createdAt: "",
    },
  ],
  accounts: [],
  rules: [],
  budgets: [],
  bills: [],
  facts: [],
  settings: { displayName: "", currency: "NZD", browserNotifications: false, budgetAlertPct: 80 },
});

test("NZ tax on 90000 is the IRD banded amount", () => {
  const tax = incomeTax(90_000);
  assert.equal(tax, 19_577.5);
  const home = takeHome(90_000, 0.035);
  assert.ok(home.net < 90_000 - tax);
  assert.equal(home.kiwiSaver, 3150);
});

test("set_budget action does not wipe transactions", () => {
  const state = empty();
  const { next, notes } = applyCoveActions(state, [{ type: "set_budget", categoryId: "groceries", amount: 400 }]);
  assert.equal(next.transactions.length, 1);
  assert.equal(next.transactions[0].amount, 87.43);
  assert.equal(next.budgets[0]?.amount, 400);
  assert.ok(notes.length);
});

test("add_transaction and remember stay additive", () => {
  const state = empty();
  const { next } = applyCoveActions(state, [
    { type: "add_transaction", txType: "expense", amount: 6.5, categoryId: "drinks", note: "Allpress" },
    { type: "remember", fact: "KiwiSaver 3.5%" },
  ]);
  assert.equal(next.transactions.length, 2);
  assert.equal(next.facts[0]?.text, "KiwiSaver 3.5%");
});

test("bad actions are ignored", () => {
  const state = empty();
  const { next } = applyCoveActions(state, [
    { type: "set_budget", categoryId: "not-a-cat", amount: 10 } as never,
    { type: "add_transaction", txType: "expense", amount: -5, categoryId: "groceries", note: "x" },
    { type: "delete_matching", pattern: "ab" },
  ]);
  assert.equal(next.transactions.length, 1);
  assert.equal(next.budgets.length, 0);
});

test("snapshot groceries total is exact", () => {
  const snap = buildSnapshot(empty());
  assert.equal(snap.livedSpend, 87.43);
  const g = snap.categories.find((c) => c.id === "groceries");
  assert.equal(g?.amount, 87.43);
});

test("local brain sets budget and answers tax", () => {
  const budget = interpretChat("Set groceries budget to 400", {
    ...empty(),
    currency: "NZD",
  });
  assert.equal(budget.budgets?.[0]?.amount, 400);
  const tax = interpretChat("tax on 90000", { ...empty(), currency: "NZD" });
  assert.match(tax.reply, /19,577|19577/);
});

test("GST, student loan, and KiwiSaver answers stay on the 2026 tables", () => {
  const gst = interpretChat("GST on 115", { ...empty(), currency: "NZD" });
  assert.match(gst.reply, /15\.00/);
  const sl = interpretChat("student loan on 70000", { ...empty(), currency: "NZD" });
  assert.match(sl.reply, /5,504|5504/);
  const ks = interpretChat("What is KiwiSaver?", { ...empty(), currency: "NZD" });
  assert.match(ks.reply, /3\.5%/);
  assert.doesNotMatch(ks.reply, /I would file/i);
});

test("how much groceries quotes the ledger, never invents", () => {
  const hit = interpretChat("How much did I spend on groceries?", { ...empty(), currency: "NZD" });
  assert.match(hit.reply, /87\.43/);
  const blank = interpretChat("How much did I spend on groceries?", {
    ...empty(),
    transactions: [],
    currency: "NZD",
  });
  assert.match(blank.reply, /nothing tagged|0\.00|\\$0/i);
});

test("mutations still apply and do not wipe the grocery row", () => {
  const r = interpretChat("Set dining budget to 250", { ...empty(), currency: "NZD" });
  assert.equal(r.budgets?.[0]?.amount, 250);
  assert.equal(r.transactions, undefined);
});

test("add uber income asks for date then logs it", () => {
  const ctx = { ...empty(), currency: "NZD" as const };
  const ask = interpretChat("add uber income $400", ctx);
  assert.match(ask.reply, /date/i);
  assert.equal(ask.pending?.kind, "add");
  assert.equal(ask.pending?.amount, 400);
  assert.equal(ask.transactions, undefined);
  const done = interpretChat("08/08/2026", { ...ctx, pending: ask.pending });
  assert.match(done.reply, /Entry added/i);
  assert.match(done.reply, /400/);
  assert.match(done.reply, /2026-08-08/);
  assert.equal(done.transactions?.[0]?.type, "income");
  assert.equal(done.transactions?.[0]?.amount, 400);
  assert.equal(done.transactions?.[0]?.date, "2026-08-08");
  assert.match(done.transactions?.[0]?.note ?? "", /uber/i);
});

test("delete matching uber after add", () => {
  const added = interpretChat("08/08/2026", {
    ...empty(),
    currency: "NZD",
    pending: { kind: "add", amount: 400, note: "Uber", txType: "income", asked: "date" },
  });
  const txs = added.transactions ?? [];
  assert.equal(txs.length, 2);
  const del = interpretChat("delete uber", { ...empty(), transactions: txs, currency: "NZD" });
  assert.match(del.reply, /Deleted/i);
  assert.equal(del.transactions?.some((t) => /uber/i.test(t.note)), false);
});

test("edit amount of a logged coffee", () => {
  const ctx = {
    ...empty(),
    currency: "NZD" as const,
    transactions: [
      {
        id: "c1",
        type: "expense" as const,
        amount: 6.5,
        categoryId: "drinks",
        note: "Coffee",
        date: "2026-08-08",
        createdAt: "",
      },
    ],
  };
  const r = interpretChat("change coffee to $8", ctx);
  assert.equal(r.transactions?.[0]?.amount, 8);
  assert.match(r.reply, /8/);
});

test("how am I doing uses the grocery amount", () => {
  const r = interpretChat("How am I doing?", { ...empty(), currency: "NZD" });
  assert.match(r.reply, /87\.43/);
  assert.equal(r.needsAi, true);
  assert.doesNotMatch(r.reply, /Ask “how am I doing/i);
  assert.doesNotMatch(r.reply, /I would file/i);
});

test("patterns mention the grocery payee not a canned blurb", () => {
  const r = interpretChat("What patterns do you see?", { ...empty(), currency: "NZD" });
  assert.match(r.reply, /Countdown|grocer/i);
  assert.match(r.reply, /87\.43/);
  assert.equal(r.needsAi, true);
});

test("add uber income learns a payee rule", () => {
  const ask = interpretChat("add uber income $400", { ...empty(), currency: "NZD" });
  const done = interpretChat("08/08/2026", { ...empty(), currency: "NZD", pending: ask.pending });
  assert.equal(done.transactions?.[0]?.type, "income");
  assert.ok((done.rules ?? []).some((r) => /uber/i.test(r.pattern)));
});

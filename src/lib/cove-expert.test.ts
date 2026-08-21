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

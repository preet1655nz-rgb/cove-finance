import assert from "node:assert/strict";
import { test } from "node:test";
import { cashBuckets, periodRange } from "./period.ts";
import { needsReconcile } from "./intelligence.ts";
import { buildNotices, daysUntil, nextBillDate } from "./notify.ts";
import { isoDate, todayISO } from "./utils.ts";
import type { Transaction } from "./types.ts";

function tx(partial: Partial<Transaction> & Pick<Transaction, "type" | "amount" | "categoryId">): Transaction {
  return {
    id: partial.id ?? "x",
    note: partial.note ?? "",
    date: partial.date ?? todayISO(),
    createdAt: "",
    ...partial,
  };
}

test("cash buckets keep income, living, investing and savings apart", () => {
  const b = cashBuckets([
    tx({ type: "income", amount: 1000, categoryId: "salary" }),
    tx({ type: "income", amount: 200, categoryId: "gig" }),
    tx({ type: "expense", amount: 400, categoryId: "groceries" }),
    tx({ type: "expense", amount: 150, categoryId: "investing" }),
    tx({ type: "expense", amount: 100, categoryId: "savings" }),
    tx({ type: "expense", amount: 50, categoryId: "credit-card" }),
    tx({ type: "expense", amount: 999, categoryId: "transfer-out" }),
    tx({ type: "income", amount: 999, categoryId: "transfer-in" }),
  ]);
  assert.equal(b.income, 1200);
  assert.equal(b.expense, 400);
  assert.equal(b.investing, 150);
  assert.equal(b.savings, 100);
  assert.equal(b.credit, 50);
  assert.equal(b.leftover, 800);
  assert.equal(b.cash, 500);
  assert.equal(b.income - b.expense - b.investing - b.savings - b.credit, b.cash);
});

test("week and fortnight ranges are bounded", () => {
  const week = periodRange("this-week");
  const fort = periodRange("fortnight");
  assert.ok(week.from <= week.to);
  assert.ok(fort.from <= fort.to);
  const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000;
  assert.equal(days(week.from, week.to), 6);
  assert.equal(days(fort.from, fort.to), 13);
});

test("unnamed and other entries need reconciling", () => {
  assert.equal(needsReconcile(tx({ type: "expense", amount: 1, categoryId: "other", note: "??" })), true);
  assert.equal(needsReconcile(tx({ type: "expense", amount: 1, categoryId: "groceries", note: "Pak n Save" })), false);
  assert.equal(needsReconcile(tx({ type: "expense", amount: 1, categoryId: "groceries", note: "", reviewed: false })), true);
  assert.equal(needsReconcile(tx({ type: "expense", amount: 1, categoryId: "other", note: "x", reviewed: true })), false);
  assert.equal(needsReconcile(tx({ type: "expense", amount: 1, categoryId: "transfer-out", note: "DD" })), false);
});

test("bill reminders fire each of the three days before due", () => {
  const today = todayISO();
  const due = new Date();
  due.setDate(due.getDate() + 2);
  const dueIso = isoDate(due);
  const bills = [
    {
      id: "rent",
      name: "Rent",
      amount: 2200,
      categoryId: "housing",
      dayOfMonth: Number(dueIso.slice(8, 10)),
      dueDate: dueIso,
      repeat: "once" as const,
      enabled: true,
    },
  ];
  const notices = buildNotices([], [], bills, [], "NZD");
  const billNotes = notices.filter((n) => n.kind === "bill");
  assert.equal(billNotes.length, 1);
  assert.match(billNotes[0]!.title, /due in 2 days|due tomorrow|due today/i);
  assert.match(billNotes[0]!.fingerprint, new RegExp(`bill-rent-${today}`));
  assert.equal(daysUntil(nextBillDate(bills[0]!), today), 2);
});

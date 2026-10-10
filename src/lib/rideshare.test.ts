import assert from "node:assert/strict";
import test from "node:test";
import { classifyGig, kilometreClaim, platformOf } from "./rideshare.ts";
import type { Transaction } from "./types.ts";

function row(partial: Partial<Transaction> & Pick<Transaction, "type" | "amount" | "note">): Transaction {
  return {
    id: "t",
    categoryId: "other",
    date: "2026-06-01",
    createdAt: "2026-06-01T00:00:00.000Z",
    ...partial,
  };
}

test("pools Uber and Didi income and ignores salary", () => {
  assert.equal(classifyGig(row({ type: "income", amount: 640, note: "Uber trip payout", categoryId: "gig" })), "income");
  assert.equal(platformOf(row({ type: "income", amount: 220, note: "DiDi weekly" })), "Didi");
  assert.equal(classifyGig(row({ type: "income", amount: 7400, note: "Monthly salary", categoryId: "salary" })), null);
});

test("pools claimable vehicle costs and drops fines", () => {
  assert.equal(classifyGig(row({ type: "expense", amount: 81, note: "Petrol — Z", categoryId: "transport" })), "vehicle");
  assert.equal(classifyGig(row({ type: "expense", amount: 65, note: "WOF VTNZ", categoryId: "vehicle" })), "vehicle");
  assert.equal(classifyGig(row({ type: "expense", amount: 48, note: "AT Hop top-up", categoryId: "transport" })), null);
  assert.equal(classifyGig(row({ type: "expense", amount: 200, note: "Speeding fine", categoryId: "fuel" })), null);
  assert.equal(classifyGig(row({ type: "expense", amount: 30, note: "Uber service fee" })), "fee");
});

test("kilometre method matches the published tier split", () => {
  const claim = kilometreClaim(18000, 70, "petrol");
  assert.equal(claim.amount, 12796);
  assert.ok(Math.abs(claim.tier1Business - 9800) < 0.001);
  assert.ok(Math.abs(claim.tier2Business - 2800) < 0.001);
});
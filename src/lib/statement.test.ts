import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  SAMPLE_STATEMENT,
  applyDuplicates,
  parseAmount,
  parseBankStatement,
  parseDate,
  txFingerprint,
} from "./statement.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../../scripts/fixtures/statements");

const GOLD = [
  { n: /dhb|payroll/i, type: "income" as const, amount: 7432.18, cat: "salary" },
  { n: /north studio|invoice 882/i, type: "income" as const, amount: 1150, cat: "freelance" },
  { n: /interest/i, type: "income" as const, amount: 12.07, cat: "investments" },
  { n: /ird|tax refund/i, type: "income" as const, amount: 428.6, cat: "other-income" },
  { n: /kauri|rent/i, type: "expense" as const, amount: 2150, cat: "housing" },
  { n: /countdown/i, type: "expense" as const, amount: 87.43, cat: "groceries" },
  { n: /new world/i, type: "expense" as const, amount: 124.9, cat: "groceries" },
  { n: /farro/i, type: "expense" as const, amount: 56.2, cat: "groceries" },
  { n: /allpress/i, type: "expense" as const, amount: 7.5, cat: "drinks" },
  { n: /z energy/i, type: "expense" as const, amount: 89.64, cat: "transport" },
  { n: /at hop/i, type: "expense" as const, amount: 40, cat: "transport" },
  { n: /netflix/i, type: "expense" as const, amount: 24.99, cat: "subscriptions" },
  { n: /spotify/i, type: "expense" as const, amount: 17.99, cat: "subscriptions" },
  { n: /spark/i, type: "expense" as const, amount: 99, cat: "utilities" },
  { n: /genesis/i, type: "expense" as const, amount: 186.42, cat: "utilities" },
  { n: /uniqlo/i, type: "expense" as const, amount: 64, cat: "shopping" },
  { n: /uber eats/i, type: "expense" as const, amount: 38.7, cat: "dining" },
  { n: /event cinemas/i, type: "expense" as const, amount: 29.5, cat: "entertainment" },
  { n: /pharmacy|unchem/i, type: "expense" as const, amount: 22.8, cat: "health" },
  { n: /kiwisaver/i, type: "expense" as const, amount: 400, cat: "savings" },
];

const INCOME_TOTAL = 9022.85;
const EXPENSE_TOTAL = 3439.07;

function assertGold(result: ReturnType<typeof parseBankStatement>, label: string, minRows = 20) {
  assert.equal(result.ok, true, `${label} should parse: ${result.error}`);
  assert.ok(result.rows.length >= minRows, `${label} rows ${result.rows.length} < ${minRows}`);
  for (const g of GOLD) {
    const row = result.rows.find((r) => g.n.test(r.note));
    assert.ok(row, `${label} missing ${g.n}`);
    assert.equal(row!.type, g.type, `${label} ${row!.note} type ${row!.type} != ${g.type}`);
    assert.equal(row!.amount, g.amount, `${label} ${row!.note} amount ${row!.amount} != ${g.amount}`);
    assert.equal(row!.categoryId, g.cat, `${label} ${row!.note} cat ${row!.categoryId} != ${g.cat}`);
  }
  const income = result.rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const expense = result.rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  assert.equal(Number(income.toFixed(2)), INCOME_TOTAL, `${label} income ${income}`);
  assert.equal(Number(expense.toFixed(2)), EXPENSE_TOTAL, `${label} expense ${expense}`);
  assert.equal(
    result.rows.filter((r) => r.type === "income").length,
    4,
    `${label} should have exactly 4 income rows`,
  );
}

test("parseAmount handles signs, commas, and parentheses", () => {
  assert.equal(parseAmount("86.40"), 86.4);
  assert.equal(parseAmount("-86.40"), -86.4);
  assert.equal(parseAmount("(86.40)"), -86.4);
  assert.equal(parseAmount("$1,240.00"), 1240);
  assert.equal(parseAmount("$7,432.18"), 7432.18);
  assert.equal(parseAmount("NZD 62.50"), 62.5);
  assert.equal(parseAmount("1.234,56"), 1234.56);
  assert.equal(parseAmount("12,50"), 12.5);
  assert.equal(parseAmount("80.00 DR"), -80);
  assert.equal(parseAmount(""), null);
});

test("parseDate prefers DMY and accepts ISO", () => {
  assert.equal(parseDate("15/08/2026", true), "2026-08-15");
  assert.equal(parseDate("08/15/2026", false), "2026-08-15");
  assert.equal(parseDate("2026-08-15", true), "2026-08-15");
  assert.equal(parseDate("20260815", true), "2026-08-15");
  assert.equal(parseDate("15 Aug 2026", true), "2026-08-15");
  assert.equal(parseDate("Aug 15, 2026", true), "2026-08-15");
  assert.equal(parseDate("26 Jun", true, 2026), "2026-06-26");
  assert.equal(parseDate("01 Jul", true, 2026), "2026-07-01");
  assert.equal(parseDate("32/13/2026", true), null);
});

test("ANZ-style signed CSV splits income and expense without mixing them", () => {
  const result = parseBankStatement(SAMPLE_STATEMENT, "anz.csv");
  assert.equal(result.ok, true);
  assert.ok(result.rows.length >= 10);
  const salary = result.rows.find((r) => /acme/i.test(r.note));
  const groceries = result.rows.find((r) => /countdown/i.test(r.note));
  const rent = result.rows.find((r) => /landlord/i.test(r.note));
  const tax = result.rows.find((r) => /ird/i.test(r.note));
  assert.ok(salary);
  assert.equal(salary.type, "income");
  assert.equal(salary.amount, 6200);
  assert.equal(salary.categoryId, "salary");
  assert.ok(groceries);
  assert.equal(groceries.type, "expense");
  assert.equal(groceries.amount, 112.4);
  assert.equal(groceries.categoryId, "groceries");
  assert.ok(rent);
  assert.equal(rent.type, "expense");
  assert.equal(rent.categoryId, "housing");
  assert.ok(tax);
  assert.equal(tax.type, "income");
  assert.equal(result.rows.some((r) => /opening balance/i.test(r.note)), false);
});

test("real household month across NZ and US bank exports", () => {
  assertGold(parseBankStatement(readFileSync(join(fixtures, "anz.csv"), "utf8"), "anz.csv"), "ANZ");
  assertGold(parseBankStatement(readFileSync(join(fixtures, "westpac.csv"), "utf8"), "westpac.csv"), "Westpac");
  assertGold(parseBankStatement(readFileSync(join(fixtures, "asb.csv"), "utf8"), "asb.csv"), "ASB");
  assertGold(parseBankStatement(readFileSync(join(fixtures, "kiwibank.csv"), "utf8"), "kiwibank.csv"), "Kiwibank");
  assertGold(parseBankStatement(readFileSync(join(fixtures, "chase.csv"), "utf8"), "chase.csv"), "Chase");
});

test("OFX household snippet keeps salary in and countdown out", () => {
  const result = parseBankStatement(readFileSync(join(fixtures, "household.ofx"), "utf8"), "household.ofx");
  assert.equal(result.ok, true);
  const salary = result.rows.find((r) => /dhb/i.test(r.note));
  const shop = result.rows.find((r) => /countdown/i.test(r.note));
  const rent = result.rows.find((r) => /kauri|rent/i.test(r.note));
  assert.equal(salary?.type, "income");
  assert.equal(salary?.amount, 7432.18);
  assert.equal(shop?.type, "expense");
  assert.equal(shop?.amount, 87.43);
  assert.equal(rent?.type, "expense");
  assert.equal(rent?.amount, 2150);
});

test("debit and credit columns", () => {
  const csv = `Date,Description,Debit,Credit,Balance
15/08/2026,COUNTDOWN PONSONBY,86.40,,1200.00
01/08/2026,SALARY ACME,,7400.00,8600.00
03/08/2026,NETFLIX.COM,24.99,,8575.01`;
  const result = parseBankStatement(csv, "westpac.csv");
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 3);
  const byNote = Object.fromEntries(result.rows.map((r) => [r.note, r]));
  assert.equal(byNote["COUNTDOWN PONSONBY"].type, "expense");
  assert.equal(byNote["SALARY ACME"].type, "income");
  assert.equal(byNote["NETFLIX.COM"].categoryId, "subscriptions");
});

test("unsigned amounts use salary words for income and default to expense", () => {
  const csv = `Date,Details,Amount
14/08/2026,Monthly salary,6200.00
13/08/2026,COUNTDOWN GREY LYNN,112.40`;
  const result = parseBankStatement(csv);
  assert.equal(result.ok, true);
  const salary = result.rows.find((r) => /salary/i.test(r.note));
  const shop = result.rows.find((r) => /countdown/i.test(r.note));
  assert.equal(salary?.type, "income");
  assert.equal(shop?.type, "expense");
});

test("quoted commas, semicolon EU format, and OFX", () => {
  const csv = `Date;Libellé;Débit;Crédit
15/08/2026;"CARREFOUR, Lyon";86,40;
01/08/2026;SALAIRE;;7400,00`;
  const csvResult = parseBankStatement(csv, "fr.csv");
  assert.equal(csvResult.ok, true);
  assert.equal(csvResult.rows.length, 2);
  assert.equal(csvResult.rows.find((r) => /carrefour/i.test(r.note))?.type, "expense");
  assert.equal(csvResult.rows.find((r) => /salaire/i.test(r.note))?.type, "income");

  const ofx = `OFXHEADER:100
<OFX>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260815120000
<TRNAMT>-42.50
<NAME>COUNTDOWN
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260801
<TRNAMT>7400.00
<NAME>ACME SALARY
</STMTTRN>
</OFX>`;
  const ofxResult = parseBankStatement(ofx, "export.ofx");
  assert.equal(ofxResult.ok, true);
  assert.equal(ofxResult.rows.length, 2);
  assert.equal(ofxResult.rows.find((r) => /countdown/i.test(r.note))?.type, "expense");
  assert.equal(ofxResult.rows.find((r) => /salary/i.test(r.note))?.type, "income");
});

test("QIF and garbage files never throw", () => {
  const qif = `!Type:Bank
D15/08/2026
T-18.00
PALLPRESS ESPRESSO
^
D01/08/2026
T7400
PSALARY
^`;
  const q = parseBankStatement(qif, "bank.qif");
  assert.equal(q.ok, true);
  assert.equal(q.rows.find((r) => /allpress/i.test(r.note))?.type, "expense");
  assert.equal(q.rows.find((r) => /salary/i.test(r.note))?.type, "income");

  const empty = parseBankStatement("   ");
  assert.equal(empty.ok, false);
  const junk = parseBankStatement("hello this is not a statement\nfoo bar");
  assert.equal(junk.ok, false);
  assert.ok(junk.error);
});

test("duplicates are unmarked by default", () => {
  const result = parseBankStatement(SAMPLE_STATEMENT);
  const existing = [
    {
      id: "1",
      type: "expense" as const,
      amount: 112.4,
      categoryId: "groceries",
      note: "COUNTDOWN GREY LYNN",
      date: "2026-08-13",
      createdAt: "",
    },
  ];
  const marked = applyDuplicates(result.rows, existing);
  const dup = marked.find((r) => /countdown/i.test(r.note));
  assert.equal(dup?.duplicate, true);
  assert.equal(dup?.included, false);
  assert.equal(txFingerprint("2026-08-13", 112.4, "COUNTDOWN GREY LYNN"), "2026-08-13|112.40|countdown grey lynn");
});

test("grocery refund stays income and opening balance is dropped", () => {
  const csv = `Date,Description,Amount
04/08/2026,COUNTDOWN REFUND,45.00
01/08/2026,Opening balance,8420.55
19/08/2026,COUNTDOWN MT EDEN,-87.43`;
  const result = parseBankStatement(csv);
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 2);
  const refund = result.rows.find((r) => /refund/i.test(r.note));
  assert.equal(refund?.type, "income");
  assert.equal(refund?.amount, 45);
  assert.equal(refund?.categoryId, "other-income");
});

const ANZ_GO_IN = 6919.71;
const ANZ_GO_OUT = 6888.99;

function assertAnzGo(result: ReturnType<typeof parseBankStatement>, label: string) {
  assert.equal(result.ok, true, `${label} should parse: ${result.error}`);
  assert.equal(result.rows.length, 47, `${label} rows ${result.rows.length}`);
  const income = result.rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const expense = result.rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  assert.equal(Number(income.toFixed(2)), ANZ_GO_IN, `${label} income ${income}`);
  assert.equal(Number(expense.toFixed(2)), ANZ_GO_OUT, `${label} expense ${expense}`);
  assert.equal(result.rows.filter((r) => r.type === "income").length, 12, `${label} income count`);
  assert.equal(result.rows.filter((r) => r.type === "expense").length, 35, `${label} expense count`);
  assert.equal(result.rows.some((r) => /brought forward|totals at end/i.test(r.note)), false);

  const wage = result.rows.find((r) => /wage\/salary/i.test(r.note) && r.amount === 1869.18);
  assert.ok(wage, `${label} missing 30 Jun wage`);
  assert.equal(wage!.type, "income");
  assert.equal(wage!.categoryId, "salary");
  assert.equal(wage!.date, "2026-06-30");

  const didi = result.rows.find((r) => /didi/i.test(r.note) && r.amount === 228.44);
  assert.ok(didi);
  assert.equal(didi!.type, "income");
  assert.equal(didi!.categoryId, "other-income");

  const waitomo = result.rows.find((r) => /waitomo/i.test(r.note) && r.amount === 34.18);
  assert.ok(waitomo);
  assert.equal(waitomo!.type, "expense");
  assert.equal(waitomo!.categoryId, "transport");

  const gym = result.rows.find((r) => /cityfitness/i.test(r.note));
  assert.ok(gym);
  assert.equal(gym!.type, "expense");
  assert.equal(gym!.categoryId, "health");

  const food = result.rows.find((r) => /foodmart/i.test(r.note));
  assert.ok(food);
  assert.equal(food!.type, "expense");
  assert.equal(food!.categoryId, "groceries");

  const power = result.rows.find((r) => /electri/i.test(r.note));
  assert.ok(power);
  assert.equal(power!.type, "expense");
  assert.equal(power!.categoryId, "utilities");

  const shop = result.rows.find((r) => /warehouse/i.test(r.note) && r.amount === 8.99);
  assert.ok(shop);
  assert.equal(shop!.categoryId, "shopping");

  const pak = result.rows.find((r) => /pak n save/i.test(r.note));
  assert.ok(pak);
  assert.equal(pak!.categoryId, "groceries");

  const pizza = result.rows.find((r) => /dominos/i.test(r.note));
  assert.ok(pizza);
  assert.equal(pizza!.categoryId, "dining");
}

test("ANZ Go CSV matches the real statement totals", () => {
  const csv = readFileSync(join(fixtures, "anz-go.csv"), "utf8");
  assertAnzGo(parseBankStatement(csv, "anz-go.csv"), "ANZ Go CSV");
});

test("ANZ Go ledger text from a PDF extract matches the same totals", () => {
  const csv = readFileSync(join(fixtures, "anz-go.csv"), "utf8");
  const ledger = csvToAnzLedger(csv);
  const result = parseBankStatement(ledger, "anz-go.pdf");
  assertAnzGo(result, "ANZ Go PDF text");
});

function csvToAnzLedger(csv: string) {
  const lines = csv.trim().split("\n");
  const out = [
    "Go - continued",
    "Date Transaction type and details Withdrawals Deposits Balance",
    "Balance brought forward from previous page 73.01",
  ];
  for (const line of lines.slice(1)) {
    const row = parseCsvLine(line);
    const [date, details, wd, dep, bal] = row;
    if (!date) {
      out.push(`${details} ${wd} ${dep} ${bal}`.replace(/  +/g, " ").trim());
      continue;
    }
    const nums = [wd, dep, bal].filter((n) => n && n !== "0");
    out.push(`${date} ${details} ${nums.join(" ")}`);
  }
  out.push("Page 2 of 3  Orig date 01/07/2026");
  return out.join("\n");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      cells.push(cur);
      cur = "";
    } else cur += c;
  }
  cells.push(cur);
  return cells;
}

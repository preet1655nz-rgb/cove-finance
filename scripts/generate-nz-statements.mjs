#!/usr/bin/env node
/**
 * Builds authentic NZ bank CSV fixtures from one household month.
 * Headers match published exports:
 *   ANZ     Type,Details,Particulars,Code,Reference,Amount,Date,ForeignCurrencyAmount,ConversionCharge
 *   ASB     FastNet Classic preamble + Date,Unique Id,Tran Type,Cheque Number,Payee,Memo,Amount (YYYY/MM/DD)
 *   Westpac Date,Amount,Other Party,Description,Reference,Particulars,Analysis Code
 *   BNZ     Date,Account,Description,Amount,Balance
 *   Kiwibank full: Amount (credit), Amount (debit), Amount, Balance; dates DD-MM-YYYY
 *   TSB     Date,Description,Amount,Balance
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(root, "scripts/fixtures/statements");
const publicSamples = join(root, "public/samples");
mkdirSync(fixtures, { recursive: true });
mkdirSync(publicSamples, { recursive: true });

const TX = [
  { d: "20/08/2026", iso: "2026-08-20", ymd: "2026/08/20", dmyDash: "20-08-2026", in: true, amt: 7432.18, payee: "AUCKLAND DHB PAYROLL", memo: "SALARY", anz: "Direct credit", asb: "D/C", kb: "DC", details: "AUCKLAND DHB PAYROLL" },
  { d: "19/08/2026", iso: "2026-08-19", ymd: "2026/08/19", dmyDash: "19-08-2026", in: false, amt: 87.43, payee: "COUNTDOWN MT EDEN", memo: "", anz: "Visa purchase", asb: "EFTPOS", kb: "POS", details: "COUNTDOWN MT EDEN" },
  { d: "19/08/2026", iso: "2026-08-19", ymd: "2026/08/19", dmyDash: "19-08-2026", in: false, amt: 7.5, payee: "ALLPRESS ESPRESSO PONSONBY", memo: "", anz: "Visa purchase", asb: "EFTPOS", kb: "POS", details: "ALLPRESS ESPRESSO PONSONBY" },
  { d: "18/08/2026", iso: "2026-08-18", ymd: "2026/08/18", dmyDash: "18-08-2026", in: false, amt: 38.7, payee: "UBER EATS", memo: "", anz: "Visa purchase", asb: "VISA", kb: "VISA", details: "UBER EATS" },
  { d: "17/08/2026", iso: "2026-08-17", ymd: "2026/08/17", dmyDash: "17-08-2026", in: false, amt: 89.64, payee: "Z ENERGY GREY LYNN", memo: "", anz: "Eft-pos", asb: "EFTPOS", kb: "POS", details: "Z ENERGY GREY LYNN" },
  { d: "16/08/2026", iso: "2026-08-16", ymd: "2026/08/16", dmyDash: "16-08-2026", in: true, amt: 1150, payee: "NORTH STUDIO LTD", memo: "INVOICE 882", anz: "Direct credit", asb: "D/C", kb: "DC", details: "NORTH STUDIO LTD" },
  { d: "15/08/2026", iso: "2026-08-15", ymd: "2026/08/15", dmyDash: "15-08-2026", in: false, amt: 186.42, payee: "GENESIS ENERGY", memo: "POWER", anz: "Direct debit", asb: "D/D", kb: "DD", details: "GENESIS ENERGY" },
  { d: "14/08/2026", iso: "2026-08-14", ymd: "2026/08/14", dmyDash: "14-08-2026", in: false, amt: 99, payee: "SPARK FIBRE", memo: "", anz: "Direct debit", asb: "D/D", kb: "DD", details: "SPARK FIBRE" },
  { d: "12/08/2026", iso: "2026-08-12", ymd: "2026/08/12", dmyDash: "12-08-2026", in: false, amt: 124.9, payee: "NEW WORLD VICTORIA PARK", memo: "", anz: "Visa purchase", asb: "VISA", kb: "VISA", details: "NEW WORLD VICTORIA PARK" },
  { d: "11/08/2026", iso: "2026-08-11", ymd: "2026/08/11", dmyDash: "11-08-2026", in: false, amt: 40, payee: "AT HOP TOP UP", memo: "", anz: "Eft-pos", asb: "EFTPOS", kb: "POS", details: "AT HOP TOP UP" },
  { d: "10/08/2026", iso: "2026-08-10", ymd: "2026/08/10", dmyDash: "10-08-2026", in: false, amt: 64, payee: "UNIQLO COMMERCIAL BAY", memo: "", anz: "Visa purchase", asb: "VISA", kb: "VISA", details: "UNIQLO COMMERCIAL BAY" },
  { d: "09/08/2026", iso: "2026-08-09", ymd: "2026/08/09", dmyDash: "09-08-2026", in: false, amt: 29.5, payee: "EVENT CINEMAS QUEEN ST", memo: "", anz: "Visa purchase", asb: "VISA", kb: "VISA", details: "EVENT CINEMAS QUEEN ST" },
  { d: "08/08/2026", iso: "2026-08-08", ymd: "2026/08/08", dmyDash: "08-08-2026", in: true, amt: 428.6, payee: "IRD", memo: "TAX REFUND", anz: "Direct credit", asb: "D/C", kb: "DC", details: "IRD" },
  { d: "08/08/2026", iso: "2026-08-08", ymd: "2026/08/08", dmyDash: "08-08-2026", in: false, amt: 24.99, payee: "NETFLIX.COM", memo: "", anz: "Direct debit", asb: "D/D", kb: "DD", details: "NETFLIX.COM" },
  { d: "06/08/2026", iso: "2026-08-06", ymd: "2026/08/06", dmyDash: "06-08-2026", in: false, amt: 22.8, payee: "UNCHEM PHARMACY", memo: "", anz: "Visa purchase", asb: "EFTPOS", kb: "POS", details: "UNCHEM PHARMACY" },
  { d: "05/08/2026", iso: "2026-08-05", ymd: "2026/08/05", dmyDash: "05-08-2026", in: false, amt: 56.2, payee: "FARRO FRESH FREEMANS BAY", memo: "", anz: "Visa purchase", asb: "VISA", kb: "VISA", details: "FARRO FRESH FREEMANS BAY" },
  { d: "05/08/2026", iso: "2026-08-05", ymd: "2026/08/05", dmyDash: "05-08-2026", in: false, amt: 17.99, payee: "SPOTIFY", memo: "", anz: "Direct debit", asb: "D/D", kb: "DD", details: "SPOTIFY" },
  { d: "03/08/2026", iso: "2026-08-03", ymd: "2026/08/03", dmyDash: "03-08-2026", in: true, amt: 12.07, payee: "WESTPAC", memo: "INTEREST", anz: "Direct credit", asb: "CREDIT", kb: "CREDIT", details: "WESTPAC" },
  { d: "02/08/2026", iso: "2026-08-02", ymd: "2026/08/02", dmyDash: "02-08-2026", in: false, amt: 400, payee: "KIWISAVER", memo: "KS", anz: "Automatic payment", asb: "AP", kb: "AP", details: "KIWISAVER" },
  { d: "01/08/2026", iso: "2026-08-01", ymd: "2026/08/01", dmyDash: "01-08-2026", in: false, amt: 2150, payee: "KAURI RENTALS LTD", memo: "RENT", anz: "Automatic payment", asb: "AP", kb: "AP", details: "KAURI RENTALS LTD" },
];

function money(n) {
  return n.toFixed(2);
}

function csvEscape(s) {
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function signed(t) {
  return t.in ? money(t.amt) : `-${money(t.amt)}`;
}

const files = {};

files["anz-official.csv"] = [
  "Bank,ANZ",
  "Account,01-0123-0045678-00",
  "From,01/08/2026",
  "To,21/08/2026",
  "",
  "Type,Details,Particulars,Code,Reference,Amount,Date,ForeignCurrencyAmount,ConversionCharge",
  ...TX.map((t) => [t.anz, t.details, t.memo, "", "", signed(t), t.d, "", ""].map(csvEscape).join(",")),
].join("\n") + "\n";

files["asb-fastnet.csv"] = [
  "Created date / time,21 August 2026 / 09:14:22",
  "Bank,ASB Bank Limited",
  "Account,12-3040-0123456-00",
  "From date,2026/08/01",
  "To date,2026/08/21",
  "Avail Bal,10688.37",
  "Ledger Bal,10688.37",
  "",
  "Date,Unique Id,Tran Type,Cheque Number,Payee,Memo,Amount",
  ...TX.map((t, i) =>
    [t.ymd, `202608${t.d.slice(0, 2)}${String(i + 1).padStart(3, "0")}`, t.asb, "", t.payee, t.memo, signed(t)].map(csvEscape).join(","),
  ),
].join("\n") + "\n";

files["westpac-nz.csv"] = [
  "Date,Amount,Other Party,Description,Reference,Particulars,Analysis Code",
  ...TX.map((t) => [t.d, signed(t), t.payee, t.memo || t.payee, t.memo, "", ""].map(csvEscape).join(",")),
].join("\n") + "\n";

files["westpac-narration.csv"] = [
  "Date,Narration,Amount,Balance",
  ...running(TX, true).map(({ t, bal }) => [t.d, `${t.payee} ${t.memo}`.trim(), signed(t), money(bal)].map(csvEscape).join(",")),
].join("\n") + "\n";

files["bnz.csv"] = [
  "Date,Account,Description,Amount,Balance",
  ...running(TX, true).map(({ t, bal }) => [t.d, "02-0123-0012345-00", `${t.payee} ${t.memo}`.trim(), signed(t), money(bal)].map(csvEscape).join(",")),
].join("\n") + "\n";

files["bnz-extended.csv"] = [
  "Date,Amount,Payee,Particulars,Code,Reference,Tran Type,This Party Account,Other Party Account,Serial,Transaction Code,Batch Number,Originating Bank/Branch",
  ...TX.map((t) =>
    [t.d, signed(t), t.payee, t.memo, "", t.memo, t.kb, "02-0123-0012345-00", "", "", "", "", ""].map(csvEscape).join(","),
  ),
].join("\n") + "\n";

files["kiwibank-full.csv"] = [
  "Account number,Date,Memo/Description,Source Code (payment type),TP ref,TP part,TP code,OP ref,OP part,OP code,OP name,OP Bank Account Number,Amount (credit),Amount (debit),Amount,Balance",
  ...running(TX, true).map(({ t, bal }) =>
    [
      "38-9000-0123456-00",
      t.dmyDash,
      t.memo || t.payee,
      t.kb,
      "",
      "",
      "",
      "",
      "",
      "",
      t.payee,
      "",
      t.in ? money(t.amt) : "",
      t.in ? "" : money(t.amt),
      signed(t),
      money(bal),
    ]
      .map(csvEscape)
      .join(","),
  ),
].join("\n") + "\n";

files["tsb.csv"] = [
  "Date,Description,Amount,Balance",
  ...running(TX, true).map(({ t, bal }) => [t.d, `${t.payee} ${t.memo}`.trim(), signed(t), money(bal)].map(csvEscape).join(",")),
].join("\n") + "\n";

files["national-bank.csv"] = [
  "Category,Description,Reference1,Reference2,Reference3,Amount,Date",
  ...TX.map((t) => [t.anz, t.payee, t.memo, "", "", signed(t), t.d].map(csvEscape).join(",")),
].join("\n") + "\n";

files["asb-pdf.txt"] = [
  "ASB Bank Limited",
  "Transaction history  01/08/2026 to 21/08/2026",
  "Date Description Withdrawals Deposits Balance",
  "Opening balance 8,420.55",
  ...running(TX, true).map(({ t, bal }) => {
    const wd = t.in ? "" : money(t.amt);
    const dep = t.in ? money(t.amt) : "";
    return `${t.d} ${t.payee} ${t.memo} ${wd} ${dep} ${money(bal)}`.replace(/  +/g, " ").trim();
  }),
  "Closing balance 10,688.37",
].join("\n") + "\n";

function running(list, chronological = false) {
  const rows = chronological ? [...list].reverse() : [...list];
  // TX is newest-first. Running balance oldest-first from 8420.55
  const oldestFirst = [...list].slice().sort((a, b) => a.iso.localeCompare(b.iso) || Number(a.in) - Number(b.in));
  let bal = 8420.55;
  const bals = new Map();
  const seen = new Map();
  for (const t of oldestFirst) {
    const key = `${t.iso}|${t.payee}|${t.amt}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    bal = Math.round((bal + (t.in ? t.amt : -t.amt)) * 100) / 100;
    bals.set(`${key}|${n}`, bal);
  }
  const count = new Map();
  return list.map((t) => {
    const key = `${t.iso}|${t.payee}|${t.amt}`;
    const n = (count.get(key) ?? 0) + 1;
    count.set(key, n);
    return { t, bal: bals.get(`${key}|${n}`) };
  });
}

for (const [name, body] of Object.entries(files)) {
  writeFileSync(join(fixtures, name), body);
}

const publicMap = {
  "anz.csv": files["anz-official.csv"],
  "asb.csv": files["asb-fastnet.csv"],
  "westpac.csv": files["westpac-nz.csv"],
  "bnz.csv": files["bnz.csv"],
  "kiwibank.csv": files["kiwibank-full.csv"],
  "tsb.csv": files["tsb.csv"],
};
for (const [name, body] of Object.entries(publicMap)) {
  writeFileSync(join(publicSamples, name), body);
}

console.log("Wrote", Object.keys(files).length, "fixtures and", Object.keys(publicMap).length, "public samples");

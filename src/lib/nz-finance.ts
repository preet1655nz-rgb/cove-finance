/** Embedded NZ personal-finance reference — tax year from 1 Apr 2025 / 2026. */

const BANDS = [
  { upTo: 15_600, rate: 0.105 },
  { upTo: 53_500, rate: 0.175 },
  { upTo: 78_100, rate: 0.3 },
  { upTo: 180_000, rate: 0.33 },
  { upTo: Infinity, rate: 0.39 },
] as const;

export const NZ_KNOWLEDGE = `New Zealand household finance (current as of August 2026):
Income tax (1 Apr 2025 onward, still used 2026/27): 10.5% to $15,600; 17.5% to $53,500; 30% to $78,100; 33% to $180,000; 39% above.
ACC earners' levy 2026/27: $1.75 per $100 of liable earnings, cap $156,641.
GST: 15%.
KiwiSaver from 1 Apr 2026: default employee + employer 3.5% (rising to 4% on 1 Apr 2028). Temporary drop back to 3% is allowed. Government contribution 25c per $1 member contribution, max $260.72/year; none if taxable income > $180,000. Member rates commonly 3.5%, 4%, 6%, 8%, 10%.
PIR for PIEs (Sharesies, Kiwisaver funds): 10.5%, 17.5% or 28%.
Emergency fund: 3–6 months of lived spending (exclude transfers between own accounts).
50/30/20: needs / wants / saving+investing of take-home pay.
Sharesies, Hatch, InvestNow, Kernel, Smartshares = investing, not shopping.
Internal bank transfers (bill payment to own savings, debit/credit transfer, Gem Visa) are not spending.
Do not give legal/tax-agent advice; figures are estimates from IRD public rates.`;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function incomeTax(income: number) {
  let tax = 0;
  let last = 0;
  let rest = Math.max(0, income);
  for (const b of BANDS) {
    const slice = Math.min(rest, b.upTo - last);
    if (slice <= 0) break;
    tax += slice * b.rate;
    rest -= slice;
    last = b.upTo;
  }
  return round2(tax);
}

export function accLevy(income: number) {
  return round2(Math.min(Math.max(0, income), 156_641) * 0.0175);
}

export function kiwiSaverEmployee(income: number, rate = 0.035) {
  return round2(Math.max(0, income) * rate);
}

export function kiwiSaverGovt(employeeContrib: number, taxableIncome: number) {
  if (taxableIncome > 180_000) return 0;
  return round2(Math.min(260.72, employeeContrib * 0.25));
}

export function takeHome(gross: number, ksRate = 0.035) {
  const tax = incomeTax(gross);
  const acc = accLevy(gross);
  const ks = kiwiSaverEmployee(gross, ksRate);
  const net = round2(gross - tax - acc - ks);
  return { gross, tax, acc, kiwiSaver: ks, govt: kiwiSaverGovt(ks, gross), net, effective: gross ? tax / gross : 0 };
}

export function explainTax(gross: number, ksRate = 0.035) {
  const t = takeHome(gross, ksRate);
  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
  return `On $${gross.toLocaleString("en-NZ")} gross (NZ 2026/27 rates, ${pct(ksRate)} KiwiSaver): income tax $${t.tax.toLocaleString("en-NZ")}, ACC levy $${t.acc.toLocaleString("en-NZ")}, KiwiSaver $${t.kiwiSaver.toLocaleString("en-NZ")}. Take-home about $${t.net.toLocaleString("en-NZ")} a year (${moneyish(t.net / 12)} / month). Government KiwiSaver kick-in up to $${t.govt}. This is an estimate, not IRD advice.`;
}

function moneyish(n: number) {
  return `$${n.toFixed(0)}`;
}

export function parseMoneyish(raw: string) {
  const m = raw.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : null;
}

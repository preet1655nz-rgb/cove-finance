/** Embedded NZ personal-finance reference — tax year 1 Apr 2026 – 31 Mar 2027. */

const BANDS = [
  { upTo: 15_600, rate: 0.105 },
  { upTo: 53_500, rate: 0.175 },
  { upTo: 78_100, rate: 0.3 },
  { upTo: 180_000, rate: 0.33 },
  { upTo: Infinity, rate: 0.39 },
] as const;

export const SL_THRESHOLD = 24_128;
export const SL_RATE = 0.12;
export const ACC_RATE = 0.0175;
export const ACC_CAP = 156_641;
export const GST_RATE = 0.15;
export const KS_DEFAULT = 0.035;
export const KS_GOVT_MAX = 260.72;
export const KS_GOVT_INCOME_CAP = 180_000;
export const MIN_WAGE_ADULT = 23.95;

export const NZ_KNOWLEDGE = `New Zealand household finance (August 2026 / 2026–27 tax year):
Income tax: 10.5% to $15,600; 17.5% to $53,500; 30% to $78,100; 33% to $180,000; 39% above.
ACC earners' levy: $1.75 per $100 of liable earnings, cap $156,641.
GST: 15%. Student loan (NZ): 12% of income above $24,128.
KiwiSaver from 1 Apr 2026: default employee + employer 3.5% (4% from 1 Apr 2028). Temporary drop to 3% allowed. Government 25c per $1, max $260.72/year; none if income > $180,000. Member rates 3.5, 4, 6, 8, 10%.
PIR for PIEs (Sharesies, KiwiSaver funds): 10.5% / 17.5% / 28%.
Adult minimum wage from 1 Apr 2026: $23.95/hour.
Emergency fund: 3–6 months of lived spending (exclude transfers between own accounts).
50/30/20: needs / wants / saving+investing of take-home.
Sharesies, Hatch, InvestNow, Kernel, Smartshares = investing, not shopping.
Internal bank transfers are not spending.
Figures are public-rate estimates, not IRD advice.`;

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
  return round2(Math.min(Math.max(0, income), ACC_CAP) * ACC_RATE);
}

export function kiwiSaverEmployee(income: number, rate = KS_DEFAULT) {
  return round2(Math.max(0, income) * rate);
}

export function kiwiSaverGovt(employeeContrib: number, taxableIncome: number) {
  if (taxableIncome > KS_GOVT_INCOME_CAP) return 0;
  return round2(Math.min(KS_GOVT_MAX, employeeContrib * 0.25));
}

export function studentLoan(income: number) {
  return round2(Math.max(0, income - SL_THRESHOLD) * SL_RATE);
}

export function takeHome(gross: number, ksRate = KS_DEFAULT, withStudentLoan = false) {
  const tax = incomeTax(gross);
  const acc = accLevy(gross);
  const ks = kiwiSaverEmployee(gross, ksRate);
  const sl = withStudentLoan ? studentLoan(gross) : 0;
  const net = round2(gross - tax - acc - ks - sl);
  return {
    gross,
    tax,
    acc,
    kiwiSaver: ks,
    studentLoan: sl,
    govt: kiwiSaverGovt(ks, gross),
    net,
    effective: gross ? tax / gross : 0,
    monthly: round2(net / 12),
  };
}

export function gstInclusive(amount: number) {
  return round2(amount * (1 + GST_RATE));
}

export function gstExclusive(amount: number) {
  return round2(amount / (1 + GST_RATE));
}

export function gstPortion(inclusive: number) {
  return round2(inclusive - gstExclusive(inclusive));
}

export function pirFor(taxableIncome: number) {
  if (taxableIncome <= 15_600) return 10.5;
  if (taxableIncome <= 53_500) return 17.5;
  return 28;
}

export function split503020(takeHomePay: number) {
  return {
    needs: round2(takeHomePay * 0.5),
    wants: round2(takeHomePay * 0.3),
    save: round2(takeHomePay * 0.2),
  };
}

export function mortgageComfort(monthlyNet: number) {
  return {
    conservative: round2(monthlyNet * 0.25),
    stretch: round2(monthlyNet * 0.3),
  };
}

export function explainTax(gross: number, ksRate = KS_DEFAULT, withStudentLoan = false) {
  const t = takeHome(gross, ksRate, withStudentLoan);
  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
  const sl = t.studentLoan
    ? ` Student loan (12% over $${SL_THRESHOLD.toLocaleString("en-NZ")}): $${t.studentLoan.toLocaleString("en-NZ")}.`
    : "";
  return `On $${gross.toLocaleString("en-NZ")} gross (NZ 2026/27 rates, ${pct(ksRate)} KiwiSaver): income tax $${t.tax.toLocaleString("en-NZ")}, ACC levy $${t.acc.toLocaleString("en-NZ")}, KiwiSaver $${t.kiwiSaver.toLocaleString("en-NZ")}.${sl} Take-home about $${t.net.toLocaleString("en-NZ")} a year ($${Math.round(t.monthly).toLocaleString("en-NZ")} / month). Government KiwiSaver kick-in up to $${t.govt}. Estimate from public IRD rates — not tax advice.`;
}

export function parseMoneyish(raw: string) {
  const m = raw.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : null;
}

export function annualize(amount: number, days: number) {
  const d = Math.max(1, days);
  return round2((amount * 365) / d);
}

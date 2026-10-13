/**
 * Indicative NZ sole-trader tax on Drive surplus.
 * Brackets and the ACC earner's levy follow the 2026/27 year.
 * This is not an IR3 and does not replace Inland Revenue or a tax agent.
 * Confirm rates at ird.govt.nz before filing.
 */

export const TAX_BRACKETS_2027 = [
  { upTo: 15600, rate: 0.105 },
  { upTo: 53500, rate: 0.175 },
  { upTo: 78100, rate: 0.3 },
  { upTo: 180000, rate: 0.33 },
  { upTo: Infinity, rate: 0.39 },
] as const;

/** ACC earner's levy for 2026/27. Work levy is occupation-specific and not included. */
export const ACC_EARNER_RATE = 0.0175;
export const ACC_EARNER_CAP = 156_641;

/** Marketplace collects 15% on listed services. Non-registered drivers keep 8.5%. */
export const FLAT_RATE_CREDIT = 0.085;

export function incomeTaxOn(profit: number) {
  const taxable = Math.max(0, profit);
  let tax = 0;
  let previous = 0;
  for (const band of TAX_BRACKETS_2027) {
    const slice = Math.max(0, Math.min(taxable, band.upTo) - previous);
    tax += slice * band.rate;
    previous = band.upTo;
    if (taxable <= band.upTo) break;
  }
  return Math.round(tax * 100) / 100;
}

export function accEarnerLevy(profit: number) {
  const liable = Math.min(Math.max(0, profit), ACC_EARNER_CAP);
  return Math.round(liable * ACC_EARNER_RATE * 100) / 100;
}

export function flatRateCredit(grossFares: number) {
  return Math.round(Math.max(0, grossFares) * FLAT_RATE_CREDIT * 100) / 100;
}

export function estimateDriveTax(opts: {
  netProfit: number;
  grossFares: number;
  gstRegistered?: boolean;
}) {
  const tax = incomeTaxOn(opts.netProfit);
  const acc = accEarnerLevy(opts.netProfit);
  const credit = opts.gstRegistered ? 0 : flatRateCredit(opts.grossFares);
  const setAside = Math.round((tax + acc) * 100) / 100;
  const effective = opts.netProfit > 0 ? Math.round((setAside / opts.netProfit) * 1000) / 10 : 0;
  return { tax, acc, credit, setAside, effective };
}

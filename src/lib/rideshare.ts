import type { RideshareSettings, Transaction, VehicleKind } from "./types.ts";
import { addMonths, todayISO } from "./utils.ts";

/**
 * Inland Revenue kilometre rates for the 2026 income year
 * (1 April 2025 – 31 March 2026). Tier 1 is the business share of the
 * first 14,000 km of total travel. Confirm the current year on ird.govt.nz
 * before filing — Cove does not replace an IR3.
 */
export const IRD_KM = {
  label: "2026 income year",
  tierKm: 14000,
  rates: {
    petrol: { tier1: 1.2, tier2: 0.37 },
    diesel: { tier1: 1.3, tier2: 0.38 },
    hybrid: { tier1: 0.9, tier2: 0.24 },
    electric: { tier1: 1.22, tier2: 0.23 },
  },
} as const;

export const GST_REGISTER_TURNOVER = 60_000;

export const IRD_RIDESHARE_URL =
  "https://www.ird.govt.nz/sharing-economy/ride-sharing/income-and-expenses-for-ride-sharing";

const GIG_INCOME = /\b(uber|didi|ola|zoomy|lyft)\b/i;
const PLATFORM_FEE = /\b(service fee|commission|booking fee|uber fee|didi fee)\b/i;
const FINES = /\b(fine|infringement|ticket|speeding|tow(?:ing)? fee)\b/i;
const PHONE = /\b(spark|2degrees|vodafone|one\.?nz|skinny|mobile|iphone)\b/i;
const VEHICLE =
  /\b(bp|z energy|mobil|gull|waitomo|caltex|petrol|diesel|fuel|wof|vtnz|nzta|rego|registration|repco|supercheap|tyre|tire|mechanic|panelbeat|car\s?wash|parking|toll|lease)\b/i;
const VEHICLE_INSURANCE = /\b(car|vehicle|motor)\b/i;

export type GigKind = "income" | "fee" | "vehicle" | "phone";
export type PlatformName = "Uber" | "Didi" | "Other";

export const defaultRideshare = (): RideshareSettings => ({
  method: "actual",
  vehicle: "petrol",
  businessPct: null,
  totalKm: null,
});

export function classifyGig(tx: Transaction): GigKind | null {
  const text = `${tx.note} ${tx.counterparty ?? ""}`;
  if (tx.gigScope !== "include" && FINES.test(text)) return null;
  if (tx.gigScope === "exclude") return null;
  if (tx.gigScope === "include") {
    if (tx.type === "income") return "income";
    if (PLATFORM_FEE.test(text)) return "fee";
    if (PHONE.test(text)) return "phone";
    return "vehicle";
  }
  if (tx.type === "income" && (tx.categoryId === "gig" || GIG_INCOME.test(text))) return "income";
  if (tx.type !== "expense") return null;
  if (PLATFORM_FEE.test(text) || (GIG_INCOME.test(text) && PLATFORM_FEE.test(text))) return "fee";
  if (GIG_INCOME.test(text) && /\bfee\b/i.test(text)) return "fee";
  if (tx.categoryId === "fuel" || tx.categoryId === "vehicle") return "vehicle";
  if (VEHICLE.test(text)) return "vehicle";
  if (tx.categoryId === "insurance" && VEHICLE_INSURANCE.test(text)) return "vehicle";
  if (PHONE.test(text)) return "phone";
  return null;
}

export function platformOf(tx: Transaction): PlatformName {
  const text = `${tx.note} ${tx.counterparty ?? ""}`;
  if (/\buber\b/i.test(text)) return "Uber";
  if (/\bdidi\b/i.test(text)) return "Didi";
  return "Other";
}

export function sumKind(txs: Transaction[], kind: GigKind) {
  return txs.reduce((sum, tx) => (classifyGig(tx) === kind ? sum + tx.amount : sum), 0);
}

export function businessShare(amount: number, businessPct: number | null) {
  if (businessPct == null) return null;
  const frac = Math.min(100, Math.max(0, businessPct)) / 100;
  return Math.round(amount * frac * 100) / 100;
}

export function kilometreClaim(totalKm: number, businessPct: number, vehicle: VehicleKind) {
  const frac = Math.min(100, Math.max(0, businessPct)) / 100;
  const total = Math.max(0, totalKm);
  const tier1Km = Math.min(total, IRD_KM.tierKm);
  const tier2Km = Math.max(0, total - IRD_KM.tierKm);
  const rate = IRD_KM.rates[vehicle];
  const tier1Business = tier1Km * frac;
  const tier2Business = tier2Km * frac;
  const amount = Math.round((tier1Business * rate.tier1 + tier2Business * rate.tier2) * 100) / 100;
  return { tier1Business, tier2Business, amount, rate };
}

export function rollingGigIncome(txs: Transaction[], today = todayISO()) {
  const from = addMonths(today, -12);
  return txs.reduce((sum, tx) => {
    if (classifyGig(tx) !== "income") return sum;
    if (tx.date <= from || tx.date > today) return sum;
    return sum + tx.amount;
  }, 0);
}
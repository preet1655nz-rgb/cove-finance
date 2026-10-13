import type { KmRates, RideshareSettings, Transaction, VehicleKind } from "./types.ts";
import { addMonths, inRange, todayISO } from "./utils.ts";

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

export function kmScheduleFrom(settings?: RideshareSettings | null) {
  const custom = settings?.kmRates;
  if (!custom) {
    return { label: IRD_KM.label, tierKm: IRD_KM.tierKm, rates: { ...IRD_KM.rates } };
  }
  const pair = (next: { tier1: number; tier2: number } | undefined, fallback: { tier1: number; tier2: number }) => {
    const tier1 = Number(next?.tier1);
    const tier2 = Number(next?.tier2);
    return {
      tier1: Number.isFinite(tier1) && tier1 >= 0 ? tier1 : fallback.tier1,
      tier2: Number.isFinite(tier2) && tier2 >= 0 ? tier2 : fallback.tier2,
    };
  };
  const tierKm = Number(custom.tierKm);
  return {
    label: custom.label?.trim() || IRD_KM.label,
    tierKm: Number.isFinite(tierKm) && tierKm > 0 ? tierKm : IRD_KM.tierKm,
    rates: {
      petrol: pair(custom.petrol, IRD_KM.rates.petrol),
      diesel: pair(custom.diesel, IRD_KM.rates.diesel),
      hybrid: pair(custom.hybrid, IRD_KM.rates.hybrid),
      electric: pair(custom.electric, IRD_KM.rates.electric),
    },
  };
}

export function defaultKmRates(): KmRates {
  return {
    label: IRD_KM.label,
    tierKm: IRD_KM.tierKm,
    petrol: { ...IRD_KM.rates.petrol },
    diesel: { ...IRD_KM.rates.diesel },
    hybrid: { ...IRD_KM.rates.hybrid },
    electric: { ...IRD_KM.rates.electric },
  };
}

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

export function kilometreClaim(
  totalKm: number,
  businessPct: number,
  vehicle: VehicleKind,
  schedule: ReturnType<typeof kmScheduleFrom> = kmScheduleFrom(null),
) {
  const frac = Math.min(100, Math.max(0, businessPct)) / 100;
  const total = Math.max(0, totalKm);
  const tier1Km = Math.min(total, schedule.tierKm);
  const tier2Km = Math.max(0, total - schedule.tierKm);
  const rate = schedule.rates[vehicle];
  const tier1Business = tier1Km * frac;
  const tier2Business = tier2Km * frac;
  const amount = Math.round((tier1Business * rate.tier1 + tier2Business * rate.tier2) * 100) / 100;
  return { tier1Business, tier2Business, amount, rate, label: schedule.label, tierKm: schedule.tierKm };
}

export function rollingGigIncome(txs: Transaction[], today = todayISO()) {
  const from = addMonths(today, -12);
  return txs.reduce((sum, tx) => {
    if (classifyGig(tx) !== "income") return sum;
    if (tx.date <= from || tx.date > today) return sum;
    return sum + tx.amount;
  }, 0);
}

export type DriveLine = { label: string; amount: number; hint?: string };

export function driveReport(txs: Transaction[], settings: RideshareSettings, from: string, to: string) {
  const period = txs.filter((t) => inRange(t.date, from, to));
  const slice = period.filter((t) => classifyGig(t));
  const schedule = kmScheduleFrom(settings);
  const income = sumKind(slice, "income");
  const fees = sumKind(slice, "fee");
  const vehicle = sumKind(slice, "vehicle");
  const phone = sumKind(slice, "phone");
  const platforms = (["Uber", "Didi", "Other"] as const)
    .map((name) => ({
      name,
      amount: slice.filter((t) => classifyGig(t) === "income" && platformOf(t) === name).reduce((s, t) => s + t.amount, 0),
    }))
    .filter((row) => row.amount > 0);
  const pct = settings.businessPct;
  const phoneClaim = businessShare(phone, pct) ?? phone;
  const actualVehicle = businessShare(vehicle, pct) ?? vehicle;
  const km =
    settings.totalKm != null && pct != null ? kilometreClaim(settings.totalKm, pct, settings.vehicle, schedule) : null;
  const useKm = settings.method === "kilometre";
  const deduction = useKm ? (km?.amount ?? 0) : actualVehicle + phoneClaim;
  const net = Math.round((income - fees - deduction) * 100) / 100;

  const upTo = txs.filter((t) => t.date <= to && classifyGig(t));
  const lifeIncome = sumKind(upTo, "income");
  const lifeFees = sumKind(upTo, "fee");
  const lifeVehicle = businessShare(sumKind(upTo, "vehicle"), pct) ?? sumKind(upTo, "vehicle");
  const lifePhone = businessShare(sumKind(upTo, "phone"), pct) ?? sumKind(upTo, "phone");
  const lifeDeduction = useKm ? (km?.amount ?? 0) + lifePhone : lifeVehicle + lifePhone;
  const equity = Math.round((lifeIncome - lifeFees - lifeDeduction) * 100) / 100;

  const incomeLines: DriveLine[] = platforms.length
    ? platforms.map((p) => ({ label: p.name, amount: p.amount }))
    : [{ label: "Gig income", amount: income }];
  const expenseLines: DriveLine[] = [
    { label: "Platform fees", amount: fees },
    useKm
      ? {
          label: "Kilometre-rate claim",
          amount: km?.amount ?? 0,
          hint: km ? `${schedule.label}. Tax-year figure, not this period alone.` : "Add kilometres and a logbook % in Claim.",
        }
      : { label: "Vehicle", amount: actualVehicle, hint: pct == null ? "Full recorded cost until you set a business %" : `${pct}% business share` },
  ];
  if (!useKm) expenseLines.push({ label: "Phone", amount: phoneClaim });
  else if (phoneClaim) expenseLines.push({ label: "Phone", amount: phoneClaim, hint: "Still claimed on top of the kilometre rate when it is a separate cost." });

  return {
    income,
    fees,
    vehicle,
    phone,
    platforms,
    schedule,
    km,
    useKm,
    deduction,
    net,
    equity,
    incomeLines,
    expenseLines,
    gross: Math.round((income - fees) * 100) / 100,
  };
}
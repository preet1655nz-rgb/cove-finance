import { format, parseISO } from "date-fns";

const localeFor: Record<string, string> = {
  NZD: "en-NZ",
  USD: "en-US",
  AUD: "en-AU",
  GBP: "en-GB",
  EUR: "en-IE",
  CAD: "en-CA",
};

export function money(amount: number, currency: string, compact = false) {
  return new Intl.NumberFormat(localeFor[currency] ?? "en-NZ", {
    style: "currency",
    currency,
    maximumFractionDigits: compact && Math.abs(amount) >= 1000 ? 0 : 2,
  }).format(amount);
}

export function signedMoney(amount: number, currency: string) {
  const abs = money(Math.abs(amount), currency);
  if (amount > 0) return `+${abs}`;
  if (amount < 0) return `−${abs}`;
  return abs;
}

export function plainMoney(amount: number) {
  return new Intl.NumberFormat("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDay(iso: string) {
  return format(parseISO(iso), "d MMM");
}

export function formatStatementDay(iso: string) {
  return format(parseISO(iso), "dd MMM");
}

export function formatDayLong(iso: string) {
  return format(parseISO(iso), "EEE d MMM");
}

export function formatMonth(isoOrKey: string) {
  const iso = isoOrKey.length === 7 ? `${isoOrKey}-01` : isoOrKey;
  return format(parseISO(iso), "MMMM yyyy");
}

export function formatMonthShort(isoOrKey: string) {
  const iso = isoOrKey.length === 7 ? `${isoOrKey}-01` : isoOrKey;
  return format(parseISO(iso), "MMM");
}

export function pct(n: number) {
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

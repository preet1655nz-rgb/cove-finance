export type TxType = "income" | "expense";

export type GigScope = "include" | "exclude";

export type TransferLeg = {
  direction: "in" | "out";
  otherAccountId?: string;
  otherLabel: string;
  pairId?: string;
};

export type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  note: string;
  date: string;
  createdAt: string;
  accountId?: string;
  counterparty?: string;
  transfer?: TransferLeg;
  reviewed?: boolean;
  /** Lens only. Absent means Drive classifies the row itself. */
  gigScope?: GigScope;
};

export type BankAccount = {
  id: string;
  name: string;
  bank: string;
  numberHint?: string;
};

export type MemoryRule = {
  id: string;
  pattern: string;
  kind: "category" | "transfer";
  categoryId?: string;
  accountName?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "cove";
  text: string;
  at: string;
};

export type CoveFact = {
  id: string;
  text: string;
};

export type Budget = {
  id: string;
  categoryId: string;
  amount: number;
};

export type RecurringBill = {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  dayOfMonth: number;
  dueDate?: string;
  repeat?: "weekly" | "fortnightly" | "monthly" | "once";
  enabled: boolean;
  /** ISO date of the occurrence that has been marked paid. */
  paidThrough?: string;
};

export type CustomCategory = {
  id: string;
  name: string;
  type: TxType;
};

export type NoticeKind = "budget" | "bill" | "insight";

export type Notice = {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  createdAt: string;
  fingerprint: string;
};

export type VehicleKind = "petrol" | "diesel" | "hybrid" | "electric";

export type KmRatePair = { tier1: number; tier2: number };

export type KmRates = {
  label: string;
  tierKm: number;
  petrol: KmRatePair;
  diesel: KmRatePair;
  hybrid: KmRatePair;
  electric: KmRatePair;
};

export type RideshareSettings = {
  method: "actual" | "kilometre";
  vehicle: VehicleKind;
  /** Logbook business-use share. Null until the driver confirms it. */
  businessPct: number | null;
  /** Total kilometres this tax year, business and private together. */
  totalKm: number | null;
  /** Overrides the built-in Inland Revenue kilometre rates for the current year. */
  kmRates?: KmRates;
};

export type Settings = {
  displayName: string;
  currency: string;
  browserNotifications: boolean;
  budgetAlertPct: number;
  customFrom?: string;
  customTo?: string;
  homeWidget?: boolean;
  appearance?: "light" | "dark";
  rideshare?: RideshareSettings;
};

export type Period = "this-week" | "fortnight" | "this-month" | "last-month" | "quarter" | "year" | "all" | "custom";

export const CURRENCIES = [
  { code: "NZD", label: "NZ Dollar" },
  { code: "USD", label: "US Dollar" },
  { code: "AUD", label: "AU Dollar" },
  { code: "GBP", label: "British Pound" },
  { code: "EUR", label: "Euro" },
  { code: "CAD", label: "Canadian Dollar" },
] as const;
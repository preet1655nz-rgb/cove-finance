export type TxType = "income" | "expense";

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
  enabled: boolean;
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

export type Settings = {
  displayName: string;
  currency: string;
  browserNotifications: boolean;
  budgetAlertPct: number;
};

export type Period = "this-month" | "last-month" | "quarter" | "year" | "all";

export const CURRENCIES = [
  { code: "NZD", label: "NZ Dollar" },
  { code: "USD", label: "US Dollar" },
  { code: "AUD", label: "AU Dollar" },
  { code: "GBP", label: "British Pound" },
  { code: "EUR", label: "Euro" },
  { code: "CAD", label: "Canadian Dollar" },
] as const;

import type { Budget, RecurringBill, Settings, Transaction } from "./types";
import { isoDate } from "./utils";

function d(year: number, monthIndex: number, day: number) {
  return isoDate(new Date(year, monthIndex, day));
}

function shift(days: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  return isoDate(dt);
}

let seq = 0;
function sid(prefix: string) {
  seq += 1;
  return `${prefix}-${seq}`;
}

function tx(
  type: Transaction["type"],
  amount: number,
  categoryId: string,
  date: string,
  note: string,
): Transaction {
  return {
    id: sid("tx"),
    type,
    amount,
    categoryId,
    note,
    date,
    createdAt: `${date}T10:00:00.000Z`,
  };
}

export const defaultSettings: Settings = {
  displayName: "",
  currency: "NZD",
  browserNotifications: false,
  budgetAlertPct: 80,
};

export function buildSeed(): {
  transactions: Transaction[];
  budgets: Budget[];
  bills: RecurringBill[];
  settings: Settings;
} {
  seq = 0;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const transactions: Transaction[] = [
    tx("income", 7400, "salary", d(y, m, 1), "Monthly salary"),
    tx("income", 7400, "salary", d(y, m - 1, 1), "Monthly salary"),
    tx("income", 7400, "salary", d(y, m - 2, 1), "Monthly salary"),
    tx("income", 1280, "freelance", d(y, m - 1, 18), "Brand illustration"),
    tx("income", 420, "investments", d(y, m, 8), "Dividend — VTI"),
    tx("income", 180, "gifts", d(y, m - 2, 14), "Birthday from Mum"),

    tx("expense", 2200, "housing", d(y, m, 1), "Rent"),
    tx("expense", 2200, "housing", d(y, m - 1, 1), "Rent"),
    tx("expense", 2200, "housing", d(y, m - 2, 1), "Rent"),

    tx("expense", 86.4, "groceries", shift(1), "Farro Fresh"),
    tx("expense", 124.9, "groceries", shift(4), "Countdown weekly"),
    tx("expense", 67.2, "groceries", shift(8), "New World"),
    tx("expense", 142.5, "groceries", shift(12), "Countdown weekly"),
    tx("expense", 58.3, "groceries", shift(16), "Fruit shop"),
    tx("expense", 131.8, "groceries", shift(20), "Countdown weekly"),
    tx("expense", 119.4, "groceries", d(y, m - 1, 6), "Countdown weekly"),
    tx("expense", 98.7, "groceries", d(y, m - 1, 13), "Countdown weekly"),
    tx("expense", 154.2, "groceries", d(y, m - 1, 20), "Farro Fresh"),
    tx("expense", 88.1, "groceries", d(y, m - 1, 27), "Countdown weekly"),
    tx("expense", 110.0, "groceries", d(y, m - 2, 8), "Countdown weekly"),
    tx("expense", 97.6, "groceries", d(y, m - 2, 22), "New World"),

    tx("expense", 42.5, "dining", shift(2), "Orphans Kitchen"),
    tx("expense", 18.0, "drinks", shift(2), "Allpress espresso"),
    tx("expense", 64.0, "dining", shift(6), "Amano pasta"),
    tx("expense", 12.5, "drinks", shift(7), "Daily espresso"),
    tx("expense", 29.0, "dining", shift(11), "Amano takeaway"),
    tx("expense", 88.0, "dining", d(y, m - 1, 9), "Coco's Cantina"),
    tx("expense", 36.5, "dining", d(y, m - 1, 22), "Pizza night"),
    tx("expense", 14.0, "drinks", d(y, m - 1, 4), "Caffe L'affare"),

    tx("expense", 64.9, "transport", shift(3), "AT Hop top-up"),
    tx("expense", 78.4, "transport", shift(14), "Petrol — BP"),
    tx("expense", 62.0, "transport", d(y, m - 1, 11), "AT Hop top-up"),
    tx("expense", 81.2, "transport", d(y, m - 1, 25), "Petrol — Z"),
    tx("expense", 59.0, "transport", d(y, m - 2, 10), "AT Hop top-up"),

    tx("expense", 142.0, "utilities", d(y, m, 12), "Fibre — 1Gb"),
    tx("expense", 138.0, "utilities", d(y, m - 1, 12), "Fibre — 1Gb"),
    tx("expense", 186.4, "utilities", d(y, m - 1, 18), "Power — Genesis"),
    tx("expense", 172.8, "utilities", d(y, m - 2, 18), "Power — Genesis"),

    tx("expense", 24.99, "subscriptions", d(y, m, 8), "Netflix"),
    tx("expense", 17.99, "subscriptions", d(y, m, 5), "Spotify"),
    tx("expense", 24.99, "subscriptions", d(y, m - 1, 8), "Netflix"),
    tx("expense", 17.99, "subscriptions", d(y, m - 1, 5), "Spotify"),
    tx("expense", 14.99, "subscriptions", d(y, m, 3), "iCloud+"),

    tx("expense", 38.0, "entertainment", shift(5), "Academy Cinema"),
    tx("expense", 62.0, "entertainment", d(y, m - 1, 16), "Concert — Aotea"),
    tx("expense", 89.0, "health", d(y, m - 1, 3), "Physio"),
    tx("expense", 46.0, "health", shift(9), "Pharmacy"),
    tx("expense", 214.0, "shopping", d(y, m - 1, 14), "Winter coat"),
    tx("expense", 68.0, "shopping", shift(10), "Uniqlo basics"),
    tx("expense", 540.0, "travel", d(y, m - 2, 21), "Wellington weekend"),
    tx("expense", 46.0, "education", d(y, m, 4), "Course workbook"),
    tx("expense", 400.0, "savings", d(y, m, 2), "Emergency fund"),
    tx("expense", 400.0, "savings", d(y, m - 1, 2), "Emergency fund"),
    tx("expense", 400.0, "savings", d(y, m - 2, 2), "Emergency fund"),
  ];

  const budgets: Budget[] = [
    { id: sid("bd"), categoryId: "housing", amount: 2200 },
    { id: sid("bd"), categoryId: "groceries", amount: 700 },
    { id: sid("bd"), categoryId: "dining", amount: 280 },
    { id: sid("bd"), categoryId: "transport", amount: 250 },
    { id: sid("bd"), categoryId: "utilities", amount: 360 },
    { id: sid("bd"), categoryId: "subscriptions", amount: 80 },
    { id: sid("bd"), categoryId: "entertainment", amount: 150 },
    { id: sid("bd"), categoryId: "shopping", amount: 200 },
    { id: sid("bd"), categoryId: "health", amount: 120 },
  ];

  const bills: RecurringBill[] = [
    { id: sid("bl"), name: "Rent", amount: 2200, categoryId: "housing", dayOfMonth: 1, enabled: true },
    { id: sid("bl"), name: "Fibre", amount: 142, categoryId: "utilities", dayOfMonth: 12, enabled: true },
    { id: sid("bl"), name: "Power", amount: 180, categoryId: "utilities", dayOfMonth: 18, enabled: true },
    { id: sid("bl"), name: "Netflix", amount: 24.99, categoryId: "subscriptions", dayOfMonth: 8, enabled: true },
  ];

  return { transactions, budgets, bills, settings: defaultSettings };
}

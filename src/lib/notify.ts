import { getCategory } from "./categories";
import { money } from "./format";
import { spentInCategory } from "./period";
import type { Budget, Notice, RecurringBill, Transaction } from "./types";
import { endOfMonth, startOfMonth, todayISO, uid } from "./utils";

function monthSpent(txs: Transaction[], categoryId: string) {
  const today = todayISO();
  return spentInCategory(txs, categoryId, startOfMonth(today), endOfMonth(today));
}

function nextBillDate(dayOfMonth: number) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const day = Math.min(dayOfMonth, last);
  let dt = new Date(y, m, day);
  const today = new Date(y, m, now.getDate());
  if (dt < today) dt = new Date(y, m + 1, Math.min(dayOfMonth, new Date(y, m + 2, 0).getDate()));
  return dt;
}

function daysUntil(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function buildNotices(
  transactions: Transaction[],
  budgets: Budget[],
  bills: RecurringBill[],
  existing: Notice[],
  currency = "NZD",
): Notice[] {
  const generated: Notice[] = [];

  for (const b of budgets) {
    if (b.amount <= 0) continue;
    const spent = monthSpent(transactions, b.categoryId);
    const ratio = spent / b.amount;
    const cat = getCategory(b.categoryId);
    if (ratio > 1) {
      generated.push({
        id: uid(),
        kind: "budget",
        title: `${cat.name} is over budget`,
        body: `${money(spent, currency)} spent of ${money(b.amount, currency)} this month.`,
        href: "/budgets",
        read: false,
        createdAt: new Date().toISOString(),
        fingerprint: `budget-over-${b.categoryId}-${startOfMonth()}`,
      });
    } else if (ratio >= 1) {
      generated.push({
        id: uid(),
        kind: "budget",
        title: `${cat.name} is at its cap`,
        body: `${money(spent, currency)} of ${money(b.amount, currency)} this month.`,
        href: "/budgets",
        read: false,
        createdAt: new Date().toISOString(),
        fingerprint: `budget-cap-${b.categoryId}-${startOfMonth()}`,
      });
    } else if (ratio >= 0.8) {
      generated.push({
        id: uid(),
        kind: "budget",
        title: `${cat.name} is ${Math.round(ratio * 100)}% used`,
        body: `${money(b.amount - spent, currency)} left of ${money(b.amount, currency)}.`,
        href: "/budgets",
        read: false,
        createdAt: new Date().toISOString(),
        fingerprint: `budget-warn-${b.categoryId}-${startOfMonth()}`,
      });
    }
  }

  for (const bill of bills.filter((b) => b.enabled)) {
    const due = nextBillDate(bill.dayOfMonth);
    const days = daysUntil(due);
    if (days >= 0 && days <= 5) {
      generated.push({
        id: uid(),
        kind: "bill",
        title: days === 0 ? `${bill.name} is due today` : `${bill.name} due in ${days} day${days === 1 ? "" : "s"}`,
        body: `${money(bill.amount, currency)} · ${getCategory(bill.categoryId).name}`,
        href: "/budgets",
        read: false,
        createdAt: new Date().toISOString(),
        fingerprint: `bill-${bill.id}-${due.toISOString().slice(0, 10)}`,
      });
    }
  }

  const today = todayISO();
  const from = startOfMonth(today);
  const to = endOfMonth(today);
  const dining = spentInCategory(transactions, "dining", from, to);
  if (dining > 150) {
    generated.push({
      id: uid(),
      kind: "insight",
      title: "Dining is running high",
      body: `${money(dining, currency)} on meals this month. A quieter week would close the gap.`,
      href: "/insights",
      read: false,
      createdAt: new Date().toISOString(),
      fingerprint: `insight-dining-${from}`,
    });
  }

  const prev = new Map(existing.map((n) => [n.fingerprint, n]));
  return generated.map((n) => {
    const old = prev.get(n.fingerprint);
    return old ? { ...n, id: old.id, read: old.read, createdAt: old.createdAt } : n;
  });
}

export async function maybeBrowserNotify(notice: Notice, enabled: boolean) {
  if (!enabled || typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(notice.title, { body: notice.body, silent: true });
  } catch {
    /* ignore */
  }
}

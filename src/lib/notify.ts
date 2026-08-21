import { getCategory } from "./categories";
import { money } from "./format";
import { spentInCategory } from "./period";
import type { Budget, Notice, RecurringBill, Transaction } from "./types";
import { addMonths, endOfMonth, isoDate, startOfMonth, todayISO, uid } from "./utils";

function monthSpent(txs: Transaction[], categoryId: string) {
  const today = todayISO();
  return spentInCategory(txs, categoryId, startOfMonth(today), endOfMonth(today));
}

export function nextBillDate(bill: Pick<RecurringBill, "dayOfMonth" | "dueDate" | "repeat">, from = todayISO()) {
  if (bill.repeat === "once" && bill.dueDate) {
    const [y, m, d] = bill.dueDate.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  if (bill.dueDate && bill.dueDate >= from) {
    const [y, m, d] = bill.dueDate.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const dayOfMonth = bill.dayOfMonth || (bill.dueDate ? Number(bill.dueDate.slice(8, 10)) : 1);
  const [fy, fm, fd] = from.split("-").map(Number);
  const today = new Date(fy, fm - 1, fd);
  const last = new Date(fy, fm, 0).getDate();
  let dt = new Date(fy, fm - 1, Math.min(dayOfMonth, last));
  if (dt < today) {
    const next = addMonths(`${fy}-${String(fm).padStart(2, "0")}-01`, 1);
    const [ny, nm] = next.split("-").map(Number);
    const nextLast = new Date(ny, nm, 0).getDate();
    dt = new Date(ny, nm - 1, Math.min(dayOfMonth, nextLast));
  }
  return dt;
}

export function daysUntil(date: Date, from = todayISO()) {
  const [y, m, d] = from.split("-").map(Number);
  const today = new Date(y, m - 1, d);
  const target = new Date(date);
  today.setHours(0, 0, 0, 0);
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
  const today = todayISO();

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
    const due = nextBillDate(bill);
    const days = daysUntil(due);
    const dueIso = isoDate(due);
    if (days < 0) {
      generated.push({
        id: uid(),
        kind: "bill",
        title: `${bill.name} is overdue`,
        body: `${money(bill.amount, currency)} was due ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago.`,
        href: "/bills",
        read: false,
        createdAt: new Date().toISOString(),
        fingerprint: `bill-overdue-${bill.id}-${today}`,
      });
      continue;
    }
    if (days <= 3) {
      const title =
        days === 0
          ? `${bill.name} is due today`
          : days === 1
            ? `${bill.name} is due tomorrow`
            : `${bill.name} is due in ${days} days`;
      generated.push({
        id: uid(),
        kind: "bill",
        title,
        body: `${money(bill.amount, currency)} · ${getCategory(bill.categoryId).name}. Reminder ${3 - days + 1} of 4.`,
        href: "/bills",
        read: false,
        createdAt: new Date().toISOString(),
        fingerprint: `bill-${bill.id}-${today}-${dueIso}`,
      });
    }
  }

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
    new Notification(notice.title, { body: notice.body, silent: false, tag: notice.fingerprint });
  } catch {
    /* ignore */
  }
}

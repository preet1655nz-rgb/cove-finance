import { createFileRoute } from "@tanstack/react-router";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageFrame } from "@/components/page-frame";
import { StatementLedger, buildMonthLedger } from "@/components/statement-ledger";
import { TransactionRow } from "@/components/transaction-row";
import { Button } from "@/components/ui/button";
import { formatMonth, money, signedMoney } from "@/lib/format";
import { useFinanceStore } from "@/lib/store";
import { cn, todayISO } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
  validateSearch: (search: Record<string, unknown>): { month?: string } => ({
    month: typeof search.month === "string" && /^\d{4}-\d{2}$/.test(search.month) ? search.month : undefined,
  }),
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CalendarPage() {
  return (
    <PageFrame>
      <CalendarView />
    </PageFrame>
  );
}

function CalendarView() {
  const txs = useFinanceStore((s) => s.transactions);
  const bills = useFinanceStore((s) => s.bills);
  const currency = useFinanceStore((s) => s.settings.currency);
  const setAddOpen = useFinanceStore((s) => s.setAddOpen);
  const setImportOpen = useFinanceStore((s) => s.setImportOpen);
  const focusMonth = useFinanceStore((s) => s.focusMonth);
  const setFocusMonth = useFinanceStore((s) => s.setFocusMonth);
  const monthQ = Route.useSearch().month;
  const [month, setMonth] = useState(() => monthQ || useFinanceStore.getState().focusMonth || todayISO().slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const t = todayISO();
    setToday(t);
    const focus = monthQ || useFinanceStore.getState().focusMonth;
    if (focus) {
      setMonth(focus);
      setSelected(`${focus}-01`);
      if (useFinanceStore.getState().focusMonth) useFinanceStore.getState().setFocusMonth(null);
    } else {
      setSelected((cur) => cur ?? t);
    }
  }, [monthQ]);

  useEffect(() => {
    if (!focusMonth) return;
    setMonth(focusMonth);
    setSelected(`${focusMonth}-01`);
    setFocusMonth(null);
  }, [focusMonth, setFocusMonth]);

  const days = useMemo(() => {
    const cursor = parseISO(`${month}-01`);
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
    });
  }, [month]);

  const cursor = parseISO(`${month}-01`);

  const byDay = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; count: number }>();
    for (const t of txs) {
      const cur = map.get(t.date) ?? { income: 0, expense: 0, count: 0 };
      if (t.type === "income") cur.income += t.amount;
      else cur.expense += t.amount;
      cur.count += 1;
      map.set(t.date, cur);
    }
    return map;
  }, [txs]);

  const monthFrom = `${month}-01`;
  const monthTo = format(endOfMonth(cursor), "yyyy-MM-dd");
  const monthTxs = txs.filter((t) => t.date >= monthFrom && t.date <= monthTo);
  const income = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = monthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const ledger = useMemo(() => buildMonthLedger(txs, month), [txs, month]);

  const selectedIso = selected ?? today ?? `${month}-01`;
  const selectedTxs = [...txs]
    .filter((t) => t.date === selectedIso)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const dayNum = Number(selectedIso.slice(8));
  const last = Number(monthTo.slice(8));
  const dayBills = bills.filter((b) => b.enabled && Math.min(b.dayOfMonth, last) === dayNum && selectedIso.slice(0, 7) === month);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">A statement for the month, day by day</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Calendar</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" />
            Statement
          </Button>
          <Button onClick={() => setAddOpen(true, { date: selectedIso })}>Add</Button>
        </div>
      </header>

      <section className="rounded-xl bg-card p-4 shadow-card sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-2xl tracking-tight">{formatMonth(month)}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() => {
                const next = format(subMonths(cursor, 1), "yyyy-MM");
                setMonth(next);
                setSelected(`${next}-01`);
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const t = todayISO();
                setMonth(t.slice(0, 7));
                setSelected(t);
              }}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next month"
              onClick={() => {
                const next = format(addMonths(cursor, 1), "yyyy-MM");
                setMonth(next);
                setSelected(`${next}-01`);
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3 border-b border-border pb-4">
          <Mini label="In" value={money(income, currency, true)} tone="income" />
          <Mini label="Out" value={money(expense, currency, true)} tone="expense" />
          <Mini label="Net" value={signedMoney(income - expense, currency)} />
        </div>

        <div className="grid grid-cols-7 gap-px">
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-2 text-center text-[11px] tracking-wide text-muted-foreground uppercase">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const iso = format(day, "yyyy-MM-dd");
            const stats = byDay.get(iso);
            const inMonth = isSameMonth(day, cursor);
            const on = iso === selectedIso;
            const isTodayCell = today != null && iso === today;
            const billHere = bills.some((b) => b.enabled && Math.min(b.dayOfMonth, last) === day.getDate() && inMonth);
            return (
              <button
                key={iso}
                type="button"
                aria-label={format(day, "d MMMM yyyy")}
                aria-pressed={on}
                onClick={() => {
                  if (!inMonth) {
                    setMonth(iso.slice(0, 7));
                  }
                  setSelected(iso);
                }}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-start gap-1 rounded-md px-0.5 py-1.5 sm:min-h-16",
                  on ? "bg-primary text-primary-foreground" : "hover:bg-muted/70",
                  !inMonth && !on && "opacity-40",
                  isTodayCell && !on && "ring-1 ring-foreground/30",
                )}
              >
                <span className="text-[13px] font-medium tabular-nums">{format(day, "d")}</span>
                <span className="flex h-1.5 items-center justify-center gap-0.5">
                  {stats?.income ? (
                    <i className={cn("size-1.5 rounded-full", on ? "bg-primary-foreground" : "bg-income")} />
                  ) : null}
                  {stats?.expense ? (
                    <i className={cn("size-1.5 rounded-full", on ? "bg-primary-foreground/70" : "bg-expense")} />
                  ) : null}
                  {billHere && !stats ? (
                    <i className={cn("size-1.5 rounded-full", on ? "bg-primary-foreground/50" : "bg-muted-foreground/50")} />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 flex gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <i className="size-1.5 rounded-full bg-income" />
            Income
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="size-1.5 rounded-full bg-expense" />
            Expense
          </span>
        </p>
      </section>

      <StatementLedger rows={ledger} selectedDate={selectedIso} onSelectDate={setSelected} />

      <section className="rounded-xl bg-card p-5 shadow-card">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">{format(parseISO(selectedIso), "EEEE d MMMM")}</h2>
          <Button variant="ghost" size="sm" onClick={() => setAddOpen(true, { date: selectedIso })}>
            Add for this day
          </Button>
        </div>
        {dayBills.length ? (
          <p className="mb-3 text-[12px] text-muted-foreground">
            Bill{dayBills.length === 1 ? "" : "s"} due: {dayBills.map((b) => b.name).join(", ")}
          </p>
        ) : null}
        {selectedTxs.length ? (
          selectedTxs.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
        ) : (
          <p className="py-8 text-sm text-muted-foreground">Nothing on this day yet.</p>
        )}
      </section>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "income" | "expense" }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-xl tabular-nums sm:text-2xl",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      >
        {value}
      </p>
    </div>
  );
}

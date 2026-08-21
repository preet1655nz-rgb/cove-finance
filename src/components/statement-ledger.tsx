import { format, parseISO } from "date-fns";
import { formatDay, money, plainMoney } from "@/lib/format";
import { useFinanceStore } from "@/lib/store";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

export type LedgerRow = {
  id: string;
  kind: "opening" | "tx" | "total";
  date: string;
  note: string;
  withdrawal?: number;
  deposit?: number;
  balance: number;
  tx?: Transaction;
};

export function buildMonthLedger(txs: Transaction[], month: string): LedgerRow[] {
  const monthFrom = `${month}-01`;
  const cursor = parseISO(monthFrom);
  const monthTo = format(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), "yyyy-MM-dd");
  const opening = txs
    .filter((t) => t.date < monthFrom)
    .reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  const monthTxs = [...txs]
    .filter((t) => t.date >= monthFrom && t.date <= monthTo)
    .sort((a, b) => a.date.localeCompare(b.date) || a.note.localeCompare(b.note) || a.amount - b.amount);

  const rows: LedgerRow[] = [
    {
      id: "opening",
      kind: "opening",
      date: "",
      note: "Balance brought forward from previous page",
      balance: opening,
    },
  ];
  let balance = opening;
  let withdrawals = 0;
  let deposits = 0;
  for (const t of monthTxs) {
    if (t.type === "income") {
      deposits += t.amount;
      balance += t.amount;
      rows.push({
        id: t.id,
        kind: "tx",
        date: t.date,
        note: t.note || "Untitled",
        deposit: t.amount,
        balance,
        tx: t,
      });
    } else {
      withdrawals += t.amount;
      balance -= t.amount;
      rows.push({
        id: t.id,
        kind: "tx",
        date: t.date,
        note: t.note || "Untitled",
        withdrawal: t.amount,
        balance,
        tx: t,
      });
    }
  }
  rows.push({
    id: "total",
    kind: "total",
    date: "",
    note: "Totals at end of page",
    withdrawal: withdrawals,
    deposit: deposits,
    balance,
  });
  return rows;
}

export function StatementLedger({
  rows,
  selectedDate,
  onSelectDate,
}: {
  rows: LedgerRow[];
  selectedDate: string;
  onSelectDate: (iso: string) => void;
}) {
  const currency = useFinanceStore((s) => s.settings.currency);
  const startEdit = useFinanceStore((s) => s.startEdit);
  const total = rows.find((r) => r.kind === "total");

  return (
    <section className="overflow-hidden rounded-xl bg-card shadow-card">
      <div className="flex items-end justify-between gap-3 border-b border-foreground/15 px-4 pt-5 pb-3 sm:px-5">
        <div>
          <p className="text-[13px] font-medium tracking-wide text-chart-3">Go</p>
          <h2 className="font-display text-2xl tracking-tight">Statement</h2>
        </div>
        {total ? (
          <p className="text-right text-[12px] text-muted-foreground">
            Closing {money(total.balance, currency)}
          </p>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-foreground/20 text-left text-[11px] tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-2.5 font-medium sm:px-5">Date</th>
              <th className="px-2 py-2.5 font-medium">Transaction type and details</th>
              <th className="px-2 py-2.5 text-right font-medium">Withdrawals</th>
              <th className="px-2 py-2.5 text-right font-medium">Deposits</th>
              <th className="px-4 py-2.5 text-right font-medium sm:px-5">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const on = row.kind === "tx" && row.date === selectedDate;
              const clickable = row.kind === "tx";
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border/70",
                    row.kind === "opening" && "font-medium",
                    row.kind === "total" && "bg-secondary font-medium",
                    on && "bg-muted",
                    clickable && "cursor-pointer hover:bg-muted/70",
                  )}
                  onClick={() => {
                    if (row.kind === "tx" && row.date) onSelectDate(row.date);
                  }}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground sm:px-5">
                    {row.date ? formatDay(row.date) : ""}
                  </td>
                  <td className="max-w-[280px] px-2 py-2.5">
                    {row.kind === "tx" && row.tx ? (
                      <button
                        type="button"
                        className="block max-w-full truncate text-left font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(row.tx!);
                        }}
                      >
                        {row.note}
                      </button>
                    ) : (
                      <span className={cn(row.kind === "total" && "font-medium")}>{row.note}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">
                    {amountCell(row.withdrawal, row.kind === "total", currency)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-income">
                    {amountCell(row.deposit, row.kind === "total", currency, true)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums sm:px-5">
                    {row.kind === "total" ? money(row.balance, currency) : plainMoney(row.balance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-[10px] tracking-wide text-muted-foreground uppercase sm:px-5">
        <span>AP Automatic Payment</span>
        <span>BP Bill Payment</span>
        <span>DC Direct Credit</span>
        <span>DD Direct Debit</span>
        <span>EP EFTPOS</span>
        <span>VT Visa Transaction</span>
      </p>
    </section>
  );
}

function amountCell(value: number | undefined, dollar: boolean, currency: string, income = false) {
  if (value == null || value === 0) return "";
  return (
    <span className={income ? "text-income" : undefined}>
      {dollar ? money(value, currency) : plainMoney(value)}
    </span>
  );
}

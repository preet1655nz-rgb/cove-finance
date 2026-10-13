import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CategoryDonut, FlowChart } from "@/components/charts";
import { PageFrame } from "@/components/page-frame";
import { PeriodSelect } from "@/components/period-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCategory } from "@/lib/categories";
import { money } from "@/lib/format";
import { downloadDriveBalanceSheet, downloadDriveProfitAndLoss } from "@/lib/drive-pdf";
import { activeRange } from "@/lib/period";
import {
  GST_REGISTER_TURNOVER,
  businessShare,
  classifyGig,
  defaultRideshare,
  driveReport,
  kilometreClaim,
  kmScheduleFrom,
  platformOf,
  rollingGigIncome,
  type GigKind,
} from "@/lib/rideshare";
import { useFinanceStore } from "@/lib/store";
import type { Transaction, VehicleKind } from "@/lib/types";
import { inRange, todayISO, cn } from "@/lib/utils";

export const Route = createFileRoute("/rideshare")({ component: DrivePage });

function DrivePage() {
  return (
    <PageFrame>
      <DriveDesk />
    </PageFrame>
  );
}

const TABS = [
  { id: "desk", label: "Desk" },
  { id: "ledger", label: "Ledger" },
  { id: "claim", label: "Claim" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function DriveDesk() {
  const txs = useFinanceStore((s) => s.transactions);
  const currency = useFinanceStore((s) => s.settings.currency);
  const settings = useFinanceStore((s) => s.settings.rideshare) ?? defaultRideshare();
  const updateSettings = useFinanceStore((s) => s.updateSettings);
  const period = useFinanceStore((s) => s.period);
  const setPeriod = useFinanceStore((s) => s.setPeriod);
  const cycleMode = useFinanceStore((s) => s.cycleMode);
  const cycleOffset = useFinanceStore((s) => s.cycleOffset);
  const setAddOpen = useFinanceStore((s) => s.setAddOpen);
  const customFrom = useFinanceStore((s) => s.settings.customFrom);
  const customTo = useFinanceStore((s) => s.settings.customTo);
  const [tab, setTab] = useState<Tab>("desk");
  const [withLines, setWithLines] = useState(false);
  const range = activeRange(txs, period, cycleMode, cycleOffset, { from: customFrom, to: customTo });
  const inPeriod = useMemo(() => txs.filter((t) => inRange(t.date, range.from, range.to)), [txs, range.from, range.to]);
  const slice = useMemo(() => inPeriod.filter((t) => classifyGig(t)), [inPeriod]);
  const report = useMemo(() => driveReport(txs, settings, range.from, range.to), [txs, settings, range.from, range.to]);
  const ledgerRows = useMemo(
    () =>
      inPeriod.filter((t) => {
        if (classifyGig(t)) return true;
        if (t.gigScope !== "exclude") return false;
        return classifyGig({ ...t, gigScope: undefined }) != null;
      }),
    [inPeriod],
  );
  const yearIncome = rollingGigIncome(txs, todayISO());
  const name = useFinanceStore((s) => s.settings.displayName);

  function patch(next: Partial<typeof settings>) {
    updateSettings({ rideshare: { ...settings, ...next } });
  }

  async function downloadPl(rows: Transaction[]) {
    await downloadDriveProfitAndLoss({
      name: name.trim() || "Drive",
      period: range.label,
      incomeLines: report.incomeLines,
      expenseLines: report.expenseLines,
      income: report.income,
      fees: report.fees,
      gross: report.gross,
      deduction: report.deduction,
      net: report.net,
      methodNote: report.useKm ? report.schedule.label : "Actual costs",
      transactions: withLines ? rows.map((t) => ({ date: t.date, note: t.note, amount: t.amount, type: t.type })) : undefined,
    });
  }

  async function downloadBs() {
    await downloadDriveBalanceSheet({
      name: name.trim() || "Drive",
      asAt: range.to,
      equity: report.equity,
      methodNote: report.useKm ? report.schedule.label : "Actual costs",
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">{range.label}</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Drive</h1>
        </div>
        <PeriodSelect value={period} onChange={setPeriod} />
      </header>

      <div className="flex w-full rounded-full bg-muted p-1 sm:w-fit">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "h-9 flex-1 rounded-full px-4 text-[13px] font-medium transition-colors sm:flex-none",
              tab === item.id ? "bg-card text-foreground shadow-card" : "text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "desk" ? (
        <Desk
          currency={currency}
          label={range.label}
          report={report}
          yearIncome={yearIncome}
          slice={slice}
          onAdd={() => setAddOpen(true)}
          onProfit={(rows) => void downloadPl(rows)}
          onBalance={() => void downloadBs()}
          withLines={withLines}
          setWithLines={setWithLines}
        />
      ) : null}
      {tab === "ledger" ? <Ledger rows={ledgerRows} currency={currency} onAdd={() => setAddOpen(true)} /> : null}
      {tab === "claim" ? <Claim settings={settings} patch={patch} vehicle={report.vehicle} phone={report.phone} currency={currency} /> : null}
    </div>
  );
}

function Desk({
  currency,
  label,
  report,
  yearIncome,
  slice,
  onAdd,
  onProfit,
  onBalance,
  withLines,
  setWithLines,
}: {
  currency: string;
  label: string;
  report: ReturnType<typeof driveReport>;
  yearIncome: number;
  slice: Transaction[];
  onAdd: () => void;
  onProfit: (rows: Transaction[]) => void;
  onBalance: () => void;
  withLines: boolean;
  setWithLines: (on: boolean) => void;
}) {
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const picked = slice
    .filter((t) => (monthKey ? t.date.startsWith(monthKey) : true))
    .filter((t) => (categoryId ? t.categoryId === categoryId : true))
    .filter(() => Boolean(monthKey || categoryId))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const viewing = monthKey || categoryId ? picked : slice;
  const empty = slice.length === 0;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-5xl tracking-tight tabular-nums">{money(report.net, currency)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{label}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setWithLines(!withLines)}
            className={cn("h-8 rounded-full px-3 text-xs", withLines ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}
          >
            Lines
          </button>
          <Button variant="outline" size="sm" onClick={() => onProfit(viewing)}>
            P&L
          </Button>
          <Button variant="outline" size="sm" onClick={onBalance}>
            Sheet
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5 sm:grid-cols-4">
        <Stat label="Income" value={money(report.income, currency)} />
        <Stat label="Fees" value={money(report.fees, currency)} />
        <Stat label="Vehicle" value={money(report.vehicle, currency)} />
        <Stat label="Phone" value={money(report.phone, currency)} />
      </section>

      {yearIncome >= GST_REGISTER_TURNOVER * 0.8 ? (
        <p className="text-sm text-muted-foreground">GST {money(yearIncome, currency)} / {money(GST_REGISTER_TURNOVER, currency)}</p>
      ) : null}

      {empty ? (
        <div className="py-6">
          <p className="text-sm font-medium">No trips in this period</p>
          <Button className="mt-4" onClick={onAdd}>Add</Button>
        </div>
      ) : (
        <>
          <section className="rounded-2xl bg-card p-4 shadow-card sm:p-6">
            <FlowChart
              txs={slice}
              currency={currency}
              activeMonth={monthKey}
              onMonth={(key) => {
                setMonthKey(key);
                if (key) setCategoryId(null);
              }}
            />
          </section>
          <section className="rounded-2xl bg-card p-4 shadow-card sm:p-6">
            <CategoryDonut
              txs={slice.filter((t) => t.type === "expense")}
              currency={currency}
              showAmounts
              selectedId={categoryId}
              onSelect={(id) => {
                setCategoryId(id);
                if (id) setMonthKey(null);
              }}
            />
          </section>
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-medium">{monthKey || (categoryId ? getCategory(categoryId).name : "This period")}</h2>
              <p className="text-xs tabular-nums text-muted-foreground">{viewing.length}</p>
            </div>
            <ul>
              {viewing.slice(0, 12).map((tx) => (
                <li key={tx.id} className="flex items-baseline justify-between gap-3 border-b border-border/70 py-2.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground">{tx.date.slice(5)}</span> {tx.note || "Untitled"}
                  </span>
                  <span className={cn("shrink-0 tabular-nums", tx.type === "income" && "text-income")}>{money(tx.amount, currency)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="grid gap-6 sm:grid-cols-2">
            <StatementLines title="Income" lines={report.incomeLines} totalLabel="Income" total={report.income} currency={currency} />
            <StatementLines title="Costs" lines={report.expenseLines} totalLabel="Surplus" total={report.net} currency={currency} />
          </section>
        </>
      )}
    </div>
  );
}

function StatementLines({
  title,
  lines,
  totalLabel,
  total,
  currency,
}: {
  title: string;
  lines: { label: string; amount: number; hint?: string }[];
  totalLabel: string;
  total: number;
  currency: string;
}) {
  return (
    <div className="mt-4">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{title}</p>
      <ul>
        {lines.map((line) => (
          <li key={line.label} className="flex items-baseline justify-between gap-3 border-b border-border/70 py-2 text-sm">
            <span>{line.label}</span>
            <span className="tabular-nums">{money(line.amount, currency)}</span>
          </li>
        ))}
        <li className="flex items-baseline justify-between py-2 text-sm font-medium">
          <span>{totalLabel}</span>
          <span className="tabular-nums">{money(total, currency)}</span>
        </li>
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

const KIND_LABEL: Record<GigKind, string> = {
  income: "Income",
  fee: "Platform fee",
  vehicle: "Vehicle",
  phone: "Phone",
};

function Ledger({ rows, currency, onAdd }: { rows: Transaction[]; currency: string; onAdd: () => void }) {
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!sorted.length) {
    return (
      <div className="rounded-[24px] bg-card px-5 py-10 text-center shadow-card">
        <p className="text-sm text-muted-foreground">The ledger fills from Cove. Nothing in this period matches gig work or a claimable cost.</p>
        <Button className="mt-4" onClick={onAdd}>
          Add a row in Cove
        </Button>
      </div>
    );
  }
  return (
    <ul className="overflow-hidden rounded-[24px] bg-card shadow-card">
      {sorted.map((tx) => {
        const shown = tx.gigScope === "exclude" ? { ...tx, gigScope: undefined } : tx;
        const kind = classifyGig(shown);
        return (
          <li key={tx.id} className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{tx.note || "Untitled"}</p>
              <p className="text-[12px] text-muted-foreground">
                {tx.date} · {kind ? KIND_LABEL[kind] : "Hidden"}
                {tx.type === "income" ? ` · ${platformOf(tx)}` : ""}
              </p>
            </div>
            <p className="shrink-0 text-sm tabular-nums">{money(tx.amount, currency)}</p>
            <button
              type="button"
              className="shrink-0 text-[12px] text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => updateTransaction(tx.id, { gigScope: tx.gigScope === "exclude" ? undefined : "exclude" })}
            >
              {tx.gigScope === "exclude" ? "Include" : "Leave out"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Claim({
  settings,
  patch,
  vehicle,
  phone,
  currency,
}: {
  settings: ReturnType<typeof defaultRideshare>;
  patch: (next: Partial<ReturnType<typeof defaultRideshare>>) => void;
  vehicle: number;
  phone: number;
  currency: string;
}) {
  const pct = settings.businessPct;
  const actual = businessShare(vehicle + phone, pct);
  const schedule = kmScheduleFrom(settings);
  const km =
    settings.totalKm != null && pct != null ? kilometreClaim(settings.totalKm, pct, settings.vehicle, schedule) : null;
  return (
    <div className="space-y-4">
      <section className="rounded-[24px] bg-card p-4 shadow-card">
        <h2 className="text-sm font-medium">How you claim the car</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Actual costs or the kilometre rate. Not both.</p>
        <div className="mt-4 flex rounded-full bg-muted p-1">
          {(
            [
              ["actual", "Actual costs"],
              ["kilometre", "Kilometre rate"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => patch({ method: id })}
              className={cn(
                "h-9 flex-1 rounded-full text-[13px] font-medium",
                settings.method === id ? "bg-card shadow-card" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="biz-pct">Business use %</Label>
            <Input
              id="biz-pct"
              inputMode="decimal"
              placeholder="From your logbook"
              value={pct ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                patch({ businessPct: raw === "" ? null : Math.min(100, Math.max(0, Number(raw) || 0)) });
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Vehicle</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["petrol", "diesel", "hybrid", "electric"] as VehicleKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => patch({ vehicle: kind })}
                  className={cn(
                    "h-10 rounded-xl text-[13px] capitalize",
                    settings.vehicle === kind ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                  )}
                >
                  {kind}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {settings.method === "actual" ? (
        <section className="rounded-[24px] bg-card p-4 shadow-card">
          <h2 className="text-sm font-medium">Actual costs this period</h2>
          <p className="mt-2 text-2xl font-medium tabular-nums tracking-tight">
            {actual == null ? "Set a logbook %" : money(actual, currency)}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Vehicle {money(vehicle, currency)} · phone {money(phone, currency)}
          </p>
        </section>
      ) : (
        <section className="rounded-[24px] bg-card p-4 shadow-card">
          <h2 className="text-sm font-medium">Kilometre rate · {schedule.label}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            First {schedule.tierKm.toLocaleString("en-NZ")} km, then the rest. Rates live in Settings.
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            <Label htmlFor="total-km">Total km this tax year</Label>
            <Input
              id="total-km"
              inputMode="decimal"
              placeholder="Business and private"
              value={settings.totalKm ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                patch({ totalKm: raw === "" ? null : Math.max(0, Number(raw) || 0) });
              }}
            />
          </div>
          <p className="mt-3 text-2xl font-medium tabular-nums tracking-tight">{km ? money(km.amount, currency) : "Add km and a logbook %"}</p>
          {km ? (
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {km.tier1Business.toLocaleString("en-NZ", { maximumFractionDigits: 0 })} km at ${km.rate.tier1.toFixed(2)} · {km.tier2Business.toLocaleString("en-NZ", { maximumFractionDigits: 0 })} km at ${km.rate.tier2.toFixed(2)}
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CategoryDonut, FlowChart } from "@/components/charts";
import { PageFrame } from "@/components/page-frame";
import { PeriodSelect } from "@/components/period-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/format";
import { downloadDriveBalanceSheet, downloadDriveProfitAndLoss } from "@/lib/drive-pdf";
import { activeRange } from "@/lib/period";
import {
  IRD_RIDESHARE_URL,
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

  async function downloadPl() {
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
      methodNote: report.useKm
        ? `Deduction uses the kilometre rate (${report.schedule.label}), not the recorded fuel and repairs as well.`
        : "Deduction uses actual recorded vehicle and phone costs. Set a business-use % so private trips are left out.",
    });
  }

  async function downloadBs() {
    await downloadDriveBalanceSheet({
      name: name.trim() || "Drive",
      asAt: range.to,
      equity: report.equity,
      methodNote: report.useKm
        ? `Kilometre claim uses ${report.schedule.label}.`
        : "Actual costs are the business share of vehicle and phone costs recorded in Cove.",
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">Pulled from your Cove ledger</p>
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
          onProfit={() => void downloadPl()}
          onBalance={() => void downloadBs()}
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
}: {
  currency: string;
  label: string;
  report: ReturnType<typeof driveReport>;
  yearIncome: number;
  slice: Transaction[];
  onAdd: () => void;
  onProfit: () => void;
  onBalance: () => void;
}) {
  const empty = slice.length === 0;
  return (
    <div className="space-y-10">
      <section>
        <p className="font-display text-5xl tracking-tight tabular-nums">{money(report.net, currency)}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Surplus · {label.toLowerCase()}
          {report.useKm ? " · kilometre rate" : ""}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5 sm:grid-cols-4">
        <Stat label="Gig income" value={money(report.income, currency)} />
        <Stat label="Fees" value={money(report.fees, currency)} />
        <Stat label="Vehicle" value={money(report.vehicle, currency)} />
        <Stat label="Phone" value={money(report.phone, currency)} />
      </section>

      <section className="rounded-2xl bg-card p-4 shadow-card sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-medium">Profit and loss</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onProfit}>
              P&L PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onBalance}>
              Balance sheet
            </Button>
          </div>
        </div>
        <StatementLines title="Income" lines={report.incomeLines} totalLabel="Total income" total={report.income} currency={currency} />
        <StatementLines title="Deduction" lines={report.expenseLines} totalLabel="Net surplus" total={report.net} currency={currency} />
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          {report.useKm
            ? "The kilometre rate replaces actual fuel and repairs for the same vehicle. The rate is the tax-year figure from Settings, not only this period."
            : "Actual costs use the vehicle and phone rows in this period. Set a logbook % on Claim so private use stays out."}
        </p>
      </section>

      {yearIncome >= GST_REGISTER_TURNOVER * 0.8 ? (
        <p className="text-sm text-muted-foreground">
          Last 12 months of gig income is {money(yearIncome, currency)}. GST registration is compulsory past {money(GST_REGISTER_TURNOVER, currency)}.
        </p>
      ) : null}

      {empty ? (
        <div className="py-6">
          <p className="text-sm font-medium">No driving rows in this period</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Log Uber or Didi pay as Gig work, and fuel, WOF, rego, repairs, parking, tolls or insurance as usual. Fines stay out.
          </p>
          <Button className="mt-4" onClick={onAdd}>
            Add a row
          </Button>
        </div>
      ) : (
        <>
          <section className="rounded-2xl bg-card p-4 shadow-card sm:p-6">
            <h2 className="mb-4 text-sm font-medium">Cash flow</h2>
            <FlowChart txs={slice} currency={currency} />
          </section>
          <section className="rounded-2xl bg-card p-4 shadow-card sm:p-6">
            <h2 className="mb-2 text-sm font-medium">Where costs sit</h2>
            <CategoryDonut txs={slice.filter((t) => t.type === "expense")} currency={currency} />
          </section>
          {report.platforms.length ? (
            <section>
              <h2 className="mb-1 text-sm font-medium">By platform</h2>
              <ul>
                {report.platforms.map((row) => (
                  <li key={row.name} className="flex items-center justify-between border-b border-border py-3 text-sm last:border-0">
                    <span>{row.name}</span>
                    <span className="tabular-nums">{money(row.amount, currency)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
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
            <span>
              {line.label}
              {line.hint ? <span className="mt-0.5 block text-[11px] text-muted-foreground">{line.hint}</span> : null}
            </span>
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
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Inland Revenue lets rideshare drivers use either actual costs or the kilometre rate, not both for the same vehicle. Only the income-earning share is deductible.{" "}
          <a href={IRD_RIDESHARE_URL} className="underline underline-offset-4" target="_blank" rel="noreferrer">
            IRD ride-sharing expenses
          </a>
        </p>
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
            Recorded vehicle {money(vehicle, currency)} and phone {money(phone, currency)}. Fuel, repairs, WOF, registration, insurance, parking, tolls and lease payments can be claimed for the business share. The purchase price of the car cannot. Fines cannot.
          </p>
        </section>
      ) : (
        <section className="rounded-[24px] bg-card p-4 shadow-card">
          <h2 className="text-sm font-medium">Kilometre rate · {schedule.label}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Tier 1 covers the business share of the first {schedule.tierKm.toLocaleString("en-NZ")} km of total travel (private included). Update the year’s rates in Settings.
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
              {km.tier1Business.toLocaleString("en-NZ", { maximumFractionDigits: 0 })} business km at ${km.rate.tier1.toFixed(2)}, then{" "}
              {km.tier2Business.toLocaleString("en-NZ", { maximumFractionDigits: 0 })} km at ${km.rate.tier2.toFixed(2)}. These are the rates saved in Settings for {schedule.label}.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
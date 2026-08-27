import { useMemo, useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getCategory } from "@/lib/categories";
import { formatMonthShort, money } from "@/lib/format";
import { monthlySeries } from "@/lib/period";
import type { Transaction } from "@/lib/types";

const CHART = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

function ChartTip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md bg-popover px-3 py-2 text-[12px] shadow-card">
      {label ? <p className="mb-1 font-medium">{label}</p> : null}
      {payload.map((p) => (
        <p key={p.name} className="tabular-nums text-muted-foreground">
          {p.name} · {money(p.value, currency)}
        </p>
      ))}
    </div>
  );
}

export function FlowChart({ txs, currency }: { txs: Transaction[]; currency: string }) {
  const mounted = useMounted();
  const data = useMemo(
    () =>
      monthlySeries(txs, 6).map((r) => ({
        ...r,
        label: formatMonthShort(r.key),
      })),
    [txs],
  );
  if (!mounted) return <div className="h-[220px] rounded-lg bg-muted/50" />;
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="inFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-income)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-income)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="outFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-expense)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-expense)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <Tooltip content={<ChartTip currency={currency} />} />
          <Area type="monotone" dataKey="income" name="Income" stroke="var(--color-income)" fill="url(#inFill)" strokeWidth={1.75} />
          <Area type="monotone" dataKey="expense" name="Spending" stroke="var(--color-expense)" fill="url(#outFill)" strokeWidth={1.75} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryDonut({
  txs,
  currency,
  kind = "expense",
  showAmounts = false,
  selectedId = null,
  onSelect,
  includeAllocations = false,
}: {
  txs: Transaction[];
  currency: string;
  kind?: "expense" | "income";
  showAmounts?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  includeAllocations?: boolean;
}) {
  const mounted = useMounted();
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txs.filter((t) => {
      if (t.type !== kind) return false;
      if (t.categoryId === "transfer-out" || t.categoryId === "transfer-in" || t.categoryId === "reversal") return false;
      if (kind === "expense" && !includeAllocations && (t.categoryId === "investing" || t.categoryId === "savings")) {
        return false;
      }
      return true;
    })) {
      const id = t.categoryId === "credit-card" ? "debt" : t.categoryId;
      map.set(id, (map.get(id) ?? 0) + t.amount);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, value]) => ({
        id,
        name: id === "debt" ? "Debt" : getCategory(id).name,
        value,
      }));
  }, [txs, kind, includeAllocations]);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!mounted) return <div className="h-[220px] rounded-lg bg-muted/50" />;
  if (!data.length) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        {kind === "income" ? "No income in this period" : "No spending in this period"}
      </p>
    );
  }
  return (
    <div className="grid h-[220px] grid-cols-[140px_1fr] items-center gap-2">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={42}
            outerRadius={62}
            paddingAngle={2}
            stroke="none"
            cursor={onSelect ? "pointer" : undefined}
            onClick={(_, index) => {
              if (!onSelect || index == null || index < 0) return;
              const row = data[index];
              if (!row) return;
              onSelect(selectedId === row.id ? null : row.id);
            }}
          >
            {data.map((d, i) => (
              <Cell
                key={d.id}
                fill={CHART[i % CHART.length]}
                opacity={selectedId && selectedId !== d.id ? 0.35 : 1}
                stroke={selectedId === d.id ? "var(--color-foreground)" : "none"}
                strokeWidth={selectedId === d.id ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTip currency={currency} />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-1.5 pr-2">
        {data.map((d, i) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onSelect?.(selectedId === d.id ? null : d.id)}
              className="flex w-full items-center justify-between gap-2 text-left text-[12px] transition-opacity hover:opacity-100"
              style={{ opacity: selectedId && selectedId !== d.id ? 0.45 : 1 }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: CHART[i % CHART.length] }} />
                <span className="truncate">{d.name}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {showAmounts ? money(d.value, currency, true) : `${Math.round((d.value / total) * 100)}%`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BudgetBars({
  rows,
  currency,
}: {
  rows: { name: string; spent: number; budget: number }[];
  currency: string;
}) {
  const mounted = useMounted();
  if (!mounted) return <div className="h-[240px] rounded-lg bg-muted/50" />;
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">Set a budget to see this.</p>;
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={88} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTip currency={currency} />} />
          <Bar dataKey="budget" name="Budget" fill="var(--color-muted)" radius={[0, 4, 4, 0]} barSize={8} />
          <Bar dataKey="spent" name="Spent" fill="var(--color-chart-3)" radius={[0, 4, 4, 0]} barSize={8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

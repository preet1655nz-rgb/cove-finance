import type { Period } from "@/lib/types";
import { useFinanceStore } from "@/lib/store";
import { todayISO } from "@/lib/utils";

const OPTIONS: { id: Period; label: string }[] = [
  { id: "this-week", label: "Week" },
  { id: "fortnight", label: "Fortnight" },
  { id: "this-month", label: "Month" },
  { id: "last-month", label: "Last month" },
  { id: "quarter", label: "3 months" },
  { id: "year", label: "Year" },
  { id: "all", label: "All" },
  { id: "custom", label: "Custom" },
];

export function PeriodSelect({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  const settings = useFinanceStore((s) => s.settings);
  const updateSettings = useFinanceStore((s) => s.updateSettings);
  const from = settings.customFrom || todayISO().slice(0, 8) + "01";
  const to = settings.customTo || todayISO();

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Period)}
        className="h-10 rounded-full bg-card px-3 text-sm shadow-card"
        aria-label="Period"
      >
        {OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {value === "custom" ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => updateSettings({ customFrom: e.target.value })}
            className="h-10 rounded-full bg-card px-3 text-sm shadow-card"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => updateSettings({ customTo: e.target.value })}
            className="h-10 rounded-full bg-card px-3 text-sm shadow-card"
          />
        </div>
      ) : null}
    </div>
  );
}

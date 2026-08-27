import type { Period } from "@/lib/types";
import { useFinanceStore } from "@/lib/store";
import { todayISO } from "@/lib/utils";
import { cn } from "@/lib/utils";

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
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              "h-9 shrink-0 rounded-md px-3 text-[13px] font-medium transition-colors duration-150",
              value === o.id ? "bg-card text-foreground shadow-card" : "text-muted-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {value === "custom" ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => updateSettings({ customFrom: e.target.value })}
            className="h-9 rounded-md bg-card px-2 text-[13px] shadow-card"
          />
          <span className="text-[12px] text-muted-foreground">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => updateSettings({ customTo: e.target.value })}
            className="h-9 rounded-md bg-card px-2 text-[13px] shadow-card"
          />
        </div>
      ) : null}
    </div>
  );
}

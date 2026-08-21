import type { Period } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS: { id: Period; label: string }[] = [
  { id: "this-week", label: "Week" },
  { id: "fortnight", label: "Fortnight" },
  { id: "this-month", label: "Month" },
  { id: "last-month", label: "Last month" },
  { id: "quarter", label: "3 months" },
  { id: "year", label: "Year" },
  { id: "all", label: "All" },
];

export function PeriodSelect({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
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
  );
}

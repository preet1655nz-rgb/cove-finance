import { getCategory } from "@/lib/categories";
import { formatDay, money } from "@/lib/format";
import { useFinanceStore } from "@/lib/store";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TransactionRow({ tx }: { tx: Transaction }) {
  const currency = useFinanceStore((s) => s.settings.currency);
  const startEdit = useFinanceStore((s) => s.startEdit);
  const cat = getCategory(tx.categoryId);
  const Icon = cat.icon;
  const income = tx.type === "income";

  return (
    <button
      type="button"
      onClick={() => startEdit(tx)}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors duration-150 hover:bg-muted/60"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{tx.note || cat.name}</span>
        <span className="block text-[12px] text-muted-foreground">
          {cat.name} · {formatDay(tx.date)}
        </span>
      </span>
      <span
        className={cn(
          "font-medium tabular-nums",
          income ? "text-income" : "text-foreground",
        )}
      >
        {income ? "+" : "−"}
        {money(tx.amount, currency)}
      </span>
    </button>
  );
}

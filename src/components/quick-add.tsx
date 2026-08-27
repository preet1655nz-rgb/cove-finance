import { categoriesFor } from "@/lib/categories";
import { useFinanceStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export function QuickAdd() {
  const open = useFinanceStore((s) => s.addOpen);
  const setOpen = useFinanceStore((s) => s.setAddOpen);
  const setImportOpen = useFinanceStore((s) => s.setImportOpen);
  const draft = useFinanceStore((s) => s.draft);
  const updateDraft = useFinanceStore((s) => s.updateDraft);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const removeTransaction = useFinanceStore((s) => s.removeTransaction);
  const editingId = useFinanceStore((s) => s.editingId);
  const currency = useFinanceStore((s) => s.settings.currency);
  const cats = categoriesFor(draft.type);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = addTransaction();
    if (!ok) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    toast.success(editingId ? "Updated" : "Saved");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-4 overflow-hidden sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit entry" : "New entry"}</DialogTitle>
          <DialogDescription>
            {editingId ? "Change the amount, category, date or note." : "Amount first. Category next."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["expense", "income"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() =>
                  updateDraft({
                    type,
                    categoryId: type === "income" ? "salary" : "groceries",
                  })
                }
                className={cn(
                  "h-10 rounded-md text-sm font-medium capitalize transition-colors duration-150",
                  draft.type === type ? "bg-card text-foreground shadow-card" : "text-muted-foreground",
                )}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center">
            <Label className="mb-1">{currency}</Label>
            <input
              autoFocus
              inputMode="decimal"
              value={draft.amount}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => updateDraft({ amount: e.target.value.replace(/[^0-9.]/g, "") })}
              placeholder="0"
              className="w-full bg-transparent text-center font-display text-5xl tracking-tight outline-none placeholder:text-muted-foreground/40"
              aria-label="Amount"
            />
          </div>

          <div className="max-h-40 overflow-y-auto">
            <div className="grid grid-cols-4 gap-1.5">
              {cats.map((c) => {
                const Icon = c.icon;
                const on = draft.categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => updateDraft({ categoryId: c.id })}
                    className={cn(
                      "flex h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] leading-tight transition-colors duration-150",
                      on ? "bg-primary text-primary-foreground" : "bg-muted/70 text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="size-3.5" strokeWidth={1.75} />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={draft.date}
                onChange={(e) => updateDraft({ date: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">Note</Label>
              <Input
                id="note"
                placeholder="Optional"
                value={draft.note}
                onChange={(e) => updateDraft({ note: e.target.value })}
              />
            </div>
          </div>

          {!editingId ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setImportOpen(true);
              }}
              className="flex h-10 items-center justify-center gap-2 rounded-md bg-muted text-sm text-foreground hover:bg-muted/80"
            >
              <Upload className="size-4" />
              Upload bank statement
            </button>
          ) : null}

          <div className="flex gap-2">
            {editingId ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  removeTransaction(editingId);
                  toast.success("Removed");
                }}
              >
                Delete
              </Button>
            ) : null}
            <Button type="submit" className="ml-auto min-w-32">
              {editingId ? "Save" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

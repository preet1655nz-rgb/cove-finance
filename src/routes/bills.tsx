import { createFileRoute } from "@tanstack/react-router";
import { Bell, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { PageFrame } from "@/components/page-frame";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { allCategories, getCategory } from "@/lib/categories";
import { formatDayLong, money } from "@/lib/format";
import { daysUntil, nextBillDate } from "@/lib/notify";
import { useFinanceStore } from "@/lib/store";
import type { RecurringBill } from "@/lib/types";
import { isoDate, todayISO } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/bills")({ component: BillsPage });

function emptyForm() {
  return { name: "", amount: "", dueDate: todayISO(), repeat: "monthly" as "weekly" | "fortnightly" | "monthly" | "once", categoryId: "utilities" };
}

function BillsPage() {
  return (
    <PageFrame>
      <Bills />
    </PageFrame>
  );
}

function Bills() {
  const bills = useFinanceStore((s) => s.bills);
  const upsertBill = useFinanceStore((s) => s.upsertBill);
  const removeBill = useFinanceStore((s) => s.removeBill);
  const currency = useFinanceStore((s) => s.settings.currency);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const rows = useMemo(() => {
    return bills
      .map((bill) => {
        const due = nextBillDate(bill);
        const days = daysUntil(due);
        return { bill, due: isoDate(due), days };
      })
      .sort((a, b) => a.due.localeCompare(b.due) || a.bill.name.localeCompare(b.bill.name));
  }, [bills]);

  const dueSoon = rows.filter((r) => r.bill.enabled && r.days <= 3);

  function startNew() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function startEdit(bill: RecurringBill) {
    const due = isoDate(nextBillDate(bill));
    setEditing(bill.id);
    setForm({
      name: bill.name,
      amount: String(bill.amount),
      dueDate: bill.dueDate || due,
      repeat: bill.repeat ?? "monthly",
      categoryId: bill.categoryId,
    });
    setOpen(true);
  }

  function save() {
    const amount = Number(form.amount);
    if (!form.name.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Name and amount are required");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) {
      toast.error("Pick a due date");
      return;
    }
    const dayOfMonth = Math.min(28, Math.max(1, Number(form.dueDate.slice(8, 10)) || 1));
    upsertBill({
      id: editing ?? undefined,
      name: form.name.trim(),
      amount: Math.round(amount * 100) / 100,
      categoryId: form.categoryId,
      dayOfMonth,
      dueDate: form.dueDate,
      repeat: form.repeat,
      enabled: true,
    });
    setOpen(false);
    setForm(emptyForm());
    toast.success(editing ? "Bill updated" : "Bill saved. Cove will remind you for three days before it is due.");
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">Due dates you enter. Reminders for the three days before.</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Bills</h1>
        </div>
        <Button onClick={startNew}>
          <Plus className="size-4" />
          Add bill
        </Button>
      </header>

      {dueSoon.length ? (
        <section className="rounded-xl bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="size-4" />
            <h2 className="text-sm font-medium">Due in the next 3 days</h2>
          </div>
          <ul className="divide-y divide-border/70">
            {dueSoon.map(({ bill, due, days }) => (
              <li key={bill.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{bill.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {days < 0 ? "Overdue" : days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`} ·{" "}
                    {formatDayLong(due)}
                  </p>
                </div>
                <p className="font-medium tabular-nums">{money(bill.amount, currency)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-xl bg-card px-5 py-12 text-center text-sm text-muted-foreground shadow-card">
            Add rent, power, fibre — anything with a due date. Cove will ping you each of the three days before.
          </p>
        ) : (
          rows.map(({ bill, due, days }) => {
            const cat = getCategory(bill.categoryId);
            return (
              <article key={bill.id} className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card sm:flex-row sm:items-center">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => startEdit(bill)}>
                  <p className="text-sm font-medium">{bill.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {cat.name} · {bill.repeat === "once" ? "Once" : bill.repeat === "weekly" ? "Weekly" : bill.repeat === "fortnightly" ? "Fortnightly" : "Monthly"} · {formatDayLong(due)}
                    {days <= 3 && bill.enabled ? ` · ${days < 0 ? "overdue" : days === 0 ? "today" : `${days}d`}` : ""}
                  </p>
                </button>
                <p className="text-sm font-medium tabular-nums">{money(bill.amount, currency)}</p>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={bill.enabled}
                    onCheckedChange={(enabled) => upsertBill({ ...bill, enabled })}
                    aria-label={`Reminders for ${bill.name}`}
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeBill(bill.id)}>
                    Remove
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit bill" : "New bill"}</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bill-name">Name</Label>
              <Input id="bill-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rent, fibre, power" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bill-amount">Amount</Label>
                <Input id="bill-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bill-due">Due date</Label>
                <Input id="bill-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Repeats</Label>
              <Select value={form.repeat} onValueChange={(repeat) => setForm({ ...form, repeat: repeat as typeof form.repeat })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="once">Once</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={(categoryId) => setForm({ ...form, categoryId })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allCategories().filter((c) => c.type === "expense" && c.id !== "transfer-out").map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Save bill</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

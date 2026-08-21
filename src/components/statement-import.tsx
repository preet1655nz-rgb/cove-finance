import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { money } from "@/lib/format";
import {
  SAMPLE_STATEMENT,
  applyDuplicates,
  categoriesForSelect,
  parseBankStatement,
  readStatementFile,
  type StatementDraft,
} from "@/lib/statement";
import { useFinanceStore } from "@/lib/store";
import type { TxType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatementImport() {
  const open = useFinanceStore((s) => s.importOpen);
  const setOpen = useFinanceStore((s) => s.setImportOpen);
  const importTransactions = useFinanceStore((s) => s.importTransactions);
  const currency = useFinanceStore((s) => s.settings.currency);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<StatementDraft[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [drag, setDrag] = useState(false);

  function reset() {
    setRows([]);
    setError(null);
    setWarnings([]);
    setSkipped(0);
    setBusy(false);
  }

  function applyParse(result: ReturnType<typeof parseBankStatement>) {
    if (!result.ok) {
      setRows([]);
      setError(result.error ?? "Could not read that statement.");
      setWarnings([]);
      setSkipped(0);
      return;
    }
    setError(null);
    setWarnings(result.warnings);
    setSkipped(result.skipped);
    setRows(applyDuplicates(result.rows, useFinanceStore.getState().transactions));
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await readStatementFile(file);
      applyParse(result);
    } catch (err) {
      console.error(err);
      setRows([]);
      setError("That PDF or statement could not be read. Try a CSV export if this keeps happening.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onSample() {
    applyParse(parseBankStatement(SAMPLE_STATEMENT, "sample-statement.csv"));
  }

  async function onAnzSample() {
    setBusy(true);
    try {
      const res = await fetch("/sample-anz-go.csv");
      if (!res.ok) throw new Error("missing");
      const text = await res.text();
      applyParse(parseBankStatement(text, "anz-go.csv"));
    } catch {
      setError("Could not load the ANZ Go sample.");
    } finally {
      setBusy(false);
    }
  }

  async function onAnzPdfSample() {
    setBusy(true);
    try {
      const res = await fetch("/sample-anz-go.pdf");
      if (!res.ok) throw new Error("missing");
      const blob = await res.blob();
      const file = new File([blob], "anz-go.pdf", { type: "application/pdf" });
      const result = await readStatementFile(file);
      applyParse(result);
    } catch {
      setError("Could not load the ANZ Go PDF sample.");
    } finally {
      setBusy(false);
    }
  }

  function patch(key: string, next: Partial<StatementDraft>) {
    setRows((list) =>
      list.map((r) => {
        if (r.key !== key) return r;
        const merged = { ...r, ...next };
        if (next.type && next.type !== r.type) {
          const cats = categoriesForSelect(next.type);
          if (!cats.some((c) => c.id === merged.categoryId)) {
            merged.categoryId = cats[0]?.id ?? merged.categoryId;
          }
        }
        return merged;
      }),
    );
  }

  const included = rows.filter((r) => r.included);
  const incomeN = included.filter((r) => r.type === "income").length;
  const expenseN = included.filter((r) => r.type === "expense").length;
  const dupN = rows.filter((r) => r.duplicate).length;

  function confirm() {
    const result = importTransactions(
      included.map((r) => ({
        date: r.date,
        amount: r.amount,
        type: r.type,
        note: r.note,
        categoryId: r.categoryId,
      })),
    );
    if (result.added) toast.success(`Imported ${result.added} ${result.added === 1 ? "entry" : "entries"}`);
    else toast.error("Nothing new to import");
    if (result.skipped) toast.message(`${result.skipped} skipped as duplicates or invalid`);
    const latest = included.reduce((m, r) => (r.date > m ? r.date : m), included[0]?.date ?? "");
    if (latest) {
      void navigate({ to: "/calendar", search: { month: latest.slice(0, 7) } });
    }
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-3xl flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Upload statement</DialogTitle>
          <DialogDescription>
            PDF, CSV, OFX or QIF from your bank. Cove reads withdrawals and deposits, then marks each row as income or expense.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.ofx,.qfx,.qif,.txt,.pdf,text/csv,application/pdf,application/ofx,text/plain"
          className="sr-only"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />

        {rows.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <button
              type="button"
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                void onFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl px-6 text-center shadow-card transition-colors duration-150",
                drag ? "bg-muted" : "bg-muted/50 hover:bg-muted",
              )}
            >
              <Upload className="size-5 text-muted-foreground" strokeWidth={1.75} />
              <p className="text-sm font-medium">{busy ? "Reading…" : "Drop a statement here"}</p>
              <p className="text-[12px] text-muted-foreground">PDF or CSV — or click to choose a file</p>
            </button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onSample}>
                Try a sample
              </Button>
              <Button variant="outline" onClick={() => void onAnzSample()}>
                Try ANZ Go
              </Button>
              <Button variant="outline" onClick={() => void onAnzPdfSample()}>
                Try ANZ PDF
              </Button>
              <a
                href="/sample-anz-go.csv"
                download
                className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm text-muted-foreground hover:text-foreground"
              >
                Download CSV
              </a>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {included.length} to import · {incomeN} in · {expenseN} out
              {dupN ? ` · ${dupN} already in Cove` : ""}
              {skipped ? ` · ${skipped} skipped` : ""}
            </p>
            {warnings.map((w) => (
              <p key={w} className="text-[12px] text-muted-foreground">
                {w}
              </p>
            ))}
            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-muted/40 p-1">
              <ul className="divide-y divide-border/70">
                {rows.map((row) => (
                  <li key={row.key} className={cn("flex flex-col gap-2 px-3 py-3 lg:flex-row lg:items-center", !row.included && "opacity-50")}>
                    <label className="flex items-start gap-3 lg:w-8 lg:shrink-0">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-primary"
                        checked={row.included}
                        onChange={(e) => patch(row.key, { included: e.target.checked })}
                        aria-label={`Include ${row.note || row.date}`}
                      />
                      <span className="text-[12px] text-muted-foreground lg:hidden">{row.date}</span>
                    </label>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.note || "Untitled"}</p>
                      <p className="hidden text-[12px] text-muted-foreground lg:block">
                        {row.date}
                        {row.duplicate ? " · already in Cove" : ""}
                      </p>
                      <p className="text-[12px] text-muted-foreground lg:hidden">
                        {row.duplicate ? "already in Cove" : ""}
                      </p>
                    </div>
                    <div className="flex flex-nowrap items-center gap-2">
                      <TypeToggle value={row.type} onChange={(type) => patch(row.key, { type })} />
                      <select
                        value={row.categoryId}
                        onChange={(e) => patch(row.key, { categoryId: e.target.value })}
                        className="h-9 min-w-0 max-w-36 flex-1 rounded-md bg-card px-2 text-[13px] shadow-card lg:flex-none"
                      >
                        {categoriesForSelect(row.type).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <span
                        className={cn(
                          "shrink-0 text-right text-sm font-medium tabular-nums",
                          row.type === "income" ? "text-income" : "text-foreground",
                        )}
                      >
                        {row.type === "income" ? "+" : "−"}
                        {money(row.amount, currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={reset}>
                Choose another
              </Button>
              <Button className="ml-auto" onClick={confirm} disabled={!included.length}>
                Import {included.length || ""}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TypeToggle({ value, onChange }: { value: TxType; onChange: (t: TxType) => void }) {
  return (
    <div className="flex shrink-0 flex-nowrap rounded-md bg-muted p-0.5">
      {(["expense", "income"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          aria-pressed={value === t}
          className={cn(
            "h-8 rounded-sm px-2.5 text-[12px] font-medium",
            value === t ? "bg-card shadow-card" : "text-muted-foreground",
          )}
        >
          {t === "income" ? "In" : "Out"}
        </button>
      ))}
    </div>
  );
}

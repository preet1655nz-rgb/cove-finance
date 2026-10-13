import { CURRENCIES, type KmRates, type VehicleKind } from "@/lib/types";
import { defaultKmRates, defaultRideshare } from "@/lib/rideshare";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useState } from "react";
import { useAccountSession } from "@/lib/account-session";
import { signOutAccount } from "@/lib/account-vault";

export function SettingsDialog() {
  const open = useFinanceStore((s) => s.settingsOpen);
  const setOpen = useFinanceStore((s) => s.setSettingsOpen);
  const settings = useFinanceStore((s) => s.settings);
  const updateSettings = useFinanceStore((s) => s.updateSettings);
  const importData = useFinanceStore((s) => s.importData);
  const setImportOpen = useFinanceStore((s) => s.setImportOpen);
  const transactions = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const bills = useFinanceStore((s) => s.bills);
  const { session } = useAccountSession();
  const clearAll = useFinanceStore((s) => s.clearAll);
  const [wipeArmed, setWipeArmed] = useState(false);

  async function enableBrowser() {
    if (!("Notification" in window)) {
      toast.error("This browser does not support notifications");
      return;
    }
    const perm = await Notification.requestPermission();
    updateSettings({ browserNotifications: perm === "granted" });
    if (perm === "granted") toast.success("Browser notices on");
    else toast.error("Permission declined");
  }

  function exportJson() {
    const snapshot = { transactions, budgets, bills, settings };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cove-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const ok = importData(JSON.parse(String(reader.result)));
        if (ok) toast.success("Imported");
        else toast.error("Could not read that file");
      } catch {
        toast.error("Could not read that file");
      }
    };
    reader.readAsText(file);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>This login keeps its books in Cove. App updates never delete the account or its data.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {session ? (
            <div className="rounded-lg bg-muted/60 px-3 py-3">
              <p className="text-sm font-medium">{session.name}</p>
              <p className="text-[12px] text-muted-foreground">{session.email}{session.gmail ? " · Gmail" : ""}</p>
              <button
                type="button"
                className="mt-2 text-[12px] text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  signOutAccount();
                  window.location.href = "/login";
                }}
              >
                Sign out
              </button>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={settings.displayName} onChange={(e) => updateSettings({ displayName: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Currency</Label>
            <Select value={settings.currency} onValueChange={(currency) => updateSettings({ currency })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} · {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/60 px-3 py-3">
            <div>
              <p className="text-sm font-medium">Night</p>
              <p className="text-[12px] text-muted-foreground">Dark, quiet, closer to an iPhone lock screen</p>
            </div>
            <Switch
              checked={(settings.appearance ?? "light") === "dark"}
              onCheckedChange={(on) => updateSettings({ appearance: on ? "dark" : "light" })}
            />
          </div>
          <KmRateFields />
          <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/60 px-3 py-3">
            <div>
              <p className="text-sm font-medium">Browser notices</p>
              <p className="text-[12px] text-muted-foreground">Budget and bill alerts on this device</p>
            </div>
            <Switch
              checked={settings.browserNotifications}
              onCheckedChange={(on) => {
                if (on) void enableBrowser();
                else updateSettings({ browserNotifications: false });
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={exportJson}>
              Export JSON
            </Button>
            <label className="inline-flex">
              <input type="file" accept="application/json" className="sr-only" onChange={(e) => onImport(e.target.files?.[0])} />
              <span className="inline-flex h-11 w-full items-center justify-center rounded-md bg-card text-sm font-medium shadow-card">
                Import JSON
              </span>
            </label>
          </div>
          <Button variant="outline" onClick={() => { setOpen(false); setImportOpen(true); }}>
            Upload bank statement
          </Button>
          <div className="rounded-lg border border-destructive/30 px-3 py-3">
            <p className="text-sm font-medium">Erase all data</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Deletes every transaction, bill, budget, account, and remembered shop. Your login stays. This cannot be undone.
            </p>
            <Button
              variant="destructive"
              className="mt-3"
              onClick={() => {
                if (!wipeArmed) {
                  setWipeArmed(true);
                  return;
                }
                clearAll();
                setWipeArmed(false);
                toast.success("Books cleared");
              }}
            >
              {wipeArmed ? "Tap again to erase everything" : "Erase all data"}
            </Button>
            {wipeArmed ? (
              <button type="button" className="mt-2 block text-[12px] text-muted-foreground underline-offset-4 hover:underline" onClick={() => setWipeArmed(false)}>
                Cancel
              </button>
            ) : null}
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Sign-out only leaves this device. The Gmail account and every transaction, budget and bill stay in Cove.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const VEHICLES: VehicleKind[] = ["petrol", "diesel", "hybrid", "electric"];

function KmRateFields() {
  const settings = useFinanceStore((s) => s.settings);
  const updateSettings = useFinanceStore((s) => s.updateSettings);
  const ride = settings.rideshare ?? defaultRideshare();
  const rates = ride.kmRates ?? defaultKmRates();

  function save(next: KmRates) {
    updateSettings({ rideshare: { ...ride, kmRates: next } });
  }

  return (
    <div className="rounded-lg bg-muted/60 px-3 py-3">
      <p className="text-sm font-medium">Kilometre rates</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        Inland Revenue rates for the current tax year. Drive uses these when the claim method is the kilometre rate.
      </p>
      <div className="mt-3 flex flex-col gap-1.5">
        <Label htmlFor="km-year">Year label</Label>
        <Input id="km-year" value={rates.label} onChange={(e) => save({ ...rates, label: e.target.value })} />
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <Label htmlFor="km-tier">Tier 1 kilometres</Label>
        <Input
          id="km-tier"
          inputMode="decimal"
          value={String(rates.tierKm)}
          onChange={(e) => save({ ...rates, tierKm: Math.max(0, Number(e.target.value) || 0) })}
        />
      </div>
      <div className="mt-3 grid grid-cols-[1fr_5rem_5rem] gap-2 text-[11px] text-muted-foreground">
        <span>Vehicle</span>
        <span>Tier 1</span>
        <span>Tier 2</span>
      </div>
      {VEHICLES.map((kind) => (
        <div key={kind} className="mt-2 grid grid-cols-[1fr_5rem_5rem] items-center gap-2">
          <span className="text-sm capitalize">{kind}</span>
          <Input
            inputMode="decimal"
            aria-label={`${kind} tier 1`}
            value={String(rates[kind].tier1)}
            onChange={(e) => save({ ...rates, [kind]: { ...rates[kind], tier1: Math.max(0, Number(e.target.value) || 0) } })}
          />
          <Input
            inputMode="decimal"
            aria-label={`${kind} tier 2`}
            value={String(rates[kind].tier2)}
            onChange={(e) => save({ ...rates, [kind]: { ...rates[kind], tier2: Math.max(0, Number(e.target.value) || 0) } })}
          />
        </div>
      ))}
    </div>
  );
}

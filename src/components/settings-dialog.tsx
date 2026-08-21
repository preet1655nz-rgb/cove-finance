import { CURRENCIES } from "@/lib/types";
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

export function SettingsDialog() {
  const open = useFinanceStore((s) => s.settingsOpen);
  const setOpen = useFinanceStore((s) => s.setSettingsOpen);
  const settings = useFinanceStore((s) => s.settings);
  const updateSettings = useFinanceStore((s) => s.updateSettings);
  const resetSample = useFinanceStore((s) => s.resetSample);
  const clearAll = useFinanceStore((s) => s.clearAll);
  const importData = useFinanceStore((s) => s.importData);
  const setImportOpen = useFinanceStore((s) => s.setImportOpen);
  const transactions = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const bills = useFinanceStore((s) => s.bills);

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
          <DialogDescription>Everything stays on this device.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={settings.displayName}
              onChange={(e) => updateSettings({ displayName: e.target.value })}
            />
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
              <input
                type="file"
                accept="application/json"
                className="sr-only"
                onChange={(e) => onImport(e.target.files?.[0])}
              />
              <span className="inline-flex h-11 w-full items-center justify-center rounded-md bg-card text-sm font-medium shadow-card">
                Import JSON
              </span>
            </label>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              setImportOpen(true);
            }}
          >
            Upload bank statement
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { resetSample(); toast.success("Sample data restored"); }}>
              Restore sample
            </Button>
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                clearAll();
                toast.success("Cleared");
              }}
            >
              Clear all
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

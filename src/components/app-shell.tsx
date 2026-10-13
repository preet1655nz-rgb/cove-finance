import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, CalendarDays, Car, FileText, LayoutGrid, ListChecks, Moon, MoreHorizontal, PieChart, Plus, Receipt, Settings, Sun, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { NotificationCenter } from "@/components/notification-center";
import { ProfileGate } from "@/components/profile-gate";
import { QuickAdd } from "@/components/quick-add";
import { SettingsDialog } from "@/components/settings-dialog";
import { StatementImport } from "@/components/statement-import";
import { Button } from "@/components/ui/button";
import { useAccountSession } from "@/lib/account-session";
import { signOutAccount } from "@/lib/account-vault";
import { startCloudSync } from "@/lib/cloud-sync";
import { attachLedgerForUser } from "@/lib/ledger-session";
import { clearProfileGate, useProfile } from "@/lib/profile";
import { useFinanceStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { to: "/", label: "Home", icon: LayoutGrid },
  { to: "/activity", label: "Activity", icon: Receipt },
  { to: "/bills", label: "Bills", icon: Bell },
  { to: "/insights", label: "Insights", icon: PieChart },
] as const;

const MORE = [
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/reconcile", label: "Reconcile", icon: ListChecks },
  { to: "/budgets", label: "Budgets", icon: Wallet },
  { to: "/reports", label: "Reports", icon: FileText },
] as const;

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const unread = useFinanceStore((s) => s.notices.filter((n) => !n.read).length);
  const setAddOpen = useFinanceStore((s) => s.setAddOpen);
  const setImportOpen = useFinanceStore((s) => s.setImportOpen);
  const setSettingsOpen = useFinanceStore((s) => s.setSettingsOpen);
  const cycleMode = useFinanceStore((s) => s.cycleMode);
  const setCycleMode = useFinanceStore((s) => s.setCycleMode);
  const { session } = useAccountSession();
  const profile = useProfile((s) => s.profile);
  const gate = useProfile((s) => s.gate);
  const hydrate = useProfile((s) => s.hydrate);
  const reopen = useProfile((s) => s.reopen);
  const [more, setMore] = useState(false);
  const drive = profile === "rideshare";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (gate || !drive || pathname !== "/") return;
    void navigate({ to: "/rideshare" });
  }, [drive, gate, pathname, navigate]);

  useEffect(() => {
    setMore(false);
  }, [pathname]);

  useEffect(() => {
    if (!session?.email) return;
    return startCloudSync(session.email);
  }, [session?.email]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setAddOpen(true);
      }
      if (e.key === "Escape") setMore(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setAddOpen]);

  useEffect(() => {
    function ping() {
      useFinanceStore.getState().refreshNotices();
    }
    function onVis() {
      if (document.visibilityState === "visible") ping();
    }
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(ping, 60 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, []);

  const moreOpen = more || MORE.some((item) => isActive(pathname, item.to));

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background" data-profile={drive ? "rideshare" : "cove"}>
      <header className="sticky top-0 z-30 border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
          <button type="button" onClick={reopen} className="flex shrink-0 items-center gap-2" aria-label="Switch profile">
            <CoveMark />
            <span className="font-display text-lg tracking-tight">{drive ? "Drive" : "Cove"}</span>
          </button>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {(drive ? [{ to: "/rideshare", label: "Desk", icon: Car }] : PRIMARY).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm transition-colors duration-150",
                  isActive(pathname, item.to) ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setMore((v) => !v)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition-colors duration-150",
                more || (!drive && moreOpen) ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              More
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="mr-1 hidden rounded-full bg-muted p-0.5 sm:flex">
              <button
                type="button"
                onClick={() => setCycleMode(false)}
                className={cn(
                  "h-7 rounded-full px-2.5 text-xs",
                  !cycleMode ? "bg-card text-foreground shadow-card" : "text-muted-foreground",
                )}
              >
                Dates
              </button>
              <button
                type="button"
                onClick={() => setCycleMode(true)}
                className={cn(
                  "h-7 rounded-full px-2.5 text-xs",
                  cycleMode ? "bg-card text-foreground shadow-card" : "text-muted-foreground",
                )}
              >
                Cycle
              </button>
            </div>
            <ThemeButton />
            <NotificationCenter />
            <Button size="sm" className="h-8 rounded-full px-3" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          </div>
        </div>
      </header>

      {more ? (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-foreground/20" aria-label="Close menu" onClick={() => setMore(false)} />
          <div className="fixed top-16 left-1/2 z-50 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl bg-card p-2 shadow-card">
            {!drive ? (
              <div className="grid grid-cols-2 gap-1">
                {MORE.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "flex h-11 items-center gap-2 rounded-xl px-3 text-sm",
                        isActive(pathname, item.to) ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
            <div className="mt-1 grid grid-cols-2 gap-1 border-t border-border pt-1">
              <button type="button" className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => { setMore(false); setImportOpen(true); }}>
                <Receipt className="size-4" /> Statement
              </button>
              <button type="button" className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => { setMore(false); setSettingsOpen(true); }}>
                <Settings className="size-4" /> Settings
              </button>
              <Link to="/welcome" className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setMore(false)}>
                Website
              </Link>
              {session ? (
                <button
                  type="button"
                  className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    signOutAccount();
                    attachLedgerForUser(null);
                    clearProfileGate();
                    window.location.href = "/login";
                  }}
                >
                  Sign out
                </button>
              ) : null}
            </div>
            {session ? <p className="truncate px-3 py-2 text-xs text-muted-foreground">{session.email}</p> : null}
            {unread > 0 ? <p className="px-3 pb-2 text-xs text-muted-foreground">{unread} unread notice{unread === 1 ? "" : "s"}</p> : null}
          </div>
        </>
      ) : null}

      <main className="mx-auto w-full max-w-5xl min-w-0 px-4 pt-8 pb-24 sm:px-6 sm:pt-10">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <div className={cn("mx-auto grid h-14 max-w-lg", drive ? "grid-cols-2" : "grid-cols-5")}>
          {(drive ? [{ to: "/rideshare", label: "Desk", icon: Car }] : PRIMARY).map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.to);
            return (
              <Link key={item.to} to={item.to} className={cn("flex flex-col items-center justify-center gap-0.5 text-[11px]", active ? "text-foreground" : "text-muted-foreground")}>
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setMore(true)} className={cn("flex flex-col items-center justify-center gap-0.5 text-[11px]", more ? "text-foreground" : "text-muted-foreground")}>
            <MoreHorizontal className="size-5" strokeWidth={1.75} />
            More
          </button>
        </div>
      </nav>

      <QuickAdd />
      <SettingsDialog />
      <StatementImport />
      <ProfileGate />
    </div>
  );
}

function ThemeButton() {
  const appearance = useFinanceStore((s) => s.settings.appearance ?? "light");
  const updateSettings = useFinanceStore((s) => s.updateSettings);
  const dark = appearance === "dark";
  const Icon = dark ? Sun : Moon;
  return (
    <button
      type="button"
      aria-label={dark ? "Day" : "Night"}
      onClick={() => updateSettings({ appearance: dark ? "light" : "dark" })}
      className="grid size-8 place-items-center rounded-full text-foreground hover:bg-muted"
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </button>
  );
}

function CoveMark() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground" aria-hidden>
      <img src="/cove-mark.png" alt="" className="size-7 object-cover" width={28} height={28} />
    </span>
  );
}

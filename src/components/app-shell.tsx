import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, CalendarDays, FileText, Globe, LayoutGrid, ListChecks, Menu, PieChart, Plus, Receipt, Settings, Wallet, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NotificationCenter } from "@/components/notification-center";
import { QuickAdd } from "@/components/quick-add";
import { SettingsDialog } from "@/components/settings-dialog";
import { CoveChat } from "@/components/cove-chat";
import { StatementImport } from "@/components/statement-import";
import { Button } from "@/components/ui/button";
import { useAccountSession } from "@/lib/account-session";
import { signOutAccount } from "@/lib/account-vault";
import { startCloudSync } from "@/lib/cloud-sync";
import { isSampleLedger, takeEmptyStart } from "@/lib/fresh-start";
import { attachLedgerForUser } from "@/lib/ledger-session";
import { useFinanceStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", short: "Home", icon: LayoutGrid },
  { to: "/calendar", label: "Calendar", short: "Cal", icon: CalendarDays },
  { to: "/activity", label: "Activity", short: "Log", icon: Receipt },
  { to: "/reconcile", label: "Reconcile", short: "Match", icon: ListChecks },
  { to: "/bills", label: "Bills", short: "Bills", icon: Bell },
  { to: "/budgets", label: "Budgets", short: "Caps", icon: Wallet },
  { to: "/insights", label: "Insights", short: "Stats", icon: PieChart },
  { to: "/reports", label: "Reports", short: "PDF", icon: FileText },
] as const;

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unread = useFinanceStore((s) => s.notices.filter((n) => !n.read).length);
  const setAddOpen = useFinanceStore((s) => s.setAddOpen);
  const setImportOpen = useFinanceStore((s) => s.setImportOpen);
  const setSettingsOpen = useFinanceStore((s) => s.setSettingsOpen);
  const cycleMode = useFinanceStore((s) => s.cycleMode);
  const setCycleMode = useFinanceStore((s) => s.setCycleMode);
  const { session } = useAccountSession();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    setMenu(false);
  }, [pathname]);

  useEffect(() => {
    const store = useFinanceStore.getState();
    const wiped = takeEmptyStart();
    if (wiped || isSampleLedger(store.transactions)) {
      store.clearAll();
      useFinanceStore.persist.clearStorage();
    }
    if (wiped) {
      try {
        sessionStorage.setItem("cove-reloaded-empty", "1");
      } catch {
        /* private mode */
      }
      window.location.reload();
      return;
    }
    attachLedgerForUser(session?.userId ?? null);
  }, [session?.userId]);

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
      if (e.key === "Escape") setMenu(false);
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

  const sidebar = (
    <>
      <div className="flex items-center gap-2.5 px-5 pt-8 pb-8">
        <CoveMark />
        <div>
          <p className="font-display text-[22px] leading-none tracking-tight">Cove</p>
          <p className="mt-1 text-[11px] text-sidebar-muted">Quiet money</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMenu(false)}
              className={cn(
                "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150",
                active
                  ? "bg-sidebar-foreground/10 text-sidebar-foreground"
                  : "text-sidebar-muted hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-[11px] text-sidebar-muted">
            {unread > 0 ? `${unread} notice${unread === 1 ? "" : "s"}` : "All quiet"}
          </span>
          <NotificationCenter light />
        </div>
        <Button
          className="w-full bg-sidebar-foreground text-sidebar hover:bg-sidebar-foreground/90"
          onClick={() => {
            setMenu(false);
            setAddOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add
        </Button>
        <Button
          variant="ghost"
          className="w-full text-sidebar-muted hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
          onClick={() => {
            setMenu(false);
            setImportOpen(true);
          }}
        >
          <Receipt className="size-4" />
          Statement
        </Button>
        <Button
          variant="ghost"
          className="w-full text-sidebar-muted hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
          onClick={() => {
            setMenu(false);
            setSettingsOpen(true);
          }}
        >
          <Settings className="size-4" />
          Settings
        </Button>
        {session ? (
          <div className="rounded-md bg-sidebar-foreground/10 px-3 py-2">
            <p className="truncate text-[12px] text-sidebar-foreground">{session.name}</p>
            <p className="truncate text-[11px] text-sidebar-muted">{session.email}</p>
            <button
              type="button"
              className="mt-1 text-[11px] text-sidebar-muted underline-offset-4 hover:underline"
              onClick={() => {
                signOutAccount();
                attachLedgerForUser(null);
                window.location.href = "/login";
              }}
            >
              Sign out
            </button>
          </div>
        ) : null}
        <Link
          to="/welcome"
          onClick={() => setMenu(false)}
          className="flex h-10 items-center justify-center gap-2 rounded-md text-sm text-sidebar-muted hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
        >
          <Globe className="size-4" strokeWidth={1.75} />
          Website
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col bg-sidebar text-sidebar-foreground lg:flex">
        {sidebar}
      </aside>

      {menu ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMenu(false)}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(240px,88vw)] flex-col bg-sidebar text-sidebar-foreground shadow-card transition-transform duration-200 lg:hidden",
          menu ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          className="absolute top-4 right-3 flex size-9 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
          onClick={() => setMenu(false)}
          aria-label="Close menu"
        >
          <X className="size-4" />
        </button>
        {sidebar}
      </aside>

      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between gap-3 px-4 lg:pl-[236px] lg:pr-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu">
              <Menu className="size-4" />
            </Button>
            <CoveMark dark className="lg:hidden" />
            <span className="font-display text-lg tracking-tight lg:hidden">Cove</span>
          </div>
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <div className="flex shrink-0 rounded-lg bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setCycleMode(false)}
                className={cn(
                  "h-8 rounded-md px-2 text-[12px] font-medium sm:px-3",
                  !cycleMode ? "bg-card text-foreground shadow-card" : "text-muted-foreground",
                )}
              >
                Calendar
              </button>
              <button
                type="button"
                onClick={() => setCycleMode(true)}
                className={cn(
                  "h-8 rounded-md px-2 text-[12px] font-medium sm:px-3",
                  cycleMode ? "bg-card text-foreground shadow-card" : "text-muted-foreground",
                )}
              >
                Pay cycle
              </button>
            </div>
            <NotificationCenter />
            <Button variant="ghost" size="icon-sm" className="hidden sm:inline-flex lg:hidden" onClick={() => setSettingsOpen(true)} aria-label="Settings">
              <Settings className="size-4" />
            </Button>
            <Button size="icon-sm" className="lg:hidden" onClick={() => setAddOpen(true)} aria-label="Add">
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="lg:pl-[220px]">
        <main className="mx-auto w-full max-w-[1120px] min-w-0 px-4 pt-6 pb-16 lg:px-6 lg:pt-8">{children}</main>
      </div>

      <QuickAdd />
      <SettingsDialog />
      <StatementImport />
      <CoveChat />
    </div>
  );
}

function CoveMark({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-sm",
        dark ? "bg-foreground" : "bg-sidebar-foreground/10",
        className,
      )}
      aria-hidden
    >
      <img src="/cove-mark.png" alt="" className="size-8 object-cover" width={32} height={32} />
    </span>
  );
}

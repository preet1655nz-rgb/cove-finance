import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, FileText, LayoutGrid, PieChart, Plus, Receipt, Settings, Wallet } from "lucide-react";
import { useEffect } from "react";
import { NotificationCenter } from "@/components/notification-center";
import { QuickAdd } from "@/components/quick-add";
import { SettingsDialog } from "@/components/settings-dialog";
import { StatementImport } from "@/components/statement-import";
import { Button } from "@/components/ui/button";
import { useFinanceStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", short: "Home", icon: LayoutGrid },
  { to: "/calendar", label: "Calendar", short: "Cal", icon: CalendarDays },
  { to: "/activity", label: "Activity", short: "Log", icon: Receipt },
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
  const setSettingsOpen = useFinanceStore((s) => s.setSettingsOpen);

  useEffect(() => {
    try {
      window.localStorage.removeItem("cove-finance-v1");
    } catch {
      /* private mode */
    }
    const result = useFinanceStore.persist.rehydrate();
    void Promise.resolve(result).finally(() => {
      useFinanceStore.getState().refreshNotices();
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setAddOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setAddOpen]);

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5 px-6 pt-8 pb-10">
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
            onClick={() => setAddOpen(true)}
          >
            <Plus className="size-4" />
            Add
          </Button>
          <Button
            variant="ghost"
            className="w-full text-sidebar-muted hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-4" />
            Settings
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2">
          <CoveMark dark />
          <span className="font-display text-lg tracking-tight">Cove</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationCenter />
          <Button variant="ghost" size="icon-sm" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            <Settings className="size-4" />
          </Button>
          <Button size="icon-sm" onClick={() => setAddOpen(true)} aria-label="Add">
            <Plus className="size-4" />
          </Button>
        </div>
      </header>

      <div className="lg:pl-[220px]">
        <main className="mx-auto max-w-[1120px] px-4 pt-6 pb-28 lg:px-6 lg:pt-8 lg:pb-16">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-6 px-0.5 pb-[env(safe-area-inset-bottom)]">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 text-[10px] font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2 : 1.6} />
                <span className="whitespace-nowrap">{item.short}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <QuickAdd />
      <SettingsDialog />
      <StatementImport />
    </div>
  );
}

function CoveMark({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-sm",
        dark ? "bg-foreground text-background" : "bg-sidebar-foreground/10 text-sidebar-foreground",
      )}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="size-5">
        <circle cx="16" cy="11" r="2.2" fill="currentColor" />
        <path
          d="M7 21c3-5 15-5 18 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

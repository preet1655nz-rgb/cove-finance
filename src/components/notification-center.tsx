import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFinanceStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function NotificationCenter({ light = false }: { light?: boolean }) {
  const notices = useFinanceStore((s) => s.notices);
  const markRead = useFinanceStore((s) => s.markNoticeRead);
  const markAll = useFinanceStore((s) => s.markAllRead);
  const unread = notices.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Notifications"
          className={cn("relative", light && "text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground")}
        >
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-expense" />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,360px)] p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-medium">Notices</p>
          {unread > 0 ? (
            <button type="button" className="text-[12px] text-muted-foreground hover:text-foreground" onClick={markAll}>
              Mark all read
            </button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto border-t border-border">
          {notices.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">All quiet. Budgets and bills will land here.</p>
          ) : (
            notices.map((n) => (
              <Link
                key={n.id}
                to={n.href ?? "/"}
                onClick={() => markRead(n.id)}
                className={cn(
                  "block px-4 py-3 transition-colors hover:bg-muted/50",
                  !n.read && "bg-muted/40",
                )}
              >
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{n.body}</p>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

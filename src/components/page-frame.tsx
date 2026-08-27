import { Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useAccountSession } from "@/lib/account-session";

export function PageFrame({ children }: { children: React.ReactNode }) {
  const { session, ready } = useAccountSession();
  if (!ready) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!session) return <Navigate to="/login" />;
  return <AppShell>{children}</AppShell>;
}

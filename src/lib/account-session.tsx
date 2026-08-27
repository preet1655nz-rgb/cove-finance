import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readSession, type CoveSession } from "./account-vault";
import { attachLedgerForUser } from "./ledger-session";

const Ctx = createContext<{ session: CoveSession | null; ready: boolean }>({ session: null, ready: false });

export function AccountSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CoveSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = readSession();
    setSession(current);
    attachLedgerForUser(current?.userId ?? null);
    setReady(true);
    const onChange = () => {
      const next = readSession();
      setSession(next);
      attachLedgerForUser(next?.userId ?? null);
    };
    window.addEventListener("cove-session", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("cove-session", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const value = useMemo(() => ({ session, ready }), [session, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccountSession() {
  return useContext(Ctx);
}

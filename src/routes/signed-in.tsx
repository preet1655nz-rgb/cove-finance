import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { adoptOauthAccount } from "@/lib/account-vault";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { attachLedgerForUser } from "@/lib/ledger-session";

export const Route = createFileRoute("/signed-in")({
  component: SignedInBridge,
  head: () => ({ meta: [{ title: "Signing in — Cove" }] }),
});

function SignedInBridge() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [error, setError] = useState("");

  useEffect(() => {
    if (isPending) return;
    if (!user?.primaryEmail) {
      setError("Gmail sign-in did not return an email. Use email and password instead.");
      return;
    }
    void adoptOauthAccount(user.primaryEmail, user.displayName || undefined)
      .then((session) => {
        attachLedgerForUser(session.userId);
        return navigate({ to: "/" });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not finish Gmail sign-in");
      });
  }, [isPending, user, navigate]);

  return (
    <AuthFrame title="Signing in" subtitle="Connecting your Gmail account to Cove.">
      <p className="text-sm text-muted-foreground">{error || "Just a moment…"}</p>
    </AuthFrame>
  );
}

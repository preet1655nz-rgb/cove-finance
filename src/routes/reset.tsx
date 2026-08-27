import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { attachLedgerForUser } from "@/lib/ledger-session";
import { resetPassword } from "@/lib/account-vault";

export const Route = createFileRoute("/reset")({
  component: ResetPage,
  head: () => ({ meta: [{ title: "Reset password — Cove" }] }),
});

function ResetPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const session = await resetPassword(email, code, password);
      attachLedgerForUser(session.userId);
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Reset password" subtitle="Use the recovery code shown when you created the account. No email is sent.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="code">Recovery code</Label>
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        </div>
        {error ? <p className="text-sm text-expense">{error}</p> : null}
        <Button className="w-full" disabled={busy} type="submit">
          {busy ? "Saving…" : "Save new password"}
        </Button>
      </form>
      <p className="mt-5 text-sm">
        <Link to="/login" className="underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthFrame>
  );
}

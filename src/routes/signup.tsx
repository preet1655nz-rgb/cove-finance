import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { attachLedgerForUser } from "@/lib/ledger-session";
import { createAccount } from "@/lib/account-vault";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({ meta: [{ title: "Create account — Cove" }] }),
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const { session, recoveryCode } = await createAccount({ email, name, password });
      attachLedgerForUser(session.userId);
      setRecovery(recoveryCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  if (recovery) {
    return (
      <AuthFrame title="Save your recovery code" subtitle="This is the only way to reset your password. Cove does not send email.">
        <p className="rounded-md bg-muted px-3 py-3 font-mono text-sm tracking-wide">{recovery}</p>
        <p className="mt-3 text-[13px] text-muted-foreground">Write it down. It will not be shown again.</p>
        <Button className="mt-6 w-full" onClick={() => void navigate({ to: "/" })}>
          Open Cove
        </Button>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Create account" subtitle="One login for the website and the iPhone home-screen app on this device.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email or Gmail</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        </div>
        {error ? <p className="text-sm text-expense">{error}</p> : null}
        <Button className="w-full" disabled={busy} type="submit">
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-5 text-sm">
        Already have one?{" "}
        <Link to="/login" className="underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthFrame>
  );
}

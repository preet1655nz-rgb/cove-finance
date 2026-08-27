import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { attachLedgerForUser } from "@/lib/ledger-session";
import { isGmail, signInAccount } from "@/lib/account-vault";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — Cove" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(nextEmail = email) {
    setError("");
    setBusy(true);
    try {
      const session = await signInAccount(nextEmail, password);
      attachLedgerForUser(session.userId);
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Sign in" subtitle="Your books stay with this account on the website and the home-screen app.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error ? <p className="text-sm text-expense">{error}</p> : null}
        <Button className="w-full" disabled={busy} type="submit">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={() => {
            if (!isGmail(email)) {
              setError("Enter your Gmail address above, then tap Continue with Gmail.");
              return;
            }
            void submit(email);
          }}
        >
          Continue with Gmail
        </Button>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Gmail is only an email on this account. Cove does not call Google, does not request Gmail access, and does not
          share the ledger.
        </p>
      </form>
      <div className="mt-5 flex flex-col gap-2 text-sm">
        <Link to="/reset" className="text-muted-foreground underline-offset-4 hover:underline">
          Forgot password
        </Link>
        <Link to="/signup" className="underline-offset-4 hover:underline">
          Create an account
        </Link>
      </div>
    </AuthFrame>
  );
}

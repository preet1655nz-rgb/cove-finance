import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { attachLedgerForUser } from "@/lib/ledger-session";
import { createAccount, isGmail } from "@/lib/account-vault";

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
      setRecovery(recoveryCode || "Saved on the server. Use Forgot password if you need a Gmail reset link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  if (recovery) {
    return (
      <AuthFrame title="Account ready" subtitle="You can sign in on the website and the iPhone home-screen app with this email.">
        {recovery.startsWith("Saved") ? (
          <p className="text-sm text-muted-foreground">{recovery}</p>
        ) : (
          <>
            <p className="rounded-md bg-muted px-3 py-3 font-mono text-sm tracking-wide">{recovery}</p>
            <p className="mt-3 text-[13px] text-muted-foreground">Keep this recovery code. You can also use Forgot password to get a Gmail reset link.</p>
          </>
        )}
        <Button className="mt-6 w-full" onClick={() => void navigate({ to: "/" })}>
          Open Cove
        </Button>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Create account" subtitle="One login for the website and the iPhone home-screen app.">
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
        <PasswordField id="password" label="Password (min 8 characters)" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
        {error ? <p className="text-sm text-expense">{error}</p> : null}
        <Button className="w-full" disabled={busy} type="submit">
          {busy ? "Creating…" : isGmail(email) ? "Create Gmail account" : "Create account"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={() => {
            if (!isGmail(email)) {
              setError("Type your @gmail.com address above.");
              return;
            }
            if (password.length < 8) {
              setError("Choose a password of at least 8 characters, then tap Continue with Gmail.");
              return;
            }
            void submit();
          }}
        >
          Continue with Gmail
        </Button>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Gmail signup stores the account in Cove’s shared cloud. Use the same Gmail and password on the website and the iPhone home-screen app.
        </p>
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

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { attachLedgerForUser } from "@/lib/ledger-session";
import { isGmail, signInAccount } from "@/lib/account-vault";
import { authEnabled, signIn } from "@/lib/auth/client";

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

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const session = await signInAccount(email, password);
      attachLedgerForUser(session.userId);
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  async function gmail() {
    setError("");
    if (!isGmail(email)) {
      setError("Enter your Gmail address above, then tap Continue with Gmail.");
      return;
    }
    if (password) {
      await submit();
      return;
    }
    if (authEnabled) {
      setBusy(true);
      try {
        await signIn("grok-google", { callbackURL: "/signed-in", errorCallbackURL: "/login" });
      } catch (err) {
        setBusy(false);
        setError(
          err instanceof Error
            ? err.message
            : "Google sign-in is not available. Enter your Gmail password and tap Sign in.",
        );
      }
      return;
    }
    setError("Enter your Gmail password, then tap Sign in. Same login works on the home-screen app.");
  }

  return (
    <AuthFrame title="Sign in" subtitle="Same login on the website and the iPhone home-screen app. Accounts sync through Cove’s cloud.">
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
        <PasswordField id="password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        {error ? <p className="text-sm text-expense">{error}</p> : null}
        <Button className="w-full" disabled={busy} type="submit">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => void gmail()}>
          Continue with Gmail
        </Button>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Type your Gmail and Cove password, then Sign in or Continue with Gmail. Same cloud login on the website and the home-screen app.
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

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { attachLedgerForUser } from "@/lib/ledger-session";
import { requestPasswordReset, resetPassword, resetPasswordWithToken } from "@/lib/account-vault";

export const Route = createFileRoute("/reset")({
  component: ResetPage,
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : "",
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({ meta: [{ title: "Reset password — Cove" }] }),
});

function ResetPage() {
  const navigate = useNavigate();
  const initial = Route.useSearch();
  const [email, setEmail] = useState(initial.email);
  const [code, setCode] = useState("");
  const [token] = useState(initial.token);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const hasLink = Boolean(token);

  const subtitle = useMemo(
    () =>
      hasLink
        ? "This Gmail reset link sets a new password for the website and the home-screen app."
        : "Email a reset link to Gmail, or use the recovery code from when you created the account.",
    [hasLink],
  );

  async function sendLink() {
    setError("");
    setBusy(true);
    try {
      const result = await requestPasswordReset(email);
      if (result.emailed) setNote("Reset link sent. Open Gmail on this phone or computer.");
      else if (result.resetUrl) {
        setNote("Resend is not sending yet, so Cove opened the reset link here.");
        window.location.href = result.resetUrl;
      } else setNote("If that email has a Cove account, a reset was prepared.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start reset");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const session = hasLink
        ? await resetPasswordWithToken(email, token, password)
        : await resetPassword(email, code, password);
      attachLedgerForUser(session.userId);
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Reset password" subtitle={subtitle}>
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
        {hasLink ? null : (
          <>
            <Button type="button" variant="outline" className="w-full" disabled={busy || !email} onClick={() => void sendLink()}>
              Email a Gmail reset link
            </Button>
            <div className="space-y-1.5">
              <Label htmlFor="code">Recovery code</Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
            </div>
          </>
        )}
        <PasswordField id="password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
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

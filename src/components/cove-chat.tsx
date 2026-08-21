import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFinanceStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "How am I doing?",
  "Add uber income $400",
  "What patterns do you see?",
  "Tax on 90000",
];

export function CoveChat() {
  const open = useFinanceStore((s) => s.chatOpen);
  const setOpen = useFinanceStore((s) => s.setChatOpen);
  const chat = useFinanceStore((s) => s.chat);
  const busy = useFinanceStore((s) => s.chatBusy);
  const rules = useFinanceStore((s) => s.rules);
  const accounts = useFinanceStore((s) => s.accounts);
  const askCove = useFinanceStore((s) => s.askCove);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat, open, busy]);

  async function send(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    setDraft("");
    await askCove(value);
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Ask Cove"
        className="fixed right-4 bottom-20 z-40 h-12 rounded-full px-4 shadow-card lg:bottom-6"
      >
        <MessageCircle className="size-4" />
        Ask Cove
      </Button>

      {open ? (
        <div className="fixed inset-x-3 bottom-20 z-50 flex max-h-[min(72dvh,580px)] flex-col overflow-hidden rounded-xl bg-card shadow-card lg:inset-x-auto lg:right-6 lg:bottom-24 lg:w-[400px]">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Ask Cove</p>
              <p className="text-[12px] text-muted-foreground">
                Reads your ledger · add, edit, delete · NZ tax
                {rules.length ? ` · ${rules.length} rules` : ""}
                {accounts.length ? ` · ${accounts.length} accounts` : ""}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close chat">
              <X className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {chat.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Built into Cove. I add, edit and delete entries, spot patterns in your books, and remember what you teach me.
              </p>
            ) : (
              chat.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <p
                    className={cn(
                      "max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px] leading-relaxed",
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                  >
                    {m.text}
                  </p>
                </div>
              ))
            )}
            {busy ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-[13px] text-muted-foreground">Reading your books…</p>
            ) : null}
            <div ref={endRef} />
          </div>
          <div className="flex flex-wrap gap-1.5 border-t border-border px-3 pt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => void send(s)}
                className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask Cove anything about your money"
              disabled={busy}
              className="h-11 flex-1 rounded-md bg-muted px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
            />
            <Button type="submit" size="icon" aria-label="Send" disabled={busy || !draft.trim()}>
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      ) : null}
    </>
  );
}

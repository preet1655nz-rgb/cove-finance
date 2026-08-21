import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFinanceStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Sharesies is investing",
  "guri wstpac saving is a transfer to Westpac savings",
  "What is in Other?",
  "Show transfers",
  "List accounts",
];

export function CoveChat() {
  const open = useFinanceStore((s) => s.chatOpen);
  const setOpen = useFinanceStore((s) => s.setChatOpen);
  const chat = useFinanceStore((s) => s.chat);
  const rules = useFinanceStore((s) => s.rules);
  const accounts = useFinanceStore((s) => s.accounts);
  const askCove = useFinanceStore((s) => s.askCove);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat, open]);

  function send(text: string) {
    const value = text.trim();
    if (!value) return;
    askCove(value);
    setDraft("");
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
        <div className="fixed inset-x-3 bottom-20 z-50 flex max-h-[min(70dvh,560px)] flex-col overflow-hidden rounded-xl bg-card shadow-card lg:inset-x-auto lg:right-6 lg:bottom-24 lg:w-[380px]">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Cove</p>
              <p className="text-[12px] text-muted-foreground">
                Remembers {rules.length} {rules.length === 1 ? "rule" : "rules"}
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
                Teach me payees and transfers. I keep the rules on this device and retag matching entries.
              </p>
            ) : (
              chat.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <p
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px] leading-relaxed",
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                  >
                    {m.text}
                  </p>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
          <div className="flex flex-wrap gap-1.5 border-t border-border px-3 pt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Sharesies is investing"
              className="h-11 flex-1 rounded-md bg-muted px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            <Button type="submit" size="icon" aria-label="Send">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      ) : null}
    </>
  );
}

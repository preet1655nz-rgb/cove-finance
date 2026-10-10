import { useNavigate } from "@tanstack/react-router";
import { Car, Check, Wallet } from "lucide-react";
import { useProfile, type ProfileId } from "@/lib/profile";
import { cn } from "@/lib/utils";

const OPTIONS: {
  id: ProfileId;
  title: string;
  kicker: string;
  body: string;
  icon: typeof Wallet;
}[] = [
  {
    id: "cove",
    title: "Cove",
    kicker: "Everyday money",
    body: "Income, bills, budgets and the full ledger. This stays the source of truth.",
    icon: Wallet,
  },
  {
    id: "rideshare",
    title: "Drive",
    kicker: "Rideshare books",
    body: "Uber and Didi income, plus vehicle costs Inland Revenue allows. Read from Cove — nothing is copied.",
    icon: Car,
  },
];

export function ProfileGate() {
  const navigate = useNavigate();
  const gate = useProfile((s) => s.gate);
  const profile = useProfile((s) => s.profile);
  const choose = useProfile((s) => s.choose);
  if (!gate) return null;

  function pick(id: ProfileId) {
    choose(id);
    void navigate({ to: id === "rideshare" ? "/rideshare" : "/" });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/35 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:items-center">
      <div className="w-full max-w-[420px] rounded-[28px] bg-background p-5 shadow-card">
        <p className="text-[13px] text-muted-foreground">Same login. Two desks.</p>
        <h2 className="mt-1 font-display text-[28px] leading-none tracking-tight">Open a profile</h2>
        <div className="mt-5 flex flex-col gap-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = profile === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => pick(option.id)}
                className={cn(
                  "flex items-start gap-3 rounded-[22px] bg-card p-4 text-left shadow-card transition-transform duration-150 active:scale-[0.98]",
                  selected && "ring-1 ring-foreground",
                )}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-foreground text-background">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-medium">{option.title}</span>
                    {selected ? <Check className="size-4" /> : null}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">{option.kicker}</span>
                  <span className="mt-1.5 block text-[13px] leading-snug text-muted-foreground">{option.body}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
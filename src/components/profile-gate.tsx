import { useNavigate } from "@tanstack/react-router";
import { Car, Check, Wallet } from "lucide-react";
import { useProfile, type ProfileId } from "@/lib/profile";
import { cn } from "@/lib/utils";

const OPTIONS: {
  id: ProfileId;
  title: string;
  kicker: string;
  icon: typeof Wallet;
}[] = [
  {
    id: "cove",
    title: "Cove",
    kicker: "Everyday money",
    icon: Wallet,
  },
  {
    id: "rideshare",
    title: "Drive",
    kicker: "Rideshare books",
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/30 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-background p-5 shadow-card">
        <h2 className="font-display text-3xl tracking-tight">Which desk?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Same books. Pick a view.</p>
        <div className="mt-5 flex flex-col gap-2">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = profile === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => pick(option.id)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-3 text-left active:scale-[0.98]",
                  selected ? "bg-foreground text-background" : "bg-card shadow-card",
                )}
              >
                <Icon className="size-5 shrink-0" strokeWidth={1.75} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{option.title}</span>
                  <span className={cn("mt-0.5 block text-xs", selected ? "text-background/70" : "text-muted-foreground")}>{option.kicker}</span>
                </span>
                {selected ? <Check className="size-4" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
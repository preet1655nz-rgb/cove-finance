import { Toaster as Sonner } from "sonner";
import { useFinanceStore } from "@/lib/store";

function Toaster() {
  const appearance = useFinanceStore((s) => s.settings.appearance ?? "light");
  return (
    <Sonner
      theme={appearance}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "bg-card text-foreground shadow-card border-0 font-sans",
          title: "text-sm font-medium",
          description: "text-sm text-muted-foreground",
        },
      }}
    />
  );
}

export { Toaster };

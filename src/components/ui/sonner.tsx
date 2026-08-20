import { Toaster as Sonner } from "sonner";

function Toaster() {
  return (
    <Sonner
      theme="light"
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

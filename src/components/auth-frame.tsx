import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-[420px]">
        <Link to="/welcome" className="mb-10 flex items-center gap-2.5">
          <span className="flex size-8 overflow-hidden rounded-sm bg-foreground" aria-hidden>
            <img src="/cove-mark.png" alt="" className="size-8 object-cover" width={32} height={32} />
          </span>
          <span className="font-display text-xl tracking-tight">Cove</span>
        </Link>
        <h1 className="font-display text-3xl tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-8 rounded-xl bg-card p-5 shadow-card sm:p-6">{children}</div>
      </div>
    </div>
  );
}

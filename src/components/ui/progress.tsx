import { cn } from "@/lib/utils";

function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full bg-primary transition-[width] duration-500 ease-out", indicatorClassName)}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export { Progress };

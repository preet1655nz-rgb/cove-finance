import { useMemo, useState } from "react";
import type { Category } from "@/lib/categories";

export function CategoryPicker({
  value,
  options,
  onChange,
  onCreate,
}: {
  value: string;
  options: Category[];
  onChange: (id: string) => void;
  onCreate?: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((c) => c.name.toLowerCase().includes(q));
  }, [options, query]);
  const canAdd = Boolean(onCreate && query.trim().length >= 2 && !filtered.some((c) => c.name.toLowerCase() === query.trim().toLowerCase()));

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-56 sm:flex-none">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search categories"
        aria-label="Search categories"
        className="h-9 w-full rounded-md bg-card px-2.5 text-[13px] shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <select
        value={options.some((c) => c.id === value) ? value : ""}
        onChange={(e) => {
          if (e.target.value === "__new") {
            onCreate?.(query.trim());
            setQuery("");
            return;
          }
          onChange(e.target.value);
          setQuery("");
        }}
        className="h-9 w-full rounded-md bg-card px-2 text-[13px] shadow-card"
        size={query.trim() ? Math.min(6, Math.max(2, filtered.length + (canAdd ? 1 : 0))) : 1}
      >
        {filtered.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        {canAdd ? <option value="__new">Add “{query.trim()}”</option> : null}
        {!filtered.length && !canAdd ? <option value="">No match</option> : null}
      </select>
    </div>
  );
}

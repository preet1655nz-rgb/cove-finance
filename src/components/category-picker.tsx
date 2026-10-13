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
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((c) => c.name.toLowerCase().includes(q));
  }, [options, query]);
  const typed = query.trim();
  const exact = typed.length >= 2 && filtered.some((c) => c.name.toLowerCase() === typed.toLowerCase());
  const canAdd = Boolean(onCreate) && !exact;

  function create(name: string) {
    const clean = name.trim();
    if (clean.length < 2) return;
    onCreate?.(clean);
    setQuery("");
    setDraft("");
    setAdding(false);
  }

  if (adding) {
    return (
      <form
        className="flex min-w-0 flex-1 items-center gap-1 sm:w-56 sm:flex-none"
        onSubmit={(e) => {
          e.preventDefault();
          create(draft);
        }}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="New category"
          aria-label="New category"
          className="h-9 min-w-0 flex-1 rounded-md bg-card px-2.5 text-[13px] shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <button type="submit" className="h-9 shrink-0 rounded-md bg-foreground px-2 text-[12px] text-background">
          Add
        </button>
        <button type="button" className="h-9 shrink-0 px-1 text-[12px] text-muted-foreground" onClick={() => setAdding(false)}>
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-56 sm:flex-none">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search or name a category"
        aria-label="Search categories"
        className="h-9 w-full rounded-md bg-card px-2.5 text-[13px] shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <select
        value={options.some((c) => c.id === value) ? value : ""}
        onChange={(e) => {
          if (e.target.value === "__new") {
            if (typed.length >= 2) create(typed);
            else {
              setDraft(typed);
              setAdding(true);
            }
            return;
          }
          onChange(e.target.value);
          setQuery("");
        }}
        className="h-9 w-full rounded-md bg-card px-2 text-[13px] shadow-card"
        size={typed ? Math.min(6, Math.max(2, filtered.length + (canAdd ? 1 : 0))) : 1}
      >
        {filtered.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        {canAdd ? <option value="__new">{typed.length >= 2 ? `Add “${typed}”` : "Add category"}</option> : null}
        {!filtered.length && !canAdd ? <option value="">No match</option> : null}
      </select>
    </div>
  );
}

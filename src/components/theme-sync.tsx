import { useEffect } from "react";
import { useFinanceStore } from "@/lib/store";

export function ThemeSync() {
  const appearance = useFinanceStore((s) => s.settings.appearance ?? "light");
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = appearance;
    root.classList.toggle("dark", appearance === "dark");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", appearance === "dark" ? "#000000" : "#f6f6f4");
  }, [appearance]);
  return null;
}

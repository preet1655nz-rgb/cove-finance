import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  Banknote,
  Briefcase,
  Bus,
  Clapperboard,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Plane,
  Receipt,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wine,
} from "lucide-react";
import type { TxType } from "./types";

export type Category = {
  id: string;
  name: string;
  type: TxType;
  icon: LucideIcon;
  tint: string;
};

export const CATEGORIES: Category[] = [
  { id: "salary", name: "Salary", type: "income", icon: Banknote, tint: "var(--color-income)" },
  { id: "freelance", name: "Freelance", type: "income", icon: Briefcase, tint: "var(--color-income)" },
  { id: "investments", name: "Investments", type: "income", icon: TrendingUp, tint: "var(--color-income)" },
  { id: "gifts", name: "Gifts", type: "income", icon: Gift, tint: "var(--color-income)" },
  { id: "other-income", name: "Other income", type: "income", icon: Wallet, tint: "var(--color-income)" },
  { id: "housing", name: "Housing", type: "expense", icon: House, tint: "var(--color-chart-2)" },
  { id: "groceries", name: "Groceries", type: "expense", icon: ShoppingBag, tint: "var(--color-chart-1)" },
  { id: "dining", name: "Dining", type: "expense", icon: Utensils, tint: "var(--color-chart-5)" },
  { id: "transport", name: "Transport", type: "expense", icon: Bus, tint: "var(--color-chart-3)" },
  { id: "utilities", name: "Utilities", type: "expense", icon: Wifi, tint: "var(--color-chart-4)" },
  { id: "health", name: "Health", type: "expense", icon: HeartPulse, tint: "var(--color-chart-2)" },
  { id: "entertainment", name: "Leisure", type: "expense", icon: Clapperboard, tint: "var(--color-chart-5)" },
  { id: "shopping", name: "Shopping", type: "expense", icon: Armchair, tint: "var(--color-chart-3)" },
  { id: "subscriptions", name: "Subscriptions", type: "expense", icon: Receipt, tint: "var(--color-chart-4)" },
  { id: "travel", name: "Travel", type: "expense", icon: Plane, tint: "var(--color-chart-1)" },
  { id: "education", name: "Education", type: "expense", icon: GraduationCap, tint: "var(--color-chart-3)" },
  { id: "drinks", name: "Cafes", type: "expense", icon: Wine, tint: "var(--color-chart-5)" },
  { id: "other", name: "Other", type: "expense", icon: Sparkles, tint: "var(--color-chart-4)" },
  { id: "savings", name: "Savings", type: "expense", icon: Landmark, tint: "var(--color-income)" },
];

const map = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string) {
  return map.get(id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function categoriesFor(type: TxType) {
  return CATEGORIES.filter((c) => c.type === type);
}

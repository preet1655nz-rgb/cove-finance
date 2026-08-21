import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  ArrowLeftRight,
  Banknote,
  Bike,
  Briefcase,
  Bus,
  CircleDollarSign,
  Clapperboard,
  CreditCard,
  Gift,
  GraduationCap,
  Hammer,
  HeartPulse,
  House,
  Landmark,
  Plane,
  Receipt,
  Scale,
  Shield,
  ShoppingBag,
  Sparkles,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wine,
} from "lucide-react";
import type { CustomCategory, TxType } from "./types";

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
  { id: "gig", name: "Gig work", type: "income", icon: Bike, tint: "var(--color-income)" },
  { id: "investments", name: "Investment income", type: "income", icon: TrendingUp, tint: "var(--color-income)" },
  { id: "gifts", name: "Gifts", type: "income", icon: Gift, tint: "var(--color-income)" },
  { id: "other-income", name: "Other income", type: "income", icon: Wallet, tint: "var(--color-income)" },
  { id: "transfer-in", name: "Transfer in", type: "income", icon: ArrowLeftRight, tint: "var(--color-chart-3)" },
  { id: "housing", name: "Housing", type: "expense", icon: House, tint: "var(--color-chart-2)" },
  { id: "groceries", name: "Groceries", type: "expense", icon: ShoppingBag, tint: "var(--color-chart-1)" },
  { id: "dining", name: "Dining", type: "expense", icon: Utensils, tint: "var(--color-chart-5)" },
  { id: "transport", name: "Transport", type: "expense", icon: Bus, tint: "var(--color-chart-3)" },
  { id: "utilities", name: "Utilities", type: "expense", icon: Wifi, tint: "var(--color-chart-4)" },
  { id: "health", name: "Health", type: "expense", icon: HeartPulse, tint: "var(--color-chart-2)" },
  { id: "insurance", name: "Insurance", type: "expense", icon: Shield, tint: "var(--color-chart-2)" },
  { id: "entertainment", name: "Leisure", type: "expense", icon: Clapperboard, tint: "var(--color-chart-5)" },
  { id: "shopping", name: "Shopping", type: "expense", icon: Armchair, tint: "var(--color-chart-3)" },
  { id: "household", name: "Household", type: "expense", icon: Hammer, tint: "var(--color-chart-4)" },
  { id: "subscriptions", name: "Subscriptions", type: "expense", icon: Receipt, tint: "var(--color-chart-4)" },
  { id: "travel", name: "Travel", type: "expense", icon: Plane, tint: "var(--color-chart-1)" },
  { id: "education", name: "Education", type: "expense", icon: GraduationCap, tint: "var(--color-chart-3)" },
  { id: "drinks", name: "Cafes", type: "expense", icon: Wine, tint: "var(--color-chart-5)" },
  { id: "tax", name: "Tax", type: "expense", icon: Scale, tint: "var(--color-chart-2)" },
  { id: "credit-card", name: "Credit card", type: "expense", icon: CreditCard, tint: "var(--color-chart-3)" },
  { id: "debt", name: "Debt", type: "expense", icon: CircleDollarSign, tint: "var(--color-expense)" },
  { id: "investing", name: "Investing", type: "expense", icon: TrendingUp, tint: "var(--color-income)" },
  { id: "savings", name: "Savings", type: "expense", icon: Landmark, tint: "var(--color-income)" },
  { id: "transfer-out", name: "Transfer out", type: "expense", icon: ArrowLeftRight, tint: "var(--color-chart-3)" },
  { id: "other", name: "Other", type: "expense", icon: Sparkles, tint: "var(--color-chart-4)" },
];

let extras: CustomCategory[] = [];

export function setCustomCategories(list: CustomCategory[]) {
  extras = list;
}

export function customCategories() {
  return extras;
}

export function allCategories(): Category[] {
  const extraCats: Category[] = extras.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    icon: Tag,
    tint: c.type === "income" ? "var(--color-income)" : "var(--color-chart-3)",
  }));
  return [...CATEGORIES, ...extraCats];
}

export function getCategory(id: string) {
  return allCategories().find((c) => c.id === id) ?? CATEGORIES.find((c) => c.id === "other")!;
}

export function categoriesFor(type: TxType) {
  return allCategories().filter((c) => c.type === type);
}

export function isTransferCategory(id: string) {
  return id === "transfer-in" || id === "transfer-out";
}

export function isAllocationCategory(id: string) {
  return id === "investing" || id === "savings" || id === "credit-card" || id === "debt";
}

export function slugCategoryId(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  return slug ? `c-${slug}` : `c-${Math.random().toString(36).slice(2, 8)}`;
}

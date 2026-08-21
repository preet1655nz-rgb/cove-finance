import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid() {
  return crypto.randomUUID();
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return isoDate(dt);
}

export function startOfWeek(iso = todayISO()) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const mondayOffset = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - mondayOffset);
  return isoDate(dt);
}

export function endOfWeek(iso = todayISO()) {
  return addDays(startOfWeek(iso), 6);
}

export function addMonths(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + delta, Math.min(d, 28));
  return isoDate(dt);
}

export function startOfMonth(iso = todayISO()) {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso = todayISO()) {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${iso.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function inRange(iso: string, from: string, to: string) {
  return iso >= from && iso <= to;
}

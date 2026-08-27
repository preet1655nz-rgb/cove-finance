import { coveApiUrl } from "./site";

const ACCOUNTS_KEY = "cove-accounts-v1";
const SESSION_KEY = "cove-session-v1";
const ITERATIONS = 120_000;

export type CoveAccount = {
  id: string;
  email: string;
  name: string;
  gmail: boolean;
  createdAt: string;
};

export type CoveSession = {
  userId: string;
  email: string;
  name: string;
  gmail: boolean;
};

type AccountRow = CoveAccount & {
  passSalt: string;
  passHash: string;
  recoverySalt: string;
  recoveryHash: string;
};

function bufToHex(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBuf(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function derive(password: string, saltHex: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBuf(saltHex), iterations: ITERATIONS },
    key,
    256,
  );
  return bufToHex(bits);
}

function randomHex(bytes = 16) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return bufToHex(buf);
}

function readRows(): AccountRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AccountRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRows(rows: AccountRow[]) {
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(rows));
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isGmail(email: string) {
  return normalizeEmail(email).endsWith("@gmail.com") || normalizeEmail(email).endsWith("@googlemail.com");
}

export function readSession(): CoveSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as CoveSession;
    if (!s?.userId || !s?.email) return null;
    return s;
  } catch {
    return null;
  }
}

export function writeSession(session: CoveSession | null) {
  if (typeof window === "undefined") return;
  if (!session) window.localStorage.removeItem(SESSION_KEY);
  else window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("cove-session"));
}

export function ledgerStorageKey(userId?: string | null) {
  return userId ? `cove-finance-v3:${userId}` : "cove-finance-v3:guest";
}

export function listAccounts(): CoveAccount[] {
  return readRows().map(({ passHash, passSalt, recoveryHash, recoverySalt, ...pub }) => pub);
}

function publicSession(row: AccountRow): CoveSession {
  return { userId: row.id, email: row.email, name: row.name, gmail: row.gmail };
}

type CloudResult = {
  ok?: boolean;
  error?: string;
  session?: CoveSession;
  recoveryCode?: string;
  emailed?: boolean;
  resetUrl?: string;
  emailError?: string;
};

async function cloudAction(body: Record<string, unknown>): Promise<CloudResult | null> {
  try {
    const res = await fetch(coveApiUrl("/api/accounts"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as CloudResult;
    if (!res.ok && !data?.error) return { ok: false, error: "Cloud login failed" };
    return data;
  } catch {
    return null;
  }
}

function cacheSession(session: CoveSession) {
  writeSession(session);
  return session;
}

export async function createAccount(input: {
  email: string;
  name: string;
  password: string;
}): Promise<{ session: CoveSession; recoveryCode: string }> {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters");
  const cloud = await cloudAction({ action: "register", email, name: input.name, password: input.password });
  if (cloud?.ok && cloud.session) {
    return { session: cacheSession(cloud.session), recoveryCode: cloud.recoveryCode || "" };
  }
  if (cloud && cloud.error && !/not configured/i.test(cloud.error || "")) {
    throw new Error(cloud.error);
  }
  const rows = readRows();
  if (rows.some((r) => r.email === email)) throw new Error("An account with that email already exists");
  const passSalt = randomHex();
  const recoverySalt = randomHex();
  const recoveryCode = randomHex(10).slice(0, 20);
  const row: AccountRow = {
    id: randomHex(12),
    email,
    name: input.name.trim() || email.split("@")[0],
    gmail: isGmail(email),
    createdAt: new Date().toISOString(),
    passSalt,
    passHash: await derive(input.password, passSalt),
    recoverySalt,
    recoveryHash: await derive(recoveryCode.toLowerCase(), recoverySalt),
  };
  writeRows([...rows, row]);
  return { session: cacheSession(publicSession(row)), recoveryCode };
}

export async function signInAccount(email: string, password: string): Promise<CoveSession> {
  const key = normalizeEmail(email);
  const cloud = await cloudAction({ action: "login", email: key, password });
  if (cloud?.ok && cloud.session) return cacheSession(cloud.session);
  const row = readRows().find((r) => r.email === key);
  if (!row) throw new Error(cloud?.error || "No account for that email on this device. Sign in once on the website, or create the account again here.");
  const hash = await derive(password, row.passSalt);
  if (hash !== row.passHash) throw new Error("Wrong password");
  const session = cacheSession(publicSession(row));
  void cloudAction({ action: "sync", email: key, name: row.name, password });
  return session;
}

export async function requestPasswordReset(email: string) {
  const key = normalizeEmail(email);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const cloud = await cloudAction({ action: "forgot", email: key, origin });
  if (!cloud) throw new Error("Could not reach Cove to start a reset");
  if (cloud.error && !cloud.resetUrl) throw new Error(cloud.error);
  return {
    emailed: Boolean(cloud.emailed),
    resetUrl: cloud.resetUrl,
    emailError: cloud.emailError,
  };
}

export async function resetPasswordWithToken(email: string, token: string, nextPassword: string): Promise<CoveSession> {
  const cloud = await cloudAction({ action: "reset", email, token, password: nextPassword });
  if (cloud?.ok && cloud.session) return cacheSession(cloud.session);
  throw new Error(cloud?.error || "Reset link expired or invalid");
}

export async function adoptOauthAccount(email: string, name?: string): Promise<CoveSession> {
  const key = normalizeEmail(email);
  const cloud = await cloudAction({ action: "oauth", email: key, name });
  if (cloud?.ok && cloud.session) return cacheSession(cloud.session);
  const existing = readRows().find((r) => r.email === key);
  if (existing) return cacheSession(publicSession(existing));
  const passSalt = randomHex();
  const recoverySalt = randomHex();
  const row: AccountRow = {
    id: randomHex(12),
    email: key,
    name: (name || "").trim() || key.split("@")[0],
    gmail: true,
    createdAt: new Date().toISOString(),
    passSalt,
    passHash: await derive(randomHex(12), passSalt),
    recoverySalt,
    recoveryHash: await derive(randomHex(10), recoverySalt),
  };
  writeRows([...readRows(), row]);
  return cacheSession(publicSession(row));
}

export async function resetPassword(email: string, recoveryCode: string, nextPassword: string): Promise<CoveSession> {
  if (nextPassword.length < 8) throw new Error("Password must be at least 8 characters");
  const key = normalizeEmail(email);
  const rows = readRows();
  const idx = rows.findIndex((r) => r.email === key);
  if (idx < 0) throw new Error("No account for that email on this device. Use the emailed reset link instead.");
  const row = rows[idx];
  const ok = (await derive(recoveryCode.trim().toLowerCase(), row.recoverySalt)) === row.recoveryHash;
  if (!ok) throw new Error("Recovery code does not match");
  const passSalt = randomHex();
  rows[idx] = { ...row, passSalt, passHash: await derive(nextPassword, passSalt) };
  writeRows(rows);
  const session = cacheSession(publicSession(rows[idx]));
  void cloudAction({ action: "sync", email: key, name: row.name, password: nextPassword });
  return session;
}

export function signOutAccount() {
  writeSession(null);
}

export const ACCOUNT_STORAGE_KEYS = [ACCOUNTS_KEY, SESSION_KEY] as const;

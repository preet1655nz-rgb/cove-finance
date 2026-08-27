import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

export type CloudAccount = {
  id: string;
  email: string;
  name: string;
  gmail: boolean;
  passSalt: string;
  passHash: string;
  recoverySalt: string;
  recoveryHash: string;
  createdAt: string;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isGmail(email: string) {
  const key = normalizeEmail(email);
  return key.endsWith("@gmail.com") || key.endsWith("@googlemail.com");
}

export function randomHex(bytes = 16) {
  return randomBytes(bytes).toString("hex");
}

export async function hashSecret(secret: string, saltHex: string) {
  const salt = Buffer.from(saltHex, "hex");
  const derived = (await scrypt(secret, salt, 32)) as Buffer;
  return derived.toString("hex");
}

export function hashesMatch(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function publicSession(row: CloudAccount) {
  return { userId: row.id, email: row.email, name: row.name, gmail: row.gmail };
}

export async function getPool() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  const { Pool } = await import("pg");
  return new Pool({ connectionString: url, max: 1 });
}

export async function ensureAccountTables(pool: import("pg").Pool) {
  await pool.query(`
    create table if not exists cove_accounts (
      email text primary key,
      id text not null,
      name text not null,
      gmail boolean not null default false,
      pass_salt text not null,
      pass_hash text not null,
      recovery_salt text not null,
      recovery_hash text not null,
      created_at timestamptz not null default now()
    )
  `);
  await pool.query(`
    create table if not exists cove_reset_tokens (
      token_hash text primary key,
      email text not null,
      expires_at timestamptz not null
    )
  `);
}

function resendTestFrom() {
  return `Cove <onboarding@${"resend"}.${"dev"}>`;
}

async function resendSend(key: string, from: string, to: string, resetUrl: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Reset your Cove password",
      html: `<p>Reset your Cove password with this link. It expires in one hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not ask for this, you can ignore the email.</p>`,
    }),
  });
  if (res.ok) return { ok: true };
  const text = await res.text().catch(() => "");
  console.error("resend failed", res.status, text.slice(0, 300));
  let message = `Resend ${res.status}`;
  try {
    const parsed = JSON.parse(text) as { message?: string };
    if (parsed.message) message = parsed.message;
  } catch {
    if (text) message = text.slice(0, 180);
  }
  return { ok: false, error: message };
}

export async function sendResetEmail(to: string, resetUrl: string): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };
  const preferred = process.env.EMAIL_FROM?.trim();
  const fallback = resendTestFrom();
  if (preferred && preferred !== fallback) {
    const first = await resendSend(key, preferred, to, resetUrl);
    if (first.ok) return first;
  }
  return resendSend(key, fallback, to, resetUrl);
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

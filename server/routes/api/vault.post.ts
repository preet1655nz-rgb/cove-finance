import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { handlePreflight } from "../../lib/cove-cors";

function txCount(payload: unknown) {
  if (!payload || typeof payload !== "object") return 0;
  const txs = (payload as { transactions?: unknown }).transactions;
  return Array.isArray(txs) ? txs.length : 0;
}

async function writeVault(email: string, payload: unknown) {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return { source: "local" as const };
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query(
      "create table if not exists cove_vault (email text primary key, payload jsonb not null, updated_at timestamptz not null default now())",
    );
    const existing = await pool.query("select payload from cove_vault where email = $1", [email]);
    const prev = existing.rows[0]?.payload;
    const incomingEmpty = txCount(payload) === 0;
    const prevCount = txCount(prev);
    if (incomingEmpty && prevCount > 0) {
      return { source: "cloud" as const, kept: true, transactions: prevCount };
    }
    await pool.query(
      "insert into cove_vault (email, payload, updated_at) values ($1, $2::jsonb, now()) on conflict (email) do update set payload = excluded.payload, updated_at = now()",
      [email, JSON.stringify(payload)],
    );
    return { source: "cloud" as const, kept: false, transactions: txCount(payload) };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export default defineEventHandler(async (event) => {
  if (handlePreflight(event)) return "";
  const body = await readBody<{ email?: string; payload?: unknown }>(event);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email || body?.payload == null) {
    setResponseStatus(event, 400);
    return { error: "email and payload required" };
  }
  try {
    return { ok: true, ...(await writeVault(email, body.payload)) };
  } catch (err) {
    return { ok: false, source: "local", error: err instanceof Error ? err.message : "vault write failed" };
  }
});

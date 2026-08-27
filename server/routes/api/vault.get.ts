import { defineEventHandler, getQuery, setResponseStatus } from "h3";

async function readVault(email: string) {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return { source: "local" as const, row: null };
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query(
      "create table if not exists cove_vault (email text primary key, payload jsonb not null, updated_at timestamptz not null default now())",
    );
    const rows = await pool.query("select payload, updated_at from cove_vault where email = $1", [email]);
    return { source: "cloud" as const, row: rows.rows[0] ?? null };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export default defineEventHandler(async (event) => {
  const email = String(getQuery(event).email || "").trim().toLowerCase();
  if (!email) {
    setResponseStatus(event, 400);
    return { error: "email required" };
  }
  try {
    return { ok: true, ...(await readVault(email)) };
  } catch (err) {
    return { ok: false, source: "local", row: null, error: err instanceof Error ? err.message : "vault read failed" };
  }
});

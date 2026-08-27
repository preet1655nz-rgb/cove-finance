import { getSql } from "../../../src/lib/db";

async function ensureVault(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql.query(
    "create table if not exists cove_vault (email text primary key, payload jsonb not null, updated_at timestamptz not null default now())",
  );
}

export default defineEventHandler(async (event) => {
  const email = String(getQuery(event).email || "").trim().toLowerCase();
  if (!email) {
    setResponseStatus(event, 400);
    return { error: "email required" };
  }
  try {
    const sql = await getSql();
    await ensureVault(sql);
    const rows = await sql.query<{ payload: unknown; updated_at: string }>(
      "select payload, updated_at from cove_vault where email = $1",
      [email],
    );
    return { ok: true, source: process.env.DATABASE_URL ? "cloud" : "ephemeral", row: rows[0] ?? null };
  } catch (err) {
    setResponseStatus(event, 500);
    return { error: err instanceof Error ? err.message : "vault read failed" };
  }
});

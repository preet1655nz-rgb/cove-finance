import { getSql } from "../../../src/lib/db";

async function ensureVault(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql.query(
    "create table if not exists cove_vault (email text primary key, payload jsonb not null, updated_at timestamptz not null default now())",
  );
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string; payload?: unknown }>(event);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email || body?.payload == null) {
    setResponseStatus(event, 400);
    return { error: "email and payload required" };
  }
  try {
    const sql = await getSql();
    await ensureVault(sql);
    await sql.query(
      "insert into cove_vault (email, payload, updated_at) values ($1, $2::jsonb, now()) on conflict (email) do update set payload = excluded.payload, updated_at = now()",
      [email, JSON.stringify(body.payload)],
    );
    return { ok: true };
  } catch (err) {
    setResponseStatus(event, 500);
    return { error: err instanceof Error ? err.message : "vault write failed" };
  }
});

import {
  ensureAccountTables,
  getPool,
  hashSecret,
  hashesMatch,
  isGmail,
  normalizeEmail,
  publicSession,
  randomHex,
  sendResetEmail,
  tokenHash,
  type CloudAccount,
} from "../../lib/cove-auth";

type Body = {
  action?: string;
  email?: string;
  name?: string;
  password?: string;
  token?: string;
  origin?: string;
};

function rowFromDb(r: Record<string, unknown>): CloudAccount {
  return {
    id: String(r.id),
    email: String(r.email),
    name: String(r.name),
    gmail: Boolean(r.gmail),
    passSalt: String(r.pass_salt),
    passHash: String(r.pass_hash),
    recoverySalt: String(r.recovery_salt),
    recoveryHash: String(r.recovery_hash),
    createdAt: String(r.created_at ?? new Date().toISOString()),
  };
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<Body>(event)) ?? {};
  const action = String(body.action || "login");
  const email = normalizeEmail(String(body.email || ""));
  const pool = await getPool();
  if (!pool) {
    setResponseStatus(event, 503);
    return { ok: false, error: "Cloud login is not configured yet (DATABASE_URL)." };
  }

  try {
    await ensureAccountTables(pool);

    if (action === "register" || action === "sync") {
      if (!email || !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(email)) {
        setResponseStatus(event, 400);
        return { ok: false, error: "Enter a valid email" };
      }
      const password = String(body.password || "");
      if (password.length < 8) {
        setResponseStatus(event, 400);
        return { ok: false, error: "Password must be at least 8 characters" };
      }
      const existing = await pool.query("select * from cove_accounts where email = $1", [email]);
      if (existing.rows[0] && action === "register") {
        setResponseStatus(event, 409);
        return { ok: false, error: "An account with that email already exists" };
      }
      const passSalt = randomHex();
      const recoverySalt = randomHex();
      const recoveryCode = randomHex(10).slice(0, 20);
      const row: CloudAccount = existing.rows[0]
        ? {
            ...rowFromDb(existing.rows[0]),
            name: String(body.name || existing.rows[0].name || email.split("@")[0]),
            passSalt,
            passHash: await hashSecret(password, passSalt),
          }
        : {
            id: randomHex(12),
            email,
            name: String(body.name || "").trim() || email.split("@")[0],
            gmail: isGmail(email),
            createdAt: new Date().toISOString(),
            passSalt,
            passHash: await hashSecret(password, passSalt),
            recoverySalt,
            recoveryHash: await hashSecret(recoveryCode.toLowerCase(), recoverySalt),
          };
      await pool.query(
        `insert into cove_accounts (email, id, name, gmail, pass_salt, pass_hash, recovery_salt, recovery_hash, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,now())
         on conflict (email) do update set
           name = excluded.name,
           pass_salt = excluded.pass_salt,
           pass_hash = excluded.pass_hash`,
        [row.email, row.id, row.name, row.gmail, row.passSalt, row.passHash, row.recoverySalt, row.recoveryHash],
      );
      return {
        ok: true,
        session: publicSession(row),
        recoveryCode: existing.rows[0] ? undefined : recoveryCode,
      };
    }

    if (action === "login") {
      const password = String(body.password || "");
      const found = await pool.query("select * from cove_accounts where email = $1", [email]);
      const raw = found.rows[0];
      if (!raw) {
        setResponseStatus(event, 401);
        return { ok: false, error: "No account for that email" };
      }
      const row = rowFromDb(raw);
      const hash = await hashSecret(password, row.passSalt);
      if (!hashesMatch(hash, row.passHash)) {
        setResponseStatus(event, 401);
        return { ok: false, error: "Wrong password" };
      }
      return { ok: true, session: publicSession(row) };
    }

    if (action === "oauth") {
      if (!email) {
        setResponseStatus(event, 400);
        return { ok: false, error: "Email required" };
      }
      const found = await pool.query("select * from cove_accounts where email = $1", [email]);
      if (found.rows[0]) return { ok: true, session: publicSession(rowFromDb(found.rows[0])) };
      const passSalt = randomHex();
      const recoverySalt = randomHex();
      const recoveryCode = randomHex(10).slice(0, 20);
      const row: CloudAccount = {
        id: randomHex(12),
        email,
        name: String(body.name || "").trim() || email.split("@")[0],
        gmail: true,
        createdAt: new Date().toISOString(),
        passSalt,
        passHash: await hashSecret(randomHex(24), passSalt),
        recoverySalt,
        recoveryHash: await hashSecret(recoveryCode.toLowerCase(), recoverySalt),
      };
      await pool.query(
        `insert into cove_accounts (email, id, name, gmail, pass_salt, pass_hash, recovery_salt, recovery_hash, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
        [row.email, row.id, row.name, row.gmail, row.passSalt, row.passHash, row.recoverySalt, row.recoveryHash],
      );
      return { ok: true, session: publicSession(row), recoveryCode };
    }

    if (action === "forgot") {
      const found = await pool.query("select email from cove_accounts where email = $1", [email]);
      if (!found.rows[0]) return { ok: true, emailed: false };
      const token = randomHex(24);
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await pool.query("insert into cove_reset_tokens (token_hash, email, expires_at) values ($1,$2,$3)", [
        tokenHash(token),
        email,
        expires,
      ]);
      const origin = String(body.origin || process.env.BETTER_AUTH_URL || "https://cove-finance.vercel.app").replace(/\/$/, "");
      const resetUrl = `${origin}/reset?email=${encodeURIComponent(email)}&token=${token}`;
      const emailed = await sendResetEmail(email, resetUrl).catch(() => false);
      return { ok: true, emailed, resetUrl: emailed ? undefined : resetUrl };
    }

    if (action === "reset") {
      const password = String(body.password || "");
      const token = String(body.token || "");
      if (password.length < 8) {
        setResponseStatus(event, 400);
        return { ok: false, error: "Password must be at least 8 characters" };
      }
      const hit = await pool.query(
        "select email from cove_reset_tokens where token_hash = $1 and expires_at > now()",
        [tokenHash(token)],
      );
      const target = String(hit.rows[0]?.email || "");
      if (!target || (email && target !== email)) {
        setResponseStatus(event, 401);
        return { ok: false, error: "Reset link expired or invalid" };
      }
      const passSalt = randomHex();
      const passHash = await hashSecret(password, passSalt);
      await pool.query("update cove_accounts set pass_salt = $1, pass_hash = $2 where email = $3", [passSalt, passHash, target]);
      await pool.query("delete from cove_reset_tokens where email = $1", [target]);
      const found = await pool.query("select * from cove_accounts where email = $1", [target]);
      return { ok: true, session: publicSession(rowFromDb(found.rows[0])) };
    }

    setResponseStatus(event, 400);
    return { ok: false, error: "Unknown action" };
  } catch (err) {
    setResponseStatus(event, 500);
    return { ok: false, error: err instanceof Error ? err.message : "Account request failed" };
  } finally {
    await pool.end().catch(() => undefined);
  }
});

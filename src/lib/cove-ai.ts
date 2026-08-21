import { createServerFn } from "@tanstack/react-start";
import { NZ_KNOWLEDGE } from "./nz-finance";
import type { CoveAction, CoveSnapshot } from "./cove-expert";
import { formatSnapshotBrief } from "./cove-expert";

export type AskCoveInput = {
  message: string;
  history: { role: "user" | "cove"; text: string }[];
  snapshot: CoveSnapshot;
};

export type AskCoveOutput =
  | { ok: true; reply: string; actions: CoveAction[] }
  | { ok: false; error: string };

const ACTION_TYPES = new Set([
  "add_rule",
  "forget_rule",
  "add_transaction",
  "update_amount",
  "retag",
  "delete_matching",
  "set_budget",
  "remove_budget",
  "upsert_bill",
  "remove_bill",
  "upsert_account",
  "rename_account",
  "set_currency",
  "remember",
]);

function extractJson(raw: string): { reply?: string; actions?: unknown } | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as { reply?: string; actions?: unknown };
  } catch {
    return null;
  }
}

function sanitizeActions(raw: unknown): CoveAction[] {
  if (!Array.isArray(raw)) return [];
  const out: CoveAction[] = [];
  for (const item of raw.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const type = String((item as { type?: string }).type ?? "");
    if (!ACTION_TYPES.has(type)) continue;
    out.push(item as CoveAction);
  }
  return out;
}

export const askCoveExpert = createServerFn({ method: "POST" })
  .validator((input: AskCoveInput) => input)
  .handler(async ({ data }): Promise<AskCoveOutput> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "AI is not available" };

    const brief = formatSnapshotBrief(data.snapshot);
    const snapshotJson = JSON.stringify(data.snapshot);
    const history = data.history.slice(-8).map((m) => ({
      role: m.role === "cove" ? ("assistant" as const) : ("user" as const),
      content: m.text.slice(0, 1200),
    }));

    const system = `You are Cove, a world-class personal-finance expert inside a New Zealand household ledger app.
You see the user's REAL books in LEDGER_JSON. Never invent balances, payees, or amounts that are not there. If a figure is missing, say you don't have it and suggest uploading that bank's statement.
When you quote money, copy the snapshot numbers (or clearly derived totals from them).
Transfers between the user's own accounts are not spending.
${NZ_KNOWLEDGE}

You MAY change the app by returning actions. Only emit an action when the user asked for a change (retag, budget, add entry, remember a fact, rename account, add bill). Never delete lots of data. Never emit clear-all. Never invent transaction ids that are not in recent[].
Action types and fields:
add_rule {pattern, kind: "category"|"transfer", categoryId?, accountName?}
forget_rule {pattern}
add_transaction {txType:"income"|"expense", amount, categoryId, note, date?}
update_amount {id, amount}
retag {pattern, categoryId}
delete_matching {pattern}  // only if user asked to delete, pattern min 3 chars
set_budget {categoryId, amount}
remove_budget {categoryId}
upsert_bill {name, amount, categoryId, dayOfMonth}
remove_bill {name}
upsert_account {name, bank?}
rename_account {from, to}
set_currency {code}
remember {fact}

categoryId must be one of: salary, freelance, investments, gifts, other-income, transfer-in, housing, groceries, dining, transport, utilities, health, entertainment, shopping, subscriptions, travel, education, drinks, tax, investing, savings, transfer-out, other.

Reply in concise, calm English. Use NZD wording when currency is NZD. You can use short bullet points.
Return ONLY JSON: {"reply":"markdown-ish text","actions":[]}`;

    const user = `LEDGER_BRIEF:\n${brief}\n\nLEDGER_JSON:\n${snapshotJson.slice(0, 14000)}\n\nUSER:\n${data.message.slice(0, 2000)}`;

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.2,
          max_tokens: 900,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, ...history, { role: "user", content: user }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return { ok: false, error: `xAI API error ${res.status}${errText ? `: ${errText.slice(0, 180)}` : ""}` };
      }
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content ?? "";
      const parsed = extractJson(content);
      const reply = (parsed?.reply || content || "").trim();
      if (!reply) return { ok: false, error: "Empty model reply" };
      return { ok: true, reply: reply.slice(0, 4000), actions: sanitizeActions(parsed?.actions) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error" };
    }
  });

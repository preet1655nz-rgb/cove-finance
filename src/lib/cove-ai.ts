import { createServerFn } from "@tanstack/react-start";

const SYSTEM = `You are Cove, the built-in analyst for a New Zealand household ledger.
Rules:
- Use ONLY the ledger snapshot, remembered facts, and chat history. Never invent dates, amounts, or payees.
- Be specific: name payees, cite dollars, compare months, flag repeats vs one-offs, and point at leaks (dining, cafés, shopping, unused subs).
- Treat remembered facts and classification rules as lessons this person already taught you. Prefer them over generic advice.
- If they want to add/edit/delete an entry, do not pretend you posted it — the app handles that. If a date is missing, ask for it.
- NZ English, under 180 words, no preamble. Do not mention APIs, models, or Grok.
- If the books are empty, say so and offer “add uber income $400” or a statement upload.`;

export const askGrokAboutBooks = createServerFn({ method: "POST" })
  .validator((input: { question: string; snapshot: string; history: { role: string; text: string }[] }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "unavailable" };

    const history = (data.history ?? []).slice(-16).map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: String(m.text ?? "").slice(0, 900),
    }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
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
          max_tokens: 420,
          messages: [
            { role: "system", content: SYSTEM },
            ...history,
            {
              role: "user",
              content: `LEDGER (source of truth, JSON):\n${data.snapshot.slice(0, 8000)}\n\nQUESTION:\n${data.question.slice(0, 600)}`,
            },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) return { ok: false as const, error: `xAI ${res.status}` };
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) return { ok: false as const, error: "empty" };
      return { ok: true as const, text };
    } catch {
      return { ok: false as const, error: "timeout" };
    } finally {
      clearTimeout(timer);
    }
  });

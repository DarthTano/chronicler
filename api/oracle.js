// Secure AI backend for Chronicler's "Ask your world" oracle.
//
// Vercel Serverless Function, ANTHROPIC_API_KEY server-side only. A fast,
// at-the-table improv assistant grounded in the campaign setting. Unlike the
// other generators this returns FREEFORM text (no structured schema), and
// carries a little recent Q&A history for natural follow-ups.
//
// Input  (POST JSON): { setting?, question, history?: [{q,a}] }
// Output (JSON):      { answer: string }

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8";

export async function askOracle({ setting, question, history, apiKey } = {}) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const err = new Error("ANTHROPIC_API_KEY is not set on the server.");
    err.statusCode = 500;
    throw err;
  }

  const client = new Anthropic({ apiKey: key });

  const system = [
    "You are the DM's improv oracle for a Dungeons & Dragons 5e campaign — a fast, in-the-moment assistant at the table.",
    "Answer the DM's question concretely and on-theme, grounded in the campaign setting below.",
    "Invent specific details (names, places, motives) that stay consistent with the world.",
    "Keep it tight and usable: a few sentences, or a numbered list when asked for multiples.",
    "No preamble, no meta-commentary — just the answer the DM can use right now.",
    "",
    "── CAMPAIGN SETTING ──",
    setting?.trim() ? setting.trim() : "(No setting written yet — improvise evocative high-fantasy that you keep internally consistent.)",
  ].join("\n");

  const messages = [];
  (history || []).slice(-6).forEach(({ q, a }) => {
    if (q) messages.push({ role: "user", content: String(q) });
    if (a) messages.push({ role: "assistant", content: String(a) });
  });
  messages.push({ role: "user", content: question?.trim() || "Give me something interesting that's happening in the world right now." });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    thinking: { type: "adaptive" },
    system,
    messages,
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock) {
    const err = new Error("Model returned no text content.");
    err.statusCode = 502;
    throw err;
  }
  return textBlock.text;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) return JSON.parse(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { setting, question, history } = await readBody(req);
    const answer = await askOracle({ setting, question, history });
    res.status(200).json({ answer });
  } catch (err) {
    const status = err.statusCode || (err.status ?? 500);
    res.status(status).json({ error: err.message || "Generation failed." });
  }
}

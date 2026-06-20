// Secure AI backend for Chronicler's session planner.
//
// Same security model as the other /api functions: Vercel Serverless Function,
// reads ANTHROPIC_API_KEY server-side only. Drafts a runnable next-session plan
// grounded in the campaign world, party, and the DM's focus.
//
// Input  (POST JSON): { setting?, party?, focus?, recap? }
// Output (JSON):      { plan: { title, recap, beats[], encounters[], npcs[], hooks_forward[] } }

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8";

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "A short, evocative title for this session." },
    recap: { type: "string", description: "A 1–2 sentence 'previously / where we left off' hook to open the session with." },
    beats: {
      type: "array",
      description: "3–5 scenes or story beats, in play order, each with enough detail to improvise from.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { title: { type: "string" }, description: { type: "string" } },
        required: ["title", "description"],
      },
    },
    encounters: { type: "array", description: "1–3 possible encounters (combat, social, or environmental) as brief one-liners.", items: { type: "string" } },
    npcs: { type: "array", description: "NPCs likely to appear — name + a few words on their role this session.", items: { type: "string" } },
    hooks_forward: { type: "array", description: "2–3 threads or cliffhangers to seed for next time.", items: { type: "string" } },
  },
  required: ["title", "recap", "beats", "encounters", "npcs", "hooks_forward"],
};

function systemPrompt() {
  return [
    "You are a Dungeons & Dragons 5e session-prep assistant for a DM.",
    "Plan the next session: grounded in the campaign setting and party, and steered by the DM's focus.",
    "Produce a runnable plan — an opening recap hook, 3–5 scenes/beats with room to improvise, a few possible",
    "encounters, NPCs likely to appear, and threads to seed for next time. Practical and evocative, not an essay.",
    "Use names, factions, and places from the provided setting when they fit. Don't railroad — give the DM options.",
    "If the DM has saved NPCs or encounters, prefer weaving those in by name over inventing new ones — only add new ones when the focus calls for it.",
  ].join("\n");
}

function userPrompt({ setting, party, focus, recap, roster }) {
  const parts = [];
  parts.push("── CAMPAIGN SETTING ──", setting?.trim() ? setting.trim() : "(No setting bible written yet — keep it generically high-fantasy.)");
  if (party?.trim()) parts.push("", "── PARTY ──", party.trim());
  if (roster?.trim()) parts.push("", "── SAVED NPCS & ENCOUNTERS (reuse these by name when they fit; invent new ones only when needed) ──", roster.trim());
  if (recap?.trim()) parts.push("", "── WHAT HAPPENED LAST SESSION ──", recap.trim());
  parts.push("", "── THIS SESSION'S FOCUS ──", focus?.trim() ? focus.trim() : "(No specific focus — advance the story naturally from where things stand.)");
  parts.push("", "Produce the session plan now.");
  return parts.join("\n");
}

export async function generateSessionPlan({ setting, party, focus, recap, roster, apiKey } = {}) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const err = new Error("ANTHROPIC_API_KEY is not set on the server.");
    err.statusCode = 500;
    throw err;
  }

  const client = new Anthropic({ apiKey: key });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: systemPrompt(),
    messages: [{ role: "user", content: userPrompt({ setting, party, focus, recap, roster }) }],
    output_config: { format: { type: "json_schema", schema: PLAN_SCHEMA } },
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock) {
    const err = new Error("Model returned no text content.");
    err.statusCode = 502;
    throw err;
  }
  return JSON.parse(textBlock.text);
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
    const { setting, party, focus, recap } = await readBody(req);
    const plan = await generateSessionPlan({ setting, party, focus, recap });
    res.status(200).json({ plan });
  } catch (err) {
    const status = err.statusCode || (err.status ?? 500);
    res.status(status).json({ error: err.message || "Generation failed." });
  }
}

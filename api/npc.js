// Secure AI backend for Chronicler's NPC studio.
//
// Vercel Serverless Function, ANTHROPIC_API_KEY server-side only. Creates a
// vivid, runnable NPC grounded in the campaign setting.
//
// Input  (POST JSON): { setting?, role?, focus? }
// Output (JSON):      { npc: {...} }

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8";

const NPC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    role: { type: "string", description: "Their role, title, or occupation." },
    appearance: { type: "string", description: "A vivid physical sketch — 1–2 sentences." },
    personality: { type: "string", description: "Demeanor and a couple of defining traits." },
    voice: { type: "string", description: "A distinctive voice, speech quirk, or mannerism the DM can perform." },
    secret: { type: "string", description: "Something they hide — a lever for the DM." },
    motivation: { type: "string", description: "What they want, and why." },
    hook: { type: "string", description: "How they could pull the party into the story." },
    statblock: { type: "string", description: 'A suggested SRD stat block to run them with if they fight, e.g. "Commoner", "Cult Fanatic", "Veteran" — or "Noncombatant" if they wouldn\'t.' },
  },
  required: ["name", "role", "appearance", "personality", "voice", "secret", "motivation", "hook", "statblock"],
};

function systemPrompt() {
  return [
    "You are an NPC designer for a Dungeons & Dragons 5e campaign.",
    "Create one vivid, immediately usable NPC grounded in the setting.",
    "Give a memorable name, a sharp appearance, a personality with a couple of defining traits, a distinctive voice/mannerism",
    "the DM can perform, a secret, a clear motivation, a hook that involves the party, and a suggested SRD stat block.",
    "Tie them to the setting's factions, places, and tensions when it fits. Be specific and characterful, not generic.",
  ].join("\n");
}

function userPrompt({ setting, role, focus }) {
  const parts = [];
  parts.push("── SETTING ──", setting?.trim() ? setting.trim() : "(No setting bible — keep it generically high-fantasy.)");
  if (role?.trim()) parts.push("", `Role / archetype: ${role.trim()}.`);
  if (focus?.trim()) parts.push("", `Extra direction: ${focus.trim()}.`);
  if (!role?.trim() && !focus?.trim()) parts.push("", "No specific brief — invent someone distinctive who fits the setting and could matter to the party.");
  parts.push("", "Create the NPC now.");
  return parts.join("\n");
}

export async function generateNpc({ setting, role, focus, apiKey } = {}) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const err = new Error("ANTHROPIC_API_KEY is not set on the server.");
    err.statusCode = 500;
    throw err;
  }

  const client = new Anthropic({ apiKey: key });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    thinking: { type: "adaptive" },
    system: systemPrompt(),
    messages: [{ role: "user", content: userPrompt({ setting, role, focus }) }],
    output_config: { format: { type: "json_schema", schema: NPC_SCHEMA } },
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
    const { setting, role, focus } = await readBody(req);
    const npc = await generateNpc({ setting, role, focus });
    res.status(200).json({ npc });
  } catch (err) {
    const status = err.statusCode || (err.status ?? 500);
    res.status(status).json({ error: err.message || "Generation failed." });
  }
}

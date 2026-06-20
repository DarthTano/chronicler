// Secure AI backend for Chronicler's encounter creator.
//
// Vercel Serverless Function, ANTHROPIC_API_KEY server-side only. Designs a
// single encounter (combat / social / exploration) balanced to the party and
// themed to the campaign setting.
//
// Input  (POST JSON): { setting?, party?, type?, difficulty?, focus? }
// Output (JSON):      { encounter: {...} }

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8";

const ENCOUNTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    type: { type: "string", enum: ["combat", "social", "exploration"] },
    difficulty: { type: "string", enum: ["easy", "medium", "hard", "deadly"] },
    summary: { type: "string", description: "1–2 sentence setup the DM reads to frame the scene." },
    setup: { type: "string", description: "How the encounter begins and what the party perceives." },
    enemies: {
      type: "array",
      description: "Combat foes, or for social/exploration the key opponents/obstacles. May be empty.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          count: { type: "string", description: 'How many, e.g. "1", "3", or "1d4+1".' },
          role: { type: "string", description: 'Tactical role, e.g. "brute", "skirmisher", "controller", "leader".' },
          tactics: { type: "string", description: "How it fights/behaves." },
        },
        required: ["name", "count", "role", "tactics"],
      },
    },
    features: { type: "array", description: "Notable terrain, environmental, or social levers in play.", items: { type: "string" } },
    twist: { type: "string", description: "A complication or surprise that can escalate or change the scene." },
    rewards: { type: "string", description: "Loot, information, or story rewards on success." },
  },
  required: ["title", "type", "difficulty", "summary", "setup", "enemies", "features", "twist", "rewards"],
};

function systemPrompt() {
  return [
    "You are a Dungeons & Dragons 5e encounter designer building for a specific party.",
    "Design ONE encounter, balanced to the requested difficulty for the party's size and level, themed to the setting.",
    "For combat: give enemies with counts, tactical roles, and tactics, plus terrain features and a twist.",
    "For social or exploration: adapt — 'enemies' becomes key NPCs/obstacles (or empty), 'features' the levers and stakes.",
    "Use names, factions, and places from the setting when they fit. Keep it concrete and runnable at the table.",
  ].join("\n");
}

function userPrompt({ setting, party, type, difficulty, focus, villain }) {
  const parts = [];
  parts.push("── SETTING ──", setting?.trim() ? setting.trim() : "(No setting bible — keep it generically high-fantasy.)");
  parts.push("", "── PARTY ──", party?.trim() ? party.trim() : "(Party unknown — assume four level-3 adventurers.)");
  if (villain?.trim()) parts.push("", "── LEAD ANTAGONIST (from the campaign — build the encounter around them as the driving foe; include them in the enemies) ──", villain.trim());
  parts.push("", `Encounter type: ${type && type !== "any" ? type : "your choice — pick what best fits the focus"}.`);
  parts.push(`Target difficulty: ${difficulty && difficulty !== "any" ? difficulty : "medium"}.`);
  if (focus?.trim()) parts.push(`Focus / prompt: ${focus.trim()}.`);
  parts.push("", "Design the encounter now.");
  return parts.join("\n");
}

export async function generateEncounter({ setting, party, type, difficulty, focus, villain, apiKey } = {}) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const err = new Error("ANTHROPIC_API_KEY is not set on the server.");
    err.statusCode = 500;
    throw err;
  }

  const client = new Anthropic({ apiKey: key });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 3500,
    thinking: { type: "adaptive" },
    system: systemPrompt(),
    messages: [{ role: "user", content: userPrompt({ setting, party, type, difficulty, focus, villain }) }],
    output_config: { format: { type: "json_schema", schema: ENCOUNTER_SCHEMA } },
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
    const { setting, party, type, difficulty, focus } = await readBody(req);
    const encounter = await generateEncounter({ setting, party, type, difficulty, focus });
    res.status(200).json({ encounter });
  } catch (err) {
    const status = err.statusCode || (err.status ?? 500);
    res.status(status).json({ error: err.message || "Generation failed." });
  }
}

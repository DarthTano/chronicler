// Secure AI backend for Chronicler's homebrew generator.
//
// Runs as a Vercel Serverless Function (Node runtime) so the Anthropic API key
// NEVER reaches the browser — it's read from the ANTHROPIC_API_KEY env var,
// set in Vercel project settings (and in local .env for `npm run dev`, where a
// Vite middleware in vite.config.js reuses generateHomebrewItem() below).
//
// Input  (POST JSON): { lore: string, kind?: string, request?: string }
// Output (JSON):      { item: { name, type, rarity, attunement, description,
//                                mechanics, lore_tie } }

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8";

// Structured-output schema — guarantees the model returns a parseable item.
// Strict mode requires additionalProperties:false and every key in `required`.
const ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", description: "Evocative item name, on-theme for the setting." },
    type: { type: "string", description: 'Item category, e.g. "Wondrous item", "Weapon (longsword)", "Armor (shield)", "Potion".' },
    rarity: { type: "string", enum: ["common", "uncommon", "rare", "very rare", "legendary"] },
    attunement: { type: "boolean", description: "Whether the item requires attunement." },
    description: { type: "string", description: "1–3 sentences of flavor that ground the item in the campaign's lore." },
    mechanics: { type: "string", description: "Concrete 5e rules text: bonuses, charges, activations, damage, etc. Keep it balanced for the stated rarity." },
    lore_tie: { type: "string", description: "One sentence naming exactly how this item connects to the supplied setting." },
  },
  required: ["name", "type", "rarity", "attunement", "description", "mechanics", "lore_tie"],
};

function systemPrompt(lore) {
  return [
    "You are a Dungeon Master's homebrew assistant for a Dungeons & Dragons 5e campaign.",
    "Invent a single magic item that feels native to THIS campaign's setting and lore.",
    "Honor the tone, factions, places, and motifs in the setting bible — reference them by name when it fits.",
    "Keep mechanics balanced and legal for the chosen rarity. Use SRD-style rules language.",
    "Do not copy named items from published books; create something original.",
    "",
    "── CAMPAIGN SETTING BIBLE ──",
    lore?.trim() ? lore.trim() : "(The DM has not written a setting bible yet. Invent something evocative and generically high-fantasy.)",
  ].join("\n");
}

function userPrompt({ kind, request }) {
  const parts = [];
  if (kind && kind !== "any") parts.push(`The item should be a ${kind}.`);
  if (request?.trim()) parts.push(`Additional direction from the DM: ${request.trim()}`);
  parts.push("Generate the item now.");
  return parts.join(" ");
}

// Shared core — callable from both the Vercel handler and the Vite dev shim.
// `apiKey` override lets the dev shim pass the key loaded from .env.
export async function generateHomebrewItem({ lore, kind, request, apiKey } = {}) {
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
    system: systemPrompt(lore),
    messages: [{ role: "user", content: userPrompt({ kind, request }) }],
    output_config: { format: { type: "json_schema", schema: ITEM_SCHEMA } },
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock) {
    const err = new Error("Model returned no text content.");
    err.statusCode = 502;
    throw err;
  }
  return JSON.parse(textBlock.text);
}

// Read and JSON-parse the request body. Vercel usually populates req.body, but
// fall back to reading the stream so the same handler works everywhere.
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) return JSON.parse(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

// Vercel Serverless Function entry point.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { lore, kind, request } = await readBody(req);
    const item = await generateHomebrewItem({ lore, kind, request });
    res.status(200).json({ item });
  } catch (err) {
    const status = err.statusCode || (err.status ?? 500);
    res.status(status).json({ error: err.message || "Generation failed." });
  }
}

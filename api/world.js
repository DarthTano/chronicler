// Secure AI backend for Chronicler's campaign world builder.
//
// Same security model as api/generate.js: runs as a Vercel Serverless Function,
// reads ANTHROPIC_API_KEY server-side only. Given a few seed inputs it drafts a
// structured setting bible (overview, factions, locations, NPCs, plot hooks)
// the DM can then edit.
//
// Input  (POST JSON): { genre?, tone?, seed?, name? }
// Output (JSON):      { world: { overview, factions[], locations[], npcs[], hooks[] } }

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8";

const namedEntry = (extra = {}) => ({
  type: "object",
  additionalProperties: false,
  properties: { name: { type: "string" }, ...extra, description: { type: "string" } },
  required: ["name", ...Object.keys(extra), "description"],
});

// Structured-output schema for a campaign world.
const WORLD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    overview: { type: "string", description: "2–4 sentences establishing the setting's premise, tone, and central tension." },
    factions: { type: "array", description: "3–4 factions, powers, or cultures in tension.", items: namedEntry() },
    locations: { type: "array", description: "3–4 evocative, named places.", items: namedEntry() },
    npcs: { type: "array", description: "3–4 notable named NPCs.", items: namedEntry({ role: { type: "string", description: "Their role or title, e.g. \"exiled high priest\"." } }) },
    hooks: { type: "array", description: "3–4 one-line adventure hooks to drop a party into.", items: { type: "string" } },
  },
  required: ["overview", "factions", "locations", "npcs", "hooks"],
};

function systemPrompt() {
  return [
    "You are a worldbuilding assistant for a Dungeons & Dragons 5e campaign.",
    "Draft an original, evocative campaign setting a DM could run from. Be specific and concrete:",
    "name factions, places, and people distinctly; give each a sharp identity and a hook for conflict.",
    "Favor fresh, characterful ideas over generic high-fantasy filler. Avoid copyrighted settings and named",
    "characters from published books. Keep entries tight — a sentence or three each, not essays.",
  ].join("\n");
}

function userPrompt({ genre, tone, seed, name }) {
  const parts = ["Build a campaign setting with the following direction:"];
  if (name?.trim()) parts.push(`Working title: ${name.trim()}.`);
  if (genre?.trim()) parts.push(`Genre / flavor: ${genre.trim()}.`);
  if (tone?.trim()) parts.push(`Tone: ${tone.trim()}.`);
  if (seed?.trim()) parts.push(`Seed idea to build around: ${seed.trim()}.`);
  if (parts.length === 1) parts.push("No specific direction given — invent something distinctive and surprising.");
  parts.push("Produce the overview, factions, locations, NPCs, and plot hooks now.");
  return parts.join(" ");
}

// Shared core — callable from the Vercel handler and the Vite dev shim.
export async function generateWorld({ genre, tone, seed, name, apiKey } = {}) {
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
    messages: [{ role: "user", content: userPrompt({ genre, tone, seed, name }) }],
    output_config: { format: { type: "json_schema", schema: WORLD_SCHEMA } },
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock) {
    const err = new Error("Model returned no text content.");
    err.statusCode = 502;
    throw err;
  }
  return JSON.parse(textBlock.text);
}

// Apply a natural-language change to an existing world and return the full
// updated world. Used by /api/refine.
export async function refineWorld({ world, instruction, apiKey } = {}) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const err = new Error("ANTHROPIC_API_KEY is not set on the server.");
    err.statusCode = 500;
    throw err;
  }

  const client = new Anthropic({ apiKey: key });

  const system = [
    "You are editing an existing Dungeons & Dragons 5e campaign world for its DM.",
    "Apply the DM's requested change, then return the COMPLETE updated world.",
    "Preserve everything the request does not touch — keep existing names, entries, ordering, and wording unless the change implies altering them.",
    "If the DM renames or reworks something, update other entries that reference it so the world stays consistent.",
    "Keep the same structure and quality bar: concrete, evocative, tight entries.",
  ].join("\n");

  const userMsg = [
    "Current world (JSON):",
    JSON.stringify(world ?? {}, null, 2),
    "",
    `Requested change: ${instruction?.trim() || "Improve and tighten the world without changing its core ideas."}`,
    "Return the full updated world.",
  ].join("\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: userMsg }],
    output_config: { format: { type: "json_schema", schema: WORLD_SCHEMA } },
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
    const { genre, tone, seed, name } = await readBody(req);
    const world = await generateWorld({ genre, tone, seed, name });
    res.status(200).json({ world });
  } catch (err) {
    const status = err.statusCode || (err.status ?? 500);
    res.status(status).json({ error: err.message || "Generation failed." });
  }
}

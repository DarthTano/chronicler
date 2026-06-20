// Client-side helper for the AI homebrew generator. Calls the secure backend
// at /api/generate (a Vercel serverless function in prod, a Vite middleware in
// dev). The Anthropic API key lives only on the server — never here.

// POST to one of the /api/* generators and return the named payload field.
async function callApi(path, body, outKey) {
  let res;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the AI service. Is the dev server running?");
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON response (e.g. an HTML error page) */
  }

  if (!res.ok) {
    throw new Error(payload?.error || `Generation failed (HTTP ${res.status}).`);
  }
  if (!payload?.[outKey]) {
    throw new Error("The AI returned an unexpected response.");
  }
  return payload[outKey];
}

export function generateHomebrewItem({ lore, kind, request }) {
  return callApi("/api/generate", { lore, kind, request }, "item");
}

export function generateWorld({ genre, tone, seed, name }) {
  return callApi("/api/world", { genre, tone, seed, name }, "world");
}

export function refineWorld({ world, instruction }) {
  return callApi("/api/refine", { world, instruction }, "world");
}

export function generateSessionPlan({ setting, party, focus, recap, roster }) {
  return callApi("/api/session", { setting, party, focus, recap, roster }, "plan");
}

export function generateEncounter({ setting, party, type, difficulty, focus, villain }) {
  return callApi("/api/encounter", { setting, party, type, difficulty, focus, villain }, "encounter");
}

export function generateNpc({ setting, role, focus }) {
  return callApi("/api/npc", { setting, role, focus }, "npc");
}

export function askOracle({ setting, question, history }) {
  return callApi("/api/oracle", { setting, question, history }, "answer");
}

// Format a party array into a short text block for AI context.
export function partyToText(party) {
  if (!Array.isArray(party) || !party.length) return "";
  return party.map((c) => {
    const bits = [c.race, c.class].filter(Boolean).join(" ");
    return `- ${c.name}${bits ? ` (${bits}${c.level ? ` ${c.level}` : ""})` : ""}`;
  }).join("\n");
}

// Flatten a structured world (+ optional free-text notes) into a single block of
// "setting bible" text — used as context for the homebrew item generator.
export function worldToText(world, notes) {
  const w = world || {};
  const lines = [];
  if (w.overview) lines.push(w.overview);
  const section = (title, items, fmt) => {
    if (Array.isArray(items) && items.length) {
      lines.push("", `${title}:`, ...items.map(fmt));
    }
  };
  section("Factions", w.factions, (f) => `- ${f.name}: ${f.description}`);
  section("Locations", w.locations, (l) => `- ${l.name}: ${l.description}`);
  section("Notable NPCs", w.npcs, (n) => `- ${n.name}${n.role ? ` (${n.role})` : ""}: ${n.description}`);
  section("Plot hooks", w.hooks, (h) => `- ${h}`);
  if (notes?.trim()) lines.push("", "DM notes:", notes.trim());
  return lines.join("\n").trim();
}

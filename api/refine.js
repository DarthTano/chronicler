// Vercel Serverless Function for /api/refine — applies a natural-language tweak
// to an existing campaign world. Shares the core (and WORLD_SCHEMA) with world.js.
//
// Input  (POST JSON): { world, instruction }
// Output (JSON):      { world: <full updated world> }

import { refineWorld } from "./world.js";

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
    const { world, instruction } = await readBody(req);
    const updated = await refineWorld({ world, instruction });
    res.status(200).json({ world: updated });
  } catch (err) {
    const status = err.statusCode || (err.status ?? 500);
    res.status(status).json({ error: err.message || "Refine failed." });
  }
}

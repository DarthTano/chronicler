import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Dev-only shim: Vercel serves files under /api as serverless functions in
// production, but `vite` doesn't. This middleware makes the POST /api/* routes
// work during `npm run dev` by reusing the same core the Vercel functions use.
// ANTHROPIC_API_KEY is read from .env here (server-side) and never shipped to
// the browser — it is NOT VITE_-prefixed, so it stays out of import.meta.env.
//
// Each route maps to { module, fn (exported core), out (response key) }.
const API_ROUTES = {
  "/api/generate": { module: "/api/generate.js", fn: "generateHomebrewItem", out: "item" },
  "/api/world": { module: "/api/world.js", fn: "generateWorld", out: "world" },
  "/api/refine": { module: "/api/world.js", fn: "refineWorld", out: "world" },
  "/api/session": { module: "/api/session.js", fn: "generateSessionPlan", out: "plan" },
  "/api/encounter": { module: "/api/encounter.js", fn: "generateEncounter", out: "encounter" },
  "/api/npc": { module: "/api/npc.js", fn: "generateNpc", out: "npc" },
  "/api/oracle": { module: "/api/oracle.js", fn: "askOracle", out: "answer" },
};

function devApi(env) {
  return {
    name: "chronicler-dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || "").split("?")[0];
        const route = API_ROUTES[path];
        if (!route) return next();

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString("utf8");
          const body = raw ? JSON.parse(raw) : {};

          const mod = await server.ssrLoadModule(route.module);
          const result = await mod[route.fn]({ ...body, apiKey: env.ANTHROPIC_API_KEY });

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ [route.out]: result }));
        } catch (err) {
          res.statusCode = err.statusCode || err.status || 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message || "Generation failed." }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load all env vars (no prefix filter) so the dev API can read ANTHROPIC_API_KEY.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), devApi(env)],
    server: {
      host: true, // listen on the local network so phones/tablets can connect
    },
  };
});

# Resume notes — Chronicler

_Last updated: 2026-06-18 (AI homebrew vertical-slice prototype built)_

## ⭐ NEW: AI DM/homebrew tool — vertical slice (built, NOT yet committed)

Pivoted toward an AI-assisted DM tool (additive — player tools stay). Built and
verified locally (build passes, page renders, no console errors, dev API shim
returns a clean error without a key):

- **`api/generate.js`** — Vercel serverless function + shared `generateHomebrewItem()`
  core. Calls Claude (`@anthropic-ai/sdk`, `claude-opus-4-8`, adaptive thinking,
  structured outputs). Reads `ANTHROPIC_API_KEY` server-side ONLY.
- **`vite.config.js`** — added `devApi` middleware so `/api/generate` works under
  `npm run dev` (reuses the same core; key via `loadEnv`).
- **`vercel.json`** — rewrite now excludes `/api`.
- **`src/lib/ai.js`** — client → `POST /api/generate`.
- **`src/pages/CampaignsPage.jsx`** — `/campaigns` route (replaced ComingSoon):
  campaign list + create, editable "setting bible" (lore), Generate homebrew
  item (lore as context), reroll, save, delete.
- **`supabase/schema.sql`** — new `campaigns` + `homebrew_items` tables (RLS).

Campaigns now also has (all built + verified locally, 2026-06-18):
- **AI world builder** (`api/world.js` + `/api/world`): genre/tone/seed → structured
  world (overview, factions, locations, NPCs, hooks). Drops into the editor for tweaking.
- **Hand-editable world** (WorldEditor): add/edit/delete every section. World feeds
  the homebrew generator's context via `worldToText()`.
- **Dashboard header**: rename, delete (with confirm), status chips
  (World / Homebrew / Characters / Sessions).
- **Party**: link/unlink existing characters to a campaign (👥 Party section,
  Characters chip is live). Needs the `campaign_id` migration below.

Campaign view is now a **sub-tab strip** (🌐 World · 👥 Party · 📅 Sessions ·
⚔️ Encounters · 🧑 NPCs · ✨ Homebrew) under a dashboard header with clickable
status chips. The DM toolkit (all AI-assisted, save/edit/delete, self-contained
components in src/components/):
- **World refine** — "🔮 ask AI to tweak this world" in the world editor
  (natural-language edits, stays consistent across entries). api/refine.js.
- **Session planner** — SessionsTab.jsx, api/session.js, table `game_sessions`.
- **Encounter creator** — EncountersTab.jsx, api/encounter.js, table `encounters`.
- **NPC studio** — NpcsTab.jsx, api/npc.js, table `npcs`.
Each tab shows a friendly "run the migration" message if its table is missing.

### To make it actually run (prerequisites)
1. **Run the migrations**: re-run the FULL `supabase/schema.sql` in the Supabase
   SQL Editor (idempotent — easiest path). It adds everything current:
   - column `campaigns.world` (jsonb)
   - column `characters.campaign_id` (FK, on delete set null)
   - tables `game_sessions`, `encounters`, `npcs` (+ `campaigns`, `homebrew_items`)
2. **Set the key**: add `ANTHROPIC_API_KEY=sk-ant-...` to local `.env` (for dev)
   AND to Vercel → Project → Settings → Environment Variables (for prod). Get a
   key at https://console.anthropic.com/settings/keys . Costs pay-as-you-go.
3. **Restart the dev server** (vite.config changed) and be signed in.

Then: Campaigns → create one → build/edit its world → link characters → Generate homebrew.

---

_Earlier (2026-06-17, paused, back after work):_

## Where things stand

**Phase 2 — Player Tools** is well underway. Everything below is **live** at
**https://chronicler-taupe.vercel.app** (auto-deploys from `master`).

Done this stretch:
- Multi-character management (delete with type-the-name confirm, living HP/temp/conditions, all persisted)
- Trait Markdown rendering, theme persists across refreshes (localStorage)
- Inventory & spell tracking → reworked into:
  - **Spells tab**: cantrip/spell sections, per-class known limits, info popups, Cast (spends a slot; cantrips at-will), spell damage rolls on the 3D dice (+ casting modifier)
  - **Equipped tab** + **Backpack tab** (split from the old Gear tab), quantities, item detail popups, equip toggle, weapon Roll-damage with STR/DEX mod
- App-level 3D dice (`src/DiceContext.jsx`) any screen can trigger
- Dice page: phone-friendly add/remove (corner − button), single-die d100 via `d%` notation
- Sounds: nat-20 crowd cheer, nat-1 crowd boo (see public/sounds/CREDITS.txt)

## NEXT UP: Level-up flow

Agreed scope for a focused v1 (was about to start):
- A "Level Up" button on the character sheet that bumps `level`.
- Auto-recompute level-driven numbers (tables already exist in src/lib/srd.js):
  proficiency bonus, HP (roll vs average + CON), spell slots, spell capacity.
- Prompt the per-level choices: HP roll vs average, ability score improvements at 4/8/12/16/19.
- DEFER: subclass features and class-specific level features (Rage uses, Sneak
  Attack dice, etc.) — big per-class data effort.

## Then (still on the list, in order)

1. Equipped armor → compute AC automatically (armor base_ac + Dex, etc.).
2. Character creator: XP-per-kill vs Milestone selector.
3. Character creator: count coin weight on/off selector.
4. (Open question to revisit) Spell damage currently adds the casting modifier —
   not 5e RAW for most spells. Confirm whether to keep.

## How to run locally

```
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH   # Node not on PATH by default
npm install      # first time / after pulling
npm run dev      # http://localhost:5173
```
The dev server dies on window close / PC sleep — ping me to restart it. Binds to
the LAN (host:true) for phone testing at http://<pc-ip>:5173.

## Supabase / workflow

- Project ref `knuvodaqhjrboyatickd`. Schema in supabase/schema.sql. Keys in local
  .env (gitignored) and Vercel env vars.
- Work on `dev`; promote by lifting master protection via API → `git push <remote>
  dev:master` → re-apply protection. (Token can't open PRs.)

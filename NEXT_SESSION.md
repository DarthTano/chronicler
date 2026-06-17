# Resume notes — Chronicler

_Last updated: 2026-06-17 (paused, back after work)_

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

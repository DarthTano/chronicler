# Resume notes — Chronicler

_Last updated: 2026-06-13 (end of session)_

## Where things stand

**Phase 1 — Foundation is essentially complete.** Live at
**https://chronicler-taupe.vercel.app** (auto-deploys from `master`).
Currently **gathering feedback from friends** before starting Phase 2.

| Feature | Status |
| --- | --- |
| Theme switcher (5 themes, live, mobile-friendly) | ✅ Done |
| Characters — sheet viewer (loads real saved characters) | ✅ Done |
| Compendium — SRD spells/monsters/items, full stat blocks | ✅ Done |
| Dice — 3D physics roller (sounds, crit cheer/scream, fade-out) | ✅ Done |
| Accounts & Auth + profile onboarding (Supabase) | ✅ Done |
| Character builder (SRD, subraces, assignable ASI, roll-for-stats, roleplay) | ✅ Done |

## Next: Phase 2 — Player Tools (per ROADMAP.html)

Waiting on friend feedback first — fold that in before/alongside these:
- Multi-character manager (edit/delete saved characters; currently create-only)
- Level-up flow
- Personal homebrew creator (ties into the homebrew toggle already in the builder)
- Inventory & spell tracking (the builder leaves equipment/spells empty for now)

Known small follow-ups noted during Phase 1:
- Crit **visual** banner only shows for a lone d20 (sound fires on any d20 nat) — could broaden.
- Half-Elf's two floating +1s are handled; other floating-ASI races could be added.
- Spell/equipment steps in the builder were scoped out (Batch B never built) — natural Phase 2 work.

## How to run locally

```
# Node is at "C:\Program Files\nodejs" and is NOT on PATH — add it first in PowerShell:
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npm install      # first time / after pulling
npm run dev      # http://localhost:5173
```
The dev server only lives while its process runs — it dies on window close / PC
sleep, so it often needs a restart. Binds to the LAN (`host: true`) for phone
testing at `http://<pc-ip>:5173` (was `192.168.50.98`).

## Supabase

Project ref `knuvodaqhjrboyatickd`. Schema (profiles + characters, with RLS) is
in `supabase/schema.sql`. Keys live in local `.env` (gitignored) and in Vercel's
env vars (for production). Uses the new publishable key (`sb_publishable_…`).

## Workflow

- Work on **`dev`**; `master` is protected (production).
- Promote: lift protection via GitHub API → `git push <remote> dev:master` →
  re-apply protection. (Token can't open PRs.)
- Every push to `dev` also gets its own Vercel preview URL for sharing WIP.

## Audio assets

Dice + crit sounds are in `public/sounds/` (CC0/CC-BY, see CREDITS.txt). The full
source packs stay extracted under a gitignored `.tmp-dice/` for easy swapping.

## Git anchor

Tonight's stopping point is tagged **`phase1-complete-2026-06-13`**.

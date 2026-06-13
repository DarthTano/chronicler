# Resume notes — Chronicler

_Last updated: 2026-06-12 (end of session)_

## Where things stand

**Phase 1 — Foundation** is mostly built. Live at **https://chronicler-taupe.vercel.app**
(auto-deploys from `master`).

| Feature | Status |
| --- | --- |
| Theme switcher (5 themes, live, mobile-friendly) | ✅ Done |
| Characters — sheet viewer (sample data) | ✅ Done |
| Compendium — SRD spells/monsters/items, full stat blocks | ✅ Done |
| Dice — 3D physics roller (full-screen, crit highlights, history) | ✅ Done |
| Character builder | ⬜ Not started |
| **Accounts & Auth (Supabase)** | ⬜ **Next up** |

## Next up: Auth

First step is creating a **Supabase project** (free tier):
1. Go to supabase.com, create a project.
2. Copy `Project URL` and `anon public` key into a local `.env`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
   (`.env` is gitignored — never commit it. `.env.example` shows the keys.)
3. `npm install @supabase/supabase-js`, then uncomment the client in `src/lib/supabase.js`.

Auth unlocks: saving characters, persisting the chosen theme per user, and
(later phases) shared campaign tables.

## How to run locally

```
# Node lives at "C:\Program Files\nodejs" and is NOT on PATH — add it first in PowerShell:
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npm install      # first time / after pulling
npm run dev      # http://localhost:5173
```
Dev server binds to the LAN (`host: true`), so phones on the same Wi-Fi can open
`http://<your-pc-ip>:5173` (was `192.168.50.98` last session).

## Workflow

- Work happens on the **`dev`** branch.
- `master` is protected (production). To promote: lift protection via the GitHub
  API, `git push <remote> dev:master`, then re-apply protection.
- Every push to `dev` also gets its own Vercel **preview URL** for sharing WIP.

## Git anchor

Tonight's stopping point is tagged **`phase1-2026-06-12`** — `git checkout phase1-2026-06-12`
to return to this exact state.

# 📖 Chronicler

A one-stop platform for all things D&D — serving players and DMs equally, from
rolling a first character to running a living campaign.

## Status

**Phase 1 — Foundation** (in progress)

See `ROADMAP.html` for the full five-phase plan.

## Tech stack

- **React** + **Vite** — frontend
- **React Router** — navigation
- **Supabase** — database, auth, real-time sync (wired up in Phase 1)

## Project structure

```
chronicler/
├── public/              Static assets (favicon, etc.)
├── src/
│   ├── components/      Reusable UI pieces (shared across pages)
│   ├── data/           Sample/seed data (characters.js)
│   ├── lib/            Integrations (supabase.js)
│   ├── pages/          One file per top-level route
│   ├── styles/         Global CSS
│   ├── theme.js        Theme tokens — change ACTIVE_THEME to re-skin
│   ├── App.jsx         Nav shell + routes
│   └── main.jsx        Entry point
├── .env.example        Copy to .env and fill in (never committed)
└── package.json
```

## Running locally

```bash
npm install      # install dependencies (first time only)
npm run dev      # start the dev server at http://localhost:5173
```

## Choosing a theme

Four candidate themes live in `src/theme.js`. Set `ACTIVE_THEME` to
`"clean"`, `"sleek"`, `"soft"`, or `"bold"` to re-skin the whole app.

## Content & licensing note

Built-in game content uses the **SRD** (open-licensed by Wizards of the Coast).
Purchased book content (e.g. from D&D Beyond) is **not** redistributable and is
never bundled — users supply anything beyond the SRD as their own homebrew.

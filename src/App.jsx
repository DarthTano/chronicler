import { NavLink, Routes, Route } from "react-router-dom";
import { THEMES, ACTIVE_THEME } from "./theme.js";
import CharactersPage from "./pages/CharactersPage.jsx";
import ComingSoon from "./pages/ComingSoon.jsx";

const t = THEMES[ACTIVE_THEME];

// Top-level sections — the five pillars of the platform.
const NAV = [
  { to: "/characters", label: "Characters", phase: 1 },
  { to: "/compendium", label: "Compendium", phase: 1 },
  { to: "/dice", label: "Dice", phase: 1 },
  { to: "/dm-screen", label: "DM Screen", phase: 3 },
  { to: "/campaigns", label: "Campaigns", phase: 4 },
  { to: "/community", label: "Community", phase: 5 },
];

export default function App() {
  return (
    <div style={{ minHeight: "100%", background: t.bg, color: t.text, display: "flex", flexDirection: "column" }}>
      <header style={{
        background: t.panel, borderBottom: `1px solid ${t.border}`,
        padding: "0 20px", height: 56, display: "flex", alignItems: "center", gap: 20,
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>📖</span>
          <strong style={{ fontSize: 16, letterSpacing: 0.3 }}>Chronicler</strong>
        </div>
        <nav style={{ display: "flex", gap: 4, overflowX: "auto" }}>
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
              textDecoration: "none", whiteSpace: "nowrap",
              color: isActive ? "#fff" : t.textMid,
              background: isActive ? t.accent : "transparent",
              padding: "7px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600,
            })}>{item.label}</NavLink>
          ))}
        </nav>
      </header>

      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<CharactersPage />} />
          <Route path="/characters" element={<CharactersPage />} />
          <Route path="/compendium" element={<ComingSoon title="Compendium" phase={1} blurb="Searchable SRD spells, monsters, and items — the data backbone every other tool reads from." />} />
          <Route path="/dice" element={<ComingSoon title="Dice Roller" phase={1} blurb="A universal roller with advantage, modifiers, and roll history." />} />
          <Route path="/dm-screen" element={<ComingSoon title="DM Screen" phase={3} blurb="Combat tracker, encounter builder, NPCs and world notes — wired into real character data." />} />
          <Route path="/campaigns" element={<ComingSoon title="Campaigns" phase={4} blurb="The shared table. Link DMs and players, with live initiative everyone watches." />} />
          <Route path="/community" element={<ComingSoon title="Community" phase={5} blurb="Share and discover homebrew, adventures, and AI-generated content." />} />
        </Routes>
      </main>
    </div>
  );
}

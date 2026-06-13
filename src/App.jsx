import { useState, useEffect } from "react";
import { NavLink, Routes, Route } from "react-router-dom";
import { THEMES, THEME_ORDER, DEFAULT_THEME } from "./theme.js";
import { ThemeContext } from "./ThemeContext.js";
import CharactersPage from "./pages/CharactersPage.jsx";
import CompendiumPage from "./pages/CompendiumPage.jsx";
import DicePage from "./pages/DicePage.jsx";
import ComingSoon from "./pages/ComingSoon.jsx";

const NAV = [
  { to: "/characters", label: "Characters", phase: 1 },
  { to: "/compendium", label: "Compendium", phase: 1 },
  { to: "/dice", label: "Dice", phase: 1 },
  { to: "/dm-screen", label: "DM Screen", phase: 3 },
  { to: "/campaigns", label: "Campaigns", phase: 4 },
  { to: "/community", label: "Community", phase: 5 },
];

const THEME_DOTS = {
  clean:    "#4f46e5",
  sleek:    "#6366f1",
  soft:     "#a8763e",
  bold:     "#f43f8e",
  grimoire: "#c8a84b",
};

export default function App() {
  const [themeName, setThemeName] = useState(DEFAULT_THEME);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const t = THEMES[themeName];

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 760);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <ThemeContext.Provider value={t}>
      <div style={{ minHeight: "100%", background: t.bg, color: t.text, display: "flex", flexDirection: "column" }}>
        <header style={{
          background: t.panel, borderBottom: `1px solid ${t.border}`,
          padding: isMobile ? "0 12px" : "0 20px", height: 56, display: "flex", alignItems: "center",
          gap: isMobile ? 10 : 20, position: "sticky", top: 0, zIndex: 50,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 22 }}>📖</span>
            {!isMobile && <strong style={{ fontSize: 16, letterSpacing: 0.3 }}>Chronicler</strong>}
          </div>

          <nav style={{ display: "flex", gap: 4, overflowX: "auto", flex: 1 }}>
            {NAV.map(item => (
              <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
                textDecoration: "none", whiteSpace: "nowrap",
                color: isActive ? "#fff" : t.textMid,
                background: isActive ? t.accent : "transparent",
                padding: "7px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              })}>{item.label}</NavLink>
            ))}
          </nav>

          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setPickerOpen(o => !o)}
              title="Switch theme"
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: t.panelAlt, border: `1px solid ${t.border}`,
                borderRadius: 8, padding: isMobile ? "8px 10px" : "6px 12px", cursor: "pointer",
                color: t.textMid, fontSize: 13, fontWeight: 600,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: THEME_DOTS[themeName], display: "inline-block", flexShrink: 0 }} />
              {!isMobile && THEMES[themeName].label}
              <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
            </button>

            {pickerOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
                background: t.panel, border: `1px solid ${t.border}`,
                borderRadius: 12, padding: 6, minWidth: 180,
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              }}>
                {THEME_ORDER.map(key => (
                  <button
                    key={key}
                    onClick={() => { setThemeName(key); setPickerOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      background: key === themeName ? t.accentSoft : "transparent",
                      border: "none", borderRadius: 8, padding: "9px 12px",
                      cursor: "pointer", color: key === themeName ? t.accent : t.textMid,
                      fontSize: 13, fontWeight: key === themeName ? 700 : 500, textAlign: "left",
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: THEME_DOTS[key], flexShrink: 0 }} />
                    {THEMES[key].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <main style={{ flex: 1 }} onClick={() => pickerOpen && setPickerOpen(false)}>
          <Routes>
            <Route path="/" element={<CharactersPage />} />
            <Route path="/characters" element={<CharactersPage />} />
            <Route path="/compendium" element={<CompendiumPage />} />
            <Route path="/dice" element={<DicePage />} />
            <Route path="/dm-screen" element={<ComingSoon title="DM Screen" phase={3} blurb="Combat tracker, encounter builder, NPCs and world notes — wired into real character data." />} />
            <Route path="/campaigns" element={<ComingSoon title="Campaigns" phase={4} blurb="The shared table. Link DMs and players, with live initiative everyone watches." />} />
            <Route path="/community" element={<ComingSoon title="Community" phase={5} blurb="Share and discover homebrew, adventures, and AI-generated content." />} />
          </Routes>
        </main>
      </div>
    </ThemeContext.Provider>
  );
}

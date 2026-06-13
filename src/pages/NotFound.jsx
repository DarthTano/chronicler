import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../ThemeContext.js";
import { NOT_FOUND_QUIPS } from "../lib/flavor.js";

export default function NotFound() {
  const t = useTheme();
  const [quip] = useState(() => NOT_FOUND_QUIPS[Math.floor(Math.random() * NOT_FOUND_QUIPS.length)]);

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "90px 28px", textAlign: "center" }}>
      <div style={{ fontSize: 64, marginBottom: 8 }}>🗺️</div>
      <div style={{
        display: "inline-block", fontSize: 12, fontWeight: 700, letterSpacing: 2,
        color: t.accent, background: t.accentSoft, padding: "4px 12px",
        borderRadius: 100, marginBottom: 18,
      }}>404 · LOST</div>
      <h1 style={{ fontSize: 30, marginBottom: 12 }}>{quip}</h1>
      <p style={{ color: t.textMid, fontSize: 16, lineHeight: 1.6, marginBottom: 28 }}>
        No such page exists in this realm. Let's get you back to safer ground.
      </p>
      <Link to="/characters" style={{
        textDecoration: "none", display: "inline-block",
        background: t.accent, color: "#fff", borderRadius: 9,
        padding: "11px 22px", fontSize: 15, fontWeight: 700,
      }}>↩ Return to the tavern</Link>
    </div>
  );
}

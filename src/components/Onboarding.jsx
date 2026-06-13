import { useState } from "react";
import { useTheme } from "../ThemeContext.js";
import { useAuth } from "../AuthContext.jsx";
import { supabase } from "../lib/supabase.js";

const ICONS = [
  "🧙", "🧙‍♀️", "🧝", "🧝‍♀️", "🧌", "🧛", "🧟", "🦹",
  "🗡️", "⚔️", "🛡️", "🏹", "🪓", "🔮", "📜", "🍺",
  "🐉", "🐺", "🦅", "🐗", "🦉", "🐲", "👑", "💀",
];

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function Onboarding() {
  const t = useTheme();
  const { user, signOut, refreshProfile } = useAuth();
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(ICONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const valid = USERNAME_RE.test(username.trim());

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const name = username.trim();
    if (!USERNAME_RE.test(name)) {
      setError("Names are 3–20 characters: letters, numbers, and underscores only.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").insert({ id: user.id, username: name, avatar });
      if (error) {
        if (error.code === "23505") throw new Error("That name is already taken by another hero. Choose another.");
        throw error;
      }
      await refreshProfile();
    } catch (err) {
      setError(err.message || "Couldn't save your profile. Try again.");
      setBusy(false);
    }
  }

  const field = {
    width: "100%", padding: "11px 13px", borderRadius: 9, fontSize: 15,
    border: `1px solid ${valid || !username ? t.border : t.bad}`, background: t.panelAlt,
    color: t.text, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 440, background: t.panel,
        border: `1px solid ${t.border}`, borderRadius: 16, padding: 28,
        boxShadow: "0 16px 48px rgba(0,0,0,0.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 4, fontSize: 40 }}>{avatar}</div>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, textAlign: "center" }}>Name your hero</h2>
        <p style={{ color: t.textMid, fontSize: 14, marginBottom: 22, textAlign: "center" }}>
          Pick a username and an icon — this is how you'll appear at the table.
        </p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: t.textDim, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>USERNAME</label>
            <input autoFocus placeholder="e.g. ShadowbladeX" value={username}
              onChange={(e) => setUsername(e.target.value)} style={field} maxLength={20} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: t.textDim, letterSpacing: 0.5, display: "block", marginBottom: 8 }}>CHOOSE YOUR ICON</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
              {ICONS.map(ic => (
                <button type="button" key={ic} onClick={() => setAvatar(ic)} style={{
                  aspectRatio: "1", fontSize: 22, cursor: "pointer", borderRadius: 10,
                  background: ic === avatar ? t.accentSoft : t.panelAlt,
                  border: `2px solid ${ic === avatar ? t.accent : "transparent"}`,
                }}>{ic}</button>
              ))}
            </div>
          </div>

          {error && <div style={{ fontSize: 13, color: t.bad, background: `${t.bad}1a`, padding: "8px 12px", borderRadius: 8 }}>{error}</div>}

          <button type="submit" disabled={busy || !valid} style={{
            padding: "12px 0", borderRadius: 9, border: "none",
            background: (busy || !valid) ? t.panelAlt : t.accent,
            color: (busy || !valid) ? t.textDim : "#fff",
            fontSize: 15, fontWeight: 700, cursor: (busy || !valid) ? "default" : "pointer",
          }}>
            {busy ? "Saving…" : "Enter the realm"}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button onClick={() => signOut()} style={{ background: "none", border: "none", color: t.textDim, fontSize: 12, cursor: "pointer" }}>
            Not you? Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

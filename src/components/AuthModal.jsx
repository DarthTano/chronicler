import { useState } from "react";
import { useTheme } from "../ThemeContext.js";
import { useAuth } from "../AuthContext.jsx";
import { flavorAuthError } from "../lib/flavor.js";

export default function AuthModal({ onClose }) {
  const t = useTheme();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await signUp(email, password);
        if (error) throw error;
        // If email confirmation is on, there's no active session yet.
        if (!data.session) {
          setNotice("Account created — check your email to confirm, then sign in.");
          setMode("signin");
        } else {
          onClose();
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        onClose();
      }
    } catch (err) {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setError(flavorAuthError(err, nextAttempts));
    } finally {
      setBusy(false);
    }
  }

  const field = {
    width: "100%", padding: "11px 13px", borderRadius: 9, fontSize: 14,
    border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text,
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 380, background: t.panel,
          border: `1px solid ${t.border}`, borderRadius: 16, padding: 28,
          boxShadow: "0 16px 48px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: t.textDim, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <p style={{ color: t.textMid, fontSize: 14, marginBottom: 20 }}>
          {mode === "signin" ? "Sign in to save characters and your settings." : "Sign up to start saving your work."}
        </p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="email" required placeholder="Email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} style={field} />
          <div style={{ position: "relative" }}>
            <input type={showPassword ? "text" : "password"} required placeholder="Password" minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ ...field, paddingRight: 42 }} />
            <button type="button" onClick={() => setShowPassword(s => !s)}
              title={showPassword ? "Hide password" : "Show password"}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={{
                position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: t.textMid, padding: 6, display: "flex", alignItems: "center",
              }}>
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {error && <div style={{ fontSize: 13, color: t.bad, background: `${t.bad}1a`, padding: "8px 12px", borderRadius: 8 }}>{error}</div>}
          {notice && <div style={{ fontSize: 13, color: t.good, background: `${t.good}1a`, padding: "8px 12px", borderRadius: 8 }}>{notice}</div>}

          <button type="submit" disabled={busy} style={{
            marginTop: 4, padding: "12px 0", borderRadius: 9, border: "none",
            background: busy ? t.panelAlt : t.accent, color: busy ? t.textDim : "#fff",
            fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer",
          }}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <div style={{ marginTop: 18, textAlign: "center", fontSize: 13, color: t.textMid }}>
          {mode === "signin" ? "Need an account?" : "Already have one?"}{" "}
          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setNotice(null); }}
            style={{ background: "none", border: "none", color: t.accent, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

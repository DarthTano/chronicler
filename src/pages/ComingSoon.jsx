import { THEMES, ACTIVE_THEME } from "../theme.js";
const t = THEMES[ACTIVE_THEME];

export default function ComingSoon({ title, phase, blurb }) {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "80px 28px", textAlign: "center" }}>
      <div style={{
        display: "inline-block", fontSize: 12, fontWeight: 600, letterSpacing: 1,
        color: t.accent, background: t.accentSoft, padding: "4px 12px",
        borderRadius: 100, marginBottom: 20,
      }}>PHASE {phase}</div>
      <h1 style={{ fontSize: 34, marginBottom: 12 }}>{title}</h1>
      <p style={{ color: t.textMid, fontSize: 16, lineHeight: 1.6 }}>{blurb}</p>
      <p style={{ color: t.textDim, fontSize: 14, marginTop: 24 }}>Not built yet — on the roadmap.</p>
    </div>
  );
}

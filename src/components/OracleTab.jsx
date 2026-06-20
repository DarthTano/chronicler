import { useState } from "react";
import { askOracle } from "../lib/ai.js";

const QUICK = [
  { label: "5 rumors", q: "Give me 5 rumors the party might overhear right now." },
  { label: "Quick NPC", q: "Invent a quick NPC the party just met — name, a one-line description, and what they want." },
  { label: "Name a place", q: "Name and briefly describe a nearby location the party could head to." },
  { label: "A complication", q: "Throw a sudden complication or twist at the party right now." },
  { label: "What now?", q: "The party seems stuck. Suggest 3 things that could happen next to push the story." },
];

export default function OracleTab({ setting, t }) {
  const [q, setQ] = useState("");
  const [feed, setFeed] = useState([]); // {q, a} — newest first
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask(question) {
    const text = (question ?? q).trim();
    if (!text || busy) return;
    setBusy(true); setError("");
    const history = [...feed].reverse().map(({ q: hq, a }) => ({ q: hq, a })); // chronological for context
    try {
      const answer = await askOracle({ setting, question: text, history });
      setFeed((f) => [{ q: text, a: answer }, ...f]);
      setQ("");
    } catch (err) {
      setError(err.message || "The oracle is silent.");
    } finally {
      setBusy(false);
    }
  }

  const btn = (bg) => ({ background: bg, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700 });
  const input = { background: t.panelAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: "9px 12px", color: t.text, fontSize: 14, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const chip = { background: t.panelAlt, border: `1px solid ${t.border}`, borderRadius: 100, padding: "5px 12px", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: t.textMid };

  return (
    <div style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 6 }}>🔮 Ask your world</h2>
      <p style={{ color: t.textDim, fontSize: 13, marginTop: 0, marginBottom: 12 }}>
        A live improv assistant grounded in your setting. Ask anything mid-game — answers aren't saved.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !busy) ask(); }}
          placeholder="e.g. what's the ferryman's name and his price?"
          style={{ ...input, flex: "1 1 260px" }}
        />
        <button onClick={() => ask()} disabled={busy || !q.trim()} style={{ ...btn(t.accent), opacity: busy || !q.trim() ? 0.6 : 1 }}>{busy ? "Consulting…" : "Ask"}</button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {QUICK.map((qc) => (
          <button key={qc.label} onClick={() => ask(qc.q)} disabled={busy} style={{ ...chip, opacity: busy ? 0.5 : 1 }}>{qc.label}</button>
        ))}
      </div>

      {!setting?.trim() && <p style={{ color: t.textDim, fontSize: 13, marginTop: 10 }}>Tip: build the world (or add DM notes) so the oracle answers fit your setting.</p>}
      {error && <div style={{ marginTop: 12, color: "#ef4444", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px" }}>{error}</div>}

      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        {feed.map((item, i) => (
          <div key={feed.length - i} style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: 14, background: t.panelAlt }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: t.accent, marginBottom: 8 }}>{item.q}</div>
            <div style={{ fontSize: 14, color: t.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{item.a}</div>
          </div>
        ))}
        {feed.length === 0 && !busy && (
          <div style={{ color: t.textDim, fontSize: 14, paddingTop: 6 }}>Ask a question, or tap a prompt above to get going.</div>
        )}
      </div>
    </div>
  );
}

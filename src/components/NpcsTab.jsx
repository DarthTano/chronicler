import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { generateNpc } from "../lib/ai.js";

function NpcCard({ npc, t }) {
  const heading = (txt) => (<span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: t.accent }}>{txt} </span>);
  const row = (label, value) => value ? (
    <div style={{ fontSize: 13.5, lineHeight: 1.55, color: t.textMid }}>{heading(label)}{value}</div>
  ) : null;
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, background: t.panelAlt }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 17 }}>🧑 {npc.name}</strong>
        {npc.role && <span style={{ fontSize: 12, color: t.textMid, fontStyle: "italic" }}>{npc.role}</span>}
      </div>
      {npc.appearance && <p style={{ color: t.text, fontSize: 14, lineHeight: 1.55, marginTop: 10, marginBottom: 0 }}>{npc.appearance}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {row("Personality", npc.personality)}
        {row("Voice", npc.voice)}
        {row("Wants", npc.motivation)}
        {row("Hook", npc.hook)}
        {row("Stat block", npc.statblock)}
      </div>
      {npc.secret && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${t.border}`, fontSize: 13, color: t.textDim, lineHeight: 1.5 }}>
          <span style={{ color: "#ef4444", fontWeight: 700 }}>🤫 Secret · </span>{npc.secret}
        </div>
      )}
    </div>
  );
}

export default function NpcsTab({ campaign, setting, t, onCountChange }) {
  const [saved, setSaved] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const [role, setRole] = useState("");
  const [focus, setFocus] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [draft, setDraft] = useState(null);
  const [savingNpc, setSavingNpc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.from("npcs").select("*").eq("campaign_id", campaign.id).order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        const list = data || [];
        setSaved(list); setLoadError(error ? error.message : null);
        onCountChange?.(list.length);
      });
    return () => { cancelled = true; };
  }, [campaign.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    setGenerating(true); setGenError(""); setDraft(null);
    try {
      const npc = await generateNpc({ setting, role, focus });
      setDraft(npc);
    } catch (err) {
      setGenError(err.message || "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    setSavingNpc(true);
    const { data } = await supabase.from("npcs")
      .insert({ campaign_id: campaign.id, user_id: campaign.user_id, name: draft.name, role: draft.role, data: draft })
      .select().single();
    setSavingNpc(false);
    if (data) { const list = [data, ...saved]; setSaved(list); setDraft(null); onCountChange?.(list.length); }
  }

  async function deleteNpc(id) {
    await supabase.from("npcs").delete().eq("id", id);
    const list = saved.filter((x) => x.id !== id);
    setSaved(list); onCountChange?.(list.length);
  }

  const btn = (bg) => ({ background: bg, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700 });
  const ghostBtn = { background: "transparent", color: t.textMid, border: `1px solid ${t.border}`, borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700 };
  const input = { background: t.panelAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: "9px 12px", color: t.text, fontSize: 14, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const fieldLabel = { display: "block", fontSize: 12, color: t.textDim, marginBottom: 4 };

  return (
    <div style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 12 }}>🧑 NPC studio</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 180px" }}>
          <label style={fieldLabel}>Role / archetype (optional)</label>
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. tavern keeper, rival captain, oracle" style={input} />
        </div>
        <div style={{ flex: "1 1 180px" }}>
          <label style={fieldLabel}>Extra direction (optional)</label>
          <input value={focus} onChange={(e) => setFocus(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !generating) generate(); }} placeholder="e.g. secretly spies for the Choir" style={input} />
        </div>
        <button onClick={generate} disabled={generating} style={{ ...btn(t.accent), opacity: generating ? 0.6 : 1 }}>{generating ? "Conjuring…" : "Generate"}</button>
      </div>

      {!setting?.trim() && <p style={{ color: t.textDim, fontSize: 13, marginTop: 10 }}>Tip: build the world (or add DM notes) so NPCs fit your setting.</p>}
      {genError && <div style={{ marginTop: 12, color: "#ef4444", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px" }}>{genError}</div>}

      {draft && (
        <div style={{ marginTop: 16 }}>
          <NpcCard npc={draft} t={t} />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={saveDraft} disabled={savingNpc} style={{ ...btn(t.accent), opacity: savingNpc ? 0.6 : 1 }}>{savingNpc ? "Saving…" : "Save to roster"}</button>
            <button onClick={generate} disabled={generating} style={ghostBtn}>Reroll</button>
          </div>
        </div>
      )}

      {loadError && (
        <div style={{ marginTop: 16, color: "#ef4444", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px" }}>
          Couldn't load your NPC roster — this feature needs the new `npcs` table. Run the latest migration in Supabase (see schema.sql), then reload.
        </div>
      )}

      {saved.length > 0 && (
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px solid ${t.border}` }}>
          <h3 style={{ fontSize: 16, marginTop: 0, marginBottom: 12 }}>NPC roster ({saved.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {saved.map((row) => (
              <div key={row.id} style={{ position: "relative" }}>
                <NpcCard npc={row.data} t={t} />
                <button onClick={() => deleteNpc(row.id)} title="Delete" style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: 6, border: `1px solid ${t.border}`, background: t.panel, color: t.textDim, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

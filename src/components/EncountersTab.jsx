import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { generateEncounter, partyToText } from "../lib/ai.js";
import CombatTracker from "./CombatTracker.jsx";

const TYPES = [
  { value: "any", label: "Any type" },
  { value: "combat", label: "Combat" },
  { value: "social", label: "Social" },
  { value: "exploration", label: "Exploration" },
];
const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "deadly", label: "Deadly" },
];

const DIFF_COLOR = { easy: "#22c55e", medium: "#3b82f6", hard: "#f59e0b", deadly: "#ef4444" };
const TYPE_ICON = { combat: "⚔️", social: "💬", exploration: "🧭" };

function EncounterCard({ enc, t }) {
  const dc = DIFF_COLOR[enc.difficulty] || t.accent;
  const heading = (txt) => (<div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: t.accent, marginBottom: 6 }}>{txt}</div>);
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, background: t.panelAlt }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 17 }}>{TYPE_ICON[enc.type] || ""} {enc.title}</strong>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#fff", background: dc, padding: "3px 9px", borderRadius: 100 }}>{enc.difficulty}</span>
      </div>
      <div style={{ color: t.textMid, fontSize: 13, fontStyle: "italic", marginTop: 2, textTransform: "capitalize" }}>{enc.type}</div>
      {enc.summary && <p style={{ color: t.text, fontSize: 14, lineHeight: 1.55, marginTop: 10, marginBottom: 0 }}>{enc.summary}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 14 }}>
        {enc.setup && <div>{heading("Setup")}<div style={{ color: t.textMid, fontSize: 13.5, lineHeight: 1.55 }}>{enc.setup}</div></div>}
        {!!enc.enemies?.length && (
          <div>{heading("Opposition")}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {enc.enemies.map((e, i) => (
                <div key={i}>
                  <span style={{ fontWeight: 700, color: t.text }}>{e.count ? `${e.count}× ` : ""}{e.name}</span>
                  {e.role && <span style={{ color: t.textDim, fontSize: 13 }}> · {e.role}</span>}
                  {e.tactics && <div style={{ color: t.textMid, fontSize: 13, lineHeight: 1.5 }}>{e.tactics}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {!!enc.features?.length && (
          <div>{heading("Features")}
            <ul style={{ margin: 0, paddingLeft: 18, color: t.textMid, fontSize: 13.5, lineHeight: 1.6 }}>{enc.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </div>
        )}
        {enc.twist && <div>{heading("Twist")}<div style={{ color: t.textMid, fontSize: 13.5, lineHeight: 1.55 }}>{enc.twist}</div></div>}
        {enc.rewards && <div>{heading("Rewards")}<div style={{ color: t.textMid, fontSize: 13.5, lineHeight: 1.55 }}>{enc.rewards}</div></div>}
      </div>
    </div>
  );
}

export default function EncountersTab({ campaign, setting, party, t, onCountChange }) {
  const [saved, setSaved] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const [npcList, setNpcList] = useState([]);
  const [villainId, setVillainId] = useState("");
  const [type, setType] = useState("any");
  const [difficulty, setDifficulty] = useState("medium");
  const [focus, setFocus] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [draft, setDraft] = useState(null);
  const [savingEnc, setSavingEnc] = useState(false);
  const [running, setRunning] = useState(null); // { encounter, encounterId }

  useEffect(() => {
    let cancelled = false;
    supabase.from("encounters").select("*").eq("campaign_id", campaign.id).order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        const list = data || [];
        setSaved(list); setLoadError(error ? error.message : null);
        onCountChange?.(list.length);
      });
    return () => { cancelled = true; };
  }, [campaign.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Saved NPCs available as a villain (best-effort; empty if table missing).
  useEffect(() => {
    let cancelled = false;
    supabase.from("npcs").select("id,name,role,data").eq("campaign_id", campaign.id).order("created_at", { ascending: false })
      .then(({ data }) => { if (!cancelled) setNpcList(data || []); });
    return () => { cancelled = true; };
  }, [campaign.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function villainText() {
    const npc = npcList.find((n) => n.id === villainId);
    if (!npc) return "";
    const d = npc.data || {};
    return [
      `${d.name || npc.name}${d.role ? ` — ${d.role}` : ""}.`,
      d.personality && `Personality: ${d.personality}`,
      d.motivation && `Wants: ${d.motivation}`,
      d.secret && `Secret: ${d.secret}`,
      d.statblock && `Suggested stat block: ${d.statblock}.`,
    ].filter(Boolean).join(" ");
  }

  async function generate() {
    setGenerating(true); setGenError(""); setDraft(null);
    try {
      const enc = await generateEncounter({ setting, party: partyToText(party), type, difficulty, focus, villain: villainText() });
      setDraft(enc);
    } catch (err) {
      setGenError(err.message || "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    setSavingEnc(true);
    const { data } = await supabase.from("encounters")
      .insert({ campaign_id: campaign.id, user_id: campaign.user_id, name: draft.title, kind: draft.type, data: draft })
      .select().single();
    setSavingEnc(false);
    if (data) { const list = [data, ...saved]; setSaved(list); setDraft(null); onCountChange?.(list.length); }
  }

  async function deleteEnc(id) {
    await supabase.from("encounters").delete().eq("id", id);
    const list = saved.filter((x) => x.id !== id);
    setSaved(list); onCountChange?.(list.length);
  }

  const btn = (bg) => ({ background: bg, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700 });
  const ghostBtn = { background: "transparent", color: t.textMid, border: `1px solid ${t.border}`, borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700 };
  const input = { background: t.panelAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: "9px 12px", color: t.text, fontSize: 14, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const fieldLabel = { display: "block", fontSize: 12, color: t.textDim, marginBottom: 4 };

  return (
    <div style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 12 }}>⚔️ Encounter creator</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "0 0 auto" }}>
          <label style={fieldLabel}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...input, width: "auto", cursor: "pointer" }}>{TYPES.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <label style={fieldLabel}>Difficulty</label>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ ...input, width: "auto", cursor: "pointer" }}>{DIFFICULTIES.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
        </div>
        {npcList.length > 0 && (
          <div style={{ flex: "0 0 auto" }}>
            <label style={fieldLabel}>Villain (from roster)</label>
            <select value={villainId} onChange={(e) => setVillainId(e.target.value)} style={{ ...input, width: "auto", cursor: "pointer" }}>
              <option value="">— none —</option>
              {npcList.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
        )}
        <div style={{ flex: "1 1 200px" }}>
          <label style={fieldLabel}>Focus (optional)</label>
          <input value={focus} onChange={(e) => setFocus(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !generating) generate(); }} placeholder="e.g. an ambush in the ash-flats, or a tense parley with the Conclave" style={input} />
        </div>
        <button onClick={generate} disabled={generating} style={{ ...btn(t.accent), opacity: generating ? 0.6 : 1 }}>{generating ? "Designing…" : "Generate"}</button>
      </div>

      {!setting?.trim() && <p style={{ color: t.textDim, fontSize: 13, marginTop: 10 }}>Tip: build the world (or add DM notes) so encounters fit your setting.</p>}
      {genError && <div style={{ marginTop: 12, color: "#ef4444", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px" }}>{genError}</div>}

      {draft && (
        <div style={{ marginTop: 16 }}>
          <EncounterCard enc={draft} t={t} />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={saveDraft} disabled={savingEnc} style={{ ...btn(t.accent), opacity: savingEnc ? 0.6 : 1 }}>{savingEnc ? "Saving…" : "Save to campaign"}</button>
            <button onClick={() => setRunning({ encounter: draft, encounterId: null })} style={ghostBtn}>▶ Run</button>
            <button onClick={generate} disabled={generating} style={ghostBtn}>Reroll</button>
          </div>
        </div>
      )}

      {loadError && (
        <div style={{ marginTop: 16, color: "#ef4444", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px" }}>
          Couldn't load saved encounters — this feature needs the new `encounters` table. Run the latest migration in Supabase (see schema.sql), then reload.
        </div>
      )}

      {saved.length > 0 && (
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px solid ${t.border}` }}>
          <h3 style={{ fontSize: 16, marginTop: 0, marginBottom: 12 }}>Saved encounters ({saved.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {saved.map((row) => (
              <div key={row.id} style={{ position: "relative" }}>
                <EncounterCard enc={row.data} t={t} />
                <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6 }}>
                  <button onClick={() => setRunning({ encounter: row.data, encounterId: row.id })} title="Run combat" style={{ ...btn(t.accent), padding: "4px 10px", fontSize: 12.5 }}>▶ Run</button>
                  <button onClick={() => deleteEnc(row.id)} title="Delete" style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${t.border}`, background: t.panel, color: t.textDim, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {running && (
        <CombatTracker encounter={running.encounter} encounterId={running.encounterId} campaign={campaign} t={t} onClose={() => setRunning(null)} />
      )}
    </div>
  );
}

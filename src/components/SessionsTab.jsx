import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { generateSessionPlan, partyToText } from "../lib/ai.js";

const hasPlan = (p) => Boolean(p && (p.recap || p.beats?.length || p.encounters?.length || p.npcs?.length || p.hooks_forward?.length));

function PlanView({ plan, t }) {
  if (!hasPlan(plan)) return null;
  const heading = (txt) => (<div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: t.accent, marginBottom: 6 }}>{txt}</div>);
  const list = (title, items) => (
    <div>{heading(title)}
      <ul style={{ margin: 0, paddingLeft: 18, color: t.textMid, fontSize: 13.5, lineHeight: 1.6 }}>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {plan.recap && <p style={{ fontSize: 14, fontStyle: "italic", color: t.textMid, margin: 0, lineHeight: 1.55 }}>{plan.recap}</p>}
      {!!plan.beats?.length && (
        <div>{heading("Beats")}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {plan.beats.map((b, i) => (
              <div key={i}>
                <span style={{ fontWeight: 700, color: t.text }}>{i + 1}. {b.title}</span>
                <div style={{ color: t.textMid, fontSize: 13.5, lineHeight: 1.5 }}>{b.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {!!plan.encounters?.length && list("Possible encounters", plan.encounters)}
      {!!plan.npcs?.length && list("NPCs in play", plan.npcs)}
      {!!plan.hooks_forward?.length && list("Threads forward", plan.hooks_forward)}
    </div>
  );
}

export default function SessionsTab({ campaign, setting, party, t, onCountChange }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selId, setSelId] = useState(null);
  const [npcList, setNpcList] = useState([]);
  const [encList, setEncList] = useState([]);

  const [focus, setFocus] = useState("");
  const [recap, setRecap] = useState("");
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState("");

  const [titleDraft, setTitleDraft] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaFlash, setMetaFlash] = useState(false);

  const sel = sessions.find((s) => s.id === selId) || null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.from("game_sessions").select("*").eq("campaign_id", campaign.id).order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        const list = data || [];
        setSessions(list); setLoadError(error ? error.message : null); setLoading(false);
        onCountChange?.(list.length);
        if (list.length && !list.some((s) => s.id === selId)) setSelId(list[list.length - 1].id);
      });
    return () => { cancelled = true; };
  }, [campaign.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPlanError(""); setFocus(""); setRecap("");
    if (!sel) { setTitleDraft(""); setDateDraft(""); setNotesDraft(""); return; }
    setTitleDraft(sel.title || ""); setDateDraft(sel.session_date || ""); setNotesDraft(sel.notes || "");
  }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Saved roster (NPCs + encounters) fed to the planner so plans reuse them.
  useEffect(() => {
    let cancelled = false;
    supabase.from("npcs").select("name,role,data").eq("campaign_id", campaign.id)
      .then(({ data }) => { if (!cancelled) setNpcList(data || []); });
    supabase.from("encounters").select("name,kind,data").eq("campaign_id", campaign.id)
      .then(({ data }) => { if (!cancelled) setEncList(data || []); });
    return () => { cancelled = true; };
  }, [campaign.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function rosterText() {
    const lines = [];
    if (npcList.length) {
      lines.push("NPCs:");
      npcList.forEach((n) => { const d = n.data || {}; lines.push(`- ${d.name || n.name}${d.role ? ` (${d.role})` : ""}${d.motivation ? ` — wants: ${d.motivation}` : ""}`); });
    }
    if (encList.length) {
      if (lines.length) lines.push("");
      lines.push("Encounters:");
      encList.forEach((e) => { const d = e.data || {}; lines.push(`- ${d.title || e.name}${d.type ? ` (${d.type}${d.difficulty ? `, ${d.difficulty}` : ""})` : ""}${d.summary ? `: ${d.summary}` : ""}`); });
    }
    return lines.join("\n");
  }

  async function createSession() {
    const { data, error } = await supabase.from("game_sessions")
      .insert({ campaign_id: campaign.id, user_id: campaign.user_id, title: `Session ${sessions.length + 1}`, plan: {}, notes: "", status: "planned" })
      .select().single();
    if (error) { setLoadError(error.message); return; }
    if (data) { const list = [...sessions, data]; setSessions(list); setSelId(data.id); onCountChange?.(list.length); }
  }

  async function generatePlan() {
    if (!sel) return;
    setPlanning(true); setPlanError("");
    try {
      const plan = await generateSessionPlan({ setting, party: partyToText(party), focus, recap, roster: rosterText() });
      const patch = { plan, updated_at: new Date().toISOString() };
      if (!sel.title || /^Session \d+$/.test(sel.title) || sel.title === "Untitled session") { patch.title = plan.title; setTitleDraft(plan.title); }
      const { error } = await supabase.from("game_sessions").update(patch).eq("id", sel.id);
      if (error) throw new Error(error.message);
      setSessions((ss) => ss.map((s) => (s.id === sel.id ? { ...s, ...patch } : s)));
    } catch (err) {
      setPlanError(err.message || "Generation failed.");
    } finally {
      setPlanning(false);
    }
  }

  async function saveMeta() {
    if (!sel) return;
    setSavingMeta(true);
    const patch = { title: titleDraft.trim() || "Untitled session", session_date: dateDraft || null, notes: notesDraft, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("game_sessions").update(patch).eq("id", sel.id);
    setSavingMeta(false);
    if (!error) { setSessions((ss) => ss.map((s) => (s.id === sel.id ? { ...s, ...patch } : s))); setMetaFlash(true); setTimeout(() => setMetaFlash(false), 1500); }
  }

  async function toggleStatus() {
    if (!sel) return;
    const status = sel.status === "played" ? "planned" : "played";
    await supabase.from("game_sessions").update({ status }).eq("id", sel.id);
    setSessions((ss) => ss.map((s) => (s.id === sel.id ? { ...s, status } : s)));
  }

  async function deleteSession(id) {
    await supabase.from("game_sessions").delete().eq("id", id);
    const list = sessions.filter((s) => s.id !== id);
    setSessions(list); onCountChange?.(list.length);
    if (selId === id) setSelId(list[list.length - 1]?.id ?? null);
  }

  const btn = (bg) => ({ background: bg, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700 });
  const ghostBtn = { background: "transparent", color: t.textMid, border: `1px solid ${t.border}`, borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700 };
  const input = { background: t.panelAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: "9px 12px", color: t.text, fontSize: 14, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const fieldLabel = { display: "block", fontSize: 12, color: t.textDim, marginBottom: 4 };
  const metaDirty = sel && (titleDraft !== (sel.title || "") || dateDraft !== (sel.session_date || "") || notesDraft !== (sel.notes || ""));

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>📅 Sessions</h2>
        <button onClick={createSession} style={btn(t.accent)}>+ New session</button>
      </div>

      {loadError && (
        <div style={{ marginTop: 12, color: "#ef4444", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px" }}>
          Couldn't load sessions — this feature needs the new `game_sessions` table. Run the latest migration in Supabase (see schema.sql), then reload.
        </div>
      )}

      {/* Session list */}
      {!loadError && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
          {loading && <div style={{ color: t.textDim, fontSize: 14 }}>Loading…</div>}
          {!loading && sessions.length === 0 && <div style={{ color: t.textDim, fontSize: 14 }}>No sessions yet. Create one to start planning.</div>}
          {sessions.map((s) => (
            <button key={s.id} onClick={() => setSelId(s.id)} style={{
              display: "flex", alignItems: "center", gap: 8,
              border: `1px solid ${s.id === selId ? t.accent : t.border}`, background: s.id === selId ? t.accentSoft : t.panel,
              color: s.id === selId ? t.accent : t.textMid, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13.5, fontWeight: 600,
            }}>
              {s.title}
              {s.status === "played" && <span title="Played" style={{ fontSize: 11, color: "#22c55e" }}>✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Selected session */}
      {sel && (
        <div style={{ marginTop: 18, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, background: t.panel }}>
          {/* meta row */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "2 1 220px" }}><label style={fieldLabel}>Title</label><input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} style={input} /></div>
            <div style={{ flex: "1 1 140px" }}><label style={fieldLabel}>Date</label><input type="date" value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} style={input} /></div>
            <button onClick={toggleStatus} style={{ ...ghostBtn, color: sel.status === "played" ? "#22c55e" : t.textMid, borderColor: sel.status === "played" ? "rgba(34,197,94,0.4)" : t.border }}>
              {sel.status === "played" ? "✓ Played" : "Mark played"}
            </button>
            <button onClick={() => deleteSession(sel.id)} style={{ ...ghostBtn, color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)" }}>Delete</button>
          </div>

          {/* planner */}
          <div style={{ marginTop: 16, border: `1px solid ${t.accentSoft}`, background: t.accentSoft, borderRadius: 10, padding: 12 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: t.accent, marginBottom: 8 }}>🪄 {hasPlan(sel.plan) ? "Regenerate" : "Generate"} a session plan</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={fieldLabel}>This session's focus</label><textarea value={focus} onChange={(e) => setFocus(e.target.value)} rows={2} placeholder="e.g. the party reaches Cinderhold and meets the Hierarch" style={{ ...input, resize: "vertical", lineHeight: 1.5 }} /></div>
              <div><label style={fieldLabel}>Last session recap (optional)</label><textarea value={recap} onChange={(e) => setRecap(e.target.value)} rows={2} placeholder="What happened last time…" style={{ ...input, resize: "vertical", lineHeight: 1.5 }} /></div>
            </div>
            <div style={{ marginTop: 10 }}>
              <button onClick={generatePlan} disabled={planning} style={{ ...btn(t.accent), opacity: planning ? 0.6 : 1 }}>{planning ? "Planning…" : hasPlan(sel.plan) ? "Regenerate plan" : "✨ Generate plan"}</button>
            </div>
            {planError && <div style={{ marginTop: 10, color: "#ef4444", fontSize: 13 }}>{planError}</div>}
            {(npcList.length > 0 || encList.length > 0) && (
              <div style={{ marginTop: 8, fontSize: 12, color: t.textMid }}>
                Drawing from your roster: {npcList.length} NPC{npcList.length === 1 ? "" : "s"} · {encList.length} encounter{encList.length === 1 ? "" : "s"} — the plan will reuse them by name where they fit.
              </div>
            )}
            {!setting?.trim() && <div style={{ marginTop: 8, fontSize: 12, color: t.textMid }}>Tip: build the world (or add DM notes) so plans fit your setting.</div>}
          </div>

          {/* plan */}
          {hasPlan(sel.plan) && <div style={{ marginTop: 18 }}><PlanView plan={sel.plan} t={t} /></div>}

          {/* notes */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
            <label style={fieldLabel}>Session notes</label>
            <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={3} placeholder="Your own prep notes, secrets, reminders…" style={{ ...input, resize: "vertical", lineHeight: 1.5 }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <button onClick={saveMeta} disabled={savingMeta || !metaDirty} style={{ ...btn(t.accent), opacity: savingMeta || !metaDirty ? 0.5 : 1 }}>{savingMeta ? "Saving…" : "Save session"}</button>
            {metaFlash && <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>Saved ✓</span>}
          </div>
        </div>
      )}
    </div>
  );
}

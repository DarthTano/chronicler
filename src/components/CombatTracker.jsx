import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";

const CONDITIONS = ["Blinded", "Charmed", "Concentrating", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"];

const parseCount = (c) => {
  const m = String(c || "").match(/\d+/);
  return m ? Math.min(20, Math.max(1, parseInt(m[0], 10))) : 1;
};
const num = (v) => (Number.isFinite(v) ? v : (parseInt(v, 10) || 0));
const d20 = () => Math.floor(Math.random() * 20) + 1;

function buildCombatants(enc, partyChars) {
  const out = [];
  partyChars.forEach((c) => {
    const d = c.data || {};
    const hp = d.hp || {};
    out.push({
      id: `pc-${c.id}`, name: c.name, side: "pc",
      init: "", initBonus: num(d.initiative),
      hp: Number.isFinite(hp.current) ? hp.current : null,
      maxHp: Number.isFinite(hp.max) ? hp.max : null,
      ac: Number.isFinite(d.ac) ? d.ac : (parseInt(d.ac, 10) || null),
      conditions: [], note: [d.race, d.class].filter(Boolean).join(" ") + (d.level ? ` ${d.level}` : ""),
    });
  });
  (enc.enemies || []).forEach((e, ei) => {
    const n = parseCount(e.count);
    for (let i = 0; i < n; i++) {
      out.push({
        id: `foe-${ei}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        name: n > 1 ? `${e.name} ${i + 1}` : e.name, side: "foe",
        init: "", initBonus: 0, hp: null, maxHp: null, ac: null,
        conditions: [], note: [e.role, e.tactics].filter(Boolean).join(" — "),
      });
    }
  });
  return out;
}

const sortByInit = (list) => [...list].sort((a, b) => (num(b.init) - num(a.init)) || (a.side === "pc" ? -1 : 1));

export default function CombatTracker({ encounter, encounterId, campaign, t, onClose }) {
  const storeKey = `chronicler-combat-${campaign.id}-${encounterId || "draft"}`;
  const [combatants, setCombatants] = useState([]);
  const [round, setRound] = useState(1);
  const [turnIdx, setTurnIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const builtRef = useRef(false);

  // Load saved combat (localStorage) or build fresh from party + foes.
  useEffect(() => {
    let cancelled = false;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(storeKey) || "null"); } catch { /* ignore */ }
    if (saved?.combatants?.length) {
      setCombatants(saved.combatants); setRound(saved.round || 1); setTurnIdx(saved.turnIdx || 0);
      setLoaded(true); builtRef.current = true;
      return;
    }
    supabase.from("characters").select("id,name,data").eq("campaign_id", campaign.id)
      .then(({ data }) => {
        if (cancelled) return;
        setCombatants(buildCombatants(encounter, data || []));
        setLoaded(true); builtRef.current = true;
      });
    return () => { cancelled = true; };
  }, [storeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist on change.
  useEffect(() => {
    if (!builtRef.current) return;
    try { localStorage.setItem(storeKey, JSON.stringify({ combatants, round, turnIdx })); } catch { /* ignore */ }
  }, [combatants, round, turnIdx, storeKey]);

  const update = (id, patch) => setCombatants((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id) => setCombatants((cs) => cs.filter((c) => c.id !== id));

  function rollInitiative() {
    setCombatants((cs) => sortByInit(cs.map((c) => ({ ...c, init: d20() + num(c.initBonus) }))));
    setTurnIdx(0); setRound(1);
  }
  function resort() { setCombatants((cs) => sortByInit(cs)); setTurnIdx(0); }
  function nextTurn() {
    const n = combatants.length || 1;
    const ni = (turnIdx + 1) % n;
    setTurnIdx(ni);
    if (ni === 0) setRound((r) => r + 1);
  }
  function rebuild() {
    supabase.from("characters").select("id,name,data").eq("campaign_id", campaign.id)
      .then(({ data }) => { setCombatants(buildCombatants(encounter, data || [])); setRound(1); setTurnIdx(0); });
  }
  function addCombatant() {
    setCombatants((cs) => [...cs, { id: `add-${Math.random().toString(36).slice(2, 8)}`, name: "New combatant", side: "foe", init: "", initBonus: 0, hp: null, maxHp: null, ac: null, conditions: [], note: "" }]);
  }
  function damage(id, amount) {
    setCombatants((cs) => cs.map((c) => {
      if (c.id !== id || c.hp == null) return c;
      const max = c.maxHp != null ? c.maxHp : Infinity;
      return { ...c, hp: Math.max(0, Math.min(max, c.hp - amount)) };
    }));
  }

  const btn = (bg) => ({ background: bg, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13.5, fontWeight: 700 });
  const ghostBtn = { background: "transparent", color: t.textMid, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13.5, fontWeight: 700 };
  const smallInput = { background: t.panelAlt, border: `1px solid ${t.border}`, borderRadius: 6, padding: "4px 6px", color: t.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 16, padding: 18, maxWidth: 760, width: "100%", boxShadow: "0 12px 48px rgba(0,0,0,0.3)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 19, margin: 0 }}>⚔️ {encounter.title || "Encounter"}</h2>
            <div style={{ color: t.textMid, fontSize: 13, marginTop: 2 }}>Round {round}</div>
          </div>
          <button onClick={onClose} title="Close" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.border}`, background: t.panel, color: t.textMid, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <button onClick={rollInitiative} style={btn(t.accent)}>🎲 Roll initiative</button>
          <button onClick={nextTurn} style={btn(t.accent)}>▶ Next turn</button>
          <button onClick={resort} style={ghostBtn}>Sort</button>
          <button onClick={addCombatant} style={ghostBtn}>+ Add</button>
          <button onClick={rebuild} style={ghostBtn}>↻ Rebuild</button>
        </div>

        {/* Combatants */}
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {!loaded && <div style={{ color: t.textDim, fontSize: 14 }}>Loading…</div>}
          {loaded && combatants.length === 0 && <div style={{ color: t.textDim, fontSize: 14 }}>No combatants. Add some, or rebuild from the encounter.</div>}
          {combatants.map((c, i) => {
            const current = i === turnIdx;
            const dead = c.hp != null && c.hp <= 0;
            return (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                borderTop: `1px solid ${current ? t.accent : t.border}`, borderRight: `1px solid ${current ? t.accent : t.border}`,
                borderBottom: `1px solid ${current ? t.accent : t.border}`, borderLeft: `4px solid ${c.side === "pc" ? "#22c55e" : "#ef4444"}`,
                background: current ? t.accentSoft : t.panelAlt, borderRadius: 8, padding: "8px 10px", opacity: dead ? 0.55 : 1,
              }}>
                <input value={c.init} onChange={(e) => update(c.id, { init: e.target.value })} title="Initiative" style={{ ...smallInput, width: 38, textAlign: "center", fontWeight: 700 }} />
                <span style={{ width: 14, color: t.accent }}>{current ? "▶" : ""}</span>
                <input value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} style={{ ...smallInput, flex: "1 1 120px", fontWeight: 700, color: c.side === "pc" ? "#16a34a" : t.text }} />

                {/* HP */}
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <input type="number" value={c.hp ?? ""} onChange={(e) => update(c.id, { hp: e.target.value === "" ? null : parseInt(e.target.value, 10) })} placeholder="HP" style={{ ...smallInput, width: 46, textAlign: "center" }} />
                  <span style={{ color: t.textDim, fontSize: 12 }}>/</span>
                  <input type="number" value={c.maxHp ?? ""} onChange={(e) => update(c.id, { maxHp: e.target.value === "" ? null : parseInt(e.target.value, 10) })} placeholder="max" style={{ ...smallInput, width: 46, textAlign: "center" }} />
                </div>
                <DmgBox t={t} onApply={(n, heal) => damage(c.id, heal ? -n : n)} />
                <input type="number" value={c.ac ?? ""} onChange={(e) => update(c.id, { ac: e.target.value === "" ? null : parseInt(e.target.value, 10) })} title="AC" placeholder="AC" style={{ ...smallInput, width: 42, textAlign: "center" }} />

                {/* Conditions */}
                <select value="" onChange={(e) => { if (e.target.value && !c.conditions.includes(e.target.value)) update(c.id, { conditions: [...c.conditions, e.target.value] }); }} title="Add condition" style={{ ...smallInput, width: 34, cursor: "pointer" }}>
                  <option value="">+</option>
                  {CONDITIONS.map((cn) => <option key={cn} value={cn}>{cn}</option>)}
                </select>
                <button onClick={() => remove(c.id)} title="Remove" style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${t.border}`, background: t.panel, color: t.textDim, cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>

                {c.conditions.length > 0 && (
                  <div style={{ flexBasis: "100%", display: "flex", gap: 5, flexWrap: "wrap", marginTop: 2 }}>
                    {c.conditions.map((cond) => (
                      <span key={cond} onClick={() => update(c.id, { conditions: c.conditions.filter((x) => x !== cond) })} title="Remove condition"
                        style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "#a855f7", padding: "2px 8px", borderRadius: 100, cursor: "pointer" }}>{cond} ×</span>
                    ))}
                  </div>
                )}
                {c.note && <div style={{ flexBasis: "100%", fontSize: 11.5, color: t.textDim, lineHeight: 1.4 }}>{c.note}</div>}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: t.textDim }}>PC HP is pulled from your character sheets. Foe HP — fill from the suggested stat blocks. Combat auto-saves on this device.</div>
      </div>
    </div>
  );
}

// Compact damage/heal entry: type a number, Enter or − damages, + heals.
function DmgBox({ t, onApply }) {
  const [v, setV] = useState("");
  const apply = (heal) => { const n = parseInt(v, 10); if (Number.isFinite(n) && n > 0) { onApply(n, heal); setV(""); } };
  const s = { background: t.panelAlt, border: `1px solid ${t.border}`, borderRadius: 6, padding: "4px 6px", color: t.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
  const b = (bg) => ({ background: bg, color: "#fff", border: "none", borderRadius: 5, padding: "4px 7px", cursor: "pointer", fontSize: 12, fontWeight: 700, lineHeight: 1 });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") apply(false); }} placeholder="±" title="Damage / heal amount" style={{ ...s, width: 34, textAlign: "center" }} />
      <button onClick={() => apply(false)} title="Damage" style={b("#ef4444")}>−</button>
      <button onClick={() => apply(true)} title="Heal" style={b("#22c55e")}>+</button>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../ThemeContext.js";
import { useAuth } from "../AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import {
  SAMPLE_CHARACTERS, CONDITIONS, STAT_ORDER, SCHOOL_COLORS,
} from "../data/characters.js";
import { parseTrait, slotsForCharacter, maxSpellLevel, spellCapacity, fetchEquipment } from "../lib/srd.js";

// Render inline Markdown (**bold**, *italic*, _italic_) as elements, dropping the markers.
function renderInline(text) {
  const nodes = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_)/g;
  let last = 0, m, key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2]) nodes.push(<strong key={key++}>{m[2]}</strong>);
    else nodes.push(<em key={key++}>{m[3] || m[4]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Modal shell for the item / spell pickers.
function PickerModal({ title, subtitle, onClose, t, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20, boxShadow: "0 16px 48px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: t.textDim, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {subtitle && <div style={{ fontSize: 12, color: t.textDim, marginTop: 2, marginBottom: 10 }}>{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}

// Equipment is stored as { name, type, qty }; older characters stored bare
// strings, so normalize both shapes on read.
function normItem(it) {
  if (typeof it === "string") return { name: it, type: "Gear", qty: 1, equipped: false };
  return { name: it.name, type: it.type || "Gear", qty: it.qty || 1, equipped: !!it.equipped };
}

// Full item details (weapon damage / armor AC) fetched from the SRD on demand.
function ItemInfoModal({ item, onClose, t }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(item.type === "Weapon" || item.type === "Armor");
  useEffect(() => {
    if (item.type !== "Weapon" && item.type !== "Armor") return;
    let cancelled = false;
    const endpoint = item.type === "Weapon" ? "weapons" : "armor";
    fetch(`https://api.open5e.com/v1/${endpoint}/?document__slug__in=wotc-srd&search=${encodeURIComponent(item.name)}&limit=5`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData((d.results || []).find(x => x.name === item.name) || (d.results || [])[0] || null); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [item]);

  const row = (label, value) => (value != null && value !== "") ? (
    <div style={{ display: "flex", gap: 8, marginBottom: 5, fontSize: 13 }}>
      <span style={{ fontWeight: 700, color: t.accent, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ color: t.textMid }}>{value}</span>
    </div>
  ) : null;

  return (
    <PickerModal title={item.name} subtitle={item.qty > 1 ? `${item.type} ×${item.qty}` : item.type} onClose={onClose} t={t}>
      <div style={{ overflowY: "auto" }}>
        {loading ? <div style={{ padding: 16, color: t.textDim, fontSize: 13 }}>Loading…</div>
          : item.type === "Gear" ? <div style={{ fontSize: 14, color: t.textMid }}>Adventuring gear — no additional stats in the SRD.</div>
          : !data ? <div style={{ padding: 16, color: t.textDim, fontSize: 13 }}>Couldn't load details.</div>
          : item.type === "Weapon" ? (
            <>
              {row("Damage", [data.damage_dice, data.damage_type].filter(Boolean).join(" "))}
              {row("Properties", (data.properties || []).join(", "))}
              {row("Category", data.category)}
              {row("Weight", data.weight)}
              {row("Cost", data.cost)}
            </>
          ) : (
            <>
              {row("Armor Class", data.ac_string || data.base_ac)}
              {row("Category", data.category)}
              {row("Stealth", data.stealth_disadvantage ? "Disadvantage" : "Normal")}
              {row("Strength Req.", data.strength_requirement ? `Str ${data.strength_requirement}` : null)}
              {row("Weight", data.weight)}
              {row("Cost", data.cost)}
            </>
          )}
      </div>
    </PickerModal>
  );
}

// Pick SRD weapons / armor / gear to add to inventory. Stays open for multiple adds.
function ItemPicker({ onAdd, onClose, t }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  useEffect(() => {
    let cancelled = false;
    fetchEquipment().then(list => { if (!cancelled) { setItems(list); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);
  const ql = q.toLowerCase().trim();
  const filtered = ql ? items.filter(it => it.name.toLowerCase().includes(ql)) : items;
  return (
    <PickerModal title="Add item" subtitle="SRD weapons, armor & gear — click to add, close when done" onClose={onClose} t={t}>
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search items…"
        style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
      <div style={{ overflowY: "auto", marginTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
        {loading ? <div style={{ padding: 16, color: t.textDim, fontSize: 13 }}>Loading…</div>
          : filtered.length === 0 ? <div style={{ padding: 16, color: t.textDim, fontSize: 13 }}>No matches.</div>
          : filtered.map((it, i) => (
            <button key={i} onClick={() => onAdd({ name: it.name, type: it.type })}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "transparent", border: "none", borderRadius: 7, padding: "8px 10px", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: 13, color: t.text }}>{it.name}</span>
              <span style={{ fontSize: 11, color: t.textDim }}>{it.type}</span>
            </button>
          ))}
      </div>
    </PickerModal>
  );
}

// Pick SRD spells from the character's class list, limited to castable levels
// and to how many cantrips / spells the class can know.
function SpellPicker({ cls, maxLvl, known, caps, onAdd, onClose, t }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef(null);
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const knownNames = known.map(k => k.name);
  const cantripCount = known.filter(k => k.level === 0).length;
  const leveledCount = known.length - cantripCount;

  useEffect(() => {
    clearTimeout(debounce.current);
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        // Fetch each castable level explicitly (0 = cantrips). The API ignores
        // ordering/lte filters, so this guarantees cantrips are included.
        const levels = [0];
        for (let l = 1; l <= maxLvl; l++) levels.push(l);
        const reqs = levels.map(lvl => {
          const params = new URLSearchParams({ document__slug__in: "wotc-srd", limit: "100", level_int: String(lvl) });
          if (q.trim()) params.set("search", q.trim());
          if (cls) params.set("dnd_class__icontains", cls);
          return fetch(`https://api.open5e.com/v1/spells/?${params}`).then(r => r.json()).then(d => d.results || []).catch(() => []);
        });
        const all = (await Promise.all(reqs)).flat().sort((a, b) => (a.level_int - b.level_int) || a.name.localeCompare(b.name));
        setResults(all);
      } catch { setResults([]); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [q, cls, maxLvl]);

  return (
    <PickerModal title="Add spell"
      subtitle={`${cls || "SRD"} · Cantrips ${cantripCount}/${caps.cantrips} · Spells ${leveledCount}/${caps.spells}`}
      onClose={onClose} t={t}>
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search spells…"
        style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
      <div style={{ overflowY: "auto", marginTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
        {searching && results.length === 0 ? <div style={{ padding: 16, color: t.textDim, fontSize: 13 }}>Searching…</div>
          : results.length === 0 ? <div style={{ padding: 16, color: t.textDim, fontSize: 13 }}>No spells found.</div>
          : results.map(sp => {
            const already = knownNames.includes(sp.name);
            const isCantrip = sp.level_int === 0;
            const atCap = isCantrip ? cantripCount >= caps.cantrips : leveledCount >= caps.spells;
            const disabled = already || atCap;
            return (
              <button key={sp.slug || sp.name} disabled={disabled}
                onClick={() => !disabled && onAdd({ name: sp.name, level: sp.level_int, school: cap(sp.school), slug: sp.slug })}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 7, padding: "8px 10px", cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", gap: 8, opacity: disabled ? 0.5 : 1 }}>
                <span style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: SCHOOL_COLORS[cap(sp.school)] || t.accent }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{sp.name}</span>
                  <span style={{ fontSize: 11, color: t.textDim, marginLeft: 6 }}>{isCantrip ? "Cantrip" : `Lvl ${sp.level_int}`} · {cap(sp.school)}</span>
                </span>
                {already ? <span style={{ fontSize: 11, color: t.textDim }}>added</span>
                  : atCap ? <span style={{ fontSize: 11, color: t.textDim }}>limit</span>
                  : <span style={{ fontSize: 16, color: t.accent }}>+</span>}
              </button>
            );
          })}
      </div>
    </PickerModal>
  );
}

// Full spell details, fetched from the SRD on demand (by slug, or by name).
function SpellInfoModal({ spell, onClose, t }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let sp = null;
        if (spell.slug) {
          const r = await fetch(`https://api.open5e.com/v1/spells/${spell.slug}/`);
          if (r.ok) sp = await r.json();
        }
        if (!sp) {
          const r = await fetch(`https://api.open5e.com/v1/spells/?search=${encodeURIComponent(spell.name)}&limit=5`);
          const d = await r.json();
          sp = (d.results || []).find(x => x.name === spell.name) || (d.results || [])[0] || null;
        }
        if (!cancelled) { setData(sp); setLoading(false); }
      } catch { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [spell]);

  const row = (label, value) => value ? (
    <div style={{ display: "flex", gap: 8, marginBottom: 5, fontSize: 13 }}>
      <span style={{ fontWeight: 700, color: t.accent, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ color: t.textMid }}>{value}</span>
    </div>
  ) : null;

  const lvl = spell.level === 0 ? "Cantrip" : `Level ${spell.level}`;
  return (
    <PickerModal title={spell.name} subtitle={`${lvl} · ${spell.school || ""}`} onClose={onClose} t={t}>
      <div style={{ overflowY: "auto" }}>
        {loading ? <div style={{ padding: 16, color: t.textDim, fontSize: 13 }}>Loading…</div>
          : !data ? <div style={{ padding: 16, color: t.textDim, fontSize: 13 }}>Couldn't load spell details.</div>
          : (
            <>
              {row("Casting Time", data.casting_time)}
              {row("Range", data.range)}
              {row("Components", [data.components, data.material].filter(Boolean).join(" "))}
              {row("Duration", data.duration)}
              <div style={{ borderTop: `1px solid ${t.border}`, margin: "12px 0" }} />
              <div style={{ fontSize: 14, color: t.textMid, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{data.desc}</div>
              {data.higher_level && (
                <>
                  <div style={{ marginTop: 14, marginBottom: 4, fontWeight: 700, color: t.accent, fontSize: 13 }}>At Higher Levels.</div>
                  <div style={{ fontSize: 14, color: t.textMid, lineHeight: 1.7 }}>{data.higher_level}</div>
                </>
              )}
            </>
          )}
      </div>
    </PickerModal>
  );
}

// Spells tab: slots auto-derived from class + level (track usage), and a
// class/level-limited spell picker.
function SpellsTab({ char, updateChar, t, isMobile }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [infoSpell, setInfoSpell] = useState(null);
  const [castMsg, setCastMsg] = useState(null);
  const castTimer = useRef(null);
  useEffect(() => () => clearTimeout(castTimer.current), []);
  function flash(msg) {
    setCastMsg(msg);
    clearTimeout(castTimer.current);
    castTimer.current = setTimeout(() => setCastMsg(null), 1800);
  }
  const known = char.spells || [];
  const slots = slotsForCharacter(char.class, char.level);
  const usedMap = char.slotsUsed || {};
  const maxLvl = maxSpellLevel(char.class, char.level);
  const caps = spellCapacity(char.class, char.level, char.stats || {});
  const card = { background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius };
  const sortedKnown = [...known].sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
  const cantrips = sortedKnown.filter(s => s.level === 0);
  const leveled = sortedKnown.filter(s => s.level >= 1);

  function addSpell(sp) {
    if (!known.some(k => k.name === sp.name)) updateChar(ch => ({ ...ch, spells: [...(ch.spells || []), sp] }));
  }
  function removeSpell(name) {
    updateChar(ch => ({ ...ch, spells: (ch.spells || []).filter(s => s.name !== name) }));
  }
  function toggleSlot(level, idx) {
    updateChar(ch => {
      const cur = (ch.slotsUsed || {})[level] || 0;
      const used = idx < cur ? idx : idx + 1;
      return { ...ch, slotsUsed: { ...(ch.slotsUsed || {}), [level]: used } };
    });
  }
  function slotsLeft(level) {
    const slot = slots.find(s => s.level === level);
    if (!slot) return 0;
    return slot.total - Math.min(usedMap[level] || 0, slot.total);
  }
  function cast(sp) {
    // Leveled spells spend a slot; cantrips are at-will. (Damage rolls — later.)
    if (sp.level >= 1) {
      if (slotsLeft(sp.level) <= 0) return;
      updateChar(ch => {
        const slot = slots.find(s => s.level === sp.level);
        const cur = (ch.slotsUsed || {})[sp.level] || 0;
        return { ...ch, slotsUsed: { ...(ch.slotsUsed || {}), [sp.level]: Math.min(slot?.total ?? cur + 1, cur + 1) } };
      });
    }
    flash(`✨ Cast ${sp.name}`);
  }

  const spellCard = (sp) => {
    const left = slotsLeft(sp.level);
    const canCast = sp.level === 0 || left > 0;
    return (
      <div key={sp.name} style={{ ...card, padding: "10px 12px", borderLeft: `3px solid ${SCHOOL_COLORS[sp.school] || t.accent}`, display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => setInfoSpell(sp)} title="Spell details"
          style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{sp.name}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
            <span style={{ fontSize: 11, color: t.textDim }}>{sp.level === 0 ? "Cantrip" : `Level ${sp.level}`}</span>
            <span style={{ fontSize: 11, color: SCHOOL_COLORS[sp.school] || t.textDim, fontWeight: 600 }}>{sp.school}</span>
          </div>
        </button>
        <button onClick={() => cast(sp)} disabled={!canCast}
          title={sp.level === 0 ? "Cast cantrip (at will)" : left <= 0 ? "No slots left" : "Cast — uses a slot"}
          style={{ flexShrink: 0, background: canCast ? t.accentSoft : "transparent", color: canCast ? t.accent : t.textDim, border: `1px solid ${canCast ? t.accent : t.border}`, borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: canCast ? "pointer" : "default" }}>Cast</button>
        <button onClick={() => removeSpell(sp.name)} title="Remove" style={{ flexShrink: 0, background: "none", border: "none", color: t.textDim, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
    );
  };

  const sectionHead = (label, count, cap) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
      <h3 style={{ margin: 0, fontSize: 11, letterSpacing: 1, color: t.textDim, textTransform: "uppercase" }}>{label}</h3>
      <span style={{ fontSize: 11, color: count >= cap ? t.warn : t.textDim, fontWeight: 600 }}>{count}/{cap}</span>
    </div>
  );

  const grid = (list) => (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>{list.map(spellCard)}</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {castMsg && (
        <div style={{ background: t.accentSoft, color: t.accent, borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 700, textAlign: "center" }}>{castMsg}</div>
      )}
      {char.spellSaveDC != null && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ ...card, padding: 14, textAlign: "center", flex: "1 1 100px" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{char.spellSaveDC}</div>
            <div style={{ fontSize: 10, color: t.textDim, textTransform: "uppercase", fontWeight: 600 }}>Save DC</div>
          </div>
          <div style={{ ...card, padding: 14, textAlign: "center", flex: "1 1 100px" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{char.spellAttackBonus}</div>
            <div style={{ fontSize: 10, color: t.textDim, textTransform: "uppercase", fontWeight: 600 }}>Atk Bonus</div>
          </div>
        </div>
      )}

      {slots.length > 0 && (
        <div style={{ ...card, padding: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 11, letterSpacing: 1, color: t.textDim, textTransform: "uppercase" }}>Spell Slots</h3>
          {slots.map(s => {
            const used = Math.min(usedMap[s.level] || 0, s.total);
            return (
              <div key={s.level} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: t.textDim, width: 44, fontWeight: 600 }}>Lvl {s.level}</span>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {Array.from({ length: s.total }).map((_, i) => (
                    <button key={i} onClick={() => toggleSlot(s.level, i)} title={i < used ? "Used — click to restore" : "Available — click to use"}
                      style={{ width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${t.accent}`, background: i < used ? "transparent" : t.accent, cursor: "pointer", padding: 0 }} />
                  ))}
                </div>
                <span style={{ marginLeft: "auto", fontSize: 11, color: t.textDim }}>{s.total - used}/{s.total} left</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => setPickerOpen(true)} style={{ background: t.accent, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Add spell</button>
      </div>

      {caps.cantrips > 0 && (
        <div>
          {sectionHead("Cantrips", cantrips.length, caps.cantrips)}
          {cantrips.length === 0 ? <div style={{ fontSize: 13, color: t.textDim }}>None yet — add up to {caps.cantrips}.</div> : grid(cantrips)}
        </div>
      )}
      <div>
        {sectionHead("Spells", leveled.length, caps.spells)}
        {leveled.length === 0 ? <div style={{ fontSize: 13, color: t.textDim }}>None yet{caps.spells > 0 ? ` — add up to ${caps.spells}.` : "."}</div> : grid(leveled)}
      </div>

      {pickerOpen && (
        <SpellPicker cls={char.class} maxLvl={maxLvl} known={known} caps={caps}
          onAdd={addSpell} onClose={() => setPickerOpen(false)} t={t} />
      )}
      {infoSpell && <SpellInfoModal spell={infoSpell} onClose={() => setInfoSpell(null)} t={t} />}
    </div>
  );
}

function HPBar({ hp, t }) {
  const pct = Math.max(0, Math.min(100, (hp.current / hp.max) * 100));
  const color = pct > 60 ? t.good : pct > 30 ? t.warn : t.bad;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "baseline" }}>
        <span style={{ fontSize: 11, color: t.textDim, fontWeight: 600 }}>Hit Points</span>
        <span style={{ fontSize: 15, color: t.text, fontWeight: 700 }}>
          {hp.current}<span style={{ color: t.textDim, fontWeight: 400 }}> / {hp.max}</span>
          {hp.temp > 0 && <span style={{ color: t.temp, marginLeft: 6, fontWeight: 600 }}>+{hp.temp}</span>}
        </span>
      </div>
      <div style={{ background: t.panelAlt, borderRadius: 100, height: 10, border: `1px solid ${t.border}`, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.4s ease", borderRadius: 100 }} />
      </div>
    </div>
  );
}

function StatBox({ stat, score, mod, t }) {
  const sign = mod >= 0 ? "+" : "";
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, background: t.panelAlt, border: `1px solid ${t.border}`, borderRadius: t.radius, padding: "12px 6px", textAlign: "center" }}>
      <div style={{ fontSize: 10, letterSpacing: 1, color: t.textDim, fontWeight: 700 }}>{stat}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: t.text, margin: "4px 0 2px" }}>{sign}{mod}</div>
      <div style={{ fontSize: 11, color: t.textDim }}>{score}</div>
    </div>
  );
}

function Pip({ filled, t }) {
  return <div style={{ width: 11, height: 11, borderRadius: "50%", border: `1.5px solid ${t.borderStrong}`, background: filled ? t.accent : "transparent" }} />;
}

export default function CharactersPage() {
  const t = useTheme();
  const { user, configured } = useAuth();
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState("stats");
  const [showDM, setShowDM] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [condOpen, setCondOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hpAmount, setHpAmount] = useState("");
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [infoItem, setInfoItem] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [saveError, setSaveError] = useState(null);

  const char = characters.find(c => c.id === selectedId);
  const isDemo = !configured || !user;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 760);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load the signed-in user's saved characters; fall back to the sample party
  // as a read-only demo when logged out (or Supabase isn't configured).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      if (!configured || !user) {
        if (!cancelled) {
          setCharacters(SAMPLE_CHARACTERS);
          setSelectedId(SAMPLE_CHARACTERS[0].id);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("characters").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
      if (cancelled) return;
      const list = (data || []).map(row => ({ ...row.data, id: row.id }));
      setCharacters(list);
      setSelectedId(list[0]?.id ?? null);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [user, configured]);

  // Persist a character's full sheet immediately so changes survive a refresh.
  async function persist(updated) {
    if (isDemo) return; // sample party is in-session only
    const { id, ...data } = updated;
    const { error } = await supabase.from("characters").update({ data }).eq("id", id);
    setSaveError(error ? error.message : null);
  }

  // Mutate the selected character locally and save it.
  function updateChar(mutate) {
    const next = characters.map(ch => (ch.id === selectedId ? mutate(ch) : ch));
    setCharacters(next);
    const updated = next.find(ch => ch.id === selectedId);
    if (updated) persist(updated);
  }

  function addCondition(c) {
    if (!char.conditions.includes(c)) updateChar(ch => ({ ...ch, conditions: [...ch.conditions, c] }));
    setCondOpen(false);
  }
  function removeCondition(c) {
    updateChar(ch => ({ ...ch, conditions: ch.conditions.filter(x => x !== c) }));
  }

  function applyDamage(n) {
    updateChar(ch => {
      const absorbed = Math.min(ch.hp.temp || 0, n);
      const temp = (ch.hp.temp || 0) - absorbed;
      const current = Math.max(0, ch.hp.current - (n - absorbed));
      return { ...ch, hp: { ...ch.hp, current, temp } };
    });
  }
  function applyHeal(n) {
    updateChar(ch => ({ ...ch, hp: { ...ch.hp, current: Math.min(ch.hp.max, ch.hp.current + n) } }));
  }
  function setTempHp(n) {
    updateChar(ch => ({ ...ch, hp: { ...ch.hp, temp: Math.max(0, n) } }));
  }

  function addItem(item) {
    updateChar(ch => {
      const list = (ch.equipment || []).map(normItem);
      const i = list.findIndex(x => x.name === item.name && x.type === item.type);
      if (i >= 0) list[i] = { ...list[i], qty: list[i].qty + 1 };
      else list.push({ name: item.name, type: item.type || "Gear", qty: 1 });
      return { ...ch, equipment: list };
    });
  }
  function setItemQty(name, type, delta) {
    updateChar(ch => {
      const list = (ch.equipment || []).map(normItem);
      const i = list.findIndex(x => x.name === name && x.type === type);
      if (i < 0) return ch;
      const qty = Math.max(0, list[i].qty + delta);
      if (qty === 0) list.splice(i, 1); else list[i] = { ...list[i], qty };
      return { ...ch, equipment: list };
    });
  }
  function removeItemByKey(name, type) {
    updateChar(ch => ({ ...ch, equipment: (ch.equipment || []).map(normItem).filter(x => !(x.name === name && x.type === type)) }));
  }
  function toggleEquip(name, type) {
    updateChar(ch => ({
      ...ch,
      equipment: (ch.equipment || []).map(normItem).map(x => (x.name === name && x.type === type ? { ...x, equipped: !x.equipped } : x)),
    }));
  }

  async function deleteChar() {
    if (isDemo || !char || deleteInput.trim() !== char.name) return;
    const id = char.id;
    const remaining = characters.filter(c => c.id !== id);
    setCharacters(remaining);
    setSelectedId(remaining[0]?.id ?? null);
    setConfirmingDelete(false);
    setDeleteInput("");
    await supabase.from("characters").delete().eq("id", id);
  }

  function pickChar(id) {
    setSelectedId(id);
    setConfirmingDelete(false);
    setDeleteInput("");
    if (isMobile) setSidebarOpen(false);
  }

  const tabs = ["stats", "spells", "features", "gear", ...(char?.bio ? ["bio"] : [])];
  const card = { background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius };

  if (loading) {
    return <div style={{ padding: 60, textAlign: "center", color: t.textDim }}>Loading your party…</div>;
  }

  // Signed in with no characters yet — invite them to build one.
  if (!isDemo && characters.length === 0) {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "90px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🎭</div>
        <h1 style={{ fontSize: 26, marginBottom: 10 }}>No heroes yet</h1>
        <p style={{ color: t.textMid, fontSize: 16, lineHeight: 1.6, marginBottom: 26 }}>
          Your roster is empty. Forge your first character and it'll live here.
        </p>
        <Link to="/build" style={{
          textDecoration: "none", display: "inline-block", background: t.accent, color: "#fff",
          borderRadius: 9, padding: "12px 24px", fontSize: 15, fontWeight: 700,
        }}>⚔ Create a character</Link>
      </div>
    );
  }

  if (!char) return null;

  return (
    <div style={{ display: "flex", position: "relative", minHeight: "calc(100vh - 56px)" }}>
      {isMobile && (
        <button onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle party" style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 60, width: 52, height: 52,
          borderRadius: "50%", background: t.accent, color: "#fff", border: "none",
          fontSize: 20, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        }}>☰</button>
      )}

      <aside style={{
        width: 240, flexShrink: 0, background: t.panel, borderRight: `1px solid ${t.border}`,
        padding: "16px 10px", position: isMobile ? "fixed" : "sticky", top: isMobile ? 0 : 56,
        height: isMobile ? "100%" : "calc(100vh - 56px)", overflowY: "auto",
        left: isMobile ? (sidebarOpen ? 0 : -260) : 0, zIndex: 55, transition: "left 0.25s ease",
      }}>
        <div style={{ fontSize: 10, letterSpacing: 1.5, color: t.textDim, fontWeight: 700, padding: "0 8px 10px" }}>PARTY</div>
        {characters.map(c => {
          const pct = c.hp.current / c.hp.max;
          const dot = pct > 0.6 ? t.good : pct > 0.3 ? t.warn : t.bad;
          const sel = c.id === selectedId;
          return (
            <button key={c.id} onClick={() => pickChar(c.id)} style={{
              width: "100%", textAlign: "left", cursor: "pointer",
              background: sel ? t.accentSoft : "transparent",
              border: `1px solid ${sel ? t.accent : "transparent"}`,
              borderRadius: t.radius, padding: "10px 12px", marginBottom: 4,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>{c.avatar}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: sel ? t.accent : t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                <div style={{ fontSize: 11, color: t.textDim }}>Lv.{c.level} {c.class}</div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
            </button>
          );
        })}
        <Link to="/build" style={{
          display: "block", textAlign: "center", textDecoration: "none",
          width: "100%", marginTop: 8, boxSizing: "border-box",
          background: "transparent", border: `1.5px dashed ${t.border}`, borderRadius: t.radius,
          color: t.accent, padding: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
        }}>+ New character</Link>
        {isDemo && (
          <div style={{ fontSize: 10, color: t.textDim, textAlign: "center", marginTop: 8, lineHeight: 1.4 }}>
            Sample party shown — sign in to build your own.
          </div>
        )}
      </aside>

      {isMobile && sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50 }} />}

      <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? 16 : "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", flexShrink: 0, background: t.accentSoft, border: `2px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>{char.avatar}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 26, fontWeight: 700 }}>{char.name}</h1>
            <div style={{ fontSize: 14, color: t.textMid, marginTop: 2 }}>
              Level {char.level} {char.race} {char.class} · <span style={{ color: t.textDim }}>{char.subclass}</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {char.conditions.map(c => (
                <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: t.accentSoft, border: `1px solid ${t.border}`, color: t.accent, borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 600 }}>
                  {c}<button onClick={() => removeCondition(c)} style={{ background: "none", border: "none", color: t.accent, cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                </span>
              ))}
              <div style={{ position: "relative" }}>
                <button onClick={() => setCondOpen(!condOpen)} style={{ background: t.panelAlt, border: `1px dashed ${t.borderStrong}`, color: t.textMid, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Condition</button>
                {condOpen && (
                  <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 100, ...card, padding: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, width: 240, maxHeight: 220, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
                    {CONDITIONS.map(c => (
                      <button key={c} onClick={() => addCondition(c)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "6px 8px", borderRadius: 6, fontSize: 12, color: t.textMid }}>{c}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {!isDemo && (
            <button onClick={() => { setConfirmingDelete(true); setDeleteInput(""); }} title="Delete character"
              style={{ flexShrink: 0, background: t.panelAlt, color: t.textDim, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 14, cursor: "pointer" }}>🗑</button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
          {[{ l: "Armor Class", v: char.ac }, { l: "Initiative", v: char.initiative }, { l: "Speed", v: `${char.speed} ft` }, { l: "Prof. Bonus", v: `+${char.proficiencyBonus}` }].map(s => (
            <div key={s.l} style={{ ...card, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{s.v}</div>
              <div style={{ fontSize: 10, color: t.textDim, textTransform: "uppercase", fontWeight: 600, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}>
          <HPBar hp={char.hp} t={t} />
          <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
            <input type="number" min="0" value={hpAmount} onChange={e => setHpAmount(e.target.value)} placeholder="0"
              style={{ width: 64, padding: "7px 9px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text, fontSize: 14, outline: "none", textAlign: "center", boxSizing: "border-box" }} />
            <button onClick={() => { const n = parseInt(hpAmount) || 0; if (n > 0) { applyDamage(n); setHpAmount(""); } }}
              style={{ background: `${t.bad}1a`, color: t.bad, border: `1px solid ${t.bad}55`, borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>− Damage</button>
            <button onClick={() => { const n = parseInt(hpAmount) || 0; if (n > 0) { applyHeal(n); setHpAmount(""); } }}
              style={{ background: `${t.good}1a`, color: t.good, border: `1px solid ${t.good}55`, borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Heal</button>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: t.textDim, fontWeight: 600 }}>Temp HP</span>
              <input type="number" min="0" value={char.hp.temp || ""} onChange={e => setTempHp(parseInt(e.target.value) || 0)} placeholder="0"
                style={{ width: 56, padding: "7px 9px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text, fontSize: 14, outline: "none", textAlign: "center", boxSizing: "border-box" }} />
            </div>
          </div>
          {saveError && <div style={{ marginTop: 10, fontSize: 12, color: t.bad }}>Couldn't save: {saveError}</div>}
        </div>

        <div style={{ ...card, marginBottom: 16, overflow: "hidden" }}>
          <button onClick={() => setShowDM(!showDM)} style={{ width: "100%", background: showDM ? t.accentSoft : "transparent", border: "none", cursor: "pointer", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <span>🔒</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: showDM ? t.accent : t.textMid, textTransform: "uppercase" }}>DM Notes — Eyes Only</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: t.textDim, fontWeight: 600 }}>{showDM ? "Hide" : "Reveal"}</span>
          </button>
          {showDM && <div style={{ padding: "0 16px 16px", fontSize: 14, color: t.textMid, lineHeight: 1.6, fontStyle: "italic" }}>{char.dmNotes}</div>}
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: t.panelAlt, padding: 4, borderRadius: t.radius, border: `1px solid ${t.border}` }}>
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, border: "none", cursor: "pointer", background: activeTab === tab ? t.panel : "transparent", color: activeTab === tab ? t.accent : t.textMid, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{tab}</button>
          ))}
        </div>

        {activeTab === "stats" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {STAT_ORDER.map(s => <StatBox key={s} stat={s} score={char.statScores[s]} mod={char.stats[s]} t={t} />)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
              <div style={{ ...card, padding: 16 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 11, letterSpacing: 1, color: t.textDim, textTransform: "uppercase" }}>Saving Throws</h3>
                {STAT_ORDER.map(s => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <Pip filled={char.saveProf[s]} t={t} />
                    <span style={{ fontSize: 13, color: t.textMid, flex: 1 }}>{s}</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{char.saves[s] >= 0 ? "+" : ""}{char.saves[s]}</span>
                  </div>
                ))}
              </div>
              <div style={{ ...card, padding: 16 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 11, letterSpacing: 1, color: t.textDim, textTransform: "uppercase" }}>Skills</h3>
                {char.skills.map(sk => (
                  <div key={sk.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <Pip filled={sk.prof} t={t} />
                    <span style={{ fontSize: 13, color: t.textMid, flex: 1 }}>{sk.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{sk.mod >= 0 ? "+" : ""}{sk.mod}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "spells" && (
          <SpellsTab char={char} updateChar={updateChar} t={t} isMobile={isMobile} />
        )}

        {activeTab === "features" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {char.features.map((f, i) => {
              const { title, body } = parseTrait(f.desc || f.name);
              return (
                <div key={i} style={{ ...card, padding: "14px 16px" }}>
                  {title && <div style={{ fontSize: 14, fontWeight: 700, color: t.accent, marginBottom: 5 }}>{title}</div>}
                  <div style={{ fontSize: 14, color: t.textMid, lineHeight: 1.55 }}>{renderInline(body)}</div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "gear" && (() => {
          const items = (char.equipment || []).map(normItem);
          const iconFor = (it) => it.type === "Weapon" ? "⚔️" : it.type === "Armor" ? "🛡️" : it.name.includes("Pack") ? "🎒" : it.name.includes("Rations") ? "🍖" : "✨";
          const equipped = items.filter(it => it.equipped && (it.type === "Weapon" || it.type === "Armor"));
          const qtyBtn = { width: 22, height: 22, borderRadius: 6, border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text, cursor: "pointer", fontSize: 13, lineHeight: 1 };
          const itemCard = (it) => (
            <div key={it.type + it.name} style={{ ...card, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderLeft: it.equipped ? `3px solid ${t.accent}` : `1px solid ${t.border}` }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{iconFor(it)}</span>
              <button onClick={() => setInfoItem(it)} title="Item details"
                style={{ flex: 1, minWidth: 80, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</button>
              {(it.type === "Weapon" || it.type === "Armor") && (
                <button onClick={() => toggleEquip(it.name, it.type)} title={it.equipped ? "Unequip" : "Equip"}
                  style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "4px 9px", cursor: "pointer", border: `1px solid ${it.equipped ? t.accent : t.border}`, background: it.equipped ? t.accentSoft : "transparent", color: it.equipped ? t.accent : t.textMid }}>{it.equipped ? "Equipped" : "Equip"}</button>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <button onClick={() => setItemQty(it.name, it.type, -1)} style={qtyBtn}>−</button>
                <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{it.qty}</span>
                <button onClick={() => setItemQty(it.name, it.type, 1)} style={qtyBtn}>+</button>
              </div>
              <button onClick={() => removeItemByKey(it.name, it.type)} title="Remove" style={{ background: "none", border: "none", color: t.textDim, cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>
          );
          const grid = (list) => (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>{list.map(itemCard)}</div>
          );
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 11, letterSpacing: 1, color: t.textDim, textTransform: "uppercase" }}>Inventory</h3>
                <button onClick={() => setItemPickerOpen(true)} style={{ background: t.accent, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Add item</button>
              </div>
              {items.length === 0 ? (
                <div style={{ ...card, padding: 32, textAlign: "center", color: t.textDim, fontSize: 14 }}>No gear yet — use “Add item” to pick from SRD weapons, armor, and gear.</div>
              ) : (
                <>
                  {equipped.length > 0 && (
                    <div>
                      <h3 style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: 1, color: t.accent, textTransform: "uppercase" }}>Equipped</h3>
                      {grid(equipped)}
                    </div>
                  )}
                  {[["Weapon", "Weapons"], ["Armor", "Armor"], ["Gear", "Gear"]].map(([type, label]) => {
                    const group = items.filter(it => it.type === type);
                    if (group.length === 0) return null;
                    return (
                      <div key={type}>
                        <h3 style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: 1, color: t.textDim, textTransform: "uppercase" }}>{label}</h3>
                        {grid(group)}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })()}

        {activeTab === "bio" && char.bio && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div style={{ ...card, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, letterSpacing: 1, color: t.textDim, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Alignment</div>
                <div style={{ fontSize: 14, color: t.textMid }}>{char.bio.alignment || "—"}</div>
              </div>
              <div style={{ ...card, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, letterSpacing: 1, color: t.textDim, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Languages</div>
                <div style={{ fontSize: 14, color: t.textMid }}>{char.bio.languages?.length ? char.bio.languages.join(", ") : "—"}</div>
              </div>
            </div>
            {[
              ["Personality", char.bio.personality],
              ["Ideals", char.bio.ideals],
              ["Bonds", char.bio.bonds],
              ["Flaws", char.bio.flaws],
              ["Backstory", char.bio.backstory],
            ].filter(([, v]) => v).map(([label, v]) => (
              <div key={label} style={{ ...card, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, letterSpacing: 1, color: t.textDim, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 14, color: t.textMid, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {itemPickerOpen && (
        <ItemPicker onAdd={addItem} onClose={() => setItemPickerOpen(false)} t={t} />
      )}
      {infoItem && <ItemInfoModal item={infoItem} onClose={() => setInfoItem(null)} t={t} />}

      {/* Type-the-name delete confirmation */}
      {confirmingDelete && !isDemo && char && (
        <div onClick={() => { setConfirmingDelete(false); setDeleteInput(""); }}
          style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 400, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 16, padding: 26, boxShadow: "0 16px 48px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>Delete {char.name}?</h2>
            <p style={{ color: t.textMid, fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              This permanently deletes the character — it can't be undone. Type <strong style={{ color: t.text }}>{char.name}</strong> to confirm.
            </p>
            <input autoFocus value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder={char.name}
              onKeyDown={e => { if (e.key === "Enter" && deleteInput.trim() === char.name) deleteChar(); }}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setConfirmingDelete(false); setDeleteInput(""); }}
                style={{ background: t.panelAlt, color: t.textMid, border: `1px solid ${t.border}`, borderRadius: 9, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={deleteChar} disabled={deleteInput.trim() !== char.name}
                style={{ background: deleteInput.trim() === char.name ? t.bad : t.panelAlt, color: deleteInput.trim() === char.name ? "#fff" : t.textDim, border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: deleteInput.trim() === char.name ? "pointer" : "default" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

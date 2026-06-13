import { useState, useEffect, useRef } from "react";
import { useTheme } from "../ThemeContext.js";

const API = "https://api.open5e.com/v1";
const PAGE_SIZE = 20;

const SPELL_SCHOOLS = ["Abjuration","Conjuration","Divination","Enchantment","Evocation","Illusion","Necromancy","Transmutation"];
const MONSTER_TYPES = ["Aberration","Beast","Celestial","Construct","Dragon","Elemental","Fey","Fiend","Giant","Humanoid","Monstrosity","Ooze","Plant","Undead"];
const ITEM_RARITIES = ["Common","Uncommon","Rare","Very Rare","Legendary","Artifact"];
const CRS = ["0","1/8","1/4","1/2","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30"];

const SCHOOL_COLORS = {
  Evocation: "#e25555", Abjuration: "#4a90d9", Conjuration: "#9b59b6",
  Illusion: "#1abc9c", Divination: "#e6b800", Enchantment: "#e84393",
  Necromancy: "#2ecc71", Transmutation: "#e67e22",
};

const RARITY_COLORS = {
  common: "#9aa3ad", uncommon: "#1dc96a", rare: "#4a90d9",
  "very rare": "#9b59b6", legendary: "#e6a817", artifact: "#e25555",
};

function statMod(score) {
  const m = Math.floor((score - 10) / 2);
  return (m >= 0 ? "+" : "") + m;
}

function crLabel(cr) {
  const map = { "0.125": "1/8", "0.25": "1/4", "0.5": "1/2" };
  return map[String(cr)] ?? String(cr);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatBubble({ label, score, t }) {
  return (
    <div style={{ textAlign: "center", flex: "1 1 0", minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: t.text }}>{statMod(score)}</div>
      <div style={{ fontSize: 12, color: t.textDim }}>{score}</div>
    </div>
  );
}

function Divider({ t }) {
  return <div style={{ borderTop: `1px solid ${t.border}`, margin: "14px 0" }} />;
}

function PropRow({ label, value, t }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 14 }}>
      <span style={{ fontWeight: 700, color: t.accent, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ color: t.textMid }}>{value}</span>
    </div>
  );
}

function ActionBlock({ action, t }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <span style={{ fontWeight: 700, color: t.text, fontSize: 14 }}>{action.name}. </span>
      <span style={{ color: t.textMid, fontSize: 14, lineHeight: 1.6 }}>{action.desc}</span>
    </div>
  );
}

function SectionHead({ label, t }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 700, letterSpacing: 1.5, color: t.accent,
      textTransform: "uppercase", borderBottom: `2px solid ${t.accent}`,
      paddingBottom: 6, marginBottom: 12, marginTop: 18,
    }}>{label}</div>
  );
}

// ── Monster Stat Block ──────────────────────────────────────────────────────

function MonsterDetail({ m, t, onClose }) {
  const saves = [];
  if (m.strength_save != null) saves.push(`STR +${m.strength_save}`);
  if (m.dexterity_save != null) saves.push(`DEX +${m.dexterity_save}`);
  if (m.constitution_save != null) saves.push(`CON +${m.constitution_save}`);
  if (m.intelligence_save != null) saves.push(`INT +${m.intelligence_save}`);
  if (m.wisdom_save != null) saves.push(`WIS +${m.wisdom_save}`);
  if (m.charisma_save != null) saves.push(`CHA +${m.charisma_save}`);

  const skillStr = m.skills && typeof m.skills === "object"
    ? Object.entries(m.skills).map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} +${v}`).join(", ")
    : null;

  const speedStr = m.speed && typeof m.speed === "object"
    ? Object.entries(m.speed).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(", ")
    : m.speed;

  return (
    <div style={{ padding: "28px 28px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: t.text }}>{m.name}</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", color: t.textDim, cursor: "pointer", fontSize: 22, padding: 0, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ fontSize: 14, color: t.textMid, fontStyle: "italic", marginBottom: 16 }}>
        {[m.size, m.type, m.subtype && `(${m.subtype})`, m.alignment].filter(Boolean).join(" ")}
      </div>

      <PropRow label="Armor Class" value={m.armor_desc ? `${m.armor_class} (${m.armor_desc})` : m.armor_class} t={t} />
      <PropRow label="Hit Points" value={`${m.hit_points} (${m.hit_dice})`} t={t} />
      <PropRow label="Speed" value={speedStr} t={t} />

      <Divider t={t} />

      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        {[["STR", m.strength], ["DEX", m.dexterity], ["CON", m.constitution],
          ["INT", m.intelligence], ["WIS", m.wisdom], ["CHA", m.charisma]].map(([l, s]) => (
          <StatBubble key={l} label={l} score={s} t={t} />
        ))}
      </div>

      <Divider t={t} />

      {saves.length > 0 && <PropRow label="Saving Throws" value={saves.join(", ")} t={t} />}
      {skillStr && <PropRow label="Skills" value={skillStr} t={t} />}
      {m.damage_vulnerabilities && <PropRow label="Vulnerabilities" value={m.damage_vulnerabilities} t={t} />}
      {m.damage_resistances && <PropRow label="Resistances" value={m.damage_resistances} t={t} />}
      {m.damage_immunities && <PropRow label="Immunities" value={m.damage_immunities} t={t} />}
      {m.condition_immunities && <PropRow label="Condition Immunities" value={m.condition_immunities} t={t} />}
      <PropRow label="Senses" value={m.senses} t={t} />
      <PropRow label="Languages" value={m.languages || "—"} t={t} />
      <PropRow label="Challenge" value={`${crLabel(m.challenge_rating)} (${m.cr} XP)`} t={t} />

      {m.special_abilities?.length > 0 && (
        <>
          <Divider t={t} />
          {m.special_abilities.map((a, i) => <ActionBlock key={i} action={a} t={t} />)}
        </>
      )}

      {m.actions?.length > 0 && (
        <>
          <SectionHead label="Actions" t={t} />
          {m.actions.map((a, i) => <ActionBlock key={i} action={a} t={t} />)}
        </>
      )}

      {m.bonus_actions?.length > 0 && (
        <>
          <SectionHead label="Bonus Actions" t={t} />
          {m.bonus_actions.map((a, i) => <ActionBlock key={i} action={a} t={t} />)}
        </>
      )}

      {m.reactions?.length > 0 && (
        <>
          <SectionHead label="Reactions" t={t} />
          {m.reactions.map((a, i) => <ActionBlock key={i} action={a} t={t} />)}
        </>
      )}

      {m.legendary_actions?.length > 0 && (
        <>
          <SectionHead label="Legendary Actions" t={t} />
          {m.legendary_desc && <p style={{ fontSize: 14, color: t.textMid, marginBottom: 12, lineHeight: 1.6 }}>{m.legendary_desc}</p>}
          {m.legendary_actions.map((a, i) => <ActionBlock key={i} action={a} t={t} />)}
        </>
      )}
    </div>
  );
}

// ── Spell Detail ────────────────────────────────────────────────────────────

function SpellDetail({ s, t, onClose }) {
  const school = s.school?.charAt(0).toUpperCase() + s.school?.slice(1);
  const schoolColor = SCHOOL_COLORS[school] ?? t.accent;
  const levelLabel = s.level_int === 0 ? "Cantrip" : `${s.level_int}${["st","nd","rd"][s.level_int - 1] || "th"}-level`;

  return (
    <div style={{ padding: "28px 28px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: t.text }}>{s.name}</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", color: t.textDim, cursor: "pointer", fontSize: 22, padding: 0, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ fontSize: 14, color: t.textMid, fontStyle: "italic", marginBottom: 16 }}>
        {levelLabel} {school}
        {s.ritual === "yes" && <span style={{ marginLeft: 8, color: schoolColor }}>(ritual)</span>}
        {s.concentration === "yes" && <span style={{ marginLeft: 8, color: schoolColor }}>(concentration)</span>}
      </div>

      <PropRow label="Casting Time" value={s.casting_time} t={t} />
      <PropRow label="Range" value={s.range} t={t} />
      <PropRow label="Components" value={[s.components, s.material].filter(Boolean).join(" ")} t={t} />
      <PropRow label="Duration" value={s.duration} t={t} />
      <PropRow label="Classes" value={s.dnd_class} t={t} />

      <Divider t={t} />

      <div style={{ fontSize: 14, color: t.textMid, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{s.desc}</div>

      {s.higher_level && (
        <>
          <div style={{ marginTop: 16, marginBottom: 6, fontWeight: 700, color: t.accent, fontSize: 14 }}>At Higher Levels.</div>
          <div style={{ fontSize: 14, color: t.textMid, lineHeight: 1.75 }}>{s.higher_level}</div>
        </>
      )}
    </div>
  );
}

// ── Item Detail ─────────────────────────────────────────────────────────────

function ItemDetail({ item, t, onClose }) {
  const rarityColor = RARITY_COLORS[item.rarity?.toLowerCase()] ?? t.textDim;
  return (
    <div style={{ padding: "28px 28px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: t.text }}>{item.name}</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", color: t.textDim, cursor: "pointer", fontSize: 22, padding: 0, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ fontSize: 14, marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ color: rarityColor, fontWeight: 700 }}>{item.rarity}</span>
        {item.type && <span style={{ color: t.textDim }}>· {item.type}</span>}
        {item.requires_attunement && <span style={{ color: t.textDim }}>· requires attunement</span>}
      </div>
      <Divider t={t} />
      <div style={{ fontSize: 14, color: t.textMid, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{item.desc}</div>
    </div>
  );
}

// ── Filter Chips ────────────────────────────────────────────────────────────

function FilterChips({ options, value, onChange, t }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button key={opt} onClick={() => onChange(active ? null : opt)} style={{
            padding: "4px 10px", borderRadius: 100, fontSize: 12, fontWeight: 600,
            border: `1px solid ${active ? t.accent : t.border}`,
            background: active ? t.accentSoft : "transparent",
            color: active ? t.accent : t.textDim, cursor: "pointer",
          }}>{opt}</button>
        );
      })}
    </div>
  );
}

// ── Result Cards ────────────────────────────────────────────────────────────

function SpellCard({ s, selected, onClick, t }) {
  const school = s.school?.charAt(0).toUpperCase() + s.school?.slice(1);
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", background: selected ? t.accentSoft : "transparent",
      border: `1px solid ${selected ? t.accent : t.border}`, borderRadius: 10,
      padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: SCHOOL_COLORS[school] ?? t.accent, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: selected ? t.accent : t.text, marginBottom: 2 }}>{s.name}</div>
        <div style={{ fontSize: 12, color: t.textDim }}>
          {s.level_int === 0 ? "Cantrip" : `Level ${s.level_int}`} · {school}
          {s.concentration === "yes" && " · C"}
          {s.ritual === "yes" && " · R"}
        </div>
      </div>
    </button>
  );
}

function MonsterCard({ m, selected, onClick, t }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", background: selected ? t.accentSoft : "transparent",
      border: `1px solid ${selected ? t.accent : t.border}`, borderRadius: 10,
      padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: selected ? t.accent : t.text, marginBottom: 2 }}>{m.name}</div>
        <div style={{ fontSize: 12, color: t.textDim }}>
          CR {crLabel(m.challenge_rating)} · {m.size} {m.type}
        </div>
      </div>
      <div style={{ fontSize: 12, color: t.textDim, flexShrink: 0 }}>HP {m.hit_points}</div>
    </button>
  );
}

function ItemCard({ item, selected, onClick, t }) {
  const rarityColor = RARITY_COLORS[item.rarity?.toLowerCase()] ?? t.textDim;
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", background: selected ? t.accentSoft : "transparent",
      border: `1px solid ${selected ? t.accent : t.border}`, borderRadius: 10,
      padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: selected ? t.accent : t.text, marginBottom: 2 }}>{item.name}</div>
        <div style={{ fontSize: 12, color: t.textDim }}>{item.type}</div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: rarityColor, flexShrink: 0 }}>{item.rarity}</div>
    </button>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function CompendiumPage() {
  const t = useTheme();
  const [tab, setTab] = useState("spells");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Spell filters
  const [spellLevel, setSpellLevel] = useState(null);
  const [spellSchool, setSpellSchool] = useState(null);
  // Monster filters
  const [monsterType, setMonsterType] = useState(null);
  const [monsterCR, setMonsterCR] = useState(null);
  // Item filters
  const [itemRarity, setItemRarity] = useState(null);

  const debounceRef = useRef(null);

  // Debounce search query
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Reset page when tab or filters change
  useEffect(() => { setPage(1); setSelected(null); }, [tab, spellLevel, spellSchool, monsterType, monsterCR, itemRarity]);

  // Fetch data
  useEffect(() => {
    let cancelled = false;
    async function fetch_() {
      setLoading(true);
      const params = new URLSearchParams({
        document__slug__in: "wotc-srd",
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      if (debouncedQuery) params.set("search", debouncedQuery);

      let endpoint = "spells";
      if (tab === "spells") {
        endpoint = "spells";
        if (spellLevel !== null) params.set("level_int", spellLevel === "Cantrip" ? "0" : spellLevel);
        if (spellSchool) params.set("school", spellSchool.toLowerCase());
      } else if (tab === "monsters") {
        endpoint = "monsters";
        if (monsterType) params.set("type", monsterType.toLowerCase());
        if (monsterCR) {
          const crMap = { "1/8": "0.125", "1/4": "0.25", "1/2": "0.5" };
          params.set("challenge_rating", crMap[monsterCR] ?? monsterCR);
        }
      } else {
        endpoint = "magicitems";
        if (itemRarity) params.set("rarity", itemRarity.toLowerCase());
      }

      try {
        const res = await fetch(`${API}/${endpoint}/?${params}`);
        const data = await res.json();
        if (!cancelled) {
          setResults(data.results ?? []);
          setTotalCount(data.count ?? 0);
        }
      } catch {
        if (!cancelled) setResults([]);
      }
      if (!cancelled) setLoading(false);
    }
    fetch_();
    return () => { cancelled = true; };
  }, [tab, debouncedQuery, page, spellLevel, spellSchool, monsterType, monsterCR, itemRarity]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasDetail = selected !== null;
  const card = { background: t.panel, border: `1px solid ${t.border}`, borderRadius: 14 };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden", background: t.bg }}>

      {/* ── Left panel ── */}
      <div style={{
        width: hasDetail ? 380 : "100%", flexShrink: 0,
        display: "flex", flexDirection: "column", borderRight: hasDetail ? `1px solid ${t.border}` : "none",
        transition: "width 0.2s ease",
      }}>

        {/* Tab bar */}
        <div style={{ padding: "14px 16px 0", background: t.panel, borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {["spells", "monsters", "items"].map(tb => (
              <button key={tb} onClick={() => { setTab(tb); setSelected(null); setQuery(""); }} style={{
                flex: 1, border: "none", cursor: "pointer", borderRadius: 8, padding: "8px 0",
                background: tab === tb ? t.accentSoft : "transparent",
                color: tab === tb ? t.accent : t.textDim,
                fontSize: 13, fontWeight: 700, textTransform: "capitalize",
              }}>{tb}</button>
            ))}
          </div>

          {/* Search */}
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${tab}…`}
            style={{
              width: "100%", padding: "9px 14px", borderRadius: 8,
              border: `1px solid ${t.border}`, background: t.panelAlt,
              color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box",
            }}
          />

          {/* Filters */}
          <div style={{ paddingBottom: 12, marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {tab === "spells" && (
              <>
                <FilterChips options={["Cantrip","1","2","3","4","5","6","7","8","9"]} value={spellLevel} onChange={setSpellLevel} t={t} />
                <FilterChips options={SPELL_SCHOOLS} value={spellSchool} onChange={setSpellSchool} t={t} />
              </>
            )}
            {tab === "monsters" && (
              <>
                <FilterChips options={MONSTER_TYPES} value={monsterType} onChange={setMonsterType} t={t} />
                <div style={{ overflowX: "auto", paddingBottom: 2 }}>
                  <div style={{ display: "flex", gap: 6, width: "max-content" }}>
                    <span style={{ fontSize: 12, color: t.textDim, alignSelf: "center", paddingRight: 4 }}>CR</span>
                    <FilterChips options={CRS} value={monsterCR} onChange={setMonsterCR} t={t} />
                  </div>
                </div>
              </>
            )}
            {tab === "items" && (
              <FilterChips options={ITEM_RARITIES} value={itemRarity} onChange={setItemRarity} t={t} />
            )}
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {loading && (
            <div style={{ textAlign: "center", padding: 40, color: t.textDim, fontSize: 14 }}>Loading…</div>
          )}
          {!loading && results.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: t.textDim, fontSize: 14 }}>No results found.</div>
          )}
          {!loading && results.map((item, i) => {
            const sel = selected?.name === item.name;
            if (tab === "spells") return <SpellCard key={i} s={item} selected={sel} onClick={() => setSelected(item)} t={t} />;
            if (tab === "monsters") return <MonsterCard key={i} m={item} selected={sel} onClick={() => setSelected(item)} t={t} />;
            return <ItemCard key={i} item={item} selected={sel} onClick={() => setSelected(item)} t={t} />;
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, padding: "12px 0", marginTop: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{
                background: t.panelAlt, border: `1px solid ${t.border}`, borderRadius: 8,
                padding: "6px 14px", color: page === 1 ? t.textDim : t.text, cursor: page === 1 ? "default" : "pointer", fontSize: 13,
              }}>← Prev</button>
              <span style={{ fontSize: 13, color: t.textDim }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{
                background: t.panelAlt, border: `1px solid ${t.border}`, borderRadius: 8,
                padding: "6px 14px", color: page === totalPages ? t.textDim : t.text, cursor: page === totalPages ? "default" : "pointer", fontSize: 13,
              }}>Next →</button>
            </div>
          )}
        </div>

        {/* Footer count */}
        {!loading && totalCount > 0 && (
          <div style={{ padding: "8px 16px", borderTop: `1px solid ${t.border}`, background: t.panel, fontSize: 12, color: t.textDim }}>
            {totalCount} {tab} in the SRD
          </div>
        )}
      </div>

      {/* ── Detail panel ── */}
      {hasDetail && (
        <div style={{ flex: 1, overflowY: "auto", background: t.bg }}>
          {tab === "monsters" && <MonsterDetail m={selected} t={t} onClose={() => setSelected(null)} />}
          {tab === "spells" && <SpellDetail s={selected} t={t} onClose={() => setSelected(null)} />}
          {tab === "items" && <ItemDetail item={selected} t={t} onClose={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}

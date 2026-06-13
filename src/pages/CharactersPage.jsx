import { useState, useEffect } from "react";
import { useTheme } from "../ThemeContext.js";
import {
  SAMPLE_CHARACTERS, CONDITIONS, STAT_ORDER, SCHOOL_COLORS,
} from "../data/characters.js";

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
  const [selectedId, setSelectedId] = useState(1);
  const [activeTab, setActiveTab] = useState("stats");
  const [showDM, setShowDM] = useState(false);
  const [characters, setCharacters] = useState(SAMPLE_CHARACTERS);
  const [condOpen, setCondOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const char = characters.find(c => c.id === selectedId);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 760);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function addCondition(c) {
    setCharacters(prev => prev.map(ch => ch.id === selectedId && !ch.conditions.includes(c) ? { ...ch, conditions: [...ch.conditions, c] } : ch));
    setCondOpen(false);
  }
  function removeCondition(c) {
    setCharacters(prev => prev.map(ch => ch.id === selectedId ? { ...ch, conditions: ch.conditions.filter(x => x !== c) } : ch));
  }
  function pickChar(id) { setSelectedId(id); if (isMobile) setSidebarOpen(false); }

  const tabs = ["stats", "spells", "features", "gear"];
  const card = { background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius };

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
        <button style={{ width: "100%", marginTop: 8, background: "transparent", border: `1.5px dashed ${t.border}`, borderRadius: t.radius, color: t.textDim, padding: 10, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ Import from D&D Beyond</button>
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
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
          {[{ l: "Armor Class", v: char.ac }, { l: "Initiative", v: char.initiative }, { l: "Speed", v: `${char.speed} ft` }, { l: "Prof. Bonus", v: `+${char.proficiencyBonus}` }].map(s => (
            <div key={s.l} style={{ ...card, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{s.v}</div>
              <div style={{ fontSize: 10, color: t.textDim, textTransform: "uppercase", fontWeight: 600, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{ ...card, padding: "16px 18px", marginBottom: 16 }}><HPBar hp={char.hp} t={t} /></div>

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
          char.spells.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div style={{ ...card, padding: 16, flex: "1 1 200px" }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 11, letterSpacing: 1, color: t.textDim, textTransform: "uppercase" }}>Spell Slots</h3>
                  {char.spellSlots.map(s => (
                    <div key={s.level} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: t.textDim, width: 14, fontWeight: 600 }}>{s.level}</span>
                      <div style={{ display: "flex", gap: 5 }}>
                        {Array.from({ length: s.total }).map((_, i) => (
                          <div key={i} style={{ width: 13, height: 13, borderRadius: "50%", border: `1.5px solid ${t.accent}`, background: i < s.used ? "transparent" : t.accent }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ ...card, padding: 16, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", flex: "1 1 100px" }}>
                  <div style={{ fontSize: 26, fontWeight: 700 }}>{char.spellSaveDC}</div>
                  <div style={{ fontSize: 10, color: t.textDim, textTransform: "uppercase", fontWeight: 600 }}>Save DC</div>
                </div>
                <div style={{ ...card, padding: 16, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", flex: "1 1 100px" }}>
                  <div style={{ fontSize: 26, fontWeight: 700 }}>{char.spellAttackBonus}</div>
                  <div style={{ fontSize: 10, color: t.textDim, textTransform: "uppercase", fontWeight: 600 }}>Atk Bonus</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {char.spells.map(sp => (
                  <div key={sp.name} style={{ ...card, padding: "12px 14px", borderLeft: `3px solid ${SCHOOL_COLORS[sp.school]}` }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{sp.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: t.textDim }}>Level {sp.level}</span>
                      <span style={{ fontSize: 11, color: SCHOOL_COLORS[sp.school], fontWeight: 600 }}>{sp.school}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ ...card, padding: 40, textAlign: "center", color: t.textDim }}>This character casts no spells.</div>
          )
        )}

        {activeTab === "features" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {char.features.map(f => (
              <div key={f.name} style={{ ...card, padding: "14px 16px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.accent, marginBottom: 5 }}>{f.name}</div>
                <div style={{ fontSize: 14, color: t.textMid, lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "gear" && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {char.equipment.map((item, i) => (
              <div key={i} style={{ ...card, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>{item.includes("gp") ? "🪙" : item.includes("Armor") ? "🛡️" : /Axe|Dagger|Staff/.test(item) ? "⚔️" : item.includes("Pack") ? "🎒" : "✨"}</span>
                <span style={{ fontSize: 13, color: t.textMid }}>{item}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../ThemeContext.js";
import { useAuth } from "../AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import {
  ABILITIES, SKILL_ABILITY, BACKGROUNDS, STANDARD_ARRAY, POINT_BUY_BUDGET, POINT_BUY_COST,
  ALIGNMENTS, LANGUAGES, abilityMod, fmtMod, bonusIncrements,
  fetchRaces, fetchClasses, buildCharacter,
} from "../lib/srd.js";

const AVATARS = ["🧙", "🧝", "🗡️", "🛡️", "🏹", "🪓", "🔮", "🐉", "⚔️", "🧌", "🦹", "👑"];
const STEPS = ["Identity", "Race", "Class", "Background", "Abilities", "Skills", "Roleplay", "Review"];

// Assign each racial increment to a distinct ability, honoring its default and
// filling any floating (null) increments with the first free ability.
function defaultAssign(increments) {
  const used = new Set();
  return increments.map(inc => {
    let ab = inc.ability && !used.has(inc.ability) ? inc.ability : ABILITIES.find(a => !used.has(a));
    used.add(ab);
    return ab;
  });
}

export default function BuilderPage() {
  const t = useTheme();
  const navigate = useNavigate();
  const { user, configured } = useAuth();

  const [step, setStep] = useState(0);
  const [races, setRaces] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [homebrew, setHomebrew] = useState(true);

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [raceName, setRaceName] = useState(null);
  const [subraceName, setSubraceName] = useState(null);
  const [className, setClassName] = useState(null);
  const [bgName, setBgName] = useState(null);
  const [method, setMethod] = useState("pointbuy");
  const [scores, setScores] = useState({ STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 });
  const [arrayAssign, setArrayAssign] = useState({ STR: "", DEX: "", CON: "", INT: "", WIS: "", CHA: "" });
  const [asiAssign, setAsiAssign] = useState([]); // ability per racial increment
  const [chosenSkills, setChosenSkills] = useState([]);
  const [bio, setBio] = useState({
    alignment: "", languages: ["Common"], personality: "", ideals: "", bonds: "", flaws: "", backstory: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const setBioField = (k, v) => setBio(prev => ({ ...prev, [k]: v }));
  const toggleLanguage = (lang) => setBio(prev => ({
    ...prev,
    languages: prev.languages.includes(lang) ? prev.languages.filter(l => l !== lang) : [...prev.languages, lang],
  }));

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchRaces(), fetchClasses()]).then(([r, c]) => {
      if (cancelled) return;
      setRaces(r); setClasses(c); setLoadingData(false);
    }).catch(() => !cancelled && setLoadingData(false));
    return () => { cancelled = true; };
  }, []);

  // Reset the racial-bonus assignment to the race's defaults when it changes.
  useEffect(() => {
    const r = races.find(x => x.name === raceName);
    const sr = (r?.subraces || []).filter(s => homebrew || !s.homebrew).find(s => s.name === subraceName);
    setAsiAssign(defaultAssign(bonusIncrements(r, sr)));
  }, [raceName, subraceName, homebrew, races]);

  const race = races.find(r => r.name === raceName);
  // Hide curated (homebrew) subraces when the toggle is off.
  const visibleSubraces = (race?.subraces || []).filter(s => homebrew || !s.homebrew);
  const subrace = visibleSubraces.find(s => s.name === subraceName);
  const cls = classes.find(c => c.name === className);
  const background = BACKGROUNDS.find(b => b.name === bgName);

  // Racial bonuses are assignable: derive increments, then sum the player's
  // chosen ability for each into a {ability: total} map.
  const increments = bonusIncrements(race, subrace);
  const raceBonuses = increments.reduce((acc, inc, i) => {
    const ab = asiAssign[i];
    if (ab) acc[ab] = (acc[ab] || 0) + inc.value;
    return acc;
  }, {});

  const baseScores = method === "array"
    ? Object.fromEntries(ABILITIES.map(a => [a, Number(arrayAssign[a]) || 8]))
    : scores;
  const finalScores = Object.fromEntries(ABILITIES.map(a => [a, baseScores[a] + (raceBonuses[a] || 0)]));

  const pointsSpent = ABILITIES.reduce((sum, a) => sum + (POINT_BUY_COST[scores[a]] ?? 0), 0);
  const arrayComplete = ABILITIES.every(a => arrayAssign[a] !== "");
  const bgSkills = background?.skills || [];
  const skillNeeded = cls?.skillChoice.count || 0;

  const card = { background: t.panel, border: `1px solid ${t.border}`, borderRadius: 14 };

  // Step validity gates the Next button.
  const stepValid = [
    name.trim().length > 0,
    Boolean(race),
    Boolean(cls),
    Boolean(background),
    method === "array" ? arrayComplete : pointsSpent <= POINT_BUY_BUDGET,
    chosenSkills.length === skillNeeded,
    true, // Roleplay — all optional
    true, // Review
  ][step];

  function toggleSkill(sk) {
    setChosenSkills(prev =>
      prev.includes(sk) ? prev.filter(s => s !== sk)
      : prev.length < skillNeeded ? [...prev, sk] : prev
    );
  }

  function adjustScore(ab, delta) {
    setScores(prev => {
      const next = prev[ab] + delta;
      if (next < 8 || next > 15) return prev;
      const trialSpent = ABILITIES.reduce((s, a) => s + (POINT_BUY_COST[a === ab ? next : prev[a]] ?? 0), 0);
      if (trialSpent > POINT_BUY_BUDGET) return prev;
      return { ...prev, [ab]: next };
    });
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const sheet = buildCharacter({ name: name.trim(), avatar, race, subrace, cls, background, baseScores, chosenSkills, bio, racialBonuses: raceBonuses });
      const { error } = await supabase.from("characters").insert({
        user_id: user.id, name: sheet.name, race: sheet.race, class: sheet.class, level: sheet.level, data: sheet,
      });
      if (error) throw error;
      navigate("/characters");
    } catch (err) {
      setError(err.message || "Couldn't save your character.");
      setSaving(false);
    }
  }

  // Auth gate — saving needs an account.
  if (configured && !user) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <h1 style={{ fontSize: 26, marginBottom: 10 }}>Sign in to forge a hero</h1>
        <p style={{ color: t.textMid, fontSize: 16 }}>Create an account from the top-right to start building and saving characters.</p>
      </div>
    );
  }

  const pill = (active) => ({
    fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 100, whiteSpace: "nowrap",
    border: `1px solid ${active ? t.accent : t.border}`,
    background: active ? t.accent : "transparent", color: active ? "#fff" : t.textDim,
  });

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 60px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Create a character</h1>
      <p style={{ color: t.textMid, fontSize: 14, marginBottom: 20 }}>Level 1 · built on the SRD</p>

      {/* Stepper */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ ...pill(i === step), opacity: i <= step ? 1 : 0.5 }}>
            {i + 1}. {s}
          </div>
        ))}
      </div>

      {loadingData ? (
        <div style={{ ...card, padding: 48, textAlign: "center", color: t.textDim }}>Summoning the SRD…</div>
      ) : (
        <div style={{ ...card, padding: 24, minHeight: 280 }}>

          {/* 0 · Identity */}
          {step === 0 && (
            <div>
              <h3 style={{ marginBottom: 16, fontSize: 18 }}>Who are they?</h3>
              <label style={{ fontSize: 12, fontWeight: 700, color: t.textDim, display: "block", marginBottom: 6 }}>NAME</label>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Thorne Blackwood"
                style={{ width: "100%", padding: "11px 13px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text, fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 20 }} />
              <label style={{ fontSize: 12, fontWeight: 700, color: t.textDim, display: "block", marginBottom: 8 }}>PORTRAIT</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                {AVATARS.map(a => (
                  <button key={a} onClick={() => setAvatar(a)} style={{
                    aspectRatio: "1", fontSize: 24, cursor: "pointer", borderRadius: 10,
                    background: a === avatar ? t.accentSoft : t.panelAlt,
                    border: `2px solid ${a === avatar ? t.accent : "transparent"}`,
                  }}>{a}</button>
                ))}
              </div>

              <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, background: t.panelAlt, borderRadius: 10, padding: "12px 14px" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Homebrew content</div>
                  <div style={{ fontSize: 12, color: t.textDim, marginTop: 2 }}>Include non-SRD options like Wood Elf, Drow, and Dragonborn ancestries.</div>
                </div>
                <button
                  onClick={() => {
                    const next = !homebrew;
                    setHomebrew(next);
                    if (!next && subrace?.homebrew) setSubraceName(null);
                  }}
                  aria-label="Toggle homebrew content"
                  style={{
                    flexShrink: 0, width: 48, height: 28, borderRadius: 100, border: "none", cursor: "pointer",
                    background: homebrew ? t.accent : t.border, position: "relative", transition: "background 0.15s",
                  }}>
                  <span style={{
                    position: "absolute", top: 3, left: homebrew ? 23 : 3, width: 22, height: 22,
                    borderRadius: "50%", background: "#fff", transition: "left 0.15s",
                  }} />
                </button>
              </div>
            </div>
          )}

          {/* 1 · Race */}
          {step === 1 && (
            <div>
              <h3 style={{ marginBottom: 16, fontSize: 18 }}>Choose a race</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                {races.map(r => {
                  const sel = r.name === raceName;
                  const bonusText = Object.entries(r.bonuses).map(([k, v]) => `${k} ${fmtMod(v)}`).join(" · ");
                  return (
                    <button key={r.name} onClick={() => { setRaceName(r.name); setSubraceName(null); }} style={{
                      textAlign: "left", cursor: "pointer", borderRadius: 10, padding: "12px 14px",
                      background: sel ? t.accentSoft : t.panelAlt, border: `2px solid ${sel ? t.accent : "transparent"}`,
                    }}>
                      <div style={{ fontWeight: 700, color: sel ? t.accent : t.text, fontSize: 14 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: t.textDim, marginTop: 3 }}>{bonusText || "—"}</div>
                    </button>
                  );
                })}
              </div>

              {visibleSubraces.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: t.textDim, letterSpacing: 0.5, marginBottom: 10 }}>
                    {(race.subraceLabel || "Subrace").toUpperCase()}
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                    {visibleSubraces.map(sr => {
                      const sel = sr.name === subraceName;
                      const bonusText = Object.entries(sr.bonuses).map(([k, v]) => `${k} ${fmtMod(v)}`).join(" · ") || sr.note;
                      return (
                        <button key={sr.name} onClick={() => setSubraceName(sr.name)} style={{
                          textAlign: "left", cursor: "pointer", borderRadius: 10, padding: "12px 14px",
                          background: sel ? t.accentSoft : t.panelAlt, border: `2px solid ${sel ? t.accent : "transparent"}`,
                        }}>
                          <div style={{ fontWeight: 700, color: sel ? t.accent : t.text, fontSize: 14 }}>{sr.name}</div>
                          <div style={{ fontSize: 11, color: t.textDim, marginTop: 3 }}>{bonusText || "—"}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2 · Class */}
          {step === 2 && (
            <div>
              <h3 style={{ marginBottom: 16, fontSize: 18 }}>Choose a class</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                {classes.map(c => {
                  const sel = c.name === className;
                  return (
                    <button key={c.name} onClick={() => { setClassName(c.name); setChosenSkills([]); }} style={{
                      textAlign: "left", cursor: "pointer", borderRadius: 10, padding: "12px 14px",
                      background: sel ? t.accentSoft : t.panelAlt, border: `2px solid ${sel ? t.accent : "transparent"}`,
                    }}>
                      <div style={{ fontWeight: 700, color: sel ? t.accent : t.text, fontSize: 14 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: t.textDim, marginTop: 3 }}>d{c.hitDie} · saves {c.saves.join(", ") || "—"}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3 · Background */}
          {step === 3 && (
            <div>
              <h3 style={{ marginBottom: 16, fontSize: 18 }}>Pick a background</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                {BACKGROUNDS.map(b => {
                  const sel = b.name === bgName;
                  return (
                    <button key={b.name} onClick={() => setBgName(b.name)} style={{
                      textAlign: "left", cursor: "pointer", borderRadius: 10, padding: "12px 14px",
                      background: sel ? t.accentSoft : t.panelAlt, border: `2px solid ${sel ? t.accent : "transparent"}`,
                    }}>
                      <div style={{ fontWeight: 700, color: sel ? t.accent : t.text, fontSize: 14 }}>{b.name}</div>
                      <div style={{ fontSize: 11, color: t.textDim, marginTop: 3 }}>{b.skills.join(", ")}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4 · Abilities */}
          {step === 4 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <h3 style={{ fontSize: 18 }}>Ability scores</h3>
                <div style={{ display: "flex", gap: 4, background: t.panelAlt, padding: 4, borderRadius: 9, border: `1px solid ${t.border}` }}>
                  <button onClick={() => setMethod("pointbuy")} style={{ ...pill(method === "pointbuy"), border: "none", cursor: "pointer" }}>Point buy</button>
                  <button onClick={() => setMethod("array")} style={{ ...pill(method === "array"), border: "none", cursor: "pointer" }}>Standard array</button>
                </div>
              </div>

              {method === "pointbuy" && (
                <div style={{ fontSize: 13, color: pointsSpent > POINT_BUY_BUDGET ? t.bad : t.textMid, marginBottom: 14 }}>
                  Points remaining: <strong>{POINT_BUY_BUDGET - pointsSpent}</strong> / {POINT_BUY_BUDGET}
                </div>
              )}
              {method === "array" && (
                <div style={{ fontSize: 13, color: t.textMid, marginBottom: 14 }}>Assign each value — {STANDARD_ARRAY.join(", ")}</div>
              )}

              {increments.length > 0 && (
                <div style={{ background: t.panelAlt, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.textDim, marginBottom: 8, letterSpacing: 0.5 }}>
                    RACIAL BONUS — ASSIGN ({subrace?.name || race?.name})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {increments.map((inc, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 8px" }}>
                        <span style={{ fontWeight: 700, color: t.accent, fontSize: 14 }}>+{inc.value}</span>
                        <select value={asiAssign[i] || ""} onChange={e => setAsiAssign(prev => prev.map((a, j) => (j === i ? e.target.value : a)))}
                          style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text, fontSize: 13 }}>
                          {ABILITIES.map(ab => (
                            <option key={ab} value={ab} disabled={asiAssign.some((a, j) => j !== i && a === ab)}>{ab}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  {increments.some(inc => inc.ability === null) && (
                    <div style={{ fontSize: 11, color: t.textDim, marginTop: 8 }}>This race lets you place some bonuses where you like.</div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ABILITIES.map(ab => {
                  const final = finalScores[ab];
                  const racial = raceBonuses[ab] || 0;
                  return (
                    <div key={ab} style={{ display: "flex", alignItems: "center", gap: 12, background: t.panelAlt, borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ width: 36, fontWeight: 700, color: t.textMid }}>{ab}</div>
                      {method === "pointbuy" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button onClick={() => adjustScore(ab, -1)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${t.border}`, background: t.panel, color: t.text, cursor: "pointer", fontWeight: 700 }}>−</button>
                          <div style={{ width: 24, textAlign: "center", fontWeight: 700, fontSize: 16 }}>{scores[ab]}</div>
                          <button onClick={() => adjustScore(ab, 1)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${t.border}`, background: t.panel, color: t.text, cursor: "pointer", fontWeight: 700 }}>+</button>
                        </div>
                      ) : (
                        <select value={arrayAssign[ab]} onChange={e => setArrayAssign(p => ({ ...p, [ab]: e.target.value }))}
                          style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.panel, color: t.text, fontSize: 14 }}>
                          <option value="">—</option>
                          {STANDARD_ARRAY.map((v, i) => {
                            const usedElsewhere = ABILITIES.some(o => o !== ab && Number(arrayAssign[o]) === v && arrayAssign[o] !== "");
                            // allow duplicates of equal values only if enough copies exist
                            const copiesNeeded = STANDARD_ARRAY.filter(x => x === v).length;
                            const copiesUsed = ABILITIES.filter(o => o !== ab && Number(arrayAssign[o]) === v).length;
                            return <option key={i} value={v} disabled={copiesUsed >= copiesNeeded && Number(arrayAssign[ab]) !== v && usedElsewhere}>{v}</option>;
                          })}
                        </select>
                      )}
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                        {racial > 0 && <span style={{ fontSize: 11, color: t.accent }}>racial {fmtMod(racial)}</span>}
                        <span style={{ fontSize: 12, color: t.textDim }}>= {final}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, minWidth: 30, textAlign: "right" }}>{fmtMod(abilityMod(final))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5 · Skills */}
          {step === 5 && (
            <div>
              <h3 style={{ marginBottom: 6, fontSize: 18 }}>Choose skill proficiencies</h3>
              <p style={{ fontSize: 13, color: t.textMid, marginBottom: 16 }}>
                {cls?.name}: pick <strong>{skillNeeded}</strong> ({chosenSkills.length}/{skillNeeded}).
                {bgSkills.length > 0 && <> Your background already grants <strong>{bgSkills.join(" & ")}</strong>.</>}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                {cls?.skillChoice.options.map(sk => {
                  const fromBg = bgSkills.includes(sk);
                  const sel = chosenSkills.includes(sk);
                  const disabled = fromBg || (!sel && chosenSkills.length >= skillNeeded);
                  return (
                    <button key={sk} disabled={disabled && !sel} onClick={() => toggleSkill(sk)} style={{
                      textAlign: "left", cursor: disabled && !sel ? "default" : "pointer", borderRadius: 9, padding: "9px 12px",
                      background: sel ? t.accentSoft : t.panelAlt, opacity: fromBg ? 0.55 : 1,
                      border: `2px solid ${sel ? t.accent : "transparent"}`,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: sel ? t.accent : t.text }}>{sk}</div>
                      <div style={{ fontSize: 10, color: t.textDim }}>{SKILL_ABILITY[sk]}{fromBg ? " · from background" : ""}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6 · Roleplay */}
          {step === 6 && (
            <div>
              <h3 style={{ marginBottom: 4, fontSize: 18 }}>Bring them to life</h3>
              <p style={{ fontSize: 13, color: t.textMid, marginBottom: 18 }}>All optional — flavor your hero, or skip ahead.</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: t.textDim, display: "block", marginBottom: 6 }}>ALIGNMENT</label>
                  <select value={bio.alignment} onChange={e => setBioField("alignment", e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text, fontSize: 14 }}>
                    <option value="">— choose —</option>
                    {ALIGNMENTS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: t.textDim, display: "block", marginBottom: 8 }}>LANGUAGES</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {LANGUAGES.map(lang => {
                      const on = bio.languages.includes(lang);
                      return (
                        <button key={lang} type="button" onClick={() => toggleLanguage(lang)} style={{
                          fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 100, cursor: "pointer",
                          border: `1px solid ${on ? t.accent : t.border}`,
                          background: on ? t.accentSoft : "transparent", color: on ? t.accent : t.textDim,
                        }}>{lang}</button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    ["personality", "Personality traits"],
                    ["ideals", "Ideals"],
                    ["bonds", "Bonds"],
                    ["flaws", "Flaws"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: t.textDim, display: "block", marginBottom: 6 }}>{label.toUpperCase()}</label>
                      <input value={bio[key]} onChange={e => setBioField(key, e.target.value)} placeholder={label}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                    </div>
                  ))}
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: t.textDim, display: "block", marginBottom: 6 }}>BACKSTORY</label>
                  <textarea value={bio.backstory} onChange={e => setBioField("backstory", e.target.value)} rows={4} placeholder="Where do they come from? What drives them?"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                </div>
              </div>
            </div>
          )}

          {/* 7 · Review */}
          {step === 7 && (
            <div>
              <h3 style={{ marginBottom: 16, fontSize: 18 }}>Review</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: t.accentSoft, border: `2px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{avatar}</div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{name || "Unnamed"}</div>
                  <div style={{ fontSize: 13, color: t.textMid }}>Level 1 {subrace?.name || race?.name} {cls?.name} · {background?.name}</div>
                  {bio.alignment && <div style={{ fontSize: 12, color: t.textDim, marginTop: 2 }}>{bio.alignment}</div>}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
                {[
                  { l: "HP", v: (cls?.hitDie || 0) + abilityMod(finalScores.CON) },
                  { l: "AC", v: 10 + abilityMod(finalScores.DEX) },
                  { l: "Speed", v: `${race?.speed || 30} ft` },
                ].map(s => (
                  <div key={s.l} style={{ background: t.panelAlt, borderRadius: 10, padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{s.v}</div>
                    <div style={{ fontSize: 10, color: t.textDim, textTransform: "uppercase", fontWeight: 600 }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {ABILITIES.map(ab => (
                  <div key={ab} style={{ flex: 1, background: t.panelAlt, borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: t.textDim, fontWeight: 700 }}>{ab}</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtMod(abilityMod(finalScores[ab]))}</div>
                    <div style={{ fontSize: 11, color: t.textDim }}>{finalScores[ab]}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, color: t.textMid }}>
                <strong>Proficient skills:</strong> {[...new Set([...chosenSkills, ...bgSkills])].join(", ") || "none"}
              </div>
              {error && <div style={{ marginTop: 14, fontSize: 13, color: t.bad, background: `${t.bad}1a`, padding: "8px 12px", borderRadius: 8 }}>{error}</div>}
            </div>
          )}
        </div>
      )}

      {/* Nav buttons */}
      {!loadingData && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <button onClick={() => step === 0 ? navigate("/characters") : setStep(s => s - 1)} style={{
            padding: "11px 20px", borderRadius: 9, border: `1px solid ${t.border}`,
            background: t.panelAlt, color: t.textMid, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>{step === 0 ? "Cancel" : "← Back"}</button>

          {step < STEPS.length - 1 ? (
            <button onClick={() => stepValid && setStep(s => s + 1)} disabled={!stepValid} style={{
              padding: "11px 24px", borderRadius: 9, border: "none",
              background: stepValid ? t.accent : t.panelAlt, color: stepValid ? "#fff" : t.textDim,
              fontSize: 14, fontWeight: 700, cursor: stepValid ? "pointer" : "default",
            }}>Next →</button>
          ) : (
            <button onClick={save} disabled={saving} style={{
              padding: "11px 28px", borderRadius: 9, border: "none",
              background: saving ? t.panelAlt : t.accent, color: saving ? t.textDim : "#fff",
              fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer",
            }}>{saving ? "Saving…" : "⚔ Create character"}</button>
          )}
        </div>
      )}
    </div>
  );
}

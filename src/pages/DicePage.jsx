import { useState, useEffect, useRef } from "react";
import { useTheme } from "../ThemeContext.js";
import { playDiceRoll, preloadDice, playCritSuccess, playCritFail } from "../lib/sound.js";

const DICE = [4, 6, 8, 10, 12, 20, 100];

const DIE_COLORS = {
  4: "#e25555", 6: "#e67e22", 8: "#e6b800",
  10: "#2ecc71", 12: "#1abc9c", 20: "#4a90d9", 100: "#9b59b6",
};

function sidesNum(s) {
  return parseInt(String(s).replace(/^d/, ""), 10);
}

// Dice size adapts to screen width so they look proportional on phone and desktop.
// Anchored so a ~1536px-wide desktop lands at scale 10; clamped for tiny/huge screens.
function scaleForWidth(w) {
  return Math.round(Math.max(5, Math.min(14, w / 154)));
}

function poolExpression(pool, modifier) {
  const parts = DICE.filter(s => pool[s]).map(s => `${pool[s]}d${s}`);
  let expr = parts.join(" + ") || "—";
  if (modifier > 0) expr += ` + ${modifier}`;
  if (modifier < 0) expr += ` − ${Math.abs(modifier)}`;
  return expr;
}

function exprFromGroups(groups, modifier) {
  const pool = groups.reduce((acc, g) => ({ ...acc, [g.sides]: g.rolls.length }), {});
  return poolExpression(pool, modifier);
}

function critOf(result) {
  if (!result) return null;
  const d20 = result.groups.find(g => g.sides === 20);
  if (!d20 || d20.rolls.length !== 1) return null;
  const v = d20.rolls[0].value;
  if (v === 20) return "success";
  if (v === 1) return "fail";
  return null;
}

function DieFace({ sides, value, t }) {
  const color = DIE_COLORS[sides] || t.accent;
  const isCrit = sides === 20 && value === 20;
  const isFail = sides === 20 && value === 1;
  return (
    <div title={`d${sides}`} style={{
      minWidth: 38, height: 38, padding: "0 8px", borderRadius: 8,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 16, fontWeight: 700,
      background: isCrit ? t.good : isFail ? t.bad : t.panelAlt,
      color: isCrit || isFail ? "#fff" : t.text,
      border: `1.5px solid ${isCrit ? t.good : isFail ? t.bad : color}`,
    }}>{value}</div>
  );
}

export default function DicePage() {
  const t = useTheme();
  const [pool, setPool] = useState({});
  const [modifier, setModifier] = useState(0);
  const [mode, setMode] = useState("normal");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [ready, setReady] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [diceFading, setDiceFading] = useState(false);
  const [vp, setVp] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  const boxRef = useRef(null);
  const pendingRef = useRef(null);   // { modifier, mode } captured at roll time
  const accentRef = useRef(t.accent);
  accentRef.current = t.accent;
  const fadeTimer = useRef(null);
  const clearTimer = useRef(null);

  const totalDice = DICE.reduce((n, s) => n + (pool[s] || 0), 0);
  const hasD20 = (pool[20] || 0) > 0;
  const crit = critOf(result);

  // Turn dice-box's group results into our render shape, applying adv/dis to d20s.
  function handleResults(groups) {
    const pending = pendingRef.current || { modifier: 0, mode: "normal" };
    const dice = groups.flatMap(g => g.rolls.map(r => ({ sides: sidesNum(r.sides), value: r.value })));

    const bySides = {};
    for (const d of dice) (bySides[d.sides] ||= []).push(d.value);

    const outGroups = [];
    let total = 0;
    for (const sides of DICE) {
      const values = bySides[sides];
      if (!values || !values.length) continue;

      if (sides === 20 && pending.mode !== "normal" && values.length === 2) {
        const keep = pending.mode === "advantage" ? Math.max(...values) : Math.min(...values);
        const alt = keep === values[0] ? values[1] : values[0];
        outGroups.push({ sides, rolls: [{ value: keep, kept: true, alt }] });
        total += keep;
      } else {
        outGroups.push({ sides, rolls: values.map(v => ({ value: v, kept: true })) });
        total += values.reduce((a, b) => a + b, 0);
      }
    }

    total += pending.modifier;
    const r = { groups: outGroups, modifier: pending.modifier, mode: pending.mode, total, ts: Date.now() };
    setResult(r);
    setHistory(h => [{ ...r, expr: exprFromGroups(outGroups, pending.modifier) }, ...h].slice(0, 15));
    setRolling(false);

    // Celebrate (or mourn) on ANY d20 that lands on 20 or 1, whatever else is
    // in the pool. Both can fire if one d20 nats and another fumbles.
    if (soundOn) {
      const d20 = r.groups.find(g => g.sides === 20);
      if (d20) {
        const values = d20.rolls.map(x => x.value);
        if (values.includes(20)) playCritSuccess();
        if (values.includes(1)) playCritFail();
      }
    }

    // Let the result linger, then fade the dice off the table and clear them.
    clearTimeout(fadeTimer.current);
    clearTimeout(clearTimer.current);
    fadeTimer.current = setTimeout(() => {
      setDiceFading(true);
      clearTimer.current = setTimeout(() => {
        try { boxRef.current?.clear(); } catch { /* no-op */ }
        setDiceFading(false);
      }, 650);
    }, 1800);
  }
  const handleResultsRef = useRef(handleResults);
  handleResultsRef.current = handleResults;

  // Initialise the 3D dice box once (dynamic import keeps Babylon off other pages).
  useEffect(() => {
    let cancelled = false;
    preloadDice();
    const stage = document.getElementById("dice-stage");
    if (stage) stage.innerHTML = "";

    (async () => {
      const { default: DiceBox } = await import("@3d-dice/dice-box");
      if (cancelled) return;
      const box = new DiceBox("#dice-stage", {
        assetPath: "/assets/dice-box/",
        theme: "default",
        themeColor: accentRef.current,
        scale: scaleForWidth(window.innerWidth),
        gravity: 1.5,
        shadowTransparency: 0.8,
      });
      await box.init();
      if (cancelled) return;
      box.onRollComplete = (groups) => handleResultsRef.current(groups);
      boxRef.current = box;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      boxRef.current = null;
      clearTimeout(fadeTimer.current);
      clearTimeout(clearTimer.current);
      const s = document.getElementById("dice-stage");
      if (s) s.innerHTML = "";
    };
  }, []);

  // Track viewport so the supersampled stage stays sized to the full screen.
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // Keep dice tinted to the active theme accent.
  useEffect(() => {
    if (boxRef.current && ready) {
      try { boxRef.current.updateConfig({ themeColor: t.accent }); } catch { /* no-op */ }
    }
  }, [t.accent, ready]);

  // Re-scale dice when the screen size changes (resize / phone rotate).
  useEffect(() => {
    if (boxRef.current && ready) {
      try { boxRef.current.updateConfig({ scale: scaleForWidth(vp.w) }); } catch { /* no-op */ }
    }
  }, [vp.w, ready]);

  function addDie(sides) { setPool(p => ({ ...p, [sides]: (p[sides] || 0) + 1 })); }
  function removeDie(sides) {
    setPool(p => {
      const next = { ...p };
      if (next[sides] > 1) next[sides] -= 1; else delete next[sides];
      return next;
    });
  }
  function clearAll() { setPool({}); setModifier(0); setMode("normal"); setResult(null); }

  function roll() {
    if (totalDice === 0 || !boxRef.current || rolling) return;
    const effMode = hasD20 ? mode : "normal";
    const notation = [];
    for (const sides of DICE) {
      const count = pool[sides] || 0;
      if (!count) continue;
      if (sides === 20 && effMode !== "normal") notation.push("2d20");
      else if (sides === 100) notation.push(`${count}d%`); // d% = a single d100, not a percentile pair
      else notation.push(`${count}d${sides}`);
    }
    pendingRef.current = { modifier, mode: effMode };
    // Cancel any pending fade so a fresh roll is fully visible.
    clearTimeout(fadeTimer.current);
    clearTimeout(clearTimer.current);
    setDiceFading(false);
    setRolling(true);
    setResult(null);
    if (soundOn) playDiceRoll();
    try {
      boxRef.current.roll(notation);
    } catch {
      setRolling(false);
    }
  }

  const card = { background: t.panel, border: `1px solid ${t.border}`, borderRadius: 14 };
  const segBtn = (active) => ({
    flex: 1, border: "none", cursor: hasD20 ? "pointer" : "default", borderRadius: 8, padding: "8px 0",
    background: active ? t.accent : "transparent", color: active ? "#fff" : t.textMid,
    fontSize: 13, fontWeight: 600,
  });

  return (
    <>
      {/* Full-screen 3D dice canvas — dice tumble across the whole viewport and bounce off
          the edges. The inner stage is 2× the viewport then downscaled (supersampling) so
          dice stay crisp despite the library forcing antialias off. Percentage sizing keeps
          it responsive on desktop and mobile, re-fitting on resize/rotate. */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 40, pointerEvents: "none", overflow: "hidden",
        opacity: diceFading ? 0 : 1, transition: "opacity 0.6s ease",
      }}>
        <div id="dice-stage" style={{
          width: vp.w * 2, height: vp.h * 2,
          transform: "scale(0.5)", transformOrigin: "top left",
        }} />
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 20px 48px", display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>

        {/* Sound toggle */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -4 }}>
          <button onClick={() => setSoundOn(s => !s)} title={soundOn ? "Mute dice" : "Unmute dice"} aria-label={soundOn ? "Mute dice" : "Unmute dice"}
            style={{ display: "flex", alignItems: "center", gap: 6, background: t.panelAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: t.textMid, fontSize: 13, fontWeight: 600 }}>
            <span>{soundOn ? "🔊" : "🔇"}</span> Sound
          </button>
        </div>

        {/* ── Result stage ── */}
        <div style={{
          ...card, padding: "28px 24px", textAlign: "center",
          background: crit === "success" ? t.accentSoft : t.panel,
          borderColor: crit === "success" ? t.good : crit === "fail" ? t.bad : t.border,
        }}>
          {rolling ? (
            <div style={{ color: t.textMid, fontSize: 16, padding: "28px 0", fontWeight: 600 }}>Rolling…</div>
          ) : !result ? (
            <div style={{ color: t.textDim, fontSize: 15, padding: "28px 0" }}>
              {ready
                ? <>Pick your dice below and hit <strong style={{ color: t.textMid }}>Roll</strong>.</>
                : "Warming up the dice…"}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: t.textDim, marginBottom: 8 }}>
                {exprFromGroups(result.groups, result.modifier)}
                {result.mode !== "normal" && <span style={{ color: t.accent, fontWeight: 600 }}> · {result.mode}</span>}
              </div>
              <div style={{
                fontSize: 56, fontWeight: 800, lineHeight: 1,
                color: crit === "success" ? t.good : crit === "fail" ? t.bad : t.text,
              }}>{result.total}</div>
              {crit && (
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, marginTop: 6, textTransform: "uppercase", color: crit === "success" ? t.good : t.bad }}>
                  {crit === "success" ? "Critical!" : "Critical Miss"}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 }}>
                {result.groups.map(g => g.rolls.map((r, i) => (
                  <span key={`${g.sides}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <DieFace sides={g.sides} value={r.value} t={t} />
                    {r.alt != null && <span style={{ fontSize: 12, color: t.textDim, textDecoration: "line-through" }}>{r.alt}</span>}
                  </span>
                )))}
                {result.modifier !== 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", fontSize: 15, fontWeight: 700, color: t.textMid, padding: "0 6px" }}>
                    {result.modifier > 0 ? `+${result.modifier}` : `−${Math.abs(result.modifier)}`}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Dice buttons ── */}
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: t.textDim, fontWeight: 700, marginBottom: 12 }}>DICE</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(86px, 1fr))", gap: 10 }}>
            {DICE.map(sides => {
              const count = pool[sides] || 0;
              return (
                <div key={sides} style={{ position: "relative" }}>
                  <button onClick={() => addDie(sides)} aria-label={`Add a d${sides}`} style={{
                    width: "100%", cursor: "pointer", borderRadius: 12, padding: "14px 0",
                    background: count ? t.accentSoft : t.panelAlt,
                    border: `2px solid ${count ? DIE_COLORS[sides] : t.border}`,
                    color: t.text, fontSize: 18, fontWeight: 700,
                  }}>d{sides}</button>
                  {count > 0 && (
                    <span style={{
                      position: "absolute", top: -8, right: -8, minWidth: 22, height: 22, pointerEvents: "none",
                      borderRadius: 11, background: DIE_COLORS[sides], color: "#fff",
                      fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px",
                    }}>{count}</span>
                  )}
                  {count > 0 && (
                    <button onClick={() => removeDie(sides)} aria-label={`Remove a d${sides}`} style={{
                      position: "absolute", bottom: -8, left: -8, width: 26, height: 26, borderRadius: 13,
                      background: t.panel, border: `1.5px solid ${t.borderStrong}`, color: t.textMid,
                      fontSize: 18, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>−</button>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: t.textDim, marginTop: 10 }}>Tap a die to add · tap − to remove</div>
        </div>

        {/* ── Modifier + advantage ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ ...card, padding: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: 1, color: t.textDim, fontWeight: 700, marginBottom: 12 }}>MODIFIER</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
              <button onClick={() => setModifier(m => m - 1)} style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text, fontSize: 22, cursor: "pointer", fontWeight: 700 }}>−</button>
              <div style={{ fontSize: 26, fontWeight: 800, minWidth: 56, textAlign: "center", color: t.text }}>{modifier > 0 ? `+${modifier}` : modifier}</div>
              <button onClick={() => setModifier(m => m + 1)} style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text, fontSize: 22, cursor: "pointer", fontWeight: 700 }}>+</button>
            </div>
          </div>

          <div style={{ ...card, padding: 18, opacity: hasD20 ? 1 : 0.5 }}>
            <div style={{ fontSize: 11, letterSpacing: 1, color: t.textDim, fontWeight: 700, marginBottom: 12 }}>
              D20 ROLL {!hasD20 && <span style={{ fontWeight: 400, textTransform: "none" }}>· add a d20</span>}
            </div>
            <div style={{ display: "flex", gap: 4, background: t.panelAlt, padding: 4, borderRadius: 10, border: `1px solid ${t.border}` }}>
              <button disabled={!hasD20} onClick={() => setMode("disadvantage")} style={segBtn(mode === "disadvantage")}>Disadv.</button>
              <button disabled={!hasD20} onClick={() => setMode("normal")} style={segBtn(mode === "normal")}>Normal</button>
              <button disabled={!hasD20} onClick={() => setMode("advantage")} style={segBtn(mode === "advantage")}>Adv.</button>
            </div>
            {hasD20 && mode !== "normal" && (
              <div style={{ fontSize: 11, color: t.textDim, marginTop: 8 }}>Rolls 2d20, keeps the {mode === "advantage" ? "higher" : "lower"}.</div>
            )}
          </div>
        </div>

        {/* ── Roll / Clear ── */}
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={roll} disabled={totalDice === 0 || !ready || rolling} style={{
            flex: 1, padding: "16px 0", borderRadius: 12, border: "none",
            background: (totalDice === 0 || !ready || rolling) ? t.panelAlt : t.accent,
            color: (totalDice === 0 || !ready || rolling) ? t.textDim : "#fff",
            fontSize: 17, fontWeight: 700, cursor: (totalDice === 0 || !ready || rolling) ? "default" : "pointer",
          }}>
            {rolling ? "Rolling…" : <>Roll {totalDice > 0 && `· ${poolExpression(pool, modifier)}`}</>}
          </button>
          <button onClick={clearAll} style={{
            padding: "16px 22px", borderRadius: 12, border: `1px solid ${t.border}`,
            background: t.panelAlt, color: t.textMid, fontSize: 15, fontWeight: 600, cursor: "pointer",
          }}>Clear</button>
        </div>

        {/* ── History ── */}
        {history.length > 0 && (
          <div style={{ ...card, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 11, letterSpacing: 1, color: t.textDim, fontWeight: 700 }}>HISTORY</div>
              <button onClick={() => setHistory([])} style={{ background: "none", border: "none", color: t.textDim, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Clear</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {history.map((h, i) => (
                <div key={h.ts + "-" + i} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
                  borderRadius: 8, background: i === 0 ? t.accentSoft : "transparent",
                  border: `1px solid ${i === 0 ? t.border : "transparent"}`,
                }}>
                  <span style={{ fontSize: 13, color: t.textMid, flex: 1, minWidth: 0 }}>
                    {h.expr}
                    {h.mode !== "normal" && <span style={{ color: t.accent }}> · {h.mode === "advantage" ? "adv" : "dis"}</span>}
                  </span>
                  <span style={{ fontSize: 12, color: t.textDim, whiteSpace: "nowrap" }}>
                    [{h.groups.flatMap(g => g.rolls.map(r => r.value)).join(", ")}]
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: t.text, minWidth: 36, textAlign: "right" }}>{h.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

import { createContext, useContext, useRef, useState, useEffect, useCallback } from "react";
import { playDiceRoll, playCritSuccess, playCritFail } from "./lib/sound.js";

// App-level 3D dice roller. Any component can call roll(notation, opts) to throw
// real dice on a shared full-screen overlay — used by the dice page's quick rolls,
// spell/weapon damage, etc. dice-box (Babylon) is imported lazily on first roll.

const DiceCtx = createContext(null);
export const useDice = () => useContext(DiceCtx);

function scaleForWidth(w) {
  return Math.round(Math.max(5, Math.min(14, w / 154)));
}

export function DiceProvider({ children }) {
  const boxRef = useRef(null);
  const pendingRef = useRef(null);
  const fadeTimer = useRef(null);
  const clearTimer = useRef(null);
  const [result, setResult] = useState(null); // { label, total, rolls, modifier }
  const [fading, setFading] = useState(false);
  const [vp, setVp] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      clearTimeout(fadeTimer.current);
      clearTimeout(clearTimer.current);
    };
  }, []);

  function handleComplete(groups) {
    const pending = pendingRef.current || {};
    const dice = groups.flatMap(g => g.rolls.map(r => ({ sides: parseInt(String(r.sides).replace(/^d/, ""), 10), value: r.value })));
    const rolls = dice.map(d => d.value);
    const total = rolls.reduce((a, b) => a + b, 0) + (pending.modifier || 0);
    setResult({ label: pending.label, total, rolls, modifier: pending.modifier || 0 });

    // Crit flair on a lone d20 (e.g. an attack roll).
    const d20s = dice.filter(d => d.sides === 20);
    if (d20s.length === 1) {
      if (d20s[0].value === 20) playCritSuccess();
      else if (d20s[0].value === 1) playCritFail();
    }

    clearTimeout(fadeTimer.current);
    clearTimeout(clearTimer.current);
    fadeTimer.current = setTimeout(() => {
      setFading(true);
      clearTimer.current = setTimeout(() => {
        try { boxRef.current?.clear(); } catch { /* no-op */ }
        setFading(false);
        setResult(null);
      }, 650);
    }, 2400);
  }

  async function ensureBox() {
    if (boxRef.current) return boxRef.current;
    const { default: DiceBox } = await import("@3d-dice/dice-box");
    const box = new DiceBox("#global-dice-stage", {
      assetPath: "/assets/dice-box/",
      theme: "default",
      scale: scaleForWidth(window.innerWidth),
      gravity: 1.5,
      shadowTransparency: 0.8,
    });
    await box.init();
    box.onRollComplete = (groups) => handleComplete(groups);
    boxRef.current = box;
    return box;
  }

  // notation: a string ("2d6") or array (["1d8","1d6"]). opts: { label, modifier }
  const roll = useCallback(async (notation, opts = {}) => {
    let box;
    try { box = await ensureBox(); } catch { return; }
    pendingRef.current = { label: opts.label, modifier: opts.modifier || 0 };
    clearTimeout(fadeTimer.current);
    clearTimeout(clearTimer.current);
    setFading(false);
    setResult(null);
    playDiceRoll();
    try { box.roll(Array.isArray(notation) ? notation : [notation]); } catch { /* no-op */ }
  }, []);

  return (
    <DiceCtx.Provider value={{ roll }}>
      {children}
      <div style={{ position: "fixed", inset: 0, zIndex: 80, pointerEvents: "none", overflow: "hidden", opacity: fading ? 0 : 1, transition: "opacity 0.6s ease" }}>
        <div id="global-dice-stage" style={{ width: vp.w * 2, height: vp.h * 2, transform: "scale(0.5)", transformOrigin: "top left" }} />
      </div>
      {result && (
        <div style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 90, pointerEvents: "none", background: "rgba(18,18,26,0.94)", color: "#fff", borderRadius: 14, padding: "12px 22px", textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.45)", minWidth: 120 }}>
          {result.label && <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 2 }}>{result.label}</div>}
          <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{result.total}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            [{result.rolls.join(", ")}]{result.modifier ? ` ${result.modifier > 0 ? "+" : "−"}${Math.abs(result.modifier)}` : ""}
          </div>
        </div>
      )}
    </DiceCtx.Provider>
  );
}

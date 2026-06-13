// Shared theme tokens for Chronicler.
// The prototype shipped four candidate themes; lock your pick here and
// every page/component reads from the same source of truth.

export const THEMES = {
  clean: {
    label: "Clean & Modern",
    bg: "#f5f6f8", panel: "#ffffff", panelAlt: "#fafbfc",
    border: "#e3e6ea", borderStrong: "#d0d5db",
    text: "#1a1d21", textMid: "#5a6470", textDim: "#9aa3ad",
    accent: "#4f46e5", accentSoft: "#eef0fd",
    good: "#16a34a", warn: "#ea8a0c", bad: "#dc2626", temp: "#0ea5e9",
    radius: "12px",
  },
  sleek: {
    label: "Sleek Dark",
    bg: "#0d0e12", panel: "#16181f", panelAlt: "#1b1e27",
    border: "#262a35", borderStrong: "#333845",
    text: "#e8eaed", textMid: "#9099a8", textDim: "#5a6373",
    accent: "#6366f1", accentSoft: "#1e1f3a",
    good: "#22c55e", warn: "#f59e0b", bad: "#ef4444", temp: "#38bdf8",
    radius: "10px",
  },
  soft: {
    label: "Soft Fantasy",
    bg: "#f4ede0", panel: "#fdfaf3", panelAlt: "#f9f2e6",
    border: "#e2d5be", borderStrong: "#d0bd9c",
    text: "#3a2f24", textMid: "#7a6a52", textDim: "#a89878",
    accent: "#a8763e", accentSoft: "#f3e6d2",
    good: "#5a8a4a", warn: "#c8891a", bad: "#b8482e", temp: "#3a8aa8",
    radius: "14px",
  },
  bold: {
    label: "Bold & Colorful",
    bg: "#13111c", panel: "#1e1b2e", panelAlt: "#252138",
    border: "#352f4d", borderStrong: "#473f63",
    text: "#f0edf7", textMid: "#a89fc0", textDim: "#6e6488",
    accent: "#f43f8e", accentSoft: "#2e1a2c",
    good: "#34d399", warn: "#fbbf24", bad: "#fb7185", temp: "#22d3ee",
    radius: "16px",
  },
};

// Your chosen default. Change this one line to re-theme the whole app.
export const ACTIVE_THEME = "clean";

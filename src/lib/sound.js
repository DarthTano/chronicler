// Dice + crit sounds. Real recordings (see public/sounds/CREDITS.txt):
//   dice roll — CC0, three takes played at random so rolls vary
//   crit success cheer — CC-BY (Gregor Quendel), nat 20
//   crit fail scream — CC0 (Rage Mode), nat 1

const ROLL_FILES = ["/sounds/dice-roll-1.wav", "/sounds/dice-roll-2.wav", "/sounds/dice-roll-3.wav"];
const CHEER_FILE = "/sounds/crit-success.mp3";
const RAGE_FILE = "/sounds/crit-fail.wav";

const cache = {};
function el(src) {
  if (!cache[src]) {
    const a = new Audio(src);
    a.preload = "auto";
    cache[src] = a;
  }
  return cache[src];
}

function play(src, volume) {
  try {
    // Clone so overlapping plays don't cut each other off.
    const a = el(src).cloneNode();
    a.volume = volume;
    a.play().catch(() => { /* autoplay/gesture guard — ignore */ });
  } catch { /* no Audio support — silent */ }
}

// Warm the cache when the dice page mounts so the first roll is instant.
export function preloadDice() {
  try { [...ROLL_FILES, CHEER_FILE, RAGE_FILE].forEach(el); } catch { /* no-op */ }
}

export function playDiceRoll() {
  play(ROLL_FILES[Math.floor(Math.random() * ROLL_FILES.length)], 0.8);
}

export function playCritSuccess() {
  play(CHEER_FILE, 0.85); // nat 20 — the tavern erupts
}

export function playCritFail() {
  play(RAGE_FILE, 0.85); // nat 1 — a scream of pure rage
}

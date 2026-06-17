// SRD data helpers for the character builder. Race/class data comes from the
// Open5e API; ability/skill maps and point-buy rules are encoded here.

const API = "https://api.open5e.com/v1";
const SRD = "document__slug__in=wotc-srd";

export const ABILITIES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

export const ABILITY_NAMES = {
  Strength: "STR", Dexterity: "DEX", Constitution: "CON",
  Intelligence: "INT", Wisdom: "WIS", Charisma: "CHA",
};

// Which ability governs each skill.
export const SKILL_ABILITY = {
  Athletics: "STR",
  Acrobatics: "DEX", "Sleight of Hand": "DEX", Stealth: "DEX",
  Arcana: "INT", History: "INT", Investigation: "INT", Nature: "INT", Religion: "INT",
  "Animal Handling": "WIS", Insight: "WIS", Medicine: "WIS", Perception: "WIS", Survival: "WIS",
  Deception: "CHA", Intimidation: "CHA", Performance: "CHA", Persuasion: "CHA",
};

export const ALL_SKILLS = Object.keys(SKILL_ABILITY);

// Curated backgrounds, each granting two skill proficiencies.
export const BACKGROUNDS = [
  { name: "Acolyte", skills: ["Insight", "Religion"] },
  { name: "Criminal", skills: ["Deception", "Stealth"] },
  { name: "Folk Hero", skills: ["Animal Handling", "Survival"] },
  { name: "Noble", skills: ["History", "Persuasion"] },
  { name: "Sage", skills: ["Arcana", "History"] },
  { name: "Soldier", skills: ["Athletics", "Intimidation"] },
  { name: "Outlander", skills: ["Athletics", "Survival"] },
  { name: "Entertainer", skills: ["Acrobatics", "Performance"] },
];

// Standard array and point-buy rules (5e).
export const ALIGNMENTS = [
  "Lawful Good", "Neutral Good", "Chaotic Good",
  "Lawful Neutral", "True Neutral", "Chaotic Neutral",
  "Lawful Evil", "Neutral Evil", "Chaotic Evil",
];

export const LANGUAGES = [
  "Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc",
  "Abyssal", "Celestial", "Draconic", "Deep Speech", "Infernal", "Primordial", "Sylvan", "Undercommon",
];

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export const abilityMod = (score) => Math.floor((score - 10) / 2);
export const fmtMod = (m) => (m >= 0 ? `+${m}` : `${m}`);

// SRD traits read like "_Name._ Body text…" or "**Name.** Body text…".
// Split off the leading bold/italic title from the rest.
export function parseTrait(text) {
  const m = (text || "").match(/^\s*(?:_([^_]+?)_|\*\*([^*]+?)\*\*)\s*([\s\S]*)$/);
  if (m) {
    const title = (m[1] || m[2] || "").replace(/[.\s]+$/, "").trim();
    return { title, body: (m[3] || "").trim() };
  }
  return { title: "", body: (text || "").trim() };
}

// ── Spell slots (auto-derived from class + level) ────────────────────────────

const FULL_CASTERS = ["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"];
const HALF_CASTERS = ["Paladin", "Ranger"];

const FULL_SLOTS = {
  1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3], 7: [4, 3, 3, 1],
  8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1], 10: [4, 3, 3, 3, 2], 11: [4, 3, 3, 3, 2, 1],
  12: [4, 3, 3, 3, 2, 1], 13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1],
  15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1], 17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1], 19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};
const HALF_SLOTS = {
  1: [], 2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2], 7: [4, 3], 8: [4, 3], 9: [4, 3, 2],
  10: [4, 3, 2], 11: [4, 3, 3], 12: [4, 3, 3], 13: [4, 3, 3, 1], 14: [4, 3, 3, 1],
  15: [4, 3, 3, 2], 16: [4, 3, 3, 2], 17: [4, 3, 3, 3, 1], 18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2],
};
const WARLOCK_SLOTS = { // [slotCount, slotLevel]
  1: [1, 1], 2: [2, 1], 3: [2, 2], 4: [2, 2], 5: [2, 3], 6: [2, 3], 7: [2, 4], 8: [2, 4], 9: [2, 5], 10: [2, 5],
  11: [3, 5], 12: [3, 5], 13: [3, 5], 14: [3, 5], 15: [3, 5], 16: [3, 5], 17: [4, 5], 18: [4, 5], 19: [4, 5], 20: [4, 5],
};

// Standard 5e spell slots for a single-class caster → [{ level, total }].
export function slotsForCharacter(cls, level = 1) {
  const lvl = Math.max(1, Math.min(20, level || 1));
  if (cls === "Warlock") {
    const [count, slotLvl] = WARLOCK_SLOTS[lvl] || [];
    return count ? [{ level: slotLvl, total: count }] : [];
  }
  if (FULL_CASTERS.includes(cls)) return (FULL_SLOTS[lvl] || []).map((total, i) => ({ level: i + 1, total }));
  if (HALF_CASTERS.includes(cls)) return (HALF_SLOTS[lvl] || []).map((total, i) => ({ level: i + 1, total }));
  return [];
}

// Highest spell level this character can cast (0 = none beyond cantrips).
export function maxSpellLevel(cls, level = 1) {
  const slots = slotsForCharacter(cls, level);
  return slots.length ? Math.max(...slots.map(s => s.level)) : 0;
}

// How many cantrips / leveled spells a class can have at a given level.
// (Level-1 values for now; prepared casters scale with their ability modifier.)
const CANTRIPS_KNOWN = { Bard: 2, Cleric: 3, Druid: 2, Sorcerer: 4, Warlock: 2, Wizard: 3 };
const SPELLS_KNOWN = { Bard: 4, Sorcerer: 2, Warlock: 2, Wizard: 6, Ranger: 0 }; // "known" casters
const PREPARED_ABILITY = { Cleric: "WIS", Druid: "WIS", Paladin: "CHA" }; // prepared = mod + level

// Which ability a class casts with (for spell attack/damage modifiers).
export const CLASS_SPELL_ABILITY = {
  Bard: "CHA", Cleric: "WIS", Druid: "WIS", Paladin: "CHA",
  Ranger: "WIS", Sorcerer: "CHA", Warlock: "CHA", Wizard: "INT",
};

export function spellCapacity(cls, level = 1, statMods = {}) {
  const cantrips = CANTRIPS_KNOWN[cls] || 0;
  let spells = 0;
  if (SPELLS_KNOWN[cls] != null) spells = SPELLS_KNOWN[cls];
  else if (PREPARED_ABILITY[cls]) spells = Math.max(1, (statMods[PREPARED_ABILITY[cls]] || 0) + (level || 1));
  return { cantrips, spells };
}

// ── Equipment ────────────────────────────────────────────────────────────────

// Common SRD adventuring gear (no dedicated API endpoint exists for it).
export const GEAR = [
  "Backpack", "Bedroll", "Blanket", "Caltrops", "Candle", "Chain (10 ft)", "Chalk", "Climber's Kit",
  "Component Pouch", "Crowbar", "Grappling Hook", "Hammer", "Healer's Kit", "Holy Symbol", "Hooded Lantern",
  "Hunting Trap", "Ink and Quill", "Iron Pot", "Lantern (Bullseye)", "Manacles", "Mess Kit", "Mirror (Steel)",
  "Oil (Flask)", "Parchment (sheet)", "Piton", "Pole (10 ft)", "Rations (1 day)", "Rope, Hempen (50 ft)",
  "Rope, Silk (50 ft)", "Sealing Wax", "Shovel", "Signal Whistle", "Soap", "Spellbook", "Tent (Two-Person)",
  "Thieves' Tools", "Tinderbox", "Torch", "Vial", "Waterskin", "Whetstone",
];

// Fetch the SRD weapons + armor, combined with curated gear, for the item picker.
export async function fetchEquipment() {
  const grab = (path) => fetch(`${API}/${path}/?${SRD}&limit=200`).then(r => r.json()).catch(() => ({ results: [] }));
  const [w, a] = await Promise.all([grab("weapons"), grab("armor")]);
  const weapons = (w.results || []).map(x => ({ name: x.name, type: "Weapon" }));
  const armor = (a.results || []).map(x => ({ name: x.name, type: "Armor" }));
  const gear = GEAR.map(name => ({ name, type: "Gear" }));
  return [...weapons, ...armor, ...gear].sort((p, q) => p.name.localeCompare(q.name));
}

// ── Fetch + normalise ───────────────────────────────────────────────────────

// Common 5e subraces beyond the SRD, encoded as game mechanics only (names,
// ability bonuses, speeds, functional notes — no book prose). Set this to {}
// to revert to strict SRD-only subraces.
const CURATED_SUBRACES = {
  Dwarf: [
    { name: "Mountain Dwarf", bonuses: { STR: 2 }, traits: ["+2 Strength", "Trained in light and medium armor"] },
  ],
  Elf: [
    { name: "Wood Elf", bonuses: { WIS: 1 }, speed: 35, traits: ["+1 Wisdom", "Walking speed 35 ft", "Can try to hide when only lightly obscured by foliage or weather"] },
    { name: "Drow (Dark Elf)", bonuses: { CHA: 1 }, traits: ["+1 Charisma", "Darkvision out to 120 ft", "Disadvantage on attacks and Perception in direct sunlight", "Knows the Dancing Lights cantrip"] },
  ],
  Gnome: [
    { name: "Forest Gnome", bonuses: { DEX: 1 }, traits: ["+1 Dexterity", "Knows the Minor Illusion cantrip", "Can speak simple ideas to Small beasts"] },
    { name: "Deep Gnome", bonuses: { DEX: 1 }, traits: ["+1 Dexterity", "Darkvision out to 120 ft", "Advantage on Stealth to hide in rocky terrain"] },
  ],
};

// Dragonborn draconic ancestry: dragon colour → damage type. Modeled as a
// "subrace" choice so it flows through the same UI.
const DRAGON_ANCESTRY = [
  ["Black", "Acid"], ["Blue", "Lightning"], ["Brass", "Fire"], ["Bronze", "Lightning"],
  ["Copper", "Acid"], ["Gold", "Fire"], ["Green", "Poison"], ["Red", "Fire"],
  ["Silver", "Cold"], ["White", "Cold"],
].map(([color, dmg]) => ({
  name: `${color} (${dmg})`,
  bonuses: {},
  note: `${dmg} damage`,
  traits: [`Draconic ancestry: resistance to ${dmg.toLowerCase()} and a ${dmg.toLowerCase()} breath weapon`],
}));

// Merge SRD subraces (from the API) with our curated additions, de-duped by name.
function mergeSubraces(raceName, apiSubraces) {
  const out = [...apiSubraces];
  const have = new Set(out.map(s => s.name));
  // Our hand-authored additions are flagged homebrew so a toggle can hide them.
  const extra = (raceName === "Dragonborn" ? DRAGON_ANCESTRY : (CURATED_SUBRACES[raceName] || []))
    .map(s => ({ ...s, homebrew: true }));
  for (const sr of extra) if (!have.has(sr.name)) out.push(sr);
  return out;
}

// asi can be an array (races) or a single object (subraces) → { STR: 2, ... }
function asiToBonuses(asi) {
  const list = Array.isArray(asi) ? asi : asi ? [asi] : [];
  return list.reduce((acc, a) => {
    for (const attr of a.attributes || []) {
      const key = ABILITY_NAMES[attr];
      if (key) acc[key] = (acc[key] || 0) + a.value;
    }
    return acc;
  }, {});
}

function parseTraits(text, limit) {
  return (text || "")
    .split("\n")
    .map(line => line.replace(/\*\*/g, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

export async function fetchRaces() {
  const res = await fetch(`${API}/races/?${SRD}&limit=100`);
  const data = await res.json();
  return (data.results || []).map(r => ({
    name: r.name,
    speed: r.speed?.walk ?? 30,
    size: r.size,
    bonuses: asiToBonuses(r.asi),
    traits: parseTraits(r.traits, 8),
    vision: r.vision || "",
    subraceLabel: r.name === "Dragonborn" ? "Draconic Ancestry" : "Subrace",
    subraces: mergeSubraces(r.name, (r.subraces || []).map(sr => ({
      name: sr.name,
      bonuses: asiToBonuses(sr.asi),
      traits: parseTraits(sr.traits, 6),
    }))),
  }));
}

// Combined ability bonuses from a race plus an optional chosen subrace.
export function combineBonuses(race, subrace) {
  const out = { ...(race?.bonuses || {}) };
  for (const [k, v] of Object.entries(subrace?.bonuses || {})) out[k] = (out[k] || 0) + v;
  return out;
}

// Break a race's bonuses into assignable increments, e.g. {CON:2, WIS:1} →
// [{value:2, ability:"CON"}, {value:1, ability:"WIS"}]. `ability: null` means a
// floating +1 the player must place. Defaults preserve the standard race.
export function bonusIncrements(race, subrace) {
  const combined = combineBonuses(race, subrace);
  const incs = Object.entries(combined).map(([ability, value]) => ({ ability, value }));
  incs.sort((a, b) => b.value - a.value);
  // SRD encodes Half-Elf as only +2 CHA; add its two "+1 of your choice".
  if ((race?.name || "").includes("Half-Elf")) {
    incs.push({ ability: null, value: 1 }, { ability: null, value: 1 });
  }
  return incs;
}

// "Choose two from Animal Handling, Athletics, and Survival" → { count, options }
function parseSkillChoice(text) {
  if (!text) return { count: 0, options: [] };
  text = text.replace(/Animal,\s*Handling/gi, "Animal Handling"); // source-data typo
  const words = { any: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const countMatch = text.match(/choose (\w+)/i);
  let count = countMatch ? (words[countMatch[1].toLowerCase()] ?? (parseInt(countMatch[1], 10) || 0)) : 0;

  const fromIdx = text.toLowerCase().indexOf("from ");
  let options;
  if (fromIdx === -1 || /any/i.test(text)) {
    options = ALL_SKILLS; // "choose any N skills"
  } else {
    options = text.slice(fromIdx + 5)
      .replace(/\band\b/gi, ",")
      .split(",")
      .map(s => s.replace(/skills?/i, "").trim())
      .filter(s => ALL_SKILLS.includes(s));
  }
  if (!count && /any/i.test(text)) {
    const n = text.match(/any (\w+)/i);
    count = n ? (words[n[1].toLowerCase()] ?? 0) : 0;
  }
  return { count, options };
}

// Assemble a full character sheet (matching the Characters page shape) from
// the builder's selections. Level 1, proficiency bonus +2.
export function buildCharacter({ name, avatar, race, subrace, cls, background, baseScores, chosenSkills, bio, racialBonuses }) {
  const PROF = 2;
  // Use the player's chosen assignment when provided; else the race default.
  const bonuses = racialBonuses || combineBonuses(race, subrace);

  const statScores = {};
  const stats = {};
  for (const ab of ABILITIES) {
    statScores[ab] = (baseScores[ab] || 8) + (bonuses[ab] || 0);
    stats[ab] = abilityMod(statScores[ab]);
  }

  const saveProf = {};
  for (const ab of cls.saves) saveProf[ab] = true;
  const saves = {};
  for (const ab of ABILITIES) saves[ab] = stats[ab] + (saveProf[ab] ? PROF : 0);

  const profSkills = new Set([...(chosenSkills || []), ...(background?.skills || [])]);
  const skills = ALL_SKILLS.map(sk => {
    const prof = profSkills.has(sk);
    return { name: sk, prof, mod: stats[SKILL_ABILITY[sk]] + (prof ? PROF : 0) };
  });

  const sc = cls.spellcastingAbility;
  const maxHp = cls.hitDie + stats.CON;

  const allTraits = [...(race.traits || []), ...(subrace?.traits || [])];

  return {
    name, avatar: avatar || "🧙",
    race: subrace?.name || race.name,
    baseRace: race.name,
    class: cls.name, subclass: "", background: background?.name || "",
    level: 1,
    hp: { current: maxHp, max: maxHp, temp: 0 },
    ac: 10 + stats.DEX,
    speed: subrace?.speed ?? race.speed,
    initiative: fmtMod(stats.DEX),
    proficiencyBonus: PROF,
    spellSaveDC: sc ? 8 + PROF + stats[sc] : null,
    spellAttackBonus: sc ? fmtMod(PROF + stats[sc]) : null,
    stats, statScores, saves, saveProf, skills,
    spellSlots: [], spells: [],
    features: allTraits.map(tr => {
      const { title } = parseTrait(tr);
      return { name: title || (tr.length > 48 ? tr.slice(0, 48) + "…" : tr), desc: tr };
    }),
    equipment: [],
    dmNotes: "",
    conditions: [],
    bio: {
      alignment: bio?.alignment || "",
      languages: bio?.languages || [],
      personality: bio?.personality || "",
      ideals: bio?.ideals || "",
      bonds: bio?.bonds || "",
      flaws: bio?.flaws || "",
      backstory: bio?.backstory || "",
    },
  };
}

export async function fetchClasses() {
  const res = await fetch(`${API}/classes/?${SRD}&limit=100`);
  const data = await res.json();
  return (data.results || []).map(c => {
    const hitDie = parseInt((c.hit_dice || "1d8").split("d")[1], 10) || 8;
    return {
      name: c.name,
      hitDie,
      saves: (c.prof_saving_throws || "")
        .split(",")
        .map(s => ABILITY_NAMES[s.trim()])
        .filter(Boolean),
      skillChoice: parseSkillChoice(c.prof_skills),
      spellcastingAbility: c.spellcasting_ability ? ABILITY_NAMES[c.spellcasting_ability] : null,
      armor: c.prof_armor || "",
      weapons: c.prof_weapons || "",
    };
  });
}

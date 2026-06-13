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
    features: allTraits.map(tr => ({ name: tr.length > 48 ? tr.slice(0, 48) + "…" : tr, desc: tr })),
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

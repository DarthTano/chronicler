// Sample party data. In Phase 1 this will be replaced by data loaded
// from Supabase, but it's useful seed data for building the UI against.

export const SAMPLE_CHARACTERS = [
  {
    id: 1, name: "Seraphine Ashveil", race: "Half-Elf", class: "Sorcerer",
    subclass: "Shadow Magic", level: 7, background: "Haunted One", avatar: "🧙‍♀️",
    hp: { current: 38, max: 45, temp: 0 }, ac: 13, speed: 30, initiative: "+3", proficiencyBonus: 3,
    spellSaveDC: 15, spellAttackBonus: "+7",
    stats: { STR: -1, DEX: 2, CON: 2, INT: 1, WIS: 0, CHA: 4 },
    statScores: { STR: 8, DEX: 14, CON: 14, INT: 12, WIS: 10, CHA: 18 },
    saves: { STR: -1, DEX: 2, CON: 5, INT: 1, WIS: 0, CHA: 7 },
    saveProf: { CON: true, CHA: true },
    skills: [
      { name: "Arcana", mod: 4, prof: true }, { name: "Deception", mod: 7, prof: true },
      { name: "Intimidation", mod: 7, prof: true }, { name: "Perception", mod: 3, prof: false },
      { name: "Stealth", mod: 5, prof: true },
    ],
    spellSlots: [{ level: 1, total: 4, used: 1 }, { level: 2, total: 3, used: 0 }, { level: 3, total: 3, used: 2 }, { level: 4, total: 1, used: 0 }],
    spells: [
      { name: "Shadow Blade", level: 2, school: "Illusion" }, { name: "Darkness", level: 2, school: "Evocation" },
      { name: "Counterspell", level: 3, school: "Abjuration" }, { name: "Fireball", level: 3, school: "Evocation" },
      { name: "Misty Step", level: 2, school: "Conjuration" }, { name: "Mage Armor", level: 1, school: "Abjuration" },
    ],
    features: [
      { name: "Eyes of the Dark", desc: "60ft darkvision. Can cast Darkness using sorcery points." },
      { name: "Strength of the Grave", desc: "When reduced to 0 HP, make a CHA save (DC 5 + damage) to drop to 1 HP instead." },
      { name: "Hound of Ill Omen", desc: "Spend 3 sorcery points to summon a howling shadow hound." },
    ],
    equipment: ["Arcane Focus (obsidian orb)", "Scholar's Pack", "Dagger +1", "Cloak of Elvenkind", "50 gp"],
    dmNotes: "Secretly working for the Dusk Court. Doesn't know the party paladin is hunting her former mentor.",
    conditions: ["Frightened"],
  },
  {
    id: 2, name: "Garron Stonefist", race: "Mountain Dwarf", class: "Fighter",
    subclass: "Battle Master", level: 7, background: "Soldier", avatar: "⚔️",
    hp: { current: 67, max: 67, temp: 10 }, ac: 18, speed: 25, initiative: "+1", proficiencyBonus: 3,
    spellSaveDC: null, spellAttackBonus: null,
    stats: { STR: 4, DEX: 1, CON: 3, INT: 0, WIS: 1, CHA: -1 },
    statScores: { STR: 18, DEX: 12, CON: 16, INT: 10, WIS: 12, CHA: 8 },
    saves: { STR: 7, DEX: 1, CON: 6, INT: 0, WIS: 1, CHA: -1 },
    saveProf: { STR: true, CON: true },
    skills: [
      { name: "Athletics", mod: 7, prof: true }, { name: "History", mod: 3, prof: true },
      { name: "Intimidation", mod: 2, prof: true }, { name: "Perception", mod: 4, prof: true },
    ],
    spellSlots: [], spells: [],
    features: [
      { name: "Action Surge", desc: "Take one additional action on your turn. Once per short rest." },
      { name: "Combat Superiority", desc: "4d10 superiority dice per short rest. Maneuvers: Riposte, Precision Attack, Goading Attack." },
      { name: "Extra Attack (2)", desc: "Attack three times when you take the Attack action." },
    ],
    equipment: ["Plate Armor", "Battle Axe +1", "Handaxe ×3", "Explorer's Pack", "120 gp"],
    dmNotes: "Estranged from his clan. Will do anything to recover the Stone of Ancestors — even betray the party.",
    conditions: [],
  },
  {
    id: 3, name: "Lira Dawnwhisper", race: "Wood Elf", class: "Druid",
    subclass: "Circle of the Moon", level: 6, background: "Outlander", avatar: "🌿",
    hp: { current: 42, max: 42, temp: 0 }, ac: 14, speed: 35, initiative: "+2", proficiencyBonus: 3,
    spellSaveDC: 14, spellAttackBonus: "+6",
    stats: { STR: 0, DEX: 2, CON: 1, INT: 1, WIS: 4, CHA: 0 },
    statScores: { STR: 10, DEX: 14, CON: 12, INT: 13, WIS: 18, CHA: 10 },
    saves: { STR: 0, DEX: 2, CON: 1, INT: 4, WIS: 7, CHA: 0 },
    saveProf: { INT: true, WIS: true },
    skills: [
      { name: "Animal Handling", mod: 7, prof: true }, { name: "Medicine", mod: 7, prof: true },
      { name: "Nature", mod: 4, prof: true }, { name: "Perception", mod: 7, prof: true },
      { name: "Survival", mod: 7, prof: true },
    ],
    spellSlots: [{ level: 1, total: 4, used: 2 }, { level: 2, total: 3, used: 1 }, { level: 3, total: 3, used: 0 }],
    spells: [
      { name: "Moonbeam", level: 2, school: "Evocation" }, { name: "Call Lightning", level: 3, school: "Conjuration" },
      { name: "Healing Word", level: 1, school: "Evocation" }, { name: "Entangle", level: 1, school: "Conjuration" },
      { name: "Pass Without Trace", level: 2, school: "Abjuration" },
    ],
    features: [
      { name: "Wild Shape (CR 2)", desc: "Transform into any beast of CR 2 or lower twice per short rest." },
      { name: "Combat Wild Shape", desc: "Use Wild Shape as a bonus action; expend spell slots to regain HP while transformed." },
      { name: "Elemental Wild Shape", desc: "Expend two uses to transform into an air, earth, fire, or water elemental." },
    ],
    equipment: ["Leather Armor", "Quarterstaff", "Druidic Focus (yew wand)", "Herbalism Kit", "30 gp"],
    dmNotes: "Hears the Whispering Root — an ancient evil awakening beneath Thornwood. Has told no one.",
    conditions: [],
  },
];

export const CONDITIONS = ["Blinded","Charmed","Deafened","Frightened","Grappled","Invisible","Paralyzed","Poisoned","Prone","Restrained","Stunned","Unconscious"];
export const STAT_ORDER = ["STR","DEX","CON","INT","WIS","CHA"];
export const SCHOOL_COLORS = {
  Evocation: "#e25555", Abjuration: "#4a90d9", Conjuration: "#9b59b6",
  Illusion: "#1abc9c", Divination: "#e6b800", Enchantment: "#e84393",
  Necromancy: "#2ecc71", Transmutation: "#e67e22",
};

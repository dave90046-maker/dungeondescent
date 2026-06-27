"use strict";

/* ════════════════════════════════════════════════════════════
   GLOBAL GAME STATE  (GS)
   ════════════════════════════════════════════════════════════
   One object that holds everything worth saving between sessions.
   Every screen reads from and writes to GS — nothing else is
   persisted.  When the player saves (or autosaves on every step),
   the whole object is serialised to localStorage.

   Fields are filled in gradually as more screens are wired up:
     Stage 1  ─ profileName, dungeon position, screen, save/load
     Stage 2  ─ party, gold, starting gear, town state
     Stage 3+ ─ combat encounter state, cleared-rooms tracking
*/
const GS = {

  /* Which localStorage slot this session lives in */
  profileName: "",

  /* Array of canonical character objects (see makePremadeParty below
     for the full shape of each object) */
  party: [],

  /* Party gold */
  gold: 0,

  /* Current dungeon position — kept in sync with the `player`
     object in index.html so saves land in the right tile. */
  dungeon: {
    level: 0,   // index into LEVELS[] (0 = The Entry Hall)
    x:     1,   // tile column
    y:     1,   // tile row
    dir:   0,   // index into DIRECTIONS[] (0 = North)
  },

  /* Name of the screen that was active when the game last saved.
     continueGame() uses this to route the player back correctly. */
  screen: "profile",

  /* Non-null while a combat encounter is in progress.
     Populated by the combat screen in Stage 3. */
  combat: null,
};

/* ════════════════════════════════════════════════════════════
   SAVE / LOAD
   ════════════════════════════════════════════════════════════
   One localStorage entry per profile.
   Key format:  dungeon_descent_save_<profileName>

   autoSave()   — serialise GS → localStorage (call after any mutation)
   loadSave()   — restore localStorage → GS, returns true on success
   listSaves()  — sorted array of existing profile names
   deleteSave() — wipe one slot permanently
*/
const SAVE_PREFIX = "dungeon_descent_save_";

function autoSave() {
  if (!GS.profileName) return;
  try {
    localStorage.setItem(SAVE_PREFIX + GS.profileName, JSON.stringify(GS));
  } catch (e) {
    console.warn("autoSave failed:", e);
  }
}

function loadSave(name) {
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + name);
    if (!raw) return false;
    /* Object.assign merges the stored fields into the live GS object.
       Keys present in GS but missing from the save keep their defaults,
       so saves from earlier stages load cleanly into later builds. */
    Object.assign(GS, JSON.parse(raw));
    return true;
  } catch (e) {
    console.warn("loadSave failed:", e);
    return false;
  }
}

function listSaves() {
  const names = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(SAVE_PREFIX)) {
      names.push(key.slice(SAVE_PREFIX.length));
    }
  }
  return names.sort();
}

function deleteSave(name) {
  localStorage.removeItem(SAVE_PREFIX + name);
}

/* ════════════════════════════════════════════════════════════
   SCREEN ROUTING
   ════════════════════════════════════════════════════════════
   Every <div class="screen"> starts hidden (CSS display:none).
   showScreen() reveals exactly one and records the change in GS.

   Callers that need per-screen initialisation do it themselves
   right after calling showScreen — e.g.:
       showScreen("town");
       renderTown();
*/
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(el => {
    el.style.display = "none";
  });
  const el = document.getElementById("screen-" + name);
  if (el) el.style.display = "flex";
  GS.screen = name;
}

/* ════════════════════════════════════════════════════════════
   DICE & MATH
   ════════════════════════════════════════════════════════════ */

/* Roll n dice with `sides` faces each and return the total. */
function roll(n, sides) {
  let t = 0;
  for (let i = 0; i < n; i++) t += 1 + Math.floor(Math.random() * sides);
  return t;
}

/* Standard D&D ability score modifier: floor((score - 10) / 2) */
function statMod(v) { return Math.floor((v - 10) / 2); }

/* Format a modifier with its sign: 0→"+0", 2→"+2", -1→"-1" */
function fmtMod(m) { return m >= 0 ? "+" + m : String(m); }

/* ════════════════════════════════════════════════════════════
   PROGRESSION TABLES
   ════════════════════════════════════════════════════════════ */

/* Cumulative XP required to reach each level (index = level - 1).
   One shared table for all four classes (can split per class later). */
const XP_TABLE = [0, 1000, 2500, 5000, 10000, 20000, 40000, 80000, 160000, 320000];

/* Hit die size (max roll = max HP gain) per class */
const HIT_DIE = { fighter: 10, thief: 8, priest: 8, mage: 4 };

/* Which ability score is added to the attack roll */
const ATK_STAT = { fighter: "str", thief: "dex", priest: "str", mage: "str" };

/* Spells unlocked at each level.  Only levels with new spells are listed. */
const MAGE_SPELLS   = { 1:"Magic Missile", 3:"Sleep", 5:"Fireball", 7:"Lightning Bolt", 9:"Death Spell" };
const PRIEST_SPELLS = { 1:"Cure Light Wounds", 3:"Bless", 5:"Cure Serious Wounds", 7:"Dispel Undead", 9:"Heal" };

/* Maps the display spell name → the snake_case key used by the combat engine. */
const SPELL_KEY = {
  "Magic Missile":    "magic_missile",
  "Sleep":            "sleep",
  "Fireball":         "fireball",
  "Lightning Bolt":   "lightning_bolt",
  "Death Spell":      "death_spell",
  "Cure Light Wounds":"cure_light",
  "Bless":            "bless",
  "Cure Serious Wounds":"cure_serious",
  "Dispel Undead":    "dispel_undead",
  "Heal":             "heal",
};

/* ════════════════════════════════════════════════════════════
   ITEM CATALOGS
   ════════════════════════════════════════════════════════════
   Tiers 1-3 are sold at the Town Shop.
   Tier 4 (Flaming Sword, Dragon Scale, etc.) is dungeon-only —
   added as loot in a later stage.
*/
const WEAPONS = [
  { id:"dagger",    name:"Dagger",            dmg:"1d4",   tier:1, price:30,   usable:["fighter","thief","priest","mage"] },
  { id:"shortsword",name:"Short Sword",       dmg:"1d6",   tier:1, price:50,   usable:["fighter","thief"] },
  { id:"mace",      name:"Mace",              dmg:"1d6+1", tier:1, price:60,   usable:["fighter","priest"] },
  { id:"longsword", name:"Long Sword",        dmg:"1d8",   tier:2, price:150,  usable:["fighter","thief"] },
  { id:"warmace",   name:"War Mace",          dmg:"1d8+1", tier:2, price:180,  usable:["fighter","priest"] },
  { id:"handaxe",   name:"Hand Axe",          dmg:"1d6+2", tier:2, price:120,  usable:["fighter"] },
  { id:"silverls",  name:"Silver Long Sword", dmg:"1d8+2", tier:3, price:400,  usable:["fighter","thief"] },
  { id:"battleaxe", name:"Battle Axe",        dmg:"2d6",   tier:3, price:500,  usable:["fighter"] },
  { id:"flail",     name:"Flail",             dmg:"1d10",  tier:3, price:450,  usable:["fighter","priest"] },
];

const ARMORS = [
  { id:"robes",   name:"Robes",           ac:9, tier:1, price:20,   usable:["mage","priest"] },
  { id:"leather", name:"Leather Armor",   ac:8, tier:1, price:40,   usable:["fighter","thief","priest"] },
  { id:"studded", name:"Studded Leather", ac:7, tier:2, price:100,  usable:["fighter","thief","priest"] },
  { id:"chain",   name:"Chainmail",       ac:6, tier:2, price:200,  usable:["fighter","priest"] },
  { id:"banded",  name:"Banded Mail",     ac:4, tier:3, price:600,  usable:["fighter","priest"] },
  { id:"plate",   name:"Plate Mail",      ac:3, tier:3, price:1000, usable:["fighter"] },
];

function itemById(id, list) { return list.find(x => x.id === id) || null; }
function canUse(cls, item)  { return item.usable.includes(cls); }
function sellPrice(item)    { return Math.floor(item.price / 2); }

/* ════════════════════════════════════════════════════════════
   CHARACTER HELPERS
   ════════════════════════════════════════════════════════════
   These functions derive stats dynamically from the canonical
   character object rather than storing them as stale cached values.
*/

function isCaster(cls)   { return cls === "mage" || cls === "priest"; }
function castStatMod(c)  { return statMod(c.cls === "mage" ? c.stats.int : c.stats.wis); }

/* Total spell uses for one combat: 3 + floor(level/2) + casting-stat modifier */
function spellUsesMax(c) { return 3 + Math.floor(c.level / 2) + castStatMod(c); }

/* Computed attack bonus: class-base formula + relevant ability modifier */
function atkBonus(c) {
  const base = c.cls === "fighter" ? c.level
             : c.cls === "thief"   ? Math.floor(c.level * 0.75)
             : c.cls === "priest"  ? Math.floor(c.level / 2)
             :                       Math.floor(c.level / 3);
  return base + statMod(c.stats[ATK_STAT[c.cls]]);
}

/* Cumulative XP required to reach a level (returns Infinity at level cap). */
function xpForLevel(lv) { return (lv >= 1 && lv <= 10) ? XP_TABLE[lv - 1] : Infinity; }

function canLevelUp(c) {
  return c.level < 10 && c.xp >= xpForLevel(c.level + 1) && c.status === "active";
}

/* 0-100 percentage of XP progress toward the next level */
function xpPct(c) {
  const cur  = xpForLevel(c.level);
  const next = xpForLevel(c.level + 1);
  if (next === Infinity) return 100;
  return Math.min(100, Math.floor(((c.xp - cur) / (next - cur)) * 100));
}

/* CSS class name for an HP bar fill: "", "low", or "crit" */
function hpCls(c) {
  if (!c.hp || c.hp <= 0) return "crit";
  const r = c.hp / c.maxHp;
  return r <= 0.3 ? "crit" : r <= 0.6 ? "low" : "";
}

/* "1d6+1" → [1, 6, 1]  |  "2d8" → [2, 8, 0]  |  "1d4" → [1, 4, 0]
   Used by the combat engine in Stage 3. */
function parseDmg(str) {
  const m = str.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!m) return [1, 4, 0];
  return [parseInt(m[1]), parseInt(m[2]), m[3] ? parseInt(m[3]) : 0];
}

/* ════════════════════════════════════════════════════════════
   RACES & CLASSES
   ════════════════════════════════════════════════════════════
   Used by character creation (Stage 3).  Defined here so both
   the creation screen and the town hire function share the data.
*/
const RACES = {
  human:  { label:"Human",  mods:{ str: 0, dex: 0, con: 0, int: 0, wis: 0 }, poolBonus:10 },
  elf:    { label:"Elf",    mods:{ str:-1, dex: 1, con:-2, int: 2, wis: 0 }, poolBonus:0  },
  dwarf:  { label:"Dwarf",  mods:{ str: 2, dex:-2, con: 2, int:-2, wis: 0 }, poolBonus:0  },
  gnome:  { label:"Gnome",  mods:{ str:-2, dex:-2, con: 0, int: 2, wis: 2 }, poolBonus:0  },
  hobbit: { label:"Hobbit", mods:{ str:-2, dex: 3, con:-2, int: 0, wis: 1 }, poolBonus:0  },
};

const CLASSES = {
  fighter: { label:"Fighter", req:{ stat:"str", min:11 }, hitDie:10, atkStat:"str", row:"front" },
  thief:   { label:"Thief",   req:{ stat:"dex", min:11 }, hitDie:8,  atkStat:"dex", row:"front" },
  priest:  { label:"Priest",  req:{ stat:"wis", min:11 }, hitDie:8,  atkStat:"str", row:"back"  },
  mage:    { label:"Mage",    req:{ stat:"int", min:11 }, hitDie:4,  atkStat:"str", row:"back"  },
};

/* ════════════════════════════════════════════════════════════
   PREMADE PARTY
   ════════════════════════════════════════════════════════════
   The four canonical heroes from the combat prototype.
   Their HP, AC, and Atk values are hand-picked to match the
   established prototype numbers rather than computed fresh —
   the design doc calls these "back-derived" for continuity.

   New characters created via the creation screen (Stage 3) will
   use the proper formula (hit die max + CON mod for HP, etc.).

   Spell uses are computed fresh via spellUsesMax():
     Aldric WIS 16 → mod +3 → 3 + 0 + 3 = 6 uses at level 1
     Mialee INT 16 → mod +3 → 3 + 0 + 3 = 6 uses at level 1
*/
function makePremadeParty() {
  return [
    { id:"tor",    name:"Tor",    race:"Human",  raceKey:"human",
      cls:"fighter", clsLabel:"Fighter", row:"front",
      level:1, xp:0, hp:18, maxHp:18, ac:4, status:"active",
      stats:{ str:14, dex:14, con:15, int:8,  wis:10 },
      weapon:{ ...itemById("shortsword", WEAPONS) },
      armor: { ...itemById("leather",   ARMORS)  },
      spells:[], spellUses:0, spellUsesMax:0 },

    { id:"shadow", name:"Shadow", race:"Hobbit", raceKey:"hobbit",
      cls:"thief",   clsLabel:"Thief",   row:"front",
      level:1, xp:0, hp:10, maxHp:10, ac:5, status:"active",
      stats:{ str:11, dex:14, con:12, int:12, wis:9  },
      weapon:{ ...itemById("dagger",    WEAPONS) },
      armor: { ...itemById("leather",   ARMORS)  },
      spells:[], spellUses:0, spellUsesMax:0 },

    { id:"aldric", name:"Aldric", race:"Human",  raceKey:"human",
      cls:"priest",  clsLabel:"Priest",  row:"back",
      level:1, xp:0, hp:12, maxHp:12, ac:6, status:"active",
      stats:{ str:12, dex:12, con:13, int:11, wis:16 },
      weapon:{ ...itemById("mace",      WEAPONS) },
      armor: { ...itemById("chain",     ARMORS)  },
      spells:["Cure Light Wounds"], spellUses:6, spellUsesMax:6 },

    { id:"mialee", name:"Mialee", race:"Elf",    raceKey:"elf",
      cls:"mage",    clsLabel:"Mage",    row:"back",
      level:1, xp:0, hp:7,  maxHp:7,  ac:9, status:"active",
      stats:{ str:10, dex:10, con:8,  int:16, wis:10 },
      weapon:{ ...itemById("dagger",    WEAPONS) },
      armor: { ...itemById("robes",     ARMORS)  },
      spells:["Magic Missile"], spellUses:6, spellUsesMax:6 },
  ];
}

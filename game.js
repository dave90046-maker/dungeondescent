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
     Stage 2  ─ party, gold, starting gear
     Stage 3+ ─ combat encounter state, cleared-rooms tracking
*/
const GS = {

  /* Which localStorage slot this session lives in */
  profileName: "",

  /* Array of canonical character objects (filled in Stage 2) */
  party: [],

  /* Party gold (filled in Stage 2) */
  gold: 0,

  /* Current dungeon position — kept in sync with the `player`
     object in index.html's dungeon renderer so saves land in
     the right tile. */
  dungeon: {
    level: 0,   // index into LEVELS[] (0 = The Entry Hall)
    x:     1,   // tile column
    y:     1,   // tile row
    dir:   0,   // index into DIRECTIONS[] (0 = North)
  },

  /* Name of the screen that was active when the game last saved.
     continueGame() uses this to route the player back correctly. */
  screen: "profile",

  /* Non-null while a combat encounter is being resolved.
     Populated by the combat screen in a later stage. */
  combat: null,
};

/* ════════════════════════════════════════════════════════════
   SAVE / LOAD
   ════════════════════════════════════════════════════════════
   One localStorage key per profile, formatted as:
       dungeon_descent_save_<profileName>

   autoSave()   — call after any state change worth keeping
   loadSave()   — overwrites GS with the stored data, returns
                  true on success
   listSaves()  — returns sorted array of existing profile names
   deleteSave() — removes one slot permanently
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
    /* Object.assign merges saved fields back into the live GS object.
       Any fields present in GS but absent in the save (e.g. new fields
       added in a later stage) keep their default values. */
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
   Every <div class="screen"> starts hidden via CSS (display:none).
   showScreen() reveals exactly one, records it in GS.screen, and
   lets the caller hook in any per-screen initialisation they need.

   Usage examples:
       showScreen("profile")   — title / save-select screen
       showScreen("dungeon")   — first-person dungeon view
       showScreen("town")      — Ironhaven town hub  (Stage 2)
       showScreen("combat")    — turn-based combat   (Stage 3)
       showScreen("creation")  — character builder   (Stage 2)
*/
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(el => {
    el.style.display = "none";
  });
  const el = document.getElementById("screen-" + name);
  if (el) el.style.display = "flex";
  GS.screen = name;
}

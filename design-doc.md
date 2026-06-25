# Dungeon Descent — Core Systems Design

First-pass numbers for experience, monsters, equipment, and death. Original
system inspired by the genre, not copied from any rulebook — built to suit a
10-level dungeon crawl with 4 fixed classes. Everything here is meant to be
played and re-tuned once it's wired into code; treat the numbers as a
starting balance, not gospel.

---

## 1. Ability Scores

Five scores, no Charisma (nothing in the system uses it yet): **STR, DEX,
CON, INT, WIS**. Typical range 3–18, standard modifier table:

| Score | 3 | 6 | 8 | 10 | 12 | 14 | 16 | 18 |
|-------|---|---|---|----|----|----|----|----|
| Mod   | −4 | −2 | −1 | 0 | +1 | +2 | +3 | +4 |

*(formula: `floor((score − 10) / 2)`, in case we need scores outside this table)*

**What each stat does:**

| Stat | Effect |
|------|--------|
| STR | + to melee attack and weapon damage (Fighter, Priest, Mage) |
| DEX | + to AC (subtracted from armor's base AC, since lower is better) — and is the attack stat for **Thief** instead of STR (finesse fighter) |
| CON | + to HP gained each level-up (added to the hit-die roll, minimum 1 HP/level regardless) |
| INT | **Mage's casting stat** — adds to bonus spell uses and spell damage |
| WIS | **Priest's casting stat** — adds to bonus spell uses and healing output |

### Starting stats — the existing party

Back-derived so the four characters already in the combat prototype keep
their exact established Level 1 numbers (HP, AC, Atk) — this is flavor and
a foundation for *future* level-ups and gear changes, not a retroactive
rebalance.

| Character | Class | STR | DEX | CON | INT | WIS |
|-----------|-------|----:|----:|----:|----:|----:|
| Tor       | Fighter | 14 | 14 | 15 | 8  | 10 |
| Shadow    | Thief   | 11 | 14 | 12 | 12 | 9  |
| Aldric    | Priest  | 12 | 12 | 13 | 11 | 16 |
| Mialee    | Mage    | 10 | 10 | 8  | 16 | 10 |

Mialee's low CON is exactly why she has the party's worst HP — and her high
INT is what makes her spellcasting worth the fragility. Aldric's WIS plays
the same role for healing reliability.

### Races

Five options. Modifiers net to zero for everyone except Human, who gets no
stat bonuses at all but a flat **+10 to the bonus point pool** instead —
balanced but flexible, the classic "no weakness, no specialty" race.

| Race   | STR | DEX | CON | INT | WIS | Pool bonus |
|--------|----:|----:|----:|----:|----:|-----------:|
| Human  | 0   | 0   | 0   | 0   | 0   | +10        |
| Elf    | −1  | +1  | −2  | +2  | 0   | —          |
| Dwarf  | +2  | −2  | +2  | −2  | 0   | —          |
| Gnome  | −2  | −2  | 0   | +2  | +2  | —          |
| Hobbit | −2  | +3  | −2  | 0   | +1  | —          |

All five stats start at a base of **8** before race modifiers are applied.

### Character creation flow (built — see `character-creation.html`)

This is the classic Wizardry rhythm: roll, reroll if you don't like it, then
spend.

1. **Name** the character.
2. **Pick a race** — sets the base stat array shown above.
3. **Roll a bonus point pool**: `3d6` (3–18), with a rare 5% chance of
   doubling, plus the Human pool bonus if applicable. **Reroll as many times
   as you want** — every reroll resets any spent points, so there's no
   reason not to fish for a good number.
4. **Spend the pool** on STR/DEX/CON/INT/WIS, 1 point = 1 stat point, capped
   at 18 max and **6 minimum** (floor at 6, not 3 — a −4 modifier is too
   punishing in a soft-death game, especially on CON where it would cap HP
   gain at the minimum-1 floor for most of the game). You can push a stat
   down to 6 to refund points into the pool for spending elsewhere.
5. **Pick a class** — only classes whose requirement is currently met are
   selectable (Fighter STR 11+, Thief DEX 11+, Priest WIS 11+, Mage INT
   11+), and the gate re-evaluates live as you reallocate.
6. **Preview** shows the resulting Level 1 HP, AC, attack bonus, and
   starting weapon before you commit.
7. **Add to party** — up to 6 characters.

Level 1 HP for a *created* character is `hit die max + CON modifier`
(minimum 1) — not rolled, to avoid an unlucky 1-HP start. This is a cleaner
formula than the hand-picked numbers on the four illustrative party members
from the combat prototype, so new characters will generally run a bit
leaner on HP than Tor/Shadow/Aldric/Mialee — intentional, and arguably more
authentic to the genre's early-game fragility. Worth a look once we
playtest whether it needs a flat bonus.

Starting gear is fixed per class for now (Fighter: Short Sword, Thief/Mage:
Dagger, Priest: Mace; everyone in Leather except Mage in Robes) — no
shopping at creation yet, that's the Town Shop's job once it exists.

---

## 2. Experience & Leveling

**Classic grind.** Each level requires roughly double the one before it, so
the climb from 9→10 is as much work as levels 1–9 combined. One XP table,
shared by all four classes (keeps a first pass simple — we can split tables
per class later if Mage/Priest leveling feels too easy or too punishing
relative to Fighter/Thief).

| Level | Cumulative XP | XP needed for *this* level |
|------:|---------------:|----------------------------:|
| 1     | 0              | —                            |
| 2     | 1,000          | 1,000                        |
| 3     | 2,500          | 1,500                        |
| 4     | 5,000          | 2,500                        |
| 5     | 10,000         | 5,000                        |
| 6     | 20,000         | 10,000                       |
| 7     | 40,000         | 20,000                       |
| 8     | 80,000         | 40,000                       |
| 9     | 160,000        | 80,000                       |
| 10    | 320,000        | 160,000                      |

### Class progression

Each class has a hit die and a **class-base** attack bonus that grows with
level; the relevant ability modifier (STR, or DEX for Thief — see §1) is
added on top to get the final attack bonus shown in combat.

| Class   | Hit Die | Class-base Atk formula | Atk stat | Base Atk @ Lv10 | Total Atk @ Lv10* |
|---------|--------:|-------------------------|----------|------------------:|--------------------:|
| Fighter | d10     | `level`                 | STR      | +10                | +12 |
| Thief   | d8      | `floor(level × 0.75)`   | DEX      | +7                 | +9  |
| Priest  | d8      | `floor(level / 2)`      | STR      | +5                 | +6  |
| Mage    | d4      | `floor(level / 3)`      | STR      | +3                 | +3  |

*\*Total uses each character's actual stat modifier from the table above —
so two Fighters with different STR will diverge over time even on the same
class-base curve. This supersedes the flatter "Atk @ Lv10" estimates from
the previous draft of this doc.*

HP gain per level-up: `roll(hitDie) + CON modifier`, minimum 1.

Spell **uses per combat**: `3 + floor(level / 2) + casting-stat modifier`
(INT for Mage, WIS for Priest) — so Mialee and Aldric, with their high
casting stats, start with more spell uses than the flat "3" stated
previously, and the gap widens as they level.

---

## 3. Spells

New spells unlock at levels 1, 3, 5, 7, 9 — deliberately timed to land right
around when the party reaches the next monster tier (see §4), so a new tool
arrives just as it's needed.

**Mage**
| Level | Spell | Effect |
|------:|-------|--------|
| 1 | Magic Missile | 1d4+1 dmg, single target, auto-hit |
| 3 | Sleep | Disables one weak monster group for the round |
| 5 | Fireball | 2d6 dmg, hits an *entire* monster group |
| 7 | Lightning Bolt | 3d8+2 dmg, single target |
| 9 | Death Spell | Chance to instantly defeat a low-tier enemy |

**Priest**
| Level | Spell | Effect |
|------:|-------|--------|
| 1 | Cure Light Wounds | Heal 1d8 |
| 3 | Bless | Party gets +1 to-hit this combat |
| 5 | Cure Serious Wounds | Heal 2d8+2 |
| 7 | Dispel Undead | Bonus damage vs. undead monster groups |
| 9 | Heal | Full HP restore, single target |

---

## 4. Monster Roster by Depth

Five tiers, two dungeon levels each. Stats follow the existing combat math
(to-hit: `d20 + attacker atk ≥ 10 + target AC`; lower AC is better defense).
XP rewards ramp hard to keep pace with the leveling curve — by the bottom
tier, a single monster is worth more than an entire early dungeon's clear.

| Tier | Dungeon Lvls | Monsters | HP | AC | Atk | Dmg | XP each |
|-----:|-------------:|----------|---:|---:|----:|-----|--------:|
| 1 | 1–2 | Kobold, Giant Rat, Skeleton, Jackal | 3–6 | 7–9 | 0–1 | 1d4 | 3–10 |
| 2 | 3–4 | Orc, Giant Spider, Zombie, Gnoll | 8–15 | 5–7 | 1–2 | 1d6–1d8 | 20–30 |
| 3 | 5–6 | Ogre, Dark Elf, Wight, Giant Scorpion | 20–35 | 3–5 | 3–4 | 1d8+2–2d6 | 100–150 |
| 4 | 7–8 | Troll, Wraith, Minotaur, Medusa | 40–60 | 1–3 | 5–6 | 2d8–3d6 | 550–700 |
| 5 | 9–10 | Vampire, Lich, Demon, Dragon (boss) | 70–150 | −2–1 | 7–9 | 3d8–4d8 | 3,000–8,000 |

Note: I deliberately skipped level-drain or other punishing special abilities
for undead (e.g. Wight, Wraith, Lich) — given the "softer death" call below,
draining XP or stats on hit would fight against that design goal. They hit
harder instead.

---

## 5. Equipment — Loot + Town Shop

Town shop sells Tiers 1–3. Tier 4 is dungeon-find only — you can't buy your
way to the best gear, you have to earn it.

**Weapons**
| Tier | Where | Examples |
|-----:|-------|----------|
| 1 | Town (starting gear) | Dagger 1d4, Short Sword 1d6, Mace 1d6+1 |
| 2 | Town | Long Sword 1d8, War Mace 1d8+1, Hand Axe 1d6+2 |
| 3 | Town (pricier) | Silver Long Sword 1d8+2, Battle Axe 2d6, Flail 1d10 |
| 4 | Dungeon only (lvl 8–10 drops) | Flaming Sword 2d6+3, Vorpal Blade 2d8+4 (rare boss drop) |

**Armor** (lower AC = better; Mage is restricted to Robes — heavier armor
disrupts spellcasting, which is also why Mage's starting AC is the worst in
the party on purpose)
| Tier | Where | Examples |
|-----:|-------|----------|
| 1 | Town | Robes AC9 (Mage), Leather AC8 |
| 2 | Town | Studded Leather AC7, Chainmail AC6 |
| 3 | Town | Banded Mail AC4, Plate Mail AC3 |
| 4 | Dungeon only | Magic Plate AC1, Dragon Scale AC−1 (boss drop) |

Monsters drop **gold** separately from XP — used to buy gear and pay for
resurrection at the Temple (§6). Loot tier found roughly matches the dungeon
tier you're standing in.

---

## 6. Death & Recovery (Soft)

No permadeath, no ash, no "lost forever" — by design.

- **0 HP → Down.** Character is unconscious, skips turns, can be healed back
  up mid-combat (any heal spell/potion revives at the healed HP total).
- **Trip ends with someone Down** → they're carried back to town
  automatically and revived at the **Temple** for a gold cost that scales
  with their level. No failure chance, no risk of losing the character —
  just a gold tax for being careless.
- This keeps death meaningful (it costs real gold, and a wipe means a wasted
  trip) without the genuine "character gone forever" dread of the original
  games, per your call.

---

## Open questions for when we playtest

- Does a single shared XP table feel right, or does Mage/Priest need a
  separate (probably steeper) curve to match their spell power?
- Are Tier 5 XP rewards (3,000–8,000) actually enough encounters' worth of
  grind to hit 320,000 cumulative, or does that tier need more monsters per
  encounter / more encounters per level to avoid feeling like a wall?
- Gold costs for the shop and Temple aren't numbered yet — easier to price
  once we see how much gold a real dungeon run generates.

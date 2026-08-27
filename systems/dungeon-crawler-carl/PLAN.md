# Dungeon Crawler Carl on the shell — build plan

Source: *Dungeon Crawler Carl Roleplaying Game Core Rulebook: Royal Court Edition*
(Renegade Game Studios, © 2026), covering Floors 3–5. A Starter Set covers the
Tutorial Floors (1–2) and is **not** in hand — the pack must degrade gracefully
where the book defers to it.

---

## 1. The design thesis

**The app is the Crawler Interface.** This is not a character-sheet app that happens
to be about DCC. The book spends Chapter 1 describing the HUD as a piece of
software the character already uses in-fiction, and it is almost a UI spec:

| Book calls it | We already have it |
|---|---|
| Health Bar (green→yellow→red, right to left) | sheet block |
| Minimap, fog of war, colored dot legend | **the map tab, nearly as-is** |
| Hotlist (10 quick-access slots) | new block |
| Inventory, gold in one slot, Misc. Junk | new block |
| Countdown timer to floor collapse | new — and it's a headline feature |
| Achievements & notifications | new |
| Crawler & creature data on inspect | NPC cards |
| Scratch pad | the campaign log |
| Party messaging | multiplayer |

Every screen should read as the System AI talking to the player. The shell's
neutral chrome plus a DCC theme gets us most of the way; the lexicon does the rest.

**Lexicon:** world→**Crawl**, hero→**Crawler**, roster→**Bestiary**, team→**Party**,
region→**Neighborhood**, logBreak→**Floor**, wiki→**Codex**, save→**Crawler File**.

---

## 2. Screen map

| Shell tab | DCC function |
|---|---|
| Hero | The crawler sheet — Stats, Health Bar, Skills, Hotlist, Buffs/Debuffs |
| NPCs | Bestiary: Mobs, Bosses (6 tiers), Dungeon NPCs, Pets, Mounts, Minions |
| Map | Floor → Neighborhood → sub-zone, with the HUD dot legend |
| Dice | d20 core mechanic: Advantage/Disadvantage, degrees, AI Favor reroll |
| Conflict | Combat tracker built on the book's 5-step round |
| Notes | Campaign log; a "Floor" break replaces the comic "Issue" break |
| Print | Character sheet (the book's is 2 pages) |
| Wiki | Codex: NPCs, deities, sponsors, interview shows, quests |
| HUD | The second-screen HUD — now literally what the book describes |
| Multiplayer | The party: shared Crawl, shared map, shared bestiary |

Two new tabs are warranted: **Floor Clock** (countdown + rest tracking) and
**Fame** (Popularity, AI Favor, Achievements, Sponsors). Both could instead be a
persistent status bar — decide during Phase 3.

---

## 3. The crawler data model

```
identity   name, crawler number (500,000–12,900,000), race, class, gender,
           level (cap 250), floor, size (1–5)

stats      STR INT CON DEX CHA — DUAL LAYER (Unenhanced / Enhanced),
           Mod derived from Enhanced via a 10-row lookup table (1–2→+1 … 300+→+10)

health     Health Bar: 10 slots, each holding CON Mod. Damage consumes whole
           slots; remainder is discarded. Marked right→left. 0% ⇒ Dying.
mana       current / max (max = Enhanced INT, not the Mod)
evade      d20 + DEX Mod + buffs (not a skill, no Rank)
dr         Damage Resistance + per-element resistances / vulnerabilities / immunities
move/step  20 ft / 10 ft

skills     name, Rank 0–20 (soft cap 15, some to 20 via Race/Class), Stat,
           Check Type (Opposed/Unopposed/Passive/Evade), Upgrades at Rank 5/10/15,
           and an ADVANCEMENT CHECKBOX
attacks    to-hit (Rank + Stat Mod) and damage (dice + Stat Mod + type)
spells     Rank, Mana cost, effect; scrolls cast at a fixed Rank for 0 Mana

inventory  Inventory (weightless, lift limit STR × 15 lb) | Hotlist (10 slots,
           stacks to 999) | Gear Slots (Head, Torso, Arms, Legs, Feet,
           Hands/Holding, Accessories ×10) | Gold (1 slot) | Misc. Junk (count)

status     Buffs — Internal, and External capped at 3 active
           Debuffs — ~25 named, `stackable` flag, per-debuff duration
           Injuries — Minor/Major, escalating to Long-Term on a repeat

fame       Popularity, AI Favor, Sponsors, Achievements
story      Past Trauma, Loose End, Regret; six Tutorial Floor Experiences
```

---

## 4. What DCC proves about the shell

SHELL-PLAN §8 predicted three missing blocks. All three are confirmed — and the
vocabulary is short by more than I estimated.

**Confirmed as predicted**
- `progression` — Level, 3 Stat points per level, and a **Skill Advancement**
  loop: tick a box on any Skill you check, then roll d20 vs. the Skill's current
  Rank (every 2 hours of play at Rank ≤4, every floor at Rank ≥5), then clear the
  ticks. This is a first-class app feature, not a footnote.
- `inventory` — and richer than predicted: **three containers with different
  rules** (Inventory / Hotlist / Gear Slots), not one list. **Built in D4** as a
  block type with three generic container kinds — `slots` (named, each with a
  capacity), `stack` (a fixed number of numbered slots holding stacks) and
  `list` (unbounded) — plus moves between them. Fate's "gear is a text note"
  is the degenerate case: a single `list` container.
- `statusEffects` — with durations, a stackable flag, an active-cap (3 External
  Buffs), and escalation (Minor Injury twice ⇒ Long-Term Minor Injury).

**Not predicted — new requirements**
- **Dual-layer traits.** Every Stat carries an Unenhanced and an Enhanced value,
  with the Mod derived from the Enhanced layer through a lookup table. `traitGrid`
  currently assumes one number per trait.
- **A non-uniform `track`.** The Health Bar is not a checkbox row: each slot holds
  a *value* (CON Mod), damage is consumed slot-by-slot with the remainder
  discarded, it fills right-to-left, and slots carry percentage labels. The block
  needs slot values, fill direction, and a damage-application rule.
- **A point-buy sub-builder.** Race (25 pts) and Class (30 pts) can be built from a
  menu of tiered benefits, with drawbacks that refund points. That's the same shape
  as the Outgunned creator and the Pirate Borg builder — a wizard inside the wizard.
- **Prerequisites as a gate.** Races and Classes require minimum Stats, Skill Ranks,
  or *achievements*. `catalogItems` needs a `prereq` predicate that can read the
  whole character, and the UI must show why a locked option is locked.
- **Reputation pools with event triggers.** Popularity and AI Favor change from
  narrative events on fixed cadences (per 2-hour session / per day / per floor),
  not from spending. Closer to a checklist than a counter.

**Recommendation:** build `traitGrid`'s dual-layer support and the richer `track`
*before* finishing the Daring Comics port, since both change the block contract.
The rest can land as new block types without disturbing what exists.

---

## 5. Character creation

The book gives a 10-step wizard for a Floor-1 crawler, then an overlay to advance
them to the floor you're actually starting on. The shell's existing wizard maps
cleanly; almost every step has a "roll or choose" table, so the generator hooks
get heavy use.

Full screen-by-screen design, including the animal-crawler branch and the
cross-screen constraints, is in [CREATION.md](CREATION.md).

**Base crawler (Floor 1)**

| Step | Content |
|---|---|
| 1 | **Background** — Childhood, Adolescence (Rank 1 each), Career, Hobby (Rank 3 each). Pick 1 of 12 per stage, then 2 of its 3 Skills. 8 Skills total. |
| 2 | **Weapon** — grants the 9th/10th Skills. Humans get Unarmed Combat; animals get Slice Attack. |
| 3 | **Stats** — standard array {2,3,4,5,6}, or roll 1d6 per Stat rerolling 1s. Then derive Mods. |
| 4 | **Evade** — DEX Mod. |
| 5 | **Health Bar** — 10 slots, CON Mod in each. |
| 6 | **Mana & Spells** — Mana = Enhanced INT; everyone starts with Heal. Seed the Hotlist. |
| 7 | **Move & Step** — 20 / 10. |
| 8 | **AI Favor & Size** — 1 favor; Medium (4), or 1–5 for animals. |
| 9 | **Past Trauma, Loose End, Regret** — 1d12 each. The safety-tools step; surface it as such. |
| 10 | **Starting gear.** |

**Third Floor overlay** (the default start): Level 10 · +2d4 to the primary attack
Skill and +1d4 to the other nine (cap 10) · six Tutorial Floor Experiences rolled
from six d12 tables · Acquired Loot (a d4 picks a Bronze/Silver/Gold/Platinum
spread across weapon, armor, item, consumable; spells may replace any but the
consumable) · 27 Stat points · AI Favor 1d2 (+more for a favored weapon) ·
Popularity = CHA Mod × 2 · **then Race and Class**.

Fourth Floor: Level 20, +30 more Stat points. Fifth Floor scales again.

> **Ordering constraint:** Stat points must be spent *before* Race/Class selection,
> because Races and Classes have Stat prerequisites. The wizard has to enforce this.

---

## 6. Race & Class

30 races and 49 classes, each a bundle of: prerequisites, size, Stat deltas
(including penalties), Skill grants, Spell grants, "this Skill may reach Rank 20",
special traits, and drawbacks. Earth races unlock Earth classes and a Silver Earth
Box; alien races get their own Popularity routes instead.

Applying a Race/Class is a **transaction**, not a text note: it mutates Stats and
Skills, respects the Rank-10 cap during selection (excess is wasted), and must be
reversible while the player is still shopping. Build it as a diff preview —
"here's your sheet before and after" — then commit.

The point-buy builder (25 / 30 points) is a second path to the same result, and
should emit the same object a book Race/Class does.

---

## 7. Combat

The book's round is a fixed 5-step loop, which makes a good tracker:

1. Mob Action Declaration → 2. Crawler Reaction Phase (Interrupts) →
3. Mob Action Resolution → 4. Crawler Action Phase → 5. Clean Up

Notable: **the GM never rolls d20.** Mob quality is a Difficulty the players roll
against, so a mob "attack" is a number the crawler evades. Advantage/Disadvantage
on a mob becomes ±5 to its Difficulty. Each crawler has **2 Actions** per round and
a 10 ft Step per Action; bosses get 1 Action per crawler. Tracker needs per-crawler
Action pips, an Interrupt queue, and end-of-round Debuff ticks.

---

## 8. Dice

```
roll: 1d20 (+ Advantage/Disadvantage = roll 2, keep high/low; they cancel 1:1)
total: d20 + Skill Rank + Stat Mod + buffs − debuffs
difficulty: Opposed 10 + antagonist Stat Mod + Floor
            Unopposed 10 + (Floor × 2)
            Stat Check 10 + Floor
degrees: Nat 20 Critical Hit · beat by 10+ Amazing · 0–9 Standard Success
         miss by 1–2 Near Miss · 3–9 Standard Fail · 10+ Major Fail · Nat 1 Critical Fail
modifiers: spend AI Favor to reroll (never a Nat 1); Play to the Cameras =
           deliberate Disadvantage for Popularity / AI Favor / Sponsor payoff
```

The roller must know the current **Floor** — it is in every difficulty formula and
in damage (`+F` appears throughout). Floor is app-wide state, not a sheet field.

---

## 9. Mobs, Bosses & NPCs

The stat block is fixed and compact, so the NPC builder can be a form:

```
Name | Mob/Boss/Elite/NPC; Size (n), Type
HB slots (= Level, max 10; bosses per tier table) each holding CON Mod, with % labels
Level | Surprise | Evade | Move | DR        ← several written as "11+F"
STR INT CON DEX CHA (with Mods)
Attacks: <to-hit>+F to hit, <dice>+<n> <type>, <range>; fail-effects
Notes: special rules
```

Generators worth building, since the book gives the maths outright:
- **Mob from Level + Floor** — HB slots = Level (max 10), damage dice from a
  Level→dice table, `+F` resolved for the current floor.
- **Boss from tier** — Neighborhood/Borough/City/Province/Country/Floor, each with
  stats-per-level and HB slots (10+F … 40+F).
- **Encounter scaler** — party size × Weak/Moderate/Strong/Overwhelming.
- **Loot roller** — mob gold by floor, Misc. Junk 1d6, boss maps.

---

## 10. Story systems

These are the flavour that makes it DCC, and they are all trackable:

- **Popularity** — gained/lost on fixed cadences (per session / per day / per
  floor) from a checklist of ~12 triggers. Build it as a literal end-of-session
  checklist that applies the deltas. Milestones (25/50/100) award Fan Boxes.
- **AI Favor** — spend to reroll or gain an extra non-Attack Action.
- **Play to the Cameras** — a 3-way choice (Audience / AI / Sponsors) resolved off
  the degree of success; a natural dice-roller button.
- **Achievements** — awards list; Appendix 3 has the canonical set. Some Races and
  Classes take an achievement as a prerequisite, so these must be data, not notes.
- **Sponsors & Benefactor Boxes**, **Interview Shows** (5 named), **Deities &
  Worship**, **Bard Patronage**, **Plot Artifacts** — Codex entries with light
  mechanics attached.
- **The Floor Clock** — 8 / 10 / 15 days for floors 3 / 4 / 5, at 30 hours per day,
  plus rest costs (Short 2h, Long 8h, Full Day 30h) and mending (1 HB + 5 Mana per
  idle hour). A real timer the party spends against.

---

## 11. Content inventory & the extraction risk

Rough pack size: 5 stats · ~10 lookup rows · 100+ skills with 3 upgrade tiers each
· ~50 spells · 30 races · 49 classes · ~25 debuffs · buff lists · gear and loot
tables · 4 background tables (12 × 3 skills) · 3 trauma tables (12 each) · 6
tutorial-experience tables (12 each) · achievements · 26 neighborhoods and quests.

**This is the largest single piece of work, and the source is damaged.** The
markdown is an OCR/PDF conversion with *systematic* corruption — doubled letters
are dropped throughout: "Skils", "Spels", "Clas", "Lot" (Loot), "ocasionaly",
"Flor". Numbers and table cells are also reflowed out of order in places, and
several headings are mis-levelled. Consequences:

1. Never bulk-parse this file into data. Anything numeric must be read in context
   and spot-checked against the PDF.
2. Do the extraction **catalogue by catalogue**, each verified, rather than in one
   pass. Skills → Spells → Races → Classes → Loot → Tables.
3. Build a validator (like Vesta's `validate.mjs`) that checks referential
   integrity: every Skill a Race grants exists; every Stat abbreviation is one of
   five; every Rank is 0–20; every prerequisite names a real Skill/achievement.

---

## 12. Phasing

| Phase | Work |
|---|---|
| **D0** | Pack skeleton: `id`, lexicon, theme, Floor as app state, Stat table, dice engine. Boots, rolls a d20 with correct difficulties, nothing else. |
| **D1** | Shell work: dual-layer `traitGrid`, value-slot `track`. Port the Daring Comics sheet onto the revised contracts to prove nothing broke. |
| **D2** | Crawler sheet: Stats, Health Bar, Mana, Evade, DR, Move/Step. |
| **D3** | Skills catalogue + the advancement checkbox loop. |
| **D4** | Inventory / Hotlist / Gear Slots. **done** |
| **D5** | Creation wizard — nine screens, both phases. See [CREATION.md](CREATION.md). **Depends on D3.** |
| **D6** | Races & Classes as a transactional diff, with prerequisite gating. |
| **D7** | Spells **done** (54). Loot, crafting, pets/mounts/minions still to do. |
| **D8** | Combat tracker (5-step round) + Debuff durations. |
| **D9** | Bestiary + mob/boss/encounter generators. |
| **D10** | Fame: Popularity checklist, AI Favor, Achievements, Sponsors. Floor Clock. |
| **D11** | Codex content, interview shows, deities. Print sheet. |
| **D12** | Point-buy Race/Class builder. |

D0–D2 is the spike that tells us whether the block vocabulary holds. Do not start
D5 before D1 lands.

---

## 13. Open questions

1. **Starting floor.** The book assumes Floor 3 at Level 10. Do we support the
   Floor-1 path at all, given the Starter Set isn't in hand? Recommend: build the
   10-step wizard (it's the foundation of the Floor-3 overlay anyway) but default
   the app to a Floor-3 start.
2. **Distribution.** This is a commercial, in-copyright rulebook. Daring Comics is
   too, but the exposure differs in degree: reproducing 49 class write-ups and 30
   race write-ups verbatim is republishing the book's substance, not referencing
   it. Options: keep this pack local/unpublished (as with Quest Codex); or ship
   *mechanics only* — names, numbers, and prerequisites, with descriptions left to
   the player's own book. Recommend the latter if it goes anywhere public. Your
   call, but worth making deliberately rather than by default.
3. **Neighborhoods & quests** (Chapters 7–9, 26 of them) — pack data, or GM content
   authored in the Codex? Recommend Codex: they're adventure modules, not rules.
4. **Do we need the Starter Set** for Floors 1–2 to make the Floor-1 path coherent?

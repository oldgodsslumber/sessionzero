# Crawler creation, end to end (phase D5)

How the wizard works, screen by screen. Page references are to the DCC RPG Core
Rulebook (Royal Court Edition).

---

## 1. The shape of it

Creation is **two phases**, and the book is explicit that they happen in order:

1. **Build a Floor-1 crawler** — the ten steps on pp. 101–113.
2. **Advance them to the floor you're actually starting on** — pp. 115–118.

You cannot skip phase 1 even when starting on Floor 3, because phase 2 is a set of
*modifiers* to a finished Floor-1 crawler. The default start is **Floor 3, Level 10**.

**The hard ordering constraint:** Stat points are distributed, and Acquired Loot is
gathered, **before** Race and Class are chosen — because Races and Classes have Stat
and Skill prerequisites, and because "this is the order in which things would have
happened had you adventured on the Tutorial Floors" (p. 115). The wizard must enforce
this, not just suggest it. The book does permit redistributing Stat points after
Race/Class as an option; offer that as a checkbox, defaulted off.

---

## 2. Book steps → wizard screens

Ten book steps is too many clicks, and several are pure bookkeeping the app does for
you (Evade, Health Bar, Move/Step are all derived — they exist as steps only because
the book is teaching you to fill in a paper sheet). Consolidated to nine screens:

| # | Screen | Book steps | Why grouped |
|---|---|---|---|
| 1 | **Who are you** | Species choice, identity, crawler number | The species branch has to come first; it changes every later table |
| 2 | **Background** | 1 | Four sub-pickers producing eight Skills |
| 3 | **How you fight** | 2 | A three-way branch, one decision |
| 4 | **Stats** | 3 | Also *shows* steps 4–7 as live derived values |
| 5 | **Scars** | 9 | Past Trauma, Loose End, Regret — the safety-tools conversation |
| 6 | **What you brought** | 10 | Starting gear |
| 7 | **The tutorial floors** | phase 2 | Level, Skill bumps, six Experiences, Acquired Loot |
| 8 | **Race & Class** | phase 2 | The biggest single decision in the game |
| 9 | **Review** | — | Full sheet, with every derived value resolved |

Steps 4–8 of the book (Evade, Health Bar, Mana, Move/Step, AI Favor, Size) never get
their own screen. They are already `derive` functions from D0–D2 and appear as a live
readout on screen 4, so the player watches them change as they assign Stats.

---

## 3. Screen by screen

### Screen 1 — Who are you

- **Species: Human or animal.** This is not cosmetic. It re-routes the whole of
  screen 2 (Tables 12–15 → Tables 16–19), changes the free combat Skill
  (Unarmed Combat → Slice Attack), changes Size (Medium (4) → 1–5 by creature), and
  **costs the starting AI Favor** — an animal spends it on the Enhanced Pet Biscuit.
  The book also gates it: GM permission, and only one animal in a party. Surface
  both as a note, not as an enforced rule; the app is not the GM.
- **Name**, optional gender/pronouns (the book says leave blank if you prefer).
- **Crawler number.** Roll one in 500,000–12,900,000. Warn on the numbers used in the
  novels (Carl 4,122; Donut 4,119) and offer +1d10, per p. 102.

Writes: `species`, `name`, `crawlerNumber`, `size`.

### Screen 2 — Background

Four stages, each: pick 1 of 12 descriptions (or roll 1d12), then take **2 of its 3**
Skills.

| Stage | Human table | Animal table | Rank |
|---|---|---|---|
| Childhood | 12 | 16 (Animal Youth) | 1 |
| Adolescence | 13 | 17 (Animal Training) | 1 |
| Career | 14 | 18 (Animal Quirk) | 3 |
| Hobby | 15 | 19 (Animal Adult) | 3 |

Eight Skills. Two rules the UI must enforce:

- **No double-dipping** (p. 103). The same Skill picked twice does not stack Ranks —
  so grey it out once taken, and say why. This is easy to hit: Streetwise, Endurance
  and Perception each appear on several tables.
- **A Skill's Stat comes with it.** Each entry names its Stat in parentheses; the
  player never chooses it.

Writes: `skills[]` as `{name, rank, stat, source}`. `source` is worth keeping — the
book suggests noting which background a Skill came from, and it makes the Review
screen legible.

### Screen 3 — How you fight

Everyone gets a free combat Skill at **Rank 3**: Unarmed Combat (human) or Slice
Attack (animal). Then a **three-way branch** for the second, also Rank 3:

1. **A weapon.** Pick from Bashing / Edged / Ranged / Reach lists, *or* name a custom
   one and map it to a listed weapon — the book's "Tire Iron (Club)" convention.
   Store both the display name and the mapped Skill.
2. **An attack Spell.** Seven options. **Requires Intelligence 4+**, which is set on
   the *next* screen — a forward dependency the wizard has to handle (see §4).
   Grants 5 Standard Mana Potions in one Hotlist slot.
3. **Hand-to-hand.** Four Skill + Damage Effect pairs (Pugilism/Iron Punch,
   Foot Soldier/Smush, Noggin Nocker/Skullcracker, Wrasslin'/Toss). Also grants an
   achievement and a Bronze Weapon Box — the AI mocking you for arriving unarmed.

Writes: `attacks[]`, possibly `hotlist[]`, possibly `achievements[]`.

### Screen 4 — Stats

Two methods, and they need different UI:

- **Standard array** — assign 2, 3, 4, 5, 6, each exactly once. A drag-or-tap
  allocator; the existing Daring Comics skill board is the closest precedent.
- **Roll** — 1d6 per Stat rerolling 1s, in fixed order STR → INT → CON → DEX → CHA,
  **no swapping afterwards**. Present as a one-way commit with a confirmation, since
  it cannot be undone without restarting the screen.

Alongside, a live readout of everything that falls out, which is the real value the
app adds over paper:

```
Health Bar   10 slots of <CON Mod>        Mana      <Enhanced INT>
Evade        d20 + <DEX Mod>              Move 20   Step 10
AI Favor     1 (human) / 0 (animal)       Size      Medium (4)
```

All of these already exist as `derive` functions.

### Screen 5 — Scars

Past Trauma, Loose End, Regret — one each, roll 1d12 or write your own
(Tables 22–24).

This screen is **not** just three more random tables. The book is explicit that this
is where you tell the GM what stories you want, *and what you don't want at the table*
(p. 113). Present it that way: a short framing line, a "discuss with your GM" prompt,
and a free-text "lines I'd rather not cross" field that is not from any table. Given
what this app is now called, it would be perverse to render it as a slot machine.

### Screen 6 — What you brought

Free-form, negotiated with the GM: a set of clothes, the weapon from your combat
Skill (or none), one interesting/useful item, and "weird stuff." Prefill the weapon
from screen 3, put clothes in the Torso/Legs gear slots, and give a few examples
drawn from the choices already made.

### Screen 7 — The tutorial floors

Everything in phase 2 except Race and Class, in this order:

1. **Level** → 10 (Floor 3), 20 (Floor 4), higher for Floor 5.
2. **Skill bumps** — +2d4 to the primary Weapon or Spell attack Skill, +1d4 to each
   of the other nine. **Cap 10.** Excess is wasted, and the UI should say so rather
   than silently truncating.
3. **Six Tutorial Floor Experiences** — roll d6 on Table 28 to pick a table, then d12
   on Tables 29–34 (Interactions with Other Crawlers, Twists of Fate, Mobs & Boss
   Battles, Strange Places, Traps & Accidents, Interview Shows). Six times. Some
   grant Skills; all are story hooks the GM is told to bring back later, so they
   should land in the Codex, not just on the sheet.
4. **Acquired Loot** — roll d4 on Table 25 for a tier spread across weapon, armor,
   item, consumable. Spells may replace any of the first three but never the
   consumable. Gold/Platinum weapons roll on Table 26 (Scroll of Upgrade); Spells
   roll on Table 27.
5. **27 Stat points** (= (Level − 1) × 3) distributed freely.
6. **AI Favor** — 1d2, plus more for a favoured weapon.
7. **Popularity** = CHA Mod × 2.

### Screen 8 — Race & Class

30 Races, 49 Classes. Each is a bundle: prerequisites, Size, Stat deltas (including
penalties), Skill grants, Spell grants, "this Skill may reach Rank 20", special
traits, drawbacks.

Three things make this the hardest screen:

- **Prerequisites must gate visibly.** Some need a Stat minimum, some a Skill at
  Rank 5+, some an *achievement*. Show locked options with the reason, rather than
  hiding them — the book has the AI recommend three options, so a shortlist framing
  fits.
- **Applying is a transaction, not a note.** It mutates Stats and Skills. Build it as
  a **diff preview** — "here is your sheet before and after" — that can be backed out
  while the player is still shopping, and only commits on confirm.
- **The Rank 10 cap applies during selection.** Rank 8 + a Race's +3 lands on 10, and
  the remaining bonus is wasted. Show the waste.

Earth Races unlock Earth Classes and a Silver Earth Box; alien Races get their own
Popularity routes instead. That's a compatibility rule between the two pickers, so
they belong on one screen, chosen in tandem.

A **custom builder** (25 Race points / 30 Class points, drawbacks refund) is the
alternate path, and must emit the same object shape a book Race/Class does. Defer to
D12 — but design the object now so the builder is a second producer, not a fork.

### Screen 9 — Review

The full sheet with every derived value resolved, a printable summary, and a
"what came from where" breakdown (background → Skills, Race/Class → deltas) so a
player can audit a number they don't recognise.

---

## 4. Cross-screen rules the wizard must handle

- **Spell attack needs INT 4+** and is chosen a screen *earlier* than Stats. Handle
  it by carrying the constraint forward: screen 4 shows "your attack Spell needs
  Intelligence 4+" and blocks Continue while INT < 4, with a link back to screen 3 to
  change the choice. Do not silently fix it.
- **Stats before Race/Class**, enforced by screen order (§1).
- **Loot before Race/Class**, same reason.
- **No duplicate Skills** across background stages.
- **Rank caps:** 10 during Race/Class selection and the phase-2 bumps; 15 in normal
  play; 20 only where a Race or Class explicitly allows it. Store the per-Skill cap.
- **Everything is roll-or-choose.** Every table gets both a picker and a Roll button.
  This is uniform enough to be one shared component.
- **Resume.** Creation writes to the crawler as it goes and can be re-entered — the
  Daring Comics wizard already works this way, and `S.creation.step` is the precedent.

---

## 5. Data this needs, and the sequencing risk

| Data | Size |
|---|---|
| Tables 12–19 (background, human + animal) | 8 tables × 12 rows × 3 Skills |
| Tables 22–24 (trauma, loose ends, regrets) | 3 × 12 |
| Table 25–27 (loot spread, weapon upgrades, random Spells) | 4 + 12 + 12 |
| Tables 28–34 (tutorial experiences) | 1 + 6 × 12 |
| Weapon lists (4 categories) | ~18 |
| Attack Spells for step 2 | 7 |
| Hand-to-hand Skill + Damage Effect pairs | 4 |
| Races / Classes | 30 / 49 |

> **D5 depends on D3.** The background tables alone reference roughly sixty distinct
> Skill names, every one of which must already exist in the Skills catalogue or the
> wizard will hand out Skills with no rules attached. **Build the Skills catalogue
> first**, then make the creation validator assert that every Skill named by any table
> resolves. Per PLAN.md §11 the source markdown is a damaged OCR, so extract these
> table-by-table and verify rather than bulk-parsing.

---

## 6. What it writes

Extends the D0–D2 crawler:

```js
{
  systemId:'dungeon-crawler-carl',
  species:'human'|'animal', name, crawlerNumber, race, class, level, floor, size,
  blocks:{ stats, health, mana, aiFavor, popularity, gold },   // D0–D2
  skills:[ {name, rank, stat, checkType, cap, source, marked} ],
  attacks:[ {name, skill, toHitStat, damage, damageStat, effects} ],
  hotlist:[], inventory:[], gear:{},
  story:{ pastTrauma, looseEnd, regret, linesNotToCross, experiences:[] },
  achievements:[],
  creation:{ step, method:'array'|'roll', complete:false }
}
```

---

## 6a. Errata found while extracting (D5 data)

Two rows of Table 14 print a Stat that contradicts the book's own Skill entry:

| Row | Table prints | Skill entry says |
|---|---|---|
| 6, Gig Worker — Escape Artist | STR | **DEX** |
| 7, Teacher — Performance | INT | **CHA** |

The PDF and the markdown print the same thing in both cases, so this is errata
in the book, not extraction damage. The pack uses the **Skill entry's** Stat —
that is where a Skill's Stat is defined; the parenthetical in a background table
is a reminder — and keeps the printed value in a `printedStat` field so the
discrepancy is visible rather than silently resolved. `test/dcc.js` asserts the
errata set exactly, so a third case appearing later fails the build instead of
slipping through.

Also confirmed while extracting: **human background tables are 1d12, animal
tables are 1d6.** Tables 16–19 have six rows each, which is the book, not a
truncation.

---

## 7. Open questions

1. **Floor-1 start.** The Starter Set covers Tutorial Floors 1–2 and we don't have
   it. Recommend: build the ten steps (phase 2 needs them anyway) and let a Floor-1
   start work, but default to Floor 3 and say plainly that floors 1–2 content is out
   of scope.
2. **Six Experiences into the Codex.** They are explicitly seeds for the GM to bring
   back. Auto-creating six Codex entries per crawler could be great or could be
   clutter — worth trying behind a checkbox.
3. **Party creation.** Multiplayer makes a "session zero for the table" mode
   plausible: everyone builds at once, crawler numbers deduplicated across the party.
   Not D5, but don't design it out.
4. **Pregens.** The book points at ready-made crawlers, and Appendix 2 has the Royal
   Court. A "start from a pregen" path would skip screens 1–7 entirely.

---

## 7a. Where the build has got to

**All nine screens are built.** A crawler can be made start to finish.

| Screen | State |
|---|---|
| 1 Who are you | done |
| 2 Background | done |
| 3 How you fight | done |
| 4 Stats | done |
| 5 Scars | done |
| 6 What you brought | done |
| 7 The tutorial floors | done, except the six Experiences and Acquired Loot (Tables 25–34) |
| 8 Race & Class | done — 30 Races, 52 Classes, prerequisite-gated, with a diff preview |
| 9 Review | done |

Two things are deliberately deferred rather than faked:

- **The six Tutorial Floor Experiences and Acquired Loot** need Tables 25–34.
  They are story hooks and starting gear rather than Stats, so they can be added
  to a finished crawler later. Screen 7 says so on the screen.
- ~~A Spell-route crawler's primary attack is a Spell, and Spells are D7.~~
  **Closed.** The Spell catalogue landed in D7, so that route now produces a real
  Spell at Rank 3 carrying its +2d4 bump, Heal alongside it, and a Hotlist seeded
  with both plus the five Mana Potions. The Spell still does not leak into the
  Skills list — Spells and Skills are separate catalogues, and a test asserts it.

**Nothing is applied while you shop on screen 8.** The diff is computed live and
the transaction only lands in `dccFinishCreation`, so backing out is free and
changing a Stat point on screen 7 re-checks your Race and Class prerequisites.

### Race & Class extraction: done, with one caveat

**30 Races and 52 Classes**, in `raceclass.js`. Three problems, all now handled:

1. **A clipped duplicate text layer.** Solved by `drop_overlays()`: the copy
   shares the real block's baseline and right edge but starts further right.
2. **Names are Title Case, not ALL CAPS**, so shape cannot tell a name from a
   bullet continuation. Solved by font: every entry name is CitrusGothic 13pt and
   nothing else on the page is.
3. **The display font drops doubled letters in proper nouns.** 13 names needed
   repair. Every one was confirmed against an independent mention elsewhere in
   the book — "Classic Dwarf", "School Wand", "Tattoo Artist" ×8, "hysicker" ×3 —
   before being written down. None was guessed.

**On the count.** The blurb advertises "30 races and 49 classes". Races match
exactly. The chapter contains 52 Class entries, each with its own `Class Type:`
line; the two extra `Class Type:` markers a raw scan finds are duplicates of
Fire Spiritualist and Boring Ol' Paladin. So 52 is the content and the blurb is
approximate.

**The caveat.** The overlay filter does not clear every page. On the pages where
it fails, some free-text benefit lines are merged or truncated. Rather than ship
garbage, a line that is visibly incomplete — unbalanced brackets, repeated words,
or ending on "a"/"the"/"with" — is **dropped**, and the entry is marked
`needsReview` with its page number so the screen can say "check p.129".

That affects the **prose only**. The mechanical fields the app actually applies —
Size, Stat deltas, Skill grants, Class Type, prerequisites — parsed cleanly for
all 82 entries and are asserted in `test/dcc.js`, including that Arachnid's
Dexterity is +5 rather than the +10 a duplicated bullet would have summed to.

---

## 8. Build order

1. Skills catalogue (**D3** — blocking).
2. Screens 1–4 with real data: species branch, background tables, combat branch,
   Stats with the live derived readout. That is a playable Floor-1 crawler.
3. Screens 5–6, both mostly free text.
4. Screen 7, which is where the dice tables cluster.
5. Screen 8, the transaction/diff engine.
6. Screen 9 and print.

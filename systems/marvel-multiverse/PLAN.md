# Marvel Multiverse RPG on the shell — translation plan

**Primary source: the Core Rulebook** (2023), now on disk and OCR'd; see §3A. It
overrides everything else here. Secondary source: `D:\claudecode\bullpen_WEB_v10-5-1.html`
("The Bullpen 2.0"), 2.1 MB, 28,034 lines, a third-party single-file app with no page
citations. It is still the only source for anything outside the core book.

Nothing is built yet. Counts in §3 and §4 were measured over the Bullpen file. A **[book]**
mark in those sections means the question was open when written; §3A has the answer.

---

## 1. The thesis

**Take the data and the arithmetic. Leave the app.**

The Bullpen is about 28,000 lines of wrappers around wrappers: four UI styles, layer
on layer of monkeypatched functions, an embedded jsPDF, a self-rewriting HTML file.
Most of that is what the shell already does better — saves, print, multiplayer, wiki,
map.

What is worth having is small and separable: roughly 250 KB of catalogue literals and
about a dozen pure formulas.

The game's own loop is what the Bullpen gets wrong. **It never rolls damage**, there
is no such function anywhere in the file, and its tracker takes a typed number and
ignores Damage Reduction. In this game the attack roll IS the damage roll: the Marvel
die you just rolled times your multiplier, plus the ability. So the one thing the pack
should do that the source cannot is this: tap a power, pay its Focus, see hit or miss
and the damage, all from one roll.

**Lexicon:** world→**Universe**, hero→**Hero**, roster→**Narrator Characters**,
team→**Team**, region→**Location**, logBreak→**Adventure**, wiki→**Codex**,
GM→**Narrator**.

---

## 2. Decisions taken (2026-11-05)

**Publishing: it goes on the public site.** The owner's call: the Bullpen is already
up and the audience is small. So this is normal `main` work on the public launcher.
Keep our own theme, with no Marvel logos or trade dress.

**The build waited for the rulebook, and it arrived 2026-11-06.** It is a scan, so
`ttrpg-pdf-extract` could not read it; see §3A. Rules and rows cite pages the way DCC's
do. `verified:false` is still needed after all, for the rows from expansions (§3A).

**Official characters come from the rulebook.** The Bullpen has none. The owner will
provide them, and they become the built-in roster: read-only book rows in a new
`MMR_PROFILES` catalogue that a player or Narrator copies from. Add this to M6.

**No Bullpen character import.** Removed from M10.

**The printed sheet is designed first.** See §13.

---

## 3. What the data actually is

| Constant (line) | Rows | Becomes | State |
|---|---:|---|---|
| `powersData` (6342) | 385 | `MMR_POWERS` | clean shape, 5 fields per row; rules buried in prose |
| `traitsData` (6160) | 112 | `MMR_TRAITS` | **dirty**, about 87 rows after cleanup, 19 of them quarantined |
| `tagsData` (6276) | 62 | `MMR_TAGS` | good |
| `originsData` (6071) | 44 in 17 families | `MMR_ORIGINS` | needs grant vs menu split |
| `occupationsData` (6121) | 18 | `MMR_OCCUPATIONS` | good; effect and examples share one string |
| `powerPrereqs` (8609) | 223 | merged into powers | see below |
| `powerRankReqs` (8467) | 193 | merged into powers | no rank conflicts with the prose |
| `narrativePowersData` (8772) | 23 | `MMR_NARRATIVE` | good, Rank X and special cases |
| `narrativeLimitationsData` (8800) | 8 | `MMR_NARRATIVE` | good |
| `STANDARD` + `NAMED` (5428, 5456) | 3×3 + 30 | `MMR_MANEUVERS` | **Focus costs are invented** |
| `hqTagsData` / `hqTraitsData` (8816, 8839) | 18 + 18 | `MMR_HQ` | good |
| `hqVehicleTemplates` / `hqCommonWeaponsData` | 5 + 12 | `MMR_GEAR` | good |
| `ITEM_SPECIFIC_POWERS` / `II_RESTRICTION_EXAMPLES` | 30 + 5 | `MMR_ITEM_RULES` | good |
| `_CONDITIONS` (13992) | 12 | `MMR_CONDITIONS` | **incomplete and vague** |
| `SCHOOLING_REWARDS` (16233) | 10 | `MMR_SCHOOLING` | good |
| `ELEMENT_TYPES`, `SIZE_FX` | 11, 11 | `data.js` | good |
| `capBoosters`, `dmgBoosters`, defence swaps | small | `data.js` | good |
| TN helper (24284), NPC templates (22683), quirks and names | small | `data.js`, `SYS.generators` | app author's guesses; label as such |

**Not in the file at all:** prebuilt heroes, villains or Iconic Items.
`iconicItemsData` starts empty, and "profiles" are 5 thin starter shells. Those lists
begin empty and fill through the catalogue's table-made rows. If rulebook profiles are
wanted, they are a separate job from the book.

### Known defects — do not carry these across

1. **The roller contradicts its own data on Fantastic. [book]** `rollAbilityCheck()`
   requires M on the Marvel die *and* a 1 on a regular die. The powers text says
   otherwise: "automatically rolls a 1 on their Marvel die" (Combat Trickery, Combat
   Support), "turn their Marvel die to a Fantastic success" (Lightning Actions,
   Offensive maneuver level 3). My memory of the book agrees with the data: **M on the
   Marvel die on a successful check is Fantastic; 6-M-6 is Ultimate.**
2. **It reports a "FANTASTIC HIT" on a miss.** The Fantastic branch never checks the
   total against the TN.
3. **Trouble never touches the Marvel die** in the code, but Combat Trickery says that
   die "cannot be affected by trouble", which only means something if it normally can.
   **[book]**
4. **Prerequisites live in two places and neither is complete.** Of 385 powers: 59
   state them in both, **24 only in prose**, 138 only in the table, 164 have none.
   Every check in the app reads only the table, so those 24 — Anger, Advance, Always
   Ready, every Sorcerous gate — are never enforced. **Three outright conflicts [book]:**
   - Counterstrike Technique: prose *Attack Stance*, table *Fast Strikes*
   - Domination: prose *Orders*, table *Command*
   - Coiling Crush: prose adds *Reverse Punch*
5. **Animal grants 18 powers. [book]** `applyOrigin` grants everything in
   `origin.powers` and `recalcSlots` charges for it, so Animal costs 18 picks against
   Rank 1's 4. That list can only be a menu. The other 13 origins with powers need
   sorting into grant or menu. The app's own copy also says grants are "free and
   locked", while the code charges for them.
6. **Junk in the trait list:**
   - `Inspiration` is a power row pasted in. `Discipline` and `DNA Manipulation` are
     not traits. `Mummudrai` lists DNA Manipulation as a power, which is the one
     dangling reference in all the origins: it is a narrative power.
   - `Lab Access`, `Public Identity`, `Secret Identity`, `Streetwise` exist as both
     trait and tag, with different text. They are tags.
   - `Situation Awareness` duplicates Situational; `Investigative` duplicates Investigation.
   - 15 `Connections: X` and 3 `Anathema` rows are one trait plus a note.
7. **19 traits read like filler [book]** and are quarantined until checked: Alienated,
   Brilliant, Business Sense, Celebrity, Charismatic, Contacts: Media, Criminal
   Underworld, Deadly Aim, Espionage, Frightful, Hidden Weapons, Knowledgeable,
   Learning, Mentorship, Navigator, Research, Survivalist, Wealthy, Youthful. This is
   my judgement, not a finding. **No origin or occupation references any of them, so
   quarantining breaks nothing.**
8. **Conditions are short.** Twelve chips with one-line invented descriptions. Its own
   text names others it has no chip for: Deafened, Corroding, Unconscious, Surprised,
   Immobilized, Infected. **[book]**
9. **Damage Reduction is described two ways. [book]** The Sturdy rows say "reduces
   incoming Health damage by N". The sheet's hint and the Uncanny rows say it lowers
   the attacker's *multiplier*. Those give very different numbers.
10. **Health clamps at 0**, while its own text describes Health at or below 0 (Let's
    Go, the Unkillable item power, vehicles destroyed at minus max). **[book]**
11. **Team maneuver Focus costs are made up.** The source comment says so: "exact
    numbers not in the paste". 5/10/15 is a placeholder. **[book]**
12. **Dead references.** `Rival`, `Debt` and `Responsibility` have note hints and
    multi-take entries but no tag rows. Hard to Kill requires the "Deceased trait",
    and Deceased is a tag.

---

## 3A. What the rulebook settled (2026-11-06)

**The file.** `Marvel-Multiverse-RPG-Core-Rulebook.pdf`, 322 pages, each one JPEG at about
180 dpi with no text layer. That is why `ttrpg-pdf-extract` produced an empty `.md`: it
reads text layers and has no OCR. **PDF page n is printed page n−1.** Page cites below are
printed pages.

**The text.** `.book/book.txt` (940,000 characters, reading order, page markers) and
`.book/ocr/` (per-page boxes), both gitignored along with the PDF. OCR is good but not
proof: it misreads stat-block digits and drops some spaces. **Check a scan before trusting
a surprising number**, because the OCR is a witness and not the book.

### Verdicts on §3

| # | Question | The book says | Page |
|---|---|---|---|
| 1 | Fantastic | **M on the Marvel die is a Fantastic roll, whether it hits or not.** M counts as 6. Meets the TN: Fantastic success, default double damage. Misses: **Fantastic failure**, a real result where the player proposes a "No, but" and the Narrator approves. 6-M-6 is an ultimate Fantastic roll: auto-success, ignores trouble, cannot beat "impossible". | 12–14 |
| 2 | "Fantastic hit" on a miss | Wrong as labelled, but a miss on M does still matter: show Fantastic failure | 14 |
| 3 | Trouble and the Marvel die | **Trouble rerolls the best die and keeps the worse; M is always the best.** So it does touch the Marvel die. Edge rerolls any one die, the player's choice, keeps the better | 15 |
| 4 | Prerequisites | Each entry and the set lists (pp. 76–80) give them. **All three conflicts go to the prose:** Counterstrike Technique = Attack Stance, Domination = Orders, Coiling Crush adds Reverse Punch. See the measurement below: this problem is much larger than I thought | 74–131 |
| 5 | Animal's 18 powers | **Animal is not in the core book.** Separately, I had this backwards: origin powers "do not come for free" and "must be picked first" (p. 52), so **the Bullpen is right to charge for them** and only its "free and locked" wording is wrong. They are a required first spend, not grants | 52 |
| 6 | Junk traits | Confirmed: `Inspiration`, `Discipline`, `DNA Manipulation` are not traits. `Connections` is one trait taken many times | 59–63 |
| 7 | The 19 quarantined traits | **None is a trait entry in the core book.** They are expansion rows or filler, so they stay out unless an expansion shows otherwise | 59–63 |
| 8 | Conditions | **13:** Ablaze, Bleeding, Blinded, Deafened, Demoralized, Grabbed, Paralyzed, Pinned, Prone, Shattered, Stunned, Surprised, Unconscious. Corroding, Immobilized and Infected are not in the core book at all | 37–38 |
| 9 | Damage Reduction | **It lowers the multiplier.** Below 1 means no damage at all, not even the ability bonus. Applied before Fantastic doubling. Does not stack: largest wins. Separate Health and Focus DR. Sturdy's "reduces damage by N" wording is the Bullpen's error | 34, 122 |
| 10 | Health below 0 | Health below 1 is unconscious. At negative max or worse, killed. Focus at 0 is demoralized. At negative max or worse, shattered. **Pools must go negative** | 33–34 |
| 11 | Team maneuver costs | **I was wrong that these were made up. 5, 10, 15 Focus each is exactly the book.** Level by team's average rank 1–2, 3–4, 5–6. Once per battle, at the start of a round, within 5 spaces; Karma can pay instead | 38 |

### New rules the plan was missing

- **Damage on M:** 6 × (multiplier after DR) + ability, then double the whole thing on a
  Fantastic success (Shang-Chi, p. 33: 6×4+7=31, doubled 62).
- **Weapons do not add to Mighty.** All multiplier bonuses take the largest, including
  weapons (p. 34). Weapon table on p. 34.
- **Karma.** Heroic tag only, equal to Rank, resets on a full night's sleep. Spend after a
  roll for an edge, or to give an attacker trouble; at most 1 per check. Karma recovery:
  Resilience or Vigilance vs TN 10, gain **the dice total × Rank**, not the Marvel die
  (Black Panther, p. 36: 2-M-5 is 13 × 4 = 52), doubled on Fantastic.
- **Holding back:** a Heroic attacker leaves a target 1 away from dying or shattered unless
  the player says otherwise, and weaponless attacks are nonlethal by default (pp. 34, 36).
- **Fantastic initiative earns a bonus round**; ties break on Fantastic, then modifier,
  then player characters first (p. 28).
- **Health and Focus floor at 10** (p. 19). Battle Ready is +30 Focus (p. 59). Big: −1
  Melee and Agility defense, +1 Run, reach 2. Small: +1 and −1 Run (pp. 60, 62).
- **Picks:** Rank×4 plus a thematic bonus of Rank − sets used; basic powers count toward
  no set (p. 67). Spare picks trade one for one into **traits or ability points**.
  Extra traits: one per Rank (p. 59).
- **Special Training** may only pick Martial Arts, Melee Weapons, Ranged Weapons, Shield
  Bearer, Tactics and suitable basic powers (p. 68). **Vampire and Werewolf** gain a rank
  bump and cannot choose other powers without another origin (p. 54). **Surprising
  Power** ignores rank and origin limits but not prerequisite powers (p. 62).
- **Numbered powers need the one before**, even if unstated (p. 68).
- **Iconic Weapon has no zero-cost rule in the core text** (p. 103): default it to one
  pick. The Bullpen's cost of 0 is unexplained.
- **The book's own sheet** has a Team Maneuver block and separate Health and Focus DR
  (p. 314). §13's sheet needs the block.

### Core versus expansions: the biggest change to scope

The Bullpen says it holds core + expansions + errata and never says which row is which.
Measured by name against the book:

| Rows | In the core book | Not in the core book |
|---|---:|---|
| Powers, 385 | 321 | **64**, including every Luck power, Precognition, Postcognition, Control Emotion and the Venom powers |
| Traits, 112 | 64, plus 8 `Connections` variants of 1 trait | about 40 |
| Tags, 62 | 49 | 13, such as Patron, Signature Item, Mutant Associate |
| Origins, 44 | 29 | **15**, including Animal, all Rank X and Symbiote |
| Occupations, 18 | 18 | 0 |
| Narrative powers + limits, 31 | at most 1 | **about 30**: the whole Rank X layer |
| HQ tags + traits, 36 | 2 | **about 34**: the whole headquarters system |
| Item powers, 30 | at most 1 | **about 29**: Iconic Items and suit building |

**Also absent from the core book:** Getting Schooled (0 mentions), Sinister Plot Points (0),
Iconic Items (0), Team Rank (0), Corroding, Immobilized, Infected. So action 9's Schooling
half, all of M8's item-building and all of M9's headquarters rest on the Bullpen alone.

**Decision, until the owner says otherwise:** carry those rows with `source:'expansion?'`
and `verified:false`, and show a small label on them. Build core first; the core game is
fully playable through M7 without them.

### What the Bullpen's powers are worth, measured

337 parsed book entries, compared field by field:

- **Effect text is close to verbatim:** median similarity 1.0, 31 rows under 0.8 to review.
  **Cost: no disagreements.** **Action: 1** (Flexible Fingers).
- **Duration: 1 real disagreement** (Teleport Object: book Permanent, Bullpen Instant).
  **Sets: 6** where one side lists a set the other lacks.
- **Rank: 96 powers have a rank in the book and none in the Bullpen, and 36 disagree.** For
  example Sturdy 3 is Rank 4 and Sturdy 4 is Rank 6 in the core book (p. 122, checked on the
  scan), where the Bullpen has 3 and 4. Same pattern for Uncanny and Shield.
- **Prerequisites: 64 rows differ.** Mostly book requirements the Bullpen leaves blank,
  including every Sorcerous, Chaotic and Cursed gate in its table, and chains such as
  Elemental Burst → Blast → Barrier → Protection 1.
- **Stormglass,** the §13 sample hero, has Elemental Protection 2 without the book's
  Elemental Barrier, so it fails the importer's rule below and needs replacing at M7.
- **Later books update powers (the owner's call, 2026-11-06).** The Bullpen was built with
  later books and errata that are not on disk here, so **a disagreement is probably an
  update, not a mistake, and the Bullpen wins it.** That supersedes the "guessing" reading
  above, and it means Sturdy 3 and 4 stay at Rank 3 and 4.

**So the importer's rule for powers is:**

| Situation | Take |
|---|---|
| Both state a value and disagree | **Bullpen** |
| Bullpen states it, book is silent | Bullpen |
| Book states it, Bullpen is silent | **Book.** A blank is not an update, and without this 96 powers have no rank limit |
| Effect text | Bullpen's wording, which is cleaner than OCR |

Rows found in both get a `page`. Rows only in the Bullpen get `source:'expansion?'`.
**Rules outside the power rows** (dice, damage, conditions, Karma) still come from the book
unless an update is in hand. Parser draft: `.book/tools/powercheck.js`, moving to `tools/`.

### The official characters

**Built ahead of M6 (2026-11-06).** Chapter 8 (pp. 134–261) has **128 one-page profiles**:
77 Heroic, 33 Villainous, 18 neither (Hulk, Loki, Magneto and other antiheroes, plus the
Average Civilian). All are in `profiles.js`, generated: stats, labels, History and
Personality, but no art. **Carrying the book's prose is the owner's call (2026-11-06)**, and
this pack's exception to the repo's "mechanics, not the book" note in `.gitignore`.

**The prose** is about 20,000 words, read off OCR and cleaned by `tools/prose.mjs` against an
English word list (`.book/words.txt`, exported from pyspellchecker). Fixes it cannot make
go in `tools/prose-fixes.json`. Line spacing finds the paragraphs. The OCR scored this text
highly, but not every word has been read against the scan, so an occasional lost comma is
likely: Hulk's was found only by reading his page. Correct them there as they turn up.

**In the app:** they are a read-only built-in catalogue, the Official tab of Narrator
Characters, because the shell has no global database, only per-table Firebase. *Add to table*
copies one into the table's roster, which syncs. *Play as Hero* copies one into a save. Until
M3 the sheet shows them as a read-only stat block plus the abilities grid; Health, Focus and
Karma cannot be tracked on it yet.

**How the numbers were checked:** `tools/boxes.py` crops every stat box and reads it alone;
`tools/parse-profiles.mjs` compares that with the whole-page OCR and re-derives what the
rules expect. The two passes never disagreed. Every remaining doubt was read off the scan
and recorded in `tools/profile-overrides.json`: 32 oddities on 26 pages, all as printed.

**The book's arithmetic is not always its own rules, and we keep what it prints:** Iron Man
75 Health and Focus, Baron Zemo 90 Health on Resilience 2, Thanos 90 Focus with Vigilance 3
and Battle Ready, several Initiatives one off Vigilance. **One correction:** Echo's Vigilance
defense prints as 2, which is 12. Three profiles carry a rules note (`formNote`): Emma Frost's
crystalline form, Blade, Namor. Emma's slash values are stored as her human form plus that note.

**Regenerating:** `node tools/parse-profiles.mjs .book tools/profile-overrides.json`, then
`node tools/build-profiles.mjs .book profiles.js`. The second refuses to write while any
doubt stands. Corrections go in the overrides file, never in `profiles.js`.

---

### The rules text, brought forward out of M1 (2026-11-07)

**The owner's note:** *"The whole reason I asked you to build this was to have a better setup
for reading powers and tags. Right now this is just as fine as Marvel's official sheets —
which means I see the names of the powers, but not what they do."* That is the pack's thesis
(§1), and it was not true of the first sheet, so the reading half of M1 was built before the
rest of it.

**Two generated files**, from `tools/build-rules.mjs` (`node tools/build-rules.mjs .book .`):

| | Rows | Source | Why |
|---|---|---|---|
| `powers.js` | 385 | the Bullpen, `page` from our scan | §3A: a disagreement is an update, and its wording is cleaner than OCR |
| `traits.js` | 57 traits, 48 tags | the Core Rulebook, Chapter 5 | "rules outside the power rows come from the book"; the book prints three paragraphs on Berserker where the Bullpen prints one line |

64 powers are flagged `source:'expansion?'` — the Luck, Translation, Sixth Sense,
Precognition and Dreamtime sets, none of which this book prints anywhere. Everything else
cites a page. The Bullpen's extra traits and tags are later-book rows and are **not** carried:
if this book does not print it, it is not here.

The trait and tag text goes through `tools/prose.mjs`, the same cleaner as the character
prose, so the fixes it gained ("reach to 2.They", "applies-1", "ancestors-is") improved both;
regenerating `profiles.js` changed five lines, all of them a missing space. The generator
**refuses to write** on a count it does not expect, on a name out of the book's alphabetical
order, or on an OCR artefact it knows the shape of.

This is the READING half of M1 only. The structured half — `focus` as a number, `actions` as
flags, inferred `roll`, `reqTags`, `minRank` — is still M1's, and belongs **beside** these
rows rather than in place of them. `rules.js` is still free for M2's arithmetic.

**What reads them:** `systems/marvel-multiverse/sheet.js`. `mmrRuleFor()` is the lookup, and
it has to be: Chapter 8 prints a name with the character's own particulars stuck to it —
`Animal Communication (Bugs)`, `Elemental Protection 3 (30 points to shatter)`,
`Connections: Military (Dora Milaje)`, `Surprising Power (2) (Grand Illusion, Mirror Images)`
— so it peels bracket groups one at a time, then a colon, then a trailing number, and shows
the particulars beside the rule. Every power and trait on all 128 profiles resolves. One tag
does not: Doctor Strange's **Prescription Pad**, which his page prints and Chapter 5 never
defines, so it shows as a name with nothing under it.

**Three surfaces, one renderer:** the hero sheet, an open card in the Official tab, and a
copy on the table (through the new `SYS.npc.bodyExtra` hook). A table's copy is editable, so
its rules are looked up from **its own** names, not from the profile it was made from.

**And the layout, which was the other half of the note.** The rule under a name is only
readable if the line is a measure rather than a page width. Everything with rules text in it
is set in CSS columns (`column-width:290px`), so widening the window adds a column and never
a longer line; the three short cards — Vitals, Abilities, Background — make one row above
them; prose is capped at 68ch. Columns, not a grid: a grid lines the cards up in rows, and
one long power then leaves a hole beside every short one next to it. The phone is one column
of the same cards and did not move. A switch (`mmr-no-rules` on `<html>`, so it reaches the
sheet and 128 cards at once without a repaint) folds the text away for anyone who wants the
old list back.

**On paper:** `SYS.sheetPrint` is a new hook in `core/print.js`. Without it the printed sheet
takes `SYS.sheetExtra` and strips its tags, which for a character out of the book is 2,000
words in one paragraph. Marvel's returns the print stylesheet's own blocks, each entry its
own `.pr-blk` flowing through `.pr-cols`, so Spider-Man — every power with its rule, traits,
tags, history, personality — comes out on one letter page.

---

## 4. Translation: their shape to ours

The catalogue contract is already set by `core/catalog.js`: **arrays of rows with a
`name`**, plus `effect`, `kind` (filter chip) and `tier`. Everything below fits it,
which gets search, filters, "Yours" rows and multiplayer sharing for nothing.

### Powers

Theirs — a keyed object, with the rules inside the prose:

```js
"Domination": { set:"Telepathy", action:"Standard", duration:"Permanent", cost:"20 Focus",
  effect:"The character dominates a target … Prerequisites: Orders, Rank 5." }
```

Ours — one row, with the rules as data and the prose only saying what the prose alone
can say:

```js
{ name:'Domination', kind:'Telepathy', sets:['Telepathy'],
  family:null, tier:null,             // 'Mighty 2' -> family:'Mighty', tier:2
  actions:['standard'], duration:'Permanent',
  focus:20,                           // 'N or more' -> more:true; 'per turn' -> per:'turn'
  minRank:5, prereqs:['Orders'],      // + reqTags:['Sorcerous'], reqOrigins:[…]
  trigger:null, range:null,           // lifted out of the prose
  roll:{ ability:'logic', vs:'logic', adv:-1 },
  cat:'active',                       // attack | active | reaction | passive
  effect:'The character dominates a target …',
  verified:false }
```

Measured over all 385:

| Field | Coverage |
|---|---|
| `focus` as a number | 379; the other 6 keep `focusText` ("Varies", "Same as Elemental Protection") |
| `actions` | 385; 9 spellings collapse to 4 flags |
| `trigger` lifted from prose | 91, none left behind |
| `range` lifted from prose | 12 |
| `prereqs` | 216 after merging prose and table; 192 have `minRank` above 1 |
| `reqTags` / `reqOrigins` | 4 / 1 (Sorcerous; Power Cosmic) |
| `sets` | 37 strings resolve to 30 real sets; 10 powers are multi-set |
| `tier` | 22 families |
| `roll` inferred | **153 by pattern; 34 of them name no defence and need a human.** Passive powers rightly get none. |

The inferred `roll`s are a draft, reviewed by hand once and then kept in an overrides
file. Bullpen works this out by regex on every render; we bake it in and test it.

### Traits and tags

```js
{ name:'Connections', effect:'…', multi:true, noteHint:'e.g. Maggia, NYPD, Damage Control' }
{ name:'Battle Ready', effect:'…', mods:{ focusMax:30 } }
{ name:'Big', effect:'…', mods:{ defence:{melee:-1, agility:-1} }, size:'Big' }
```

`multi` comes from `MULTI_TAKE_*`, `noteHint` from the `map` table at line 9682, `mods`
replaces name-matching scattered through the code. A grant of `Connections: Criminal`
becomes `{name:'Connections', note:'Criminal'}`.

### Origins and occupations

```js
{ name:'Alien: Kree', family:'Alien',
  grants:{ tags:['Alien Heritage','Extreme Appearance'],
           traits:['Breathe Different','Enhanced Physique'], powers:[], narrative:[] },
  powerMenu:[],                       // Animal's 18 go here, pending the book
  suggests:{ occupations:['Outsider'] },
  limits:{ minRank:null, rankXOnly:false, note:'' } }
```

**Grants are derived, never stored.** The Bullpen copies grants onto the character and
then needs `_syncVisiblePowers`, ownership trackers, backfills and a comment reading
"CRITICAL: empty manualPowers [] must NOT wipe charP". The character stores
`origin`, `occupation` and *what the player picked*; `derive.granted(char)` works out
the rest on each render. Changing origin cannot orphan anything, and DCC already works
this way (`granted: 'derive.grantedSkills'`, `lent: 'derive.wornSkills'`).

### Everything else

| Bullpen | Shell home |
|---|---|
| Custom powers, traits, tags, origins | catalogue "Yours" rows, already universe-scoped and shared; better than its per-browser Library |
| Iconic Items, Battle Suits | catalogue rows with `itemKinds`, carried in `inventory`; Owned/Borrowed is a field |
| Hero Vault, recents, trash | save files |
| Team folders | Universes |
| Portraits | not in the shell's sheet today; separate decision |
| Roll history | Log, plus the multiplayer roll feed |
| Narrative items (plot artifacts) | Codex entries |

---

## 5. The hero on the sheet

```
identity   heroName, realName, rank, origin, occupation, size, bio fields
```

| Block | Type | Notes |
|---|---|---|
| `abilities` | `traitGrid` + pack `render` | M.A.R.V.E.L.: Score, Defence, Non-combat, Damage. `type` stays so roller and print still find it. `span:'full'`, `locked` |
| `health` | `pool` (extended, §7) | max(10, Res×30); type an amount; may go negative [book] |
| `focus` | `pool` (extended) | max(10, Vig×30) + Battle Ready 30; **powers spend from here** |
| `karma` | `pool` | starts at Rank; the Bullpen gates it behind the Heroic tag [book] |
| `sinister` | `pool` | Sinister Plot Points; shown only with Villainous |
| `combat` | `readout` | Initiative, Health DR, Focus DR, Reach, Size |
| `speeds` | `readout` | Run, Climb, Swim, plus Jump, Flight, Glide, Swingline, Levitate where earned |
| `powers` | **`catalogItems`** | new block; `span:2`; picks counter, set rules, die button per row |
| `traits` | `catalogItems` | budget Rank + bonuses |
| `tags` | `catalogItems` | no budget |
| `narrative` | `catalogItems` | Rank X / Narrator |
| `gear` | `inventory` | a single `list`; Iconic Items and suits live here |
| `schooling` | pack `render` | Getting Schooled, 10 boxes |

**Tabs, keeping the phone nav in mind:** `powers` (Mine / Library), and `base`
(Headquarters) in M9. The HUD (`renderHUD`) is the fight view, and it is the screen
that matters most.

### The arithmetic to port (`rules.js`, pure, one test per line)

- Defence = score + 10, + Spider-Sense +2 Agility, + size. Brawling, Evasion, Integrity
  and Wisdom swap which defence applies.
- Non-combat check = score + tier of the matching power.
- Multiplier = Rank + highest of Mighty/Grow (Melee), Accuracy (Agility), Discipline
  (Ego), Brilliance (Logic). Rank X = ×10.
- Damage = Marvel die × (multiplier − target's DR) + ability, nothing if that multiplier
  is below 1; a Fantastic success doubles the total. M counts as 6. (§3A, p. 34)
- Multiplier bonuses, weapons included, never add: take the largest. (p. 34)
- Ability cap = Rank + 3 + matching tier; floor −3.
- Budget: abilities Rank×5 + traded picks + schooling. Power picks Rank×4 + (Rank − sets
  used, min 0) + schooling − trades. Traits Rank + schooling + trades. Basic powers count
  toward no set. Origin powers are paid for, and picked first. (pp. 52, 59, 67)
- Power cost = its tier number, else 1. Iconic Weapon costs 1 in the core text; Iconic
  Items are expansion rules. Upgrading pays the difference. A multi-set power counts
  toward one set, the player's choice.
- Health below 1 = unconscious, ≤ −max = killed. Focus 0 = demoralized, ≤ −max =
  shattered. Pools go negative. (pp. 33–34)
- Karma = Rank with the Heroic tag, otherwise 0. Recovery = dice total × Rank. (pp. 19, 36)
- Run = 5 + floor(Agility/5) + size; the speed rules at line 7638.
- Item Power Value = picks granted + item powers − restrictions, min 1, less overlap.
- Team Rank = mean of the 6 highest, rounded up. HQ traits = Team Rank × 3.

**Rank X** is Narrator-only: reachable from the NPC form, not from hero creation.

---

## 5A. Yours to change: adapting an official hero (2026-11-07)

**The owner's note:** *"The pre-generated characters should not be altered. However, once a
hero is yours, they can be editable. Tony Stark wears more than one armor, for instance!"*

**Why this is not a UI job.** Today *Play as Hero* writes a **pointer**:
`{systemId, name, profile:'iron-man-tony-stark', blocks:{abilities}}`, and `mmrSheetExtra`
reads every number back out of `MMR_PROFILES` through `mmrProfile(ch.profile)`. There is
nothing to edit, and the only thing an edit could reach is the catalogue every other save
and the Official tab share. Both halves of the note are therefore the same change: **the
book is read-only because the copy is real data.**

### The two shapes, named apart

| | What it is | Rules |
|---|---|---|
| `MMR_PROFILES` | the book's 128 rows, generated from the scan | **deep-frozen at load.** Never written at runtime, never migrated, never patched for a player. A correction goes to `tools/profile-overrides.json` and a regeneration, as §3's "The official characters" already says |
| `ch.sheet` | the playable data a save **owns** | a deep copy, made once, at adoption. Every reader goes through it |
| `ch.profile`, `ch.profileRev` | provenance only | "based on Iron Man, Book p. 196", and the hook for the diff below. **Never a source of numbers** |

`ch.sheet` carries what the profile carries — `rank, kind, realName, origin, occupation,
size, teams, base, abilities{score,def,check}, damage{}, speeds{}, health, healthDR, focus,
focusDR, karma, init, initEdge, traits[], tags[], powers[], history, personality, formNote`
— and nothing else. The *printed maxima* live here; the *current* Health, Focus and Karma
stay where M3 puts them, in `ch.blocks`. Conflating those two is how a loadout switch would
silently heal somebody.

**One reader, and it is not `ch.sheet`:** `mmrEffective(ch)` returns the base sheet with the
active loadout applied, and the stat block, the HUD, the dice, the printed page and the
roster mirror all call it. A reader that reaches past it is the bug this section exists to
prevent, and a test looks for one.

### Editing, and what edits are not

Everything on `ch.sheet` is editable: identity and prose, the six abilities and their trained
Defense and Check (§2 — those are trained values, never derived), the vitals, and the
powers, traits and tags as lists, with the rules text still resolving under each name through
`mmrRuleFor()` — a hand-typed name that Chapter 5 does not define shows as a name with
nothing under it, exactly as Doctor Strange's Prescription Pad does now.

**Edits are not validated, and legality is a report rather than a gate.** The book's own
pregens are illegal by its creation rules — Iron Man prints 75 Health on Resilience 3 — and
§3A already settled that we keep what the book prints. A *Check against the rules* button
says what is off (budget, ability cap, prerequisites, derived vitals) and changes nothing.
The creation wizard (M4) is the place that refuses a pick, because there the player is
spending a budget.

### Loadouts: more than one armor

A **loadout** is a named overlay on the owned sheet, not a second sheet:

```js
{ id, name:'Hulkbuster', note:'p. 196 Iconic Battle Suit',
  add:{ powers:['Mighty 6'], traits:['Immovable'], tags:[] },
  remove:{ powers:['Flight 3'] },
  set:{ health:100, healthDR:-4, abilities:{ melee:{score:9} } } }
```

Overlay rather than a snapshot, deliberately: six armors as six full sheets is six places to
fix a typo in Tony's history, and it makes the one screen that is actually worth having —
**what this armor changes** — impossible to draw. *Duplicate as a loadout* computes the
overlay from a free edit, so the simpler mental model is still available. `activeLoadout`
names one, `'base'` means the overlay-free sheet, and the switcher sits in `.mmr-head`,
the row that already holds Rank, kind and page.

**Switching mid-fight carries the damage, not the pools.** If Hulkbuster sets Health 100 and
Tony stands at 40 of 75, he is 35 down and stays 35 down: 65 of 100. Current values clamp to
the new maximum; a bigger maximum is never healing. Karma, being a resource and not a
capacity, does not move at all.

### The book changing under a copy

`profileRev` is stamped at adoption. When a regenerated `profiles.js` disagrees with the row
a save was copied from, the sheet offers a diff — *the book's Iron Man changed: Focus 75 →
90* — and the player pulls a field across one at a time. Nothing is ever overwritten for
them. This is also the honest answer to a correction we make months from now.

### Narrator copies get the same model, later

*Add to table* still writes a flat text row, because flat text is what syncs, and
`mmrRowPowerGroups` already reads a Narrator's own edited names rather than the profile's.
Giving a roster copy the same `sheet`/loadouts shape is worth doing — a Narrator's Hulkbuster
is the same want — but it touches the synced schema and `database.rules.json`, so it waits
for M6 and is listed there.

### Sequencing: M3a, before the wizard — **built 2026-11-07**

| Step | Work | Done when |
|---|---|---|
| 1 | `own.js`: freeze the catalogue, `mmrAdopt`, `mmrEffective`, the save migration | the sheet renders identically from owned data; the Official tab is byte-identical after a save edits its copy |
| 2 | Editing the owned sheet, and the legality report | rename Tony, drop a power, add a trait, reload — it holds |
| 3 | Loadouts: create, name, edit, switch, delete, the delta view, print, roster mirror | two armors, switched, with the pools behaving as above |
| 4 | The `profileRev` diff | a regenerated row offers its change and does not take it |

**All four are in.** What the build settled, beyond the design above:

- **`mmrEffective()` returns a copy even with no loadout on.** Handing back the live
  sheet made every reader an accidental writer — the legality report adjusts a value to
  answer a what-if, and that quietly rewrote the character it was reporting on. Found by
  the mirror check failing three checks downstream, not by the check aimed at it.
- **The editor is the shell's own Edit switch** (`sysEditing()`), not a second control:
  `opts.edit` puts a field where each number was and nothing about the layout moves.
  With an armor on, an edit lands on **that armor** — which is how `set` gets filled
  without a second screen — and the sheet says so above the fields, because guessing
  wrong is how somebody edits Tony and finds they edited the suit.
- **Provenance is a hash per field (`profileFields`), not a second copy of the row.** It
  answers "did the BOOK change?" in a few bytes where keeping the original would double
  the prose in every save. What the player needs is the book's value *now* against
  theirs, and both are in hand. It is stamped against the book's values, never against
  the edits carried in by the migration, or the notice fires the first time they look.
- **Speeds are edited as the line the sheet already prints** — `Run 6, Climb 3, Jump 30`
  — parsed back by `mmrParseSpeeds()`, with `mmrSpeedText()` as its exact inverse and a
  check holding them to it. That is what makes a speed addable without a screen of its own.
- **The report checks four things and says what it does not check.** Derived vitals,
  the Rank + 3 ability cap, prerequisites, and names the book does not print. Measured
  against the book's own 128: Health flags 2, Focus 2, Karma 0, the cap 1, prerequisites
  13. **Defense and the non-combat Check are deliberately left out** — score + 10 is the
  rule, but size, Spider-Sense, Evasion and Integrity all move it, and checking it flags
  32 of 128 characters and 165 Check values, which is a report nobody reads twice. The
  **pick budget** waits for M2's `rules.js`.
- **Prerequisites honour the book's own convention:** Chapter 8 prints only the TOP tier
  of a tiered power, so owning Mighty 3 is owning the chain. Without that rule the check
  flagged 95 of 128 characters; with it, 14 unmet prerequisites on 13 — which is the
  book being illegal by its own rules, as §3A said it is.
- **`mmrRosterRow` takes the profile id as an argument now.** An owned sheet has no
  `id`, because it is nobody's catalogue row any more, and `profile: undefined` on a
  mirrored row both lost the provenance the Official tab reads and handed Firebase an
  `undefined`, which wedges every later save.

**Tests:** 26 new checks in `test/marvel.js` (105 in the suite, 1254 across the ten),
and 18 deliberate mutations, each caught by the check meant to catch it — a freeze that
is only shallow, a loadout the sheet ignores, a mirror that reads the book again, a
migration that runs twice, a bigger maximum that heals you, prerequisites without the
tier convention, the Official tab drawing the player's sheet.

**New file:** `systems/marvel-multiverse/own.js` — the owned-sheet model (adopt, effective,
loadouts, migrations). `sheet.js` stays the renderer; `rules.js` stays reserved for M2.

**The migration matters more than any of it.** An existing save is
`{profile, blocks:{abilities}}` with no `sheet`. It adopts once, on load, stamped so it
cannot adopt twice — and it must carry across whatever is already in `blocks.abilities`,
because that is the one thing a player can have changed today.

**Tests, each falsifiable per §11:** the catalogue is deep-frozen and a write does not stick;
adopt → edit every field class → reload → the edits are there and the book's row is
unchanged; a reader that bypasses `mmrEffective` is caught by rendering an armored hero and
asserting the base value appears nowhere; switching a loadout at 40 of 75 gives 65 of 100;
the migration is idempotent and keeps a changed ability score.

---

## 6. Dice: d616

```js
dice: {
  formula: 'd616',
  skillBlocks: ['powers'],
  degrees: [Failure, FantasticFailure, Success, FantasticSuccess, Ultimate],
  advOptions: [{v:2,'Double Edge'},{v:1,'Edge'},{v:0,'Straight'},{v:-1,'Trouble'},{v:-2,'Double Trouble'}],
  tnInput: true,                 // or a target's defence
  resolve: mmrResolve,           // {dice:[d1,d2,m], marvel:'M'|n, total, difficulty, degree, damage}
  resultHTML: mmrRollResultHTML, // three dice, M drawn as M, the damage line
}
```

Two d6 plus the Marvel die, where **M counts as 6**. Edge rerolls one die of the player's
choice and keeps the better. **Trouble rerolls the best die, with M always best, and keeps
the worse.** They cancel one for one, stack, and 6-M-6 ignores trouble. Edge is optional,
so the player picks the die: keep the Bullpen's one good idea, an option to fish with the
Marvel die when the total is already enough. (pp. 12–15)

---

## 7. Changes the shell needs

All opt-in, so DCC and Daring Comics do not move. Found by reading the paths this pack
takes, per PORTING §2.

| # | Where | Change |
|---|---|---|
| 1 | `dice.js:210` | Straight/Advantage/Disadvantage is hardcoded; read `SYS.dice.advOptions` |
| 2 | `dice.js:232` | "+ Rank + Stat Mod" is hardcoded; read `SYS.dice.formulaNote` |
| 3 | `dice.js:194` | "(Rank n)" label only when `rank` is meaningful |
| 4 | `dice.js:316` | pass a TN from a new `-tn` field to `resolve` |
| 5 | `dice.js:373` | `SYS.dice.resultHTML` override: the die highlight assumes one chosen d20 |
| 6 | `blocks.js:445` | `pool`: typed amount, `min`, optional state labels. ±1 cannot reach Health 90 |
| 7 | `blocks.js` | new **`catalogItems`**: already in the SHELL-PLAN §2 vocabulary. Add, remove, note, prereq gate, budget, granted rows, die button. Daring Comics' powers want it eventually, so it belongs in `core/` |
| 8 | `catalog.js:129` | `catalogIsEntries` includes `catalogItems`; hide "Grant at Rank" for those; search `sets` as well as `kind` |
| 9 | `dice.js:128` | `rollEntries` also reads `b.entries` |
| 10 | `print.js:515` | `prBlockRows` honours `block.printRows(ctx)`; add `catalogItems` |
| 11 | `state.js:52`, `creation.js:105` | **default `floor:3` leaks**: the identity card would read "Adventure 3". Only show it for a pack that tracks a floor; pack sets `floor:null` |
| 12 | `core/*.js` | about 18 user-facing "GM" strings need `lex('gm')` |
| 13 | `shell.css` | one more theme block, as `crawler` has |
| 14 | `state.js:386` | `TABLE_KEYS` needs `hq` in M9; check `database.rules.json` first |
| 15 | `print.js:838` | `prBlockSheetHTML` defers to `SYS.printSheet(char, opts)` when a pack declares it; the generic rows are what make a sheet cramped (§13) |

**Do not use `core/team.js`** (Fate-shaped) or `core/sheet.js` (Daring Comics').

---

## 8. New files

```
marvel/index.html                       entry; same script list as dcc/
systems/marvel-multiverse/
  PLAN.md
  data.js        abilities, ranks, sizes, conditions, elements, schooling
  rules.js       the §5 arithmetic, pure
  powers.js      MMR_POWER_RULES     generated (the text; M1 adds the structured fields)
  traits.js      MMR_TRAIT_RULES, MMR_TAG_RULES, MMR_NOTE_HINTS   generated
  sheet.js       the stat block, the three reading surfaces, the printed sheet
  own.js         the owned sheet: adopt a profile, loadouts, mmrEffective(), migrations (§5A)
  origins.js     MMR_ORIGINS, MMR_OCCUPATIONS
  maneuvers.js   MMR_MANEUVERS
  gear.js        items, suits, weapons, vehicles
  hq.js          headquarters tab
  creation.js    the wizard screens
  combat.js      SYS.combat
  hud.js         SYS.renderHUD
  system.js      the manifest, loaded last of the pack
  tools/import-bullpen.mjs
  tools/overrides.json
test/marvel.js
```

**The importer is a one-shot, not a build step.** It writes `powers.js` and friends,
which are committed; the app never runs it, so "no build step" still holds.
`overrides.json` holds every correction, so a re-run on a newer Bullpen shows a diff
instead of wiping hand fixes. Once a row is checked against the book, the book wins.

---

## 9. Player actions — the sign-off list

Per PORTING §0, these are what "done" means. Files are not.

1. Make a legal hero at any Rank, and be told why a pick is refused.
2. Look up any power, trait or tag by name in two taps.
3. Make an ability check with edge or trouble against a TN.
4. **Use a power: Focus paid, roll made, Fantastic shown, damage worked out.**
5. Take a hit, with DR applied, and see the condition that results.
6. Run a fight: initiative, the bonus round for Fantastic initiative, turns, concentration.
7. Spend Karma.
8. Track conditions on a combatant.
9. Tick Getting Schooled and rank up.
10. Build an Iconic Item and carry it, with its powers appearing on the sheet.
11. Print the sheet.
12. All of it on a phone, from cold storage, in a shared game.
13. ✓ Take an official character as your own, change anything on them, and keep more than
    one loadout — Tony's armors — switching between them in play (§5A).

---

## 10. Milestones

Each leaves a working app, in the DCC D-phase style.

| | Work | Done when |
|---|---|---|
| **M0** | `marvel` branch, `marvel/index.html`, skeleton pack, launcher card | pack boots; 1130 existing checks still pass |
| **M1** | Two-reader importer (§3A), all catalogues, `page` and `source` on each row, integrity suite. **The text half is done (§3A, 2026-11-07): `powers.js`, `traits.js`.** | every power browsable in the Catalogue; no dangling reference; every core row cites a page |
| **M2** | `rules.js`, d616, shell changes 1–5 and 9 | action 3 from the Dice tab, on a phone |
| **M3** | Sheet blocks, `catalogItems`, extended `pool`, changes 6–8 and 11–13 | a hand-built hero reads correctly |
| **M3a** ✓ | §5A: the copy becomes data (`own.js`), the catalogue freezes, the owned sheet is editable, loadouts | **Done 2026-11-07.** Tony Stark, yours, in two armors; the book's row untouched |
| **M4** | Creation wizard: Identity, Rank, Origin, Occupation, Abilities, Powers, Traits & Tags, Review | actions 1, 2 |
| **M5** | HUD: powers by Attack / Active / Reaction / Passive; one tap does action 4 | **action 4, the point of the pack** |
| **M6** | `SYS.combat`, the rest of `SYS.npc`, conditions, TN helper (official characters already in, §3A); a Narrator copy gets §5A's owned shape, which touches the synced schema | actions 5–8 — **first playable** |
| **M7** | Getting Schooled, rank-up, the §13 sheet through `SYS.printSheet` | actions 9, 11 |
| **M8** | Iconic Items, Battle Suits, weapons, vehicles | action 10 |
| **M9** | Headquarters tab, Team Maneuvers | HQ survives reload and syncs |
| **M10** | Parity table (PORTING §6), full phone playthrough | action 12 |

Review the 34 no-defence rolls and the 31 low-similarity effects in M1, against the scans.

M7's Schooling half, M8's item-building and M9's headquarters are expansion rules with no
book behind them yet (§3A). M7's sheet needs the Team Maneuver block, and a new sample hero
that is legal by the book.

---

## 11. Tests

New `test/marvel.js`, added to `test/run.js`, and a third entry in the `PACKS` table in
`test/dice.js`, which gives reachability at every width for free.

- **Integrity, in the spirit of DCC's "every Skill named exists":** every prereq, grant,
  menu entry and tag requirement resolves; tier chains have no gaps; no row keeps
  "Prerequisites:" or "Trigger:" in its prose (2 legitimate mentions allow-listed);
  counts are pinned, so a re-import that loses rows fails loudly.
- **Rules:** one check per §5 line. d616 with an injected RNG: M counts as 6, a miss is
  never Fantastic, 6-M-6 is Ultimate, edge and trouble cancel. These are the exact
  points the Bullpen gets wrong, so each gets a named check.
- **Leak test:** render every tab and assert no "Crawler", "Mana", "Floor", "Aspect" or
  "Stunt" appears anywhere. This suite exists because of DEBRIEF's lesson.
- **Controls, not handlers** (PORTING §5): assert the power's die button is reachable
  at 400px, then press it, and assert Focus fell and damage shows.
- **Regressions:** the existing 1130 checks stay green at every milestone.

---

## 12. Deliberately not ported

UI style switcher, custom theme editor, 15 PDF palettes and 4 layouts (print centre),
embedded jsPDF, self-rewriting "bake" download, section watchdogs, onboarding tour,
undo stack, Free Mode's banner (kept as a one-line Narrator override), team folders,
localStorage vaults, and the 5 starter shells.

---

## 13. The printed sheet

The brief: **powers and traits get their full descriptions, with space between them so
nothing is cramped or confusing.** The mockup is in [print-mock/](print-mock/):
`sample-sheet.pdf` is the thing to look at, and `build.js` holds the CSS and page
functions that move into the pack at M7. Stormglass is an invented, legal Rank 4 hero
(17 of 17 picks, all prerequisites met), using real rows from the Bullpen.

| Page | What it is for | Contents |
|---|---|---|
| 1 | Playing from | Identity, abilities (Score, Defense, Non-combat, Damage), Health, Focus, Karma, speeds, how to roll, conditions, attacks worked out in numbers, then named lists of actions, reactions and always-on powers |
| 2+ | Reading a power | Full text, two columns, grouped Attacks / Actions / Reactions / Always on |
| last | Who they are | Traits and tags in full, each saying where it came from, then Getting Schooled |

**Rules the layout follows:**

- Two columns at about 60 characters a line. One column across a letter page is about
  120, which is hard to track.
- An entry never splits across pages or columns. Twelve points of space and a hairline
  separate each one.
- Each entry reads in the same order: name and Focus cost, then action, duration and
  set, then labelled Roll, Trigger and Range lines, then the description.
- "On a Fantastic success" is bold in every description, because that is the clause
  you hunt for mid-fight.
- A Focus cost that is a sentence gets its own labelled line. In the chip it ran into
  the next column.
- An elemental hero's element and its special effect are stated once at the top of the
  powers pages, because those powers only say "the elemental type's special effect".
- Page one has fixed rules first. Only attacks get table rows. A very large hero
  tightens those rows and drops the name lists, rather than spilling onto a near-empty
  page 2.
- Continuation pages say "Powers" or "Traits & Tags" in the footer, with the hero's name
  and the page number, so a loose page can be identified.
- Black ink on white. Nothing relies on a background colour printing.

**Tiers:** a family whose higher tier fully replaces the lower (Mighty, Sturdy,
Discipline, Elemental Protection) prints only the top one. A family whose higher tier
refers back (Flight 2, Postcognition 2: "works the same as Postcognition 1") prints the
chain, or the text stops making sense. That is a per-family flag in `MMR_POWERS`.

**Tested** with a stress hero well past a normal Rank 6 build: 33 powers, 13 traits, 8
tags, including Power Slider, the longest entry in the game. Page one holds and it runs
to 8 pages. The footer labels use `@page` margin boxes, which rendered here in current
Chrome; a browser without them should just omit the labels (not tested).

**Waits on the book:** the "Rolling" box (§3.1, §3.9), the conditions list (§3.8), and
which rows are real. The layout does not depend on any of them.

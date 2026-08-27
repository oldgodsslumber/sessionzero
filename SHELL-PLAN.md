# Turning Daring Comics into a generic RPG shell

**Goal:** keep every feature we built — hero sheet, NPC roster, map, dice, conflict
tracker, campaign log, print centre, wiki/lore + AI, universes, saves, multiplayer,
HUD, themes — and remove the *Fate/Daring Comics ruleset* from the engine, so a new
game is a data pack you drop in rather than a fork of the app.

---

## 1. Where the ruleset actually lives today

`index.html` is 4,336 lines / ~400 KB. Measured by weight:

| Weight | Region | Ruleset coupling |
|---:|---|---|
| 12% | `GAME DATA` block (L403–795) | **Pure ruleset.** Lifts out cleanly. |
| 12% | Creation wizard (L1349–1861) | **Deeply Fate-shaped.** Skill columns, aspect categories, HP budget. |
| 8% | Saves / universes / tabs / theme | Generic already. |
| 7% | Print centre (L2340–2746) | Layout engine generic; the *cards* read Fate fields. |
| 6% | Wiki / lore + LLM | Generic, except `LORE_TYPES` and prompt wording. |
| 6% | NPC roster & builder | Generic container, Fate-shaped stat block. |
| 6% | HTML head + CSS | Generic + comic-book theming. |
| 5% | Campaign log | Generic. |
| 4% | Character sheet render | **Fate-shaped.** |
| 4% | Team sheet | Fate-shaped. |
| 4% | Map | Generic. |
| 4% | Print sheet HTML/CSS | Fate-shaped. |
| 2% | Dice | **Hardcoded 4dF + ladder + shifts.** |
| 2% | Generators (hero names, aspects) | Pure ruleset flavour. |
| 1% | Conflict tracker | Generic. |
| <1% | Multiplayer bootstrap | Generic. |

**The trap:** only ~12% is the tidy data block. Fate assumptions are load-bearing in
the sheet, dice, print, HUD, team, NPC cards *and* the lore prompt — `aspects`,
`stress`, `consequences`, `fatePoints`/`refresh`, the −2…+8 ladder, "shifts", and
"HP cost" are referenced by name all over. Deleting the data block alone gets you a
broken Fate app, not a shell.

**The opportunity:** roughly 55–60% of the app (storage, universes, map, log,
conflict, wiki, LLM, print layout engine, multiplayer, themes, icons, import/export)
is already system-agnostic and needs little more than renaming.

---

## 2. Proposed architecture — three layers

```
SHELL (engine)          knows about: saves, universes, tabs, themes, map, log,
                        conflict, wiki+LLM, print layout, multiplayer, dice UI
   |                    knows NOTHING about: aspects, stress, powers, 4dF
   | reads
   v
SYSTEM PACK (manifest)  declares: character schema as BLOCKS, creation steps,
                        derive formulas, dice engine, catalogs, NPC types,
                        print cards, generators, theme
   |
   v
CONTENT DATA            the actual numbers: POWERS, GEAR, SKILLS, tones, stunts
```

### The central design decision

Two honest options:

**(a) Renderer injection.** Shell owns nav/storage/sync only; each system ships its
own `renderSheet`, `renderCreation`, `renderDice`. Low risk, fast — but every new
system re-implements a character sheet from scratch. That's a template, not a shell.

**(b) Block vocabulary.** Shell owns a generic set of character-sheet *primitives*;
a system declares which it uses. Higher up-front cost, but a new system becomes a
config file.

**Decided: (b) with (a) as an escape hatch.** Any block — or a whole creation
step — can be replaced by a system-supplied render function when the vocabulary
doesn't stretch. That keeps weird rules possible without forcing every system to be
weird.

### The block vocabulary (derived from what Daring Comics actually needs)

| Block | Daring Comics use | Generalises to |
|---|---|---|
| `traitGrid` | 26 skills, ladder labels, budget + column validation | attributes, stats, approaches |
| `track` | physical / mental stress boxes | HP, wounds, stress, clocks, ammo |
| `slots` | mild / moderate / severe consequences | injuries, conditions, bonds |
| `pool` | Fate Points vs Refresh | luck, adrenaline, mana, grit |
| `textList` | aspects (categorised free text) | traits, bonds, drives, flaws |
| `catalogItems` | powers & gear & stunts — pick, rename, level, cost, modifiers | spells, feats, equipment, moves |
| `groups` | power sets (named, aspect-tagged bundles) | spell schools, loadouts |
| `variants` | forms (swap a whole block set) | shapeshift, vehicle, stances |
| `entityRefs` | supporting cast / rogues gallery → roster | allies, contacts, enemies |
| `richText` | gear notes | anything |

That vocabulary covers Daring Comics with nothing left over. It does **not** cover
Dungeon Crawler Carl — see §8 for the blocks still missing. Treat the table above as
the starting set, not the final one.

### System manifest sketch

```js
registerSystem({
  id: 'daring-comics', name: 'Daring Comics', theme: 'comics',
  schema: {
    identity: ['costumedName','civilianName'],
    blocks: [
      {id:'aspects',  type:'textList',   categories: ASPECT_CATEGORIES},
      {id:'skills',   type:'traitGrid',  values: LADDER, budget: 'derive.skillBudget'},
      {id:'stress',   type:'track',      tracks:['physical','mental'], length:'derive.tracks'},
      {id:'cons',     type:'slots',      slots:[['mild',2],['moderate',4],['severe',6]]},
      {id:'fp',       type:'pool',       max:'derive.refresh'},
      {id:'powers',   type:'catalogItems', catalog:'POWERS', grouped:true, variants:'forms'},
    ],
  },
  creation: [ /* Series, Names, Aspects, Cast, Skills, Powers, Review */ ],
  derive:   { skillBudget, tracks, refresh, finalize },
  dice:     { formula:'4dF', roll, outcome, modifiers:[invokeAspect, reroll] },
  npcTypes: NPC_TABS, loreTypes: LORE_TYPES, generators: {name, aspect},
  migrate:  [ formsMigration, controllingSkillMigration ],   // DC-specific, moves OUT of shell
});
```

---

## 3. File layout (no build step — keep it GitHub-Pages-simple)

```
index.html                 nav, pages, modals, no game data, <script src> tags
core/state.js              saves, universes, storage namespacing, migration
core/blocks.js             the block renderers  <- new, the heart of it
core/sheet.js  core/creation.js  core/dice.js
core/map.js    core/log.js       core/conflict.js
core/wiki.js   core/llm.js       core/print.js
core/mp.js     core/app-mp.js    (renamed from dc-mp.js / dc-app-mp.js)
systems/daring-comics/system.js  manifest
systems/daring-comics/data.js    POWERS, GEAR, SKILLS, tones, stunts
systems/daring-comics/theme.css  systems/daring-comics/print.js (overrides)
```

System selected by `?system=` or a first-run picker; the shell loads exactly one.

---

## 4. Sequencing

Each phase leaves a working, shippable app.

| Phase | Work | Risk |
|---|---|---|
| **0** | Split `index.html` into `core/*.js` with **zero logic change**. Verify, commit. | Low — but MP monkeypatches by function name, update in lockstep. |
| **1** | Move the `GAME DATA` block to `systems/daring-comics/data.js`. | Low |
| **2** | Introduce `registerSystem()`; route every ruleset constant and derive-formula through `SYS.*`. No rendering changes yet. | Low–medium |
| **3** | **The big one.** Build `core/blocks.js`; re-express the sheet and creation wizard as blocks. | High |
| **4** | Genericise dice, print cards, NPC stat blocks, generators, lore types. | Medium |
| **4b** | `lexicon` sweep — replace comic wording in user-facing copy (§9). | Low, wide |
| **5** | Namespace storage `dc_* → rpg:<systemId>:*`, stamp `systemId` on universes + saves, write the migration. | **Medium–high — real user data.** |
| **6** | Build the **Dungeon Crawler Carl** pack to prove it (§8). | — |
| **7** | System picker UI, per-system theming, docs for authoring a pack. | Low |

**Do Phase 6 concurrently with Phases 3–4, not after them.** You cannot tell whether
the shell is generic until a non-Fate system runs on it, and DCC needs at least three
blocks Fate never exercises (`progression`, `inventory`, `statusEffects`). Discover
those while the vocabulary is still soft, or they arrive as retrofits.

---

## 5. Things that will fight us

- **Fate vocabulary is everywhere.** `aspects`, `stress`, `consequences`,
  `fatePoints`, `refresh`, `shifts`, ladder names appear in the sheet, dice, print,
  HUD, team sheet, NPC cards and the LLM lore-intake prompt. Grep-and-rename is
  necessary but not sufficient — several are structural.
- **The skill board.** Drag-to-assign columns + `validateColumn()` + `SAMPLE_COLUMNS`
  encode Fate's pyramid rule. Make it an *opt-in* `traitGrid` mode, not a default.
- **The re-render pattern.** Nearly every interaction rebuilds a whole tab's
  `innerHTML` — that's exactly the bug just fixed in the Powers search, and five
  more search boxes still have it. Blocks are the chance to render *in place*.
  Genericising without fixing this multiplies the focus bugs across every system.
- **`save()` fires on every keystroke.** Block renderers must stay cheap.
- **Multiplayer monkeypatches app functions by name** (`dc-app-mp.js` wraps mutators
  and renderers). Replace that with a real event bus in the shell (`on('roster:change')`)
  so the MP layer subscribes instead of wrapping — otherwise every rename breaks sync.
- **Universes must be system-stamped.** Joining a Fate universe with a d20 character
  has to fail loudly, not corrupt a roster.
- **Print prefs are keyed by catalog item id** — namespace per system or they collide.
- **Existing legacy migrations** (slot→save, forms wrap, controlling-skill) are
  Daring-Comics-specific and must move into the DC pack, not stay in the shell.

---

## 6. Repo strategy

~~Do it in-place on a long-lived branch in `daringcomics`.~~ **Superseded.** The
shell was staged into its own folder (`d:/claudecode/sessionzero`, published as `oldgodsslumber/sessionzero`) after Phase 0, cloned
from the `shell` branch so the history came with it, with the `origin` remote removed
so nothing can push back to `daringcomics`.

The original objection stands and is now a live cost: **the multiplayer layer and the
Firebase rules exist in two places.** They are stable today, so the duplication is
cheap — but any change to `core/mp.js`, `core/app-mp.js` or MULTIPLAYER.md has to be
made twice, or deliberately abandoned in one copy. Decide which repo owns multiplayer
before touching it again.

One thing the fork forced, correctly: `firebase-config.js` is **not** carried into the
shell. Committing it was right for one deployed app; a template that seeds many games
must not hand each of them Daring Comics' database.

Daring Comics stays the reference implementation and the regression test: **if the
DC pack on the shell isn't identical to today's app, the shell is wrong.**

---

## 7. Decisions taken

1. **Hybrid** — block vocabulary as the default, renderer injection as the per-block
   escape hatch. (Section 2.)
2. **Second system: Dungeon Crawler Carl.** Source books being formatted; see §8.
3. **Per-system saves.** A universe belongs to exactly one system, stamped with its
   `systemId`. No mixed-system rosters.
4. **Neutral shell.** The comic-book identity ships as the Daring Comics pack's
   theme, not as the shell default. (See §9.)

---

## 8. Dungeon Crawler Carl as the shakeout target

Excellent choice, because it is Fate's opposite in almost every dimension that
matters. Fate is diceless-ish, budget-spend, narrative, flat — no levels, no
inventory, no timers. DCC is numeric, progression-driven, loot-driven and timed.
Every place the shell has quietly absorbed a Fate assumption, DCC will break it.

**Blocks DCC will demand that Daring Comics never exercises** (to confirm against
the source once the books land):

| Need | Why the current vocabulary won't cover it |
|---|---|
| `progression` — level, XP thresholds, unspent points | Fate has no advancement at all. Nothing in the app models "spend later". |
| `inventory` — stacks, slots, weight, equipped vs. carried | DC's gear is a `richText` note and a flat catalog list. |
| `pools` with current/max **and regen** | Fate Points are a single integer with no ceiling logic and no recovery tick. |
| `statusEffects` — buffs/debuffs with **durations** | Nothing in the app has a clock. This one reaches into the conflict tracker. |
| `catalogItems` with **prerequisites and tiers** | Powers have cost, not gating. Skill trees need a dependency graph. |
| Derived traits (attribute → HP/carry/etc.) | DC derives stress boxes once, at creation. DCC derives continuously. |
| Awards / titles / achievements | A `textList` with locked/unlocked state. Close to existing, but not identical. |

**Two features get *better*, not just ported:**

- **The map tab is already a dungeon crawler.** Regions with sub-zones, travel,
  explored/void cells, icon-per-cell — that is a floor map. It may need nothing but
  a lexicon change.
- **The campaign log's issue breaks** map onto floors/levels almost exactly.

**Sequencing note:** DCC's needs are additive, so build the DCC pack *against the
block layer as it is being written* (Phases 3–4 concurrently, as §4 says). If the
block vocabulary is finalised on Fate alone, `progression`, `inventory` and
`statusEffects` will all arrive as retrofits.

> **Updated after reading the rulebook** (2026-08-25). All three predicted blocks
> are confirmed, and two of them are richer than described above: `inventory` is
> three containers with different rules (Inventory / Hotlist / Gear Slots), and
> `statusEffects` needs durations, a stackable flag, an active-cap and escalation.
> Two further gaps were **not** predicted and change existing block contracts:
> **dual-layer traits** (Unenhanced/Enhanced with a derived Mod) and a
> **non-uniform track** (Health Bar slots hold values, fill right-to-left, and
> consume damage slot-by-slot). Both must land before the Daring Comics port is
> finished. See `systems/dungeon-crawler-carl/PLAN.md` for the full build plan.

---

## 9. Neutral shell — what that actually costs

Cheaper than expected. Theming is already a clean token swap: `html[data-theme="x"]`
blocks redefine `--bg / --surface / --accent / --text / --muted` **and**
`--font-title / --font-body / --font-label`. So:

- Shell ships neutral defaults on bare `:root` plus all *structural* CSS.
- Each system pack ships `theme.css` — its `data-theme` blocks and its swatch list —
  and the shell renders the swatch row from the pack rather than from hardcoded HTML.

Three bits of real work hide behind that:

1. **The Google Fonts `<link>` is hardcoded** in `<head>` (Bangers, Comic Neue,
   Oswald). Fonts must be requested by the active pack, not the shell.
2. **A few structural rules are comic-specific**, not token-driven — `.pg-title`
   uppercase + `text-shadow:2px 2px 0 var(--ink)`, and the `--comic` halftone
   variables. These move into the DC theme.
3. **The HUD and log-export windows inline their own hardcoded palette**
   (`index.html:3404`) instead of reading tokens. Those need tokenising or they'll
   stay comic-red forever.

### The third coupling axis: UI vocabulary

Not in the original survey and worth calling out. Comic words are baked into
user-facing copy roughly 550 times: `Universe` (~230), `hero` (~180), `Issue` (~44),
`Nameless` (~21), `Super Team` (~11), plus `Rogues Gallery`, `Supporting Cast`,
`Costumed Identity`.

Internal identifiers (`renderHero`, `S.char`, `#hero-content`) can stay as-is —
renaming them is churn with no payoff. But **user-facing strings need a `lexicon`
in the system manifest**:

```js
lexicon: {
  universe:'Universe', hero:'Hero', roster:'Rogues Gallery',
  region:'Neighborhood', logBreak:'Issue', team:'Super Team',
}
// DCC: universe:'Crawl', hero:'Crawler', roster:'Bestiary',
//      region:'Floor', logBreak:'Level', team:'Party'
```

This is a mechanical but wide sweep — worth its own phase rather than being smuggled
into Phase 3. **Insert as Phase 4b**, after the blocks land and before the DCC pack
needs its own words.

---

## 10. Phase 0 log — done

`index.html` went from 4,336 lines to 419 (markup + CSS + 15 `<script src>` tags).
The former inline script was split **verbatim** into:

| File | Size | File | Size |
|---|---:|---|---:|
| `systems/daring-comics/data.js` | 51 KB | `core/log.js` | 30 KB |
| `core/state.js` | 35 KB | `core/npcs.js` | 28 KB |
| `core/creation.js` | 51 KB | `core/wiki.js` | 28 KB |
| `core/sheet.js` | 29 KB | `core/team.js` | 17 KB |
| `core/print.js` | 50 KB | `core/map.js` | 17 KB |
| `core/util.js` | 14 KB | `core/dice.js` | 10 KB |
| `core/llm.js` | 8.5 KB | `core/conflict.js` | 5.4 KB |
| `core/mp-boot.js` | 2.7 KB | | |

**How "zero logic change" was enforced.** Cut points were not chosen by eye — every
candidate boundary was tested by splitting there and running `node --check` on both
halves, which rules out cutting inside a template literal. (`exportLog()` embeds a
whole HTML document containing a literal `<script>` tag, ~40 lines that *look* like
top-level code but are string content.) 433 boundaries verified clean; the module
boundaries then snapped to the nearest one, drifting at most 1 line. Reassembly of
the 15 files was asserted byte-identical to the original before any edit, and a
line-multiset diff against `HEAD` confirms **zero lines lost**.

### The one real bug the split exposed

`core/state.js` runs `let S = defaultState()` at load, and `defaultState()` calls
`defaultRegion()` — which lived in the map section. In one script, function
declarations hoist across the whole file, so this worked. Across separate
`<script>` tags hoisting is **per file**, so it became
`ReferenceError: defaultRegion is not defined`, which cascaded into a TDZ error on
`U` and left the app dead. Fixed by relocating `defaultRegion()` into `state.js`
verbatim — the only content change in the phase.

> **Rule for every later phase:** a module may *declare* at load time; anything that
> *executes* must either be self-contained or wait for the boot IIFE in
> `core/mp-boot.js`. Load order is the original execution order and must not be
> reordered — `mp-boot.js` boots the app and stays last.

### Verification

- Test suite: **215 checks, 4 suites — all passing**, identical to the pre-split
  baseline captured from `git stash`.
- Boot smoke test: no uncaught errors, all probed globals resolve, all 8 tabs render.
- `test/loadapp.js` (new) inlines the `<script src>` files for JSDOM, which builds
  from an HTML string and would otherwise never fetch them. Same files, same order,
  still classic scripts sharing one global.

### Known cosmetic follow-up

The page now makes 15 script requests instead of 0. Fine for a static GitHub Pages
app, but if it ever matters, concatenate at deploy rather than reintroducing one
giant file.

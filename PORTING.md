# Porting a game onto the shell

The checklist I wish I had had before Dungeon Crawler Carl shipped without a
dice roller. `SHELL-PLAN.md` says how the architecture is *meant* to work; this
says how to land a pack on it without losing features nobody remembered were
features. Read `DEBRIEF.md` for why each rule exists.

---

## 0. The rule behind all the other rules

> **Track features, not files.**

The DCC port lost dice rolling while `core/dice.js` was fully ported, tested and
correct — because "the player can make a check" is spread across `dice.js`,
`sheet.js`, `shell.css` and `chrome.js`. Every file was done. The feature was
gone.

Before starting a pack, write the list of *player actions* the game needs. Sign
off against that list, never against a list of files.

---

## 1. Know which files are actually shell

`core/` is a location, not a promise. As of today:

| Genuinely shell | Daring Comics wearing a `core/` name |
|---|---|
| `state.js` (saves, universes, tabs) | **`sheet.js`** — DC's sheet renderer, top to bottom |
| `blocks.js`, `wizard.js`, `system.js` | **`creation.js`** — `renderCreationStep()` and its 7 Fate steps |
| `map.js`, `log.js`, `wiki.js`, `llm.js` | **`dice.js`** — `renderDiceFate()` and everything below it |
| `mp.js`, `app-mp.js`, `mp-boot.js` | `print.js`, `npcs.js`, `team.js` — generic engines, Fate-shaped cards |
| `chrome.js`, `util.js` | |

**106 references to Daring Comics constants still live in `core/`** — `SKILLS`,
`POWERS`, `fatePoints`, `ladderName`, `EXP_LEVELS`, `ASPECT_CATEGORIES` and
friends, concentrated in `creation.js` (35), `print.js` (15), `state.js` (14),
`dice.js` (14), `sheet.js` (13).

Anything a DC-only file draws **does not exist for your pack.** Before you start,
grep the DC-only files for `getElementById(` and `innerHTML=` and write down
every DOM node they fill. That list is what you are about to lose.

The roll surfaces used to be on that list and are not any more: `rollToastHTML()`,
`rollBarHTML()` and `renderRollSidebar()` live in `core/dice.js` and both sheet
renderers call them, dispatching on whether the pack declared `SYS.dice`. Take
that as the pattern for the next one — a surface every pack needs belongs behind
a shell function that both branches call, not inside one branch.

## 2. Trace every path a block pack does *not* take

The fork is at `core/creation.js:6`:

```js
if(sysUsesBlocks()){ … renderSysSheet(); return; }   // your pack
if(S.char){ … renderSheet(); }                        // Daring Comics
```

`renderSheet()` is 248 lines. Everything unique to it is a feature your pack
silently does not have. Today that is:

- `#hero-dice-sidebar` — the desktop roller
- `#hero-dice-mobile` / `#dice-bar-body` — the mobile roller
- `#quick-roll-toast` — where roll results appear on mobile
- tap-a-Skill-to-load, tap-a-Power-to-load

All five of those are shell services now, so a new pack gets them for free. Do
the same trace for any other `sysUsesBlocks()` branch you find, and expect to
discover the next one this way.

**A screen only your pack wants goes in your pack.** The HUD — Dungeon Crawler
Carl's fight screen — is `systems/dungeon-crawler-carl/hud.js`, not `core/hud.js`.
The shell owns the nav slot, the page container and one call, `SYS.renderHUD`;
a pack that declares nothing has no HUD button at all. Written that way it is
impossible for it to become the next `core/sheet.js`, and when a second pack
wants one the shared parts move UP into `core/` — the direction that costs
nobody anything.

**Icons are one component too.** `core/icons.js` — `iconField(id, opts)`,
`iconSearch(id)`, `iconPick(id, val)`, and `iconHTML(value, size, color, cls)`
for rendering. Same instance-scoped shape as the roller. It exists because the
picker had already been written twice, for Daring Comics' powers and for map
cells, with the same fetch and the same markup under different element ids;
items and Skills would have made four. Note what it actually is: **Iconify's
search API filtered to the game-icons set**, not a game-icons.net API, and the
icons are CSS masks so they take the pack's theme colour. A stored icon renders
from a remote URL, so it will not appear offline — the search says so, the
rendering cannot.

**The popover is generic.** `popOpen(html, anchor)` / `popClose()` in
`core/chrome.js`. The roller uses it, and so does the Skill icon picker. It
mounts on `<body>` because a block repaint replaces the row it is anchored to.

**The roller is one component, instantiated.** `rollerHTML(id, opts)` and
`rollerBarHTML(id, opts)` each stamp every field, button and result element with
the instance id, and the helpers find live instances by querying `[data-roller]`
rather than holding a list — a list goes stale the moment a tab repaints. Where
an instance answers is written on its own wrapper as `data-result`, so nothing
has to special-case the fact that the hero sheet's bar answers in a sticky toast
while the rest answer in place. There are six: the Dice tab, a sidebar and a bar
on the Hero page, the same pair on the HUD, and the popover. Add a seventh by
calling the function — do not copy the markup.

**Rollable things are named by ref, not by name.** `stat:stats:STR`,
`skill:spells:Heal` — kind, block, name. A Stat called Strength and a Skill
called Strength are different rolls and a bare name cannot say which.
`sysRollSkill()` still accepts a bare name so a card can say
`dccHudRoll('Unarmed Combat')` without knowing which block it lives in, but
anything generated from a row should emit a ref.

**A page that carries a roller wears `.roller-page`.** Main column
`.roller-main`, sticky rail `.roller-side`, mobile bar `.roller-bar`. This was
four `#hero-*` rules until the HUD wanted the same layout; copying them under a
second id is how a rule ends up depending on what some other file happens to
draw, which is the whole subject of `DEBRIEF.md`.

**A block can be on screen twice.** `renderBlock(block, char, mount)` namespaces
the wrapper id, every lookup goes through `[data-blk="…"]`, and `blockRepaint()`
walks all mounts. That is what lets the HUD show the real Health Bar rather than
a copy of it. If you render a block in a second place, use `mount` — two
elements with the same id means one of them silently stops updating. It also
means a document-wide `querySelectorAll('.trk-slot')` in a test now counts every
slot twice; scope test selectors to `#sys-blocks` or `#hud-content`.

## 3. Audit the CSS for invariants, not just for looks

`core/shell.css` was copied verbatim out of Daring Comics. Verbatim was safe for
colours and spacing and **unsafe for visibility rules**, because a rule like

```css
#nb-dice{display:none}                     /* mobile */
@media(min-width:700px){#nb-dice{display:flex!important}}
```

encodes a claim about *another file's behaviour* — "the Hero sheet supplies a
mobile roller instead". True for DC. False for you. Result: no way to roll on a
phone.

**Grep `shell.css` for every `display:none` on an `#id`, and for every
`!important`, and ask what is supposed to be there instead.** If the answer is
"a thing `sheet.js` draws", it is not there for you.

`#nb-dice` is fixed — the rule is `body.has-sheet-roller #nb-dice{display:none}`
now, and `core/dice.js` sets that class from the DOM, so it can only fire when
its premise holds. Copy the shape when you meet the next one: **make the premise
a class, and set it from what was actually drawn.**

Still to check when you port: `#nb-second`, `#nb-print`, `#page-hero`.

Also check the reverse: `#hero-dice-sidebar{width:280px}` used to *reserve*
space at ≥700px even when nothing filled it, so a diceless pack's sheet was
squeezed by 280px of nothing. `#hero-dice-sidebar:empty{display:none!important}`
now collapses it. An unfilled container is not a harmless no-op; it is a hole in
your layout.

## 4. Declare the contracts, then check they are consumed

Declaring `SYS.dice` gets you the Dice tab and nothing else. For each contract
you declare, find every place the shell *should* offer it and confirm something
actually calls it:

| Contract | Renderer that reads it | Other surfaces that should |
|---|---|---|
| `SYS.dice` | `renderDice()`, `renderRollSidebar()`, `rollBarHTML()`, `rollRowBtn()`, the popover, MP roll feed | conflict tracker |
| `SYS.dice.skillBlocks` / `.statBlocks` | `rollEntries()` — what the roller offers | — |
| `SYS.dice.statKind` | `sysRollSkill()` — the difficulty a raw trait rolls against | — |
| `SYS.schema.blocks` | `renderBlockSheet()` | print cards, MP sync, export |
| a block's `span` | the desktop sheet grid (`.blk-sheet`) | the HUD, if the block is mounted there too |
| `entryFields` / `entryActions` / `entryAct` | `skillList`'s ⋯ panel, `skillFacts()` | the HUD card, print, anything reading the catalogue |
| `SYS.tabs` | `buildSysTabs()`, `renderSysTab()`, `showTab()` | the sheet, which stops drawing the blocks a tab claimed |
| `SYS.creation` | `renderWizard()` | "Edit creation" on the sheet |
| `SYS.renderHUD` | `renderHUD()` (the HUD tab) | — |
| `itemFields` entry `{type:'icon'}` | `invDetailHTML()` — draws the shared picker | — |
| `derive.gearItemTap` | the Hotlist keypad — what ONE tap does | — |
| `SYS.themes` / `SYS.fonts` | `renderThemeSwatches()` / `applySysFonts()` | — |
| `SYS.lexicon` | everywhere via `lex()`/`lexU()` | check the tabs you don't use |

A contract with one consumer is a contract that is 20% wired.

### Describing an entry the catalogue has not got

A `skillList` block may declare `entryFields` — the same vocabulary an item's
`itemFields` uses (`text`, `number`, `lines`, select via `options`), rendered by
the same editor into a ⋯ panel on the row. `skillFacts(block, entry)` is then
the single answer to "what is this Skill or Spell": the catalogue row with
anything the player filled in laid over the top, and it is what the sheet, the
HUD and the printed page all read.

Two things fall out of that, and both are the point:

- a Spell that is not in the book — invented, handed out by the GM, or crafted
  with Arcane, which Table 45 says is a thing a crawler can do — has a Mana cost,
  damage and text like any other;
- an entry the shipped catalogue gets WRONG can be corrected by the person
  looking at it, on their own sheet, without touching the pack.

`entryActions` / `entryAct` are the same idea for verbs: `[{id, label}]` and a
handler returning `{ok, message, remove}`. Dungeon Crawler Carl uses them for
"write a scroll of this Spell", which turns a Spell into an ordinary item that
stacks, sits in a Hotlist slot and is cast with one tap.

### A tab of your own

`SYS.tabs` is a list of `{id, label, icon, blocks:[…]}` — or `{id, label, icon,
render(char)}` for markup the block vocabulary has nowhere to put. The shell
builds the nav button, the page and the routing; a tab may not take an id the
shell already uses. Blocks a tab names are drawn there INSTEAD of on the sheet,
and keep their canonical ids, so everything that looks a block up by id keeps
working and `blockRepaint()` still reaches every mount.

Use it when a block is big enough or reached often enough that living halfway
down the sheet is the wrong answer — Gear is the first one. Remember the phone
nav is a fixed bottom bar: every tab you add is a narrower button for everything
else.

### Blocks and the desktop sheet

A block may declare `span: 1 | 2 | 'full'` — how many of the sheet's columns
it wants where there is room for more than one. `renderBlockSheet()` stamps it
on the block's wrapper as `data-span` and `core/shell.css` places it; a block
that declares nothing takes one column. Below 1100px there is only ever one
column, so a span is invisible on a phone and cannot break it. Say `full` for
anything with a wide row of controls — a trait grid, a health track, an
inventory — and say nothing for a pool or a readout.

## 5. Test the button, not the handler

The DCC suite calls `showTab('dice')` and asserts the tab renders. Both checks
pass on a build where the button that calls `showTab('dice')` is
`display:none`.

**A test that invokes a handler proves nothing about reachability.** For every
player action, assert the *control*: that it exists, and that neither it nor any
ancestor is hidden at the width under test.

`test/dice.js` does this and is the model to copy. JSDOM's `getComputedStyle`
ignores `@media` entirely — it reports `#nb-dice` as visible at every width,
which is precisely the blind spot that let this through — so the suite carries a
small stylesheet reader that collects declarations by selector and media
condition and evaluates them at a stated width:

```js
check(P + 'a roll control is reachable at phone width', () => {
  const tab = reachableAt(rules, $('nb-dice'), PHONE);
  const bar = reachableAt(rules, $('hero-dice-mobile'), PHONE);
  return tab || bar || 'no roll control at ' + PHONE + 'px';
});
```

Two traps that suite already hit, worth knowing before you write your own:

- **Test the control, not the panel.** `#dice-bar-body` is `display:none` until
  you tap it open, so asserting on it calls a working roller unreachable. The
  control is the toggle.
- **A check that returns a truthy string is a failure**, by the `check()`
  convention these suites use. `return sel && sel.value` reports a pass as
  `-> Unarmed Combat`. Coerce: `return !!(sel && sel.value) || 'why not'`.

Reverting the fix makes 8 of its 28 checks fail, the first of them reading
`no roll control at 400px` — which is the bug report, in the words the player
used.

## 6. The parity table

Before calling a pack done, fill this in by rendering both packs with a finished
character and diffing. Any row where your pack is dramatically smaller is a
question to answer, not a number to accept:

| Tab | Reference pack | Your pack | Explained? |
|---|---|---|---|
| Hero | | | |
| NPCs | | | |
| Map | | | |
| Dice | | | |
| Conflict | | | |
| Notes | | | |
| Print | | | |
| Wiki | | | |

The DCC Dice tab is 1,005 chars against Daring Comics' 2,487. That gap was
visible before the bug was reported and nobody looked.

## 7. Play it

Not a substitute for anything above; the thing everything above exists to
support.

- On a **phone width** (≤560px) and a **desktop width** (≥700px). The nav
  changes shape at 700px and hides three buttons below it — half the bugs live
  on one side of that line only.
- From a **cold `localStorage`**. First-run gates (`openUniverseSetup`) return
  early out of boot and can leave state uninitialised in ways a warm profile
  never shows.
- Take a **complete turn**: make a character, look something up, roll for it,
  take damage, mark the result down.

If you cannot complete that loop, the pack is not ported, however many files
are.

---

## Quick checklist

- [ ] Wrote the list of player actions this game needs, before writing code
- [ ] Listed every DOM node the DC-only files fill, and know which I lose
- [ ] Traced every `sysUsesBlocks()` fork for features on the other branch
- [ ] Audited `shell.css` for `display:none` on ids and for `!important`
- [ ] Every declared `SYS.*` contract has more than one consumer
- [ ] Tests assert controls are reachable, not just that handlers run
- [ ] Parity table filled in and every gap explained
- [ ] Played a full turn at phone width, from cold storage

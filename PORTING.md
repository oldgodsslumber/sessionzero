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
| `SYS.dice` | `renderDice()`, `renderRollSidebar()`, `rollBarHTML()`, `skillRollBtn()`, MP roll feed | conflict tracker |
| `SYS.schema.blocks` | `renderBlockSheet()` | print cards, MP sync, export |
| `SYS.creation` | `renderWizard()` | "Edit creation" on the sheet |
| `SYS.renderHUD` | `renderHUD()` (the HUD tab) | — |
| `SYS.themes` / `SYS.fonts` | `renderThemeSwatches()` / `applySysFonts()` | — |
| `SYS.lexicon` | everywhere via `lex()`/`lexU()` | check the tabs you don't use |

A contract with one consumer is a contract that is 20% wired.

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

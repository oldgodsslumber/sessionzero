# Debrief — the shell shipped a game you cannot roll dice in

Written after Dungeon Crawler Carl reached a playable sheet and a player found
there was no way to make a check. This is the post-mortem: what broke, why the
tests said everything was fine, and what the port actually missed.

---

## 1. The symptom

On Dungeon Crawler Carl there is no way to roll a die on a phone, and on a
desktop there is exactly one — a nav icon most people never find, next to a
280px column of empty space where the roller is supposed to live.

Daring Comics, the same shell, the same commit, has **six**.

---

## 2. What Daring Comics actually gives a player

Every one of these is built in `core/sheet.js`, in `renderSheet()`:

| # | Surface | Where | Source |
|---|---|---|---|
| 1 | Dice tab | `#page-dice`, **desktop only** | `core/dice.js` → `renderDice()` |
| 2 | Desktop sidebar roller | `#hero-dice-sidebar`, sticky beside the sheet | `core/sheet.js:76-85` |
| 3 | Mobile sticky dice bar | `#hero-dice-mobile`, tap-to-expand on the Hero page | `core/sheet.js:31` |
| 4 | Roll-result toast | `#quick-roll-toast`, sticky at the top of the sheet | `core/sheet.js:29` |
| 5 | Tap a Skill row to load it into the roller | Skills list | `core/sheet.js:33` |
| 6 | Tap a Power to load its Skill + level bonus | Power sets | `core/sheet.js:45` |

Surfaces 2–6 exist because rolling is the thing you do most, and a tab you have
to navigate to is the wrong place for it. That was a deliberate design decision.
It was never written down.

## 3. What Dungeon Crawler Carl gets

Surface 1. On screens ≥700px only. Nothing else.

A block pack renders its sheet through `renderSysSheet()`
(`core/creation.js:77`) → `renderBlockSheet()` (`core/blocks.js`). That path
never touches `core/sheet.js`, so surfaces 2–6 are simply not built. Confirmed
by inspection of a finished crawler's sheet: the only `onclick` handlers on it
are `trackToggle`, `poolAdj`, `invAdd`, `skillMark`, `tallyAdjust` and friends.
Not one is a roll.

## 4. Why surface 1 disappears on a phone

`core/shell.css:400-403`:

```css
#nb-hud{display:none}
#nb-dice{display:none}
#nb-print{display:none}
```

…re-enabled at `core/shell.css:439-442`:

```css
@media(min-width:700px){
  #nb-hud{display:flex!important}
  #nb-print{display:flex!important}
  #nb-dice{display:flex!important}
}
```

**This rule is not a porting mistake.** It was correct in Daring Comics and was
copied verbatim by commit `63dbdbd` ("the 332 lines of CSS, verbatim"). Hiding
the Dice tab on mobile was right *because the Hero page carried surface 3*. The
tab was redundant, so it was hidden to buy a nav slot for Wiki.

The rule encodes an invariant — **"the Hero sheet supplies a mobile roller"** —
that lives nowhere except in the head of whoever wrote it. The moment a second
pack rendered its Hero page through a different function, the rule stopped
hiding a duplicate and started hiding the only copy.

Same story at 700px and up: `#hero-dice-sidebar{display:block!important;width:280px}`
still reserves the column. For DCC it is filled by nobody, so the crawler sheet
is squeezed by a permanently blank 280px gutter.

## 5. Why the tests passed

The DCC suite runs 587 checks. Two of them are about the Dice tab
(`test/dcc.js:1087`, `:1094`) and both open it like this:

```js
ev("showTab('dice')");
```

`showTab()` is the *handler*. Calling it directly proves the renderer works and
says nothing whatsoever about whether a player can reach it. The button that
calls it is `display:none` at the width most people play at, and no test has an
opinion about that.

More broadly: 868 checks across 7 suites, and **not one asserts that a player
can perform the core action of the game.** The suites are excellent at rules
maths — every DCC value is cited to a rulebook page — and blind to whether the
rules are reachable. The tests were written to protect the *pack*, and the
regression was in the *shell*.

## 6. How much was actually missed

Less than it feels like, and that matters — the failure is narrow and specific,
not systemic rot. I rendered every tab for both packs on a finished character:

| Tab | Daring Comics | Dungeon Crawler Carl |
|---|---|---|
| Hero | 13,935 chars | 31,940 |
| NPCs | 1,720 | 1,720 |
| Map | 7,438 | 7,461 |
| **Dice** | **2,487** | **1,005** |
| Conflict | 318 | 413 |
| Notes | 968 | 968 |
| Print | 4,613 | 4,634 |
| Wiki | 382 | 382 |

Zero runtime errors on either pack. Every other tab works. The port is in good
shape; it has exactly one hole, and it happens to be under the thing you do
every five minutes.

The known-debt number is still real though: **106 references to Daring Comics
constants remain inside `core/`** (`SKILLS`, `POWERS`, `fatePoints`,
`ladderName`, `EXP_LEVELS`, `ASPECT_CATEGORIES`…), concentrated in
`creation.js` (35), `print.js` (15), `state.js` (14), `dice.js` (14) and
`sheet.js` (13). Commit `63dbdbd` predicted ~88 of these as "Phase 2 proper and
unreachable". They are still there, and `core/sheet.js` — 13 of them — is the
file holding five of the six missing roll surfaces hostage.

---

## 7. Root causes

**(a) A shared file was left owned by one pack.** `core/sheet.js` sits in
`core/` and is named as if it were shell. It is Daring Comics' sheet renderer.
Anything that only *it* draws is invisible to every other pack, and its name
actively hides that. The same is true of `renderDiceFate()`, which at least
says so in its name.

**(b) CSS was ported without its invariants.** "Verbatim" was the safe-sounding
choice for 332 lines of styling, and it silently carried per-pack behavioural
assumptions across a boundary that was supposed to make packs interchangeable.
A visibility rule that depends on another file rendering something is a
contract, and it was moved as if it were decoration.

**(c) The block path was measured against the schema, not against the game.**
Every block type — `traitGrid`, `track`, `pool`, `skillList`, `inventory` —
was built and tested. Nobody asked the question one level up: *with these
blocks on screen, can a player take a turn?* A `skillList` that renders a Skill
with its Rank and its Stat, and gives you no way to roll it, satisfies its spec
completely and fails the player completely.

**(d) The port was driven by the source file, not by the player.** The work was
organised around dismantling a 4,336-line `index.html`: extract the CSS, extract
the chrome, lift the data, generalise the renderers. Coverage was tracked
against *regions of the old file*. Under that frame `core/dice.js` was ported —
it grew a `SYS.dice` contract, the DCC roller works, it has tests. The file was
done. But the *feature* — "the player can make a check" — was spread across
`dice.js`, `sheet.js`, `shell.css` and `chrome.js`, and no one was tracking it
as a unit, so it was possible for every file to be done and the feature to be
gone.

**(e) Nobody played the second game.** Not once, on a phone. Every issue in
this document is visible in about four seconds of doing that.

---

## 8. The three rules that come out of this

1. **A pack is not ported until someone plays it, on a phone, doing the thing
   the game is about.** File-level completeness is not evidence.
2. **No CSS rule may hide a control on the assumption that another file draws a
   replacement** — unless the shell guarantees the replacement for every pack.
3. **`core/` means every pack, or the file is misnamed.** `core/sheet.js` is
   Daring Comics'. Until it is split or renamed, it will keep quietly stealing
   features from every pack that follows.

See `PORTING.md` for the checklist these turned into.

---

## 9. What was done about it

**The three roll surfaces are shell services.** `rollToastHTML()`,
`rollBarHTML()` and `renderRollSidebar()` live in `core/dice.js` and dispatch on
whether the pack declared `SYS.dice`. Daring Comics' mobile bar markup moved out
of `renderSheet()` to sit beside its own roller; both sheet renderers now reach
all three through the same calls, so neither owns a surface the other cannot
see. Daring Comics' behaviour is unchanged — its sidebar still renders the same
2,792 characters it did before.

**The pack roller is drawn once and used three times.** `sysRollFormHTML(p)`
takes an id prefix — `sd` for the Dice tab, `ss` for the sidebar, `sm` for the
mobile bar — and `sysDoRollFrom(p)` rolls from whichever surface asked, answering
in place or in the sticky toast. A change to the roller can no longer reach one
surface and miss the other two. `SYS.dice.skillBlocks` replaces the hardcoded
`['skills','spells']`.

**The CSS invariant is written down.** The rule is
`body.has-sheet-roller #nb-dice{display:none}`, and `markRollSurfaces()` sets
that class from what the sheet actually drew. The premise cannot be false while
the rule fires. `#hero-dice-sidebar:empty` collapses, so a pack with no roller
stops losing 280px.

**You can roll from where you read.** A `skillList` row carries a die button
that loads the Skill into every roller at once and opens the mobile bar —
offered only to a pack with a dice contract, and never on a passive Skill.

**Pack rolls reach the table.** `sysDoRollFrom` joined the multiplayer wrapper
list, and the roll now carries `skill` as well as `label`, because the feed
reads that field — without it a crawler's roll arrived as a bare number with no
name on it.

**`test/dice.js`** — 28 checks that start from a control a player could press, at
a width they could be at. Reverting the fix fails 8 of them, the first reading
`no roll control at 400px`. It carries a small stylesheet reader because JSDOM
ignores `@media` and would have reported the hidden tab as visible.

Suite: 896 checks across 8 suites, all passing.

### Still open

The 106 Daring Comics constants in `core/` are untouched — this was the roll
surfaces, not Phase 2. `core/sheet.js`, `core/creation.js` and the Fate half of
`core/dice.js` are still Daring Comics wearing a `core/` name, and rule 3 above
still applies to them.

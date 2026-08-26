# rpgshell

A generic tabletop-RPG app shell: character sheets, NPC roster, hex-ish region
map with sub-zones, dice, conflict tracker, campaign log, print centre, an
AI-assisted wiki/lore codex, multi-world saves, and Firebase multiplayer —
with the **ruleset removed from the engine** and moved into a swappable system
pack under `systems/`.

Forked from the Daring Comics app, which stays in here as the reference pack
and the regression test.

---

## Status — honest version

**This is staged, not finished.** The engine/ruleset seam exists as a registry
(`core/system.js`), but the core modules do not read it yet. Daring Comics is
still wired in directly, and the app still boots and behaves exactly as it did.

| Phase | | State |
|---|---|---|
| 0 | Split the monolith into modules | **done** |
| 1 | Move game data into a pack | **done** — `systems/daring-comics/data.js` |
| 2 | Route ruleset constants through `SYS` | registry exists, nothing reads it |
| 3 | Block vocabulary; genericise sheet + creation | not started |
| 4 | Genericise dice, print, NPCs, generators | not started |
| 4b | `lexicon` sweep over user-facing copy | helpers exist, unused |
| 5 | Namespace storage, stamp `systemId` | `sysKey()` exists, unused |
| 6 | Dungeon Crawler Carl pack | not started |
| 7 | System picker UI, per-pack theming | not started |

The plan, the measurements behind it, and the decisions taken are in
[SHELL-PLAN.md](SHELL-PLAN.md). Read §2 (block vocabulary) and §10 (the load-order
rule) before changing anything.

---

## Layout

**One entry file per game.** Each `.html` at the root is a game: it loads the shared
engine from `core/` plus exactly one pack from `systems/`, so a game ships only its
own rules data. Adding a system means a new folder and a new entry file — no build
step, no other file changes.

```
index.html                   launcher: lists the games
daring-comics.html           the Daring Comics app
dungeon-crawler-carl.html    the Dungeon Crawler Carl app (preview)

core/shell.css               all of the shell's styling
core/chrome.js               nav, page containers, modals — built at boot
core/system.js               the seam: registerSystem(), SYS, lex(), sysKey()
core/blocks.js               the block vocabulary: traitGrid, track, pool, readout
core/state.js                saves, worlds, tabs, theme
core/creation.js  core/sheet.js   character creation and the sheet
core/npcs.js      core/team.js
core/map.js       core/log.js     core/conflict.js   core/dice.js
core/wiki.js      core/llm.js     wiki/codex + the AI intake
core/print.js                print centre and the print stylesheet
core/util.js                 esc(), icons, import/export, generators
core/mp.js        core/app-mp.js  Firebase layer + the overlay
core/mp-boot.js              boots the app — MUST stay last
systems/_template/           skeleton pack: copy this to start a game
systems/daring-comics/       the reference pack
systems/dungeon-crawler-carl/
test/                        jsdom suites — 312 checks
```

An entry file carries no markup of its own: `core/chrome.js` injects the nav, page
containers and modal shells as the first step of boot, and the active pack supplies
its own fonts and theme swatches. That keeps a game's `.html` at about forty lines
instead of duplicating four hundred lines of chrome per game.

**Load order is execution order and must not be reordered.** A module may *declare*
at load time; anything that *executes* must be self-contained or wait for the boot
IIFE in `core/mp-boot.js`. A pack calling `registerSystem()` at load is the one
documented exception. See SHELL-PLAN.md §10 for the bug that established this rule.

> **Caveat on payload separation.** Only *rules data* is separated today. The core
> modules still contain plenty of Daring Comics logic (`core/sheet.js`,
> `core/print.js`, `core/team.js`), so the DCC app carries code it cannot use.
> Routing that through `SYS` is Phase 2; expressing it as blocks is Phase 3.

---

## Running it

No build step. Any static server works:

```sh
npx serve .          # then open the printed URL and pick a game
npm test             # 312 checks across 5 jsdom suites
```

Opening the files directly from the filesystem mostly works, but multiplayer and
the icon search need `http://`.

---

## Starting a new game

1. `cp -r systems/_template systems/my-game` and set its `id`.
2. Copy `dungeon-crawler-carl.html` to `my-game.html` and point its two
   `systems/...` script tags at your pack.
3. Add it to the launcher in `index.html`.
4. Fill in the `lexicon` first — it is the cheapest thing that makes the app feel
   like your game.
5. Then the `schema.blocks`, then `derive`, then `dice`.

Every manifest key except `id` and `name` is optional; the shell falls back to a
default for anything omitted, so a half-written pack still boots.

---

## Multiplayer

`firebase-config.js` is **not** committed here, and is git-ignored on purpose. In
the single deployed Daring Comics app committing it was correct; a shell is a
starting point for many games, and a pack copied from here must reach its **own**
Firebase project rather than inheriting someone else's database. Copy
`firebase-config.example.js`, fill in your project, and read
[MULTIPLAYER.md](MULTIPLAYER.md) §1–2 — particularly the API-key restrictions and
the database rules that keep GM secrets out of players' clients.

The app runs fully offline without any of this; the Firebase SDK is only fetched
when someone opens the multiplayer lobby.

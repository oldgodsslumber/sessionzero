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

```
index.html                   markup, CSS, and the script tags. No game data.
core/system.js               the seam: registerSystem(), SYS, lex(), sysKey()
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
test/                        jsdom suites — 215 checks
```

**Load order is execution order and must not be reordered.** A module may
*declare* at load time; anything that *executes* must be self-contained or wait
for the boot IIFE in `core/mp-boot.js`. See SHELL-PLAN.md §10 for the bug that
established this rule.

---

## Running it

No build step. Any static server works:

```sh
npx serve .          # then open the printed URL
npm test             # 215 checks across 4 jsdom suites
```

Opening `index.html` from the filesystem mostly works, but multiplayer and the
icon search need `http://`.

---

## Starting a new game

1. `cp -r systems/_template systems/my-game` and set its `id`.
2. Open it with `?system=my-game`.
3. Fill in the `lexicon` first — it is the cheapest thing that makes the app feel
   like your game.
4. Then the `schema.blocks`, then `derive`, then `dice`.

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

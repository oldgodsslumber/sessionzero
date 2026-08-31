# Tests

The app is a static page with no build step; these suites load `index.html` into
[jsdom](https://github.com/jsdom/jsdom) and drive the real functions.

```sh
npm install     # one dev dependency: jsdom
npm test        # all suites
node test/mp.js # one suite
```

| Suite       | Covers |
| ----------- | ------ |
| `wiki.js`   | Model-output parsing, name/alias upsert, universe scoping, cross-links, intake success and failure paths |
| `saves.js`  | Migration off the old 10 slots, save-index repair, quota failure, CRUD past 28 saves |
| `series.js` | Series tone/level on the universe, per-hero experience, the first-run gate |
| `mp.js`     | Two simulated clients: sync, collaboration, soft delete, and GM secret isolation |
| `dice.js`   | That a player can actually roll: a control reachable at phone and desktop width, in every pack, plus the HUD tab |

## Notes on how these work

**Assertions run inside the page.** `w.eval(...)` rather than reaching in from
Node, because top-level `const`/`let` in a source file never land on `window`.
That is also why `dice.js` parks `SYS.dice` on `window` before nulling it: the
suite cannot restore a `const` it cannot reach.

**Calling a handler proves nothing about reachability.** Dungeon Crawler Carl
shipped with no way to roll a die at phone width while two checks called
`showTab('dice')` and passed — the button that calls it was `display:none` below
700px and the sheet roller it was hidden in favour of was never drawn for a block
pack. Assert the *control*: that it exists, and that neither it nor an ancestor
is hidden at the width under test. See `DEBRIEF.md` and `PORTING.md` §5.

**JSDOM ignores `@media`.** `getComputedStyle` reports width-gated rules as if
they always applied, which is exactly the blind spot that let the bug through.
`dice.js` carries a small stylesheet reader that collects declarations by
selector and media condition and evaluates them at a stated width. Reach for it
rather than trusting `getComputedStyle` for anything responsive.

**`fakefb.js` is an in-memory Firebase with the security rules modelled.** It
exists so `mp.js` can prove a player never receives GM-only lore — a client-side
check alone would prove nothing. Two caveats:

- The rules are *modelled*, not evaluated by Firebase. Real RTDB rules
  **cascade**; the model is deliberately non-cascading, matching the per-subtree
  rules in `MULTIPLAYER.md`. If you change those rules, verify with the Rules
  Playground as well — this harness cannot catch a cascade mistake.
- Sign-in is stubbed. Nothing here exercises real Google auth.

**Timing.** The suites `await` fixed delays for debounced pushes to land. If a
suite goes flaky after a debounce interval changes, the waits are the thing to
adjust.

**Scope selectors to a screen.** A block can be mounted twice — the Health Bar
is on the crawler sheet and on the HUD — so `querySelectorAll('.trk-slot')`
counts every slot twice once both tabs have been opened. Use `#sys-blocks …` or
`#hud-content …`. The same trap has a sharper form: searching a whole screen's
`textContent` for a phrase passes whenever *any* card contains it. The first
version of the healing-Spell check did that and stayed green with the bug put
back in; `hudCard(name, sel)` in `dcc.js` reads one card instead. Falsify a new
check by reintroducing the bug before you trust it.

**Seed data must be realistic.** Several early failures were the harness's fault
for building characters without `aspects` or `stress`; `renderSheet` assumes
both, as everything that creates a character does. Use the `CHAR`/`CH` helpers
already in the suites rather than hand-rolling a partial character.

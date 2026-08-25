// systems/_template/system.js — skeleton system pack.
//
// Copy this directory to systems/<your-game>/ and fill it in. Every key is
// optional except id and name: the shell falls back to a default for anything
// omitted, so a pack boots while it is still half-written. Start by changing
// the id, the lexicon and one block, then load it with ?system=<your-game>.
//
// See SHELL-PLAN.md §2 for the block vocabulary and §8 for the blocks that
// Dungeon Crawler Carl needs and Daring Comics does not.

registerSystem({
  id: 'template',
  name: 'Untitled Game',

  // ─── vocabulary ──────────────────────────────────────────────────────────
  // Only override the words your game says differently. Anything you leave out
  // uses the shell's neutral default (World / Character / Roster / Party / …).
  lexicon: {
    // universe: 'Campaign',
    // hero:     'Adventurer',
    // region:   'Zone',
    // logBreak: 'Session',
  },

  // ─── look ────────────────────────────────────────────────────────────────
  // theme  — the data-theme value your theme.css defines
  // themes — swatches offered in the sidebar: [value, label, cssGradientStops]
  // fonts  — Google Fonts hrefs; the shell ships none, so ask for what you use
  theme: null,
  themes: [],
  fonts: [],

  // ─── the character ───────────────────────────────────────────────────────
  // identity — plain text fields at the top of the sheet
  // blocks   — the sheet itself, in order. Each needs a unique id and a type
  //            from the block vocabulary. Give a block a `render(ctx)` instead
  //            of a type to drop to a hand-written renderer (the escape hatch).
  schema: {
    identity: ['name'],
    blocks: [
      // {id:'stats',  type:'traitGrid', values:[...], budget:'derive.statPoints'},
      // {id:'hp',     type:'track',     tracks:['hp'], length:'derive.maxHP'},
      // {id:'gear',   type:'inventory', catalog:'GEAR'},
    ],
  },

  // ─── character creation ──────────────────────────────────────────────────
  // One entry per wizard step. `validate` gates the Continue button.
  creation: [
    // {id:'name', label:'Name', validate: c => c.name.trim().length > 0},
  ],

  // ─── formulas ────────────────────────────────────────────────────────────
  // Referenced from blocks as the string 'derive.<name>'. Keep them pure —
  // take state, return a number/array. They are called on every render.
  derive: {
    // maxHP: st => 10 + (st.stats.CON || 0),
  },

  // ─── dice ────────────────────────────────────────────────────────────────
  // roll()    -> {dice:[…], total}
  // outcome() -> a label for total vs. target number
  // modifiers -> spend-a-resource buttons offered after a roll
  dice: null,
  // dice: {
  //   formula: '1d20',
  //   roll:    () => { const d = 1 + Math.floor(Math.random()*20); return {dice:[d], total:d}; },
  //   outcome: (total, tn) => total >= tn ? 'Success' : 'Failure',
  //   modifiers: [],
  // },

  // ─── content ─────────────────────────────────────────────────────────────
  // Catalogs are the pickable lists (powers, spells, gear, feats). Put the data
  // in data.js and reference it here by name from catalogItems/inventory blocks.
  catalogs: {},

  // NPC roster tabs. Omit for the shell default (a single flat roster).
  npcTypes: [],

  // Wiki entry types. Omit to use the shell's defaults.
  loreTypes: null,

  // Random generators offered as "Roll" buttons next to text fields.
  generators: {},

  // One-off fixups for saves written by older versions of THIS pack. Each runs
  // against a loaded state and returns true if it changed anything. Pack-local
  // on purpose: the shell must never carry one game's legacy quirks.
  migrate: [],
});

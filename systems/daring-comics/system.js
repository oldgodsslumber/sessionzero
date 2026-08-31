// systems/daring-comics/system.js — the Daring Comics pack manifest.
//
// PHASE 2 IS NOT DONE. This registers the pack's identity and its words, but
// declares NO schema.blocks — which is the signal that makes renderHero fall
// back to the legacy hand-written sheet in core/sheet.js. Daring Comics behaves
// exactly as it always has; the only thing that changes is that it now has an
// id, so it can be selected and so its saves can be stamped.
//
// Routing the ruleset constants (SKILLS, LADDER, POWERS, the derive formulas)
// through this manifest is Phase 2; expressing the sheet as blocks is Phase 3.

registerSystem({
  id: 'daring-comics',
  name: 'Daring Comics',
  theme: '',                 // '' is this pack's default data-theme

  // The pop-out second screen in core/log.js is this pack's: it reads
  // costumedName, stress.physical and Fate Points off the character, and draws
  // 4dF. Declaring it is what puts the nav button there — without this the
  // button showed for every pack, and on Dungeon Crawler Carl it opened a window
  // that said "Waiting…" forever and threw as soon as any state reached it.
  secondScreen: true,

  // The comic look is the PACK's, not the shell's. These were hardcoded in
  // index.html's markup and <head>; moving them here is decision 4 landing:
  // a pack that declares neither renders neutral, in the system font stack.
  fonts: ['https://fonts.googleapis.com/css2?family=Bangers&family=Oswald:wght@400;600;700&family=Comic+Neue:wght@400;700&family=Roboto+Condensed:wght@400;700&display=swap'],
  themes: [
    ['', 'Classic Comics', '#0a0e1a,#e63946'],
    ['dark', 'Dark &amp; Gritty', '#0c0c0c,#d4a020'],
    ['cosmic', 'Cosmic', '#0a0020,#ff2d78'],
    ['street', 'Street Level', '#111510,#e8a020'],
    ['golden', 'Golden Age', '#1a140e,#cc3333'],
  ],

  // The comic vocabulary that is currently hard-coded in the markup. Declaring
  // it here changes nothing yet — the lexicon sweep is Phase 4b — but it records
  // the mapping so that sweep is a lookup rather than an archaeology exercise.
  lexicon: {
    universe: 'Universe',     universes: 'Universes',
    hero: 'Hero',             heroes: 'Heroes',
    roster: 'Rogues Gallery', npc: 'NPC',          npcs: 'NPCs',
    team: 'Super Team',       region: 'Neighborhood', regions: 'Neighborhoods',
    logBreak: 'Issue',        log: 'Campaign Log', wiki: 'Wiki',
    save: 'Save',             saves: 'Saves',      sheet: 'Character Sheet',
  },

  // No blocks: use the legacy renderer. See core/creation.js renderHero().
  schema: { identity: ['costumedName', 'civilianName'], blocks: [] },
});

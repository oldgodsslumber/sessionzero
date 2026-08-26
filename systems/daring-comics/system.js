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
  theme: '',                 // the shipped comic themes are this pack's

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

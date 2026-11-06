// systems/marvel-multiverse/system.js — the Marvel Multiverse pack manifest.
//
// So far: the official characters (roster.js). The rules, catalogues and sheet arrive
// in later milestones; PLAN.md §10 has the order, and §3A has what the rulebook settled.

registerSystem({
  id: 'marvel-multiverse',
  name: 'Marvel Multiverse',

  // The nav is a fixed row of buttons, so these are the SHORT words.
  nav: {
    hero: 'Hero', npcs: 'Cast', notes: 'Log', wiki: 'Codex',
  },

  lexicon: {
    universe: 'Universe',     universes: 'Universes',
    hero: 'Hero',             heroes: 'Heroes',
    roster: 'Narrator Characters',
    npc: 'Narrator Character', npcs: 'Narrator Characters',
    team: 'Team',             region: 'Location',   regions: 'Locations',
    logBreak: 'Adventure',    wiki: 'Codex',
    gm: 'Narrator',
  },

  // The official characters open first, because a new table has nothing else here yet.
  // Heroes, Villains and Others are that table's own copies, which sync through Firebase.
  npc: {
    label: 'Narrator Character',
    title: 'Narrator Characters',
    panelHint: 'The official characters, and the ones at your table.',
    kinds: () => [
      { id: 'official', label: 'Official', render: mmrOfficialPanelHTML },
      { id: 'hero', label: 'Heroes', one: 'Hero' },
      { id: 'villain', label: 'Villains', one: 'Villain' },
      { id: 'other', label: 'Others', one: 'Other' },
    ],
    // A hero played from a profile shows that profile on the table's roster.
    fromHero: (ch) => mmrHeroRow(ch),
    readout: (n) => (n ? [
      n.rank ? 'Rank ' + n.rank : '',
      n.health ? 'Health ' + n.health : '',
      n.focus ? 'Focus ' + n.focus : '',
      n.karma ? 'Karma ' + n.karma : '',
    ] : []),
    fields: () => [
      { key: 'name', label: 'Name', group: 'Identity', quick: true },
      { key: 'origin', label: 'Origin', group: 'Identity' },
      { key: 'occupation', label: 'Occupation', group: 'Identity' },
      { key: 'teams', label: 'Teams', group: 'Identity' },
      { key: 'base', label: 'Base', group: 'Identity' },
      { key: 'rank', label: 'Rank', type: 'number', def: 1, group: 'Numbers', quick: true },
      { key: 'health', label: 'Health', type: 'number', def: 30, group: 'Numbers', quick: true },
      { key: 'healthDR', label: 'Health Damage Reduction', type: 'number', def: 0, group: 'Numbers' },
      { key: 'focus', label: 'Focus', type: 'number', def: 30, group: 'Numbers', quick: true },
      { key: 'focusDR', label: 'Focus Damage Reduction', type: 'number', def: 0, group: 'Numbers' },
      { key: 'karma', label: 'Karma', type: 'number', def: 0, group: 'Numbers' },
      { key: 'init', label: 'Initiative', group: 'Numbers' },
      { key: 'speed', label: 'Speed', group: 'Numbers' },
      { key: 'abilities', label: 'Abilities', rows: 3, long: true, group: 'Abilities' },
      { key: 'damage', label: 'Damage', rows: 2, long: true, group: 'Abilities' },
      { key: 'traits', label: 'Traits', rows: 2, long: true, group: 'Labels' },
      { key: 'tags', label: 'Tags', rows: 2, long: true, group: 'Labels' },
      { key: 'powers', label: 'Powers', rows: 4, long: true, group: 'Powers' },
      { key: 'history', label: 'History', rows: 6, long: true, group: 'Story' },
      { key: 'personality', label: 'Personality', rows: 4, long: true, group: 'Story' },
      { key: 'notes', label: 'Notes', rows: 3, long: true, group: 'Notes' },
    ],
  },

  sheetExtra: mmrSheetExtra,

  schema: {
    identity: ['name'],
    // At least one block is required: sysUsesBlocks() treats a pack with none as
    // Daring Comics and sends it to that game's creation screens, which crash here.
    blocks: [
      {
        id: 'abilities', type: 'traitGrid', label: 'Abilities', span: 'full',
        traits: [
          { id: 'melee',      name: 'Melee' },
          { id: 'agility',    name: 'Agility' },
          { id: 'resilience', name: 'Resilience' },
          { id: 'vigilance',  name: 'Vigilance' },
          { id: 'ego',        name: 'Ego' },
          { id: 'logic',      name: 'Logic' },
        ],
      },
    ],
  },
});

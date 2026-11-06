// systems/marvel-multiverse/system.js — the Marvel Multiverse pack manifest.
//
// So far: the official characters (roster.js). The rules, catalogues and sheet arrive
// in later milestones; PLAN.md §10 has the order, and §3A has what the rulebook settled.

registerSystem({
  id: 'marvel-multiverse',
  name: 'Marvel Multiverse',

  defaultTheme: 'multiverse',

  // The nav is a fixed row of buttons, so these are the SHORT words.
  nav: {
    hero: 'Hero', npcs: 'Cast', notes: 'Log', wiki: 'Codex',
  },

  // The characters are what works so far, so a table with nobody in play opens on them.
  landing: (ch) => ((ch && (ch.profile || sysCharName(ch))) ? '' : 'npcs'),

  copy: {
    map:      { title: 'Location Map' },
    conflict: { hint: 'Turn order and zones for now. The d616 combat rules are still to come.' },
    dice:     { none: 'The d616 dice roller is still to come.' },
    // The icon library is the same for every game; only the suggested words
    // need to belong to this one, or a Location asks you to search for potions.
    icons:    { examples: 'city, lightning, shield, mask' },
  },

  lexicon: {
    universe: 'Universe',     universes: 'Universes',
    hero: 'Hero',             heroes: 'Heroes',
    roster: 'Narrator Characters',
    npc: 'Narrator Character', npcs: 'Narrator Characters',
    team: 'Team',             region: 'Location',   regions: 'Locations',
    logBreak: 'Adventure',    log: 'Adventure Log', wiki: 'Codex',
    gm: 'Narrator',           sheet: 'Hero Sheet',
    registerWorld: 'Name Your Marvel Universe',
    universeHint: 'e.g. Earth-616, Friday Night Heroes',
    worldNext: 'Name it once, then pick from the 128 official characters.',
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
        // A character out of the book already prints its abilities in the stat
        // block from `sheetExtra`, with the trained Defense and Check values
        // beside each score. Those cannot be derived from the score, so a second
        // editable copy here could only disagree with it. Your own character has
        // no stat block, so the grid is its only abilities and it stays.
        when: (ch) => !(ch && ch.profile),
        // Set at creation, not by a finger landing on the sheet you read every
        // round. The Edit switch opens it.
        locked: true,
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

// systems/dungeon-crawler-carl/system.js — the DCC pack manifest.
//
// Phases D0–D2: identity, lexicon, the dice engine, and the crawler sheet's
// core blocks. Skills (D3), inventory (D4), creation (D5) and Races/Classes (D6)
// are not here yet — the shell degrades to a default for anything omitted, so
// the pack boots in this half-written state on purpose.

// Local helpers. These must NOT go through SYS: another pack may be the active
// system when these run (the sheet renderer passes the character explicitly), and
// SYS points at whichever pack is selected, not at this one.
function dccStatOf(char, id) {
  const c = char && char.blocks && char.blocks.stats && char.blocks.stats[id];
  return c ? (c.base || 0) + (c.bonus || 0) : 0;   // Enhanced = Unenhanced + bonus
}
function dccModOf(char, id) { return dccStatMod(dccStatOf(char, id)); }

// One d20, with Advantage (+1) / Disadvantage (-1) / neither (0).
function dccRollD20(adv) {
  const d = () => 1 + Math.floor(Math.random() * 20);
  const a = d();
  if (!adv) return { dice: [a], nat: a };
  const b = d();
  return { dice: [a, b], nat: adv > 0 ? Math.max(a, b) : Math.min(a, b) };
}

// The full resolution of one Check.
function dccResolveCheck(opts) {
  const o = opts || {};
  const r = dccRollD20(o.adv || 0);
  const total = r.nat + (o.rank || 0) + (o.statMod || 0) + (o.bonus || 0);
  const difficulty = o.difficulty !== undefined
    ? o.difficulty
    : dccDifficulty(o.kind || 'unopposed', o.floor, o.antagonistMod);
  const degreeId = dccDegree(total, difficulty, r.nat);
  return {
    dice: r.dice, nat: r.nat, total, difficulty,
    degree: DCC_DEGREES.find(x => x.id === degreeId),
    margin: total - difficulty,
  };
}

registerSystem({
  id: 'dungeon-crawler-carl',
  name: 'Dungeon Crawler Carl',

  // The app is the Crawler Interface, so the words are the System AI's.
  lexicon: {
    universe: 'Crawl',        universes: 'Crawls',
    hero: 'Crawler',          heroes: 'Crawlers',
    roster: 'Bestiary',       npc: 'Mob',           npcs: 'Mobs',
    team: 'Party',            region: 'Neighborhood', regions: 'Neighborhoods',
    logBreak: 'Floor',        log: 'Crawl Log',     wiki: 'Codex',
    save: 'Crawler File',     saves: 'Crawler Files', sheet: 'Crawler Sheet',
  },

  // ─── the crawler sheet ────────────────────────────────────────────────────
  schema: {
    identity: ['name', 'crawlerNumber', 'race', 'class', 'level'],
    blocks: [
      {
        id: 'stats', type: 'traitGrid', label: 'The Five Core Stats',
        hint: 'Unenhanced is you. Enhanced adds gear, Spells and Buffs. Everything rolls off the Mod.',
        layers: ['Unenhanced', 'Enhanced'],
        mod: 'derive.statMod',
        traits: DCC_STATS.map(s => ({ id: s.id, name: s.name, desc: s.desc })),
        // editing a Stat changes Health, Mana and Evade, so repaint those too
        affects: ['health', 'mana', 'defence'],
      },
      {
        id: 'health', type: 'track', label: 'Health Bar',
        slots: DCC_HB_SLOTS,
        slotValue: 'derive.hbSlotValue',      // = CON Mod
        fill: 'rtl', percent: true, damageInput: true,
        emptyWarning: 'Dying — you have CON Mod rounds. Heal to at least 10% or you are off the show.',
      },
      {
        id: 'mana', type: 'pool', label: 'Mana',
        hint: 'Max Mana equals your Enhanced Intelligence — the score, not the Mod.',
        max: 'derive.maxMana',
      },
      {
        id: 'defence', type: 'readout',
        items: [
          { label: 'Evade',  value: 'derive.evade', hint: 'd20 + DEX Mod' },
          { label: 'DR',     value: 'derive.dr',    hint: 'damage resistance' },
          { label: 'Move',   value: 'derive.move',  hint: 'feet' },
          { label: 'Step',   value: 'derive.step',  hint: 'feet, free per Action' },
          { label: 'Size',   value: 'derive.size' },
        ],
      },
      {
        id: 'skills', type: 'skillList', label: 'Skills',
        hint: 'Tick a Skill when you use it. Skills do not rise on level-up — they advance from use: '
            + 'roll d20 against the Skill’s current Rank, every 2 hours of play at Rank 4 or lower, '
            + 'at the end of each floor from Rank 5. Passive Skills never mark.',
        statMod: 'derive.skillStatMod',
        advanceRoll: 'derive.advanceSkill',
        lookup: 'derive.skillLookup',
        catalog: 'skills',
        rankCap: DCC_SKILL_RANK_SOFT_CAP,
      },
      {
        id: 'spells', type: 'skillList', label: 'Spells',
        hint: 'A Spell has to be in your Hotlist to cast it under pressure. Spells cannot be '
            + 'attempted untrained, except from a scroll.',
        statMod: 'derive.spellStatMod',
        advanceRoll: 'derive.advanceSkill',
        lookup: 'derive.spellLookup',
        catalog: 'spells',
        rankCap: DCC_SKILL_RANK_SOFT_CAP,
      },
      {
        id: 'gear', type: 'inventory', label: 'Gear',
        hint: 'Only what is in a Gear Slot gives you anything. The Hotlist is for reach, not bonuses '
            + '— an item put back into it turns its benefits off. Inventory is weightless; the '
            + 'only limit is whether you could pick the thing up.',
        carryLimit: 'derive.liftLimit',
        containers: [
          { id: 'equipped', kind: 'slots', label: 'Gear Slots', slots: DCC_GEAR_SLOTS,
            note: 'one item each, except Accessories' },
          { id: 'hotlist', kind: 'stack', label: 'Hotlist', size: DCC_HOTLIST_SLOTS, stackMax: 999,
            note: 'ten slots, reachable with one Action' },
          { id: 'inventory', kind: 'list', label: 'Inventory',
            note: 'weightless, and retrieved at the speed of thought outside combat' },
        ],
        counters: [{ id: 'junk', label: 'Misc. Junk' }],
      },
      {
        id: 'companions', type: 'entityList', label: 'Pets, Mounts & Minions',
        hint: 'A pet levels twice as fast as you until 15, and rolls at the Floor Number '
            + 'however green it is. Track how many levels YOU have gained since it joined.',
        kinds: DCC_COMPANION_KINDS,
        readout: 'derive.companionReadout',
      },
      { id: 'aiFavor',    type: 'pool', label: 'AI Favor',   hint: 'Reroll a d20 (never a Nat 1), or gain an extra non-Attack Action.' },
      { id: 'popularity', type: 'pool', label: 'Popularity', hint: 'Fan Boxes at 25, 50, 100. Viewers are fickle.' },
      { id: 'gold',       type: 'pool', label: 'Gold',       hint: 'All of it fits in one Inventory slot.' },
    ],
  },

  creation: DCC_SCREENS,
  finishCreation: dccFinishCreation,

  // ─── formulas ─────────────────────────────────────────────────────────────
  // Pure: take the character, return a number. Called on every render.
  derive: {
    statMod: enhancedValue => dccStatMod(enhancedValue),
    hbSlotValue: char => dccModOf(char, 'CON'),
    // The only cap on Inventory is whether you could lift the thing: STR x 15 lb (p. 98).
    // One line of numbers under a companion's name. A pet is the only kind
    // with anything to derive; the others carry rules, not statistics.
    companionReadout: (char, e) => {
      if (!e || e.kind !== 'pet') return [];
      const floor = (typeof S !== 'undefined' && S && S.floor) || 3;
      const lvl = dccPetLevel(e.levelsGained || 0);
      const out = ['Level ' + lvl,
                   'Rank ' + dccPetRank(floor) + ' (Floor ' + floor + ')',
                   dccPetStatPoints(1, lvl) + ' Stat points, none in ' + DCC_PET_STAT_EXCLUDED];
      const dice = dccPetAttackDice(floor);
      if (dice) out.push('+' + dice + ' base damage ' + (dice === 1 ? 'die' : 'dice'));
      if (dccPetIsMature(lvl)) out.push('mature');
      return out;
    },

    liftLimit: char => 'Lift limit ' + (dccStatOf(char, 'STR') * 15) + ' lb',
    maxMana:     char => dccStatOf(char, 'INT'),
    evade:       char => '+' + dccModOf(char, 'DEX'),
    dr:          char => (char && char.dr) || 0,
    move:        char => (char && char.move) || DCC_BASE_MOVE,
    step:        char => (char && char.step) || DCC_BASE_STEP,
    size:        char => {
      const n = (char && char.size) || 4;
      const s = DCC_SIZES.find(x => x.n === n);
      return s ? s.name + ' (' + n + ')' : String(n);
    },
    // exposed for the sheet, the dice tab and the tests
    stat: dccStatOf,
    mod:  dccModOf,

    // the Stat Mod a Skill row adds, given the character and the Skill's Stat
    // Resolve a typed name against the catalogue, so an added Skill or Spell
    // brings its Stat and check type with it and only a genuinely new name
    // is recorded as custom.
    skillLookup: name => dccSkillByName(name),
    spellLookup: name => dccSpellByName(name),

    skillStatMod: (char, statId) => statId ? dccModOf(char, statId) : 0,

    // A Spell rolls off INT unless its entry names another Stat, but it always
    // costs INT-based Mana (p. 202).
    spellStatMod: (char, statId) => dccModOf(char, statId || 'INT'),

    // Skill Advancement (p. 169): roll 1d20 against the Skill's CURRENT Rank.
    // Meet or beat it and the Rank goes up by one, to a maximum of 15.
    advanceSkill: skill => {
      const before = skill.rank || 0;
      const roll = 1 + Math.floor(Math.random() * 20);
      const gained = roll >= before && before < DCC_SKILL_RANK_SOFT_CAP;
      return { roll, before, gained, rank: gained ? before + 1 : before };
    },
  },

  // ─── dice ─────────────────────────────────────────────────────────────────
  // The d20 is the whole game. The GM never rolls one: a Mob's quality is a
  // Difficulty the player rolls against.
  dice: {
    formula: '1d20',
    checkKinds: DCC_CHECK_KINDS,
    roll: dccRollD20,
    resolve: dccResolveCheck,
    difficulty: dccDifficulty,
    degrees: DCC_DEGREES,
  },

  // ─── content the shell can already use ────────────────────────────────────
  catalogs: {
    skills: DCC_SKILLS,
    spells: DCC_SPELLS,
    craftingTables: DCC_CRAFTING_TABLES,
    craftingSkills: DCC_CRAFTING_SKILLS,
    salvage: DCC_SALVAGE,
    concoctions: DCC_CONCOCTIONS,
    races: DCC_RACES,
    classes: DCC_CLASSES,
    backgrounds: DCC_BACKGROUNDS,
    storyTables: DCC_STORY_TABLES,
    weaponCategories: DCC_WEAPON_CATEGORIES,
    handToHand: DCC_HAND_TO_HAND,
    startingSpells: DCC_STARTING_SPELLS,
    floorStart: DCC_FLOOR_START,
    rankDamage: DCC_RANK_DAMAGE,
    debuffs: DCC_DEBUFFS,
    damageTypes: DCC_DAMAGE_TYPES,
    gearSlots: DCC_GEAR_SLOTS,
    sizes: DCC_SIZES,
    bossTiers: DCC_BOSS_TIERS,
    popularityTriggers: DCC_POPULARITY_TRIGGERS,
  },

  // A crawler's starting shape. The blocks fill themselves in on first render.
  newCharacter() {
    return {
      systemId: 'dungeon-crawler-carl',
      name: '', crawlerNumber: 500000 + Math.floor(Math.random() * 12400000),
      race: '', class: '', level: 10,
      dr: 0, move: DCC_BASE_MOVE, step: DCC_BASE_STEP, size: 4,
      blocks: {},
    };
  },
});

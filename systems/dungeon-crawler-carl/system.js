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
  let n = c ? (c.base || 0) + (c.bonus || 0) : 0;  // Enhanced = Unenhanced + bonus
  // ...plus whatever you are wearing, which is not stored on the Stat because
  // taking the item off has to take the bonus with it.
  const eq = char && char.blocks && char.blocks.gear && char.blocks.gear.equipped;
  if (eq) {
    Object.keys(eq).forEach(function (slot) {
      (eq[slot] || []).forEach(function (it) {
        if (it && it.grantsStat === id) n += Number(it.grantsStatN) || 0;
      });
    });
  }
  return n;
}
function dccModOf(char, id) { return dccStatMod(dccStatOf(char, id)); }

// A Hotlist entry is often just a name — creation writes {name:'Heal'} for a
// Spell parked there. If the crawler actually knows a Skill or Spell by that
// name, tapping the slot should roll it.
function dccHotlistKnown(char, name) {
  const n = String(name || '').toLowerCase();
  if (!n || !char || !char.blocks) return '';
  let hit = '';
  ['skills', 'spells'].forEach(function (id) {
    const b = char.blocks[id];
    ((b && b.skills) || []).forEach(function (s) {
      if (!hit && s && String(s.name).toLowerCase() === n) hit = s.name;
    });
  });
  return hit;
}

// What Skill an item works as. An explicit "Works as" wins; failing that the
// item's own name is matched against the catalogue, because a gun a crawler
// simply named "Handgun" is a Handgun. That is the rule the attack icons
// already follow — an explicit link beats a name, but a name still connects —
// and it is what makes a weapon added straight from the catalogue usable
// without the player also filling in a field they have no reason to know about.
function dccItemSkillName(item) {
  if (!item) return '';
  const explicit = item.skill || item.grantsSkill;
  if (explicit) return explicit;
  const cat = item.name ? dccSkillByName(item.name) : null;
  return cat ? cat.name : '';
}

// ...and the same answer, but only when the Skill is one you must be holding
// something to use. dccNeedsWeapon() owns that rule; this asks it rather than
// carrying a second copy of the category test.
function dccItemWeaponSkill(item) {
  const name = dccItemSkillName(item);
  const cat = name ? dccSkillByName(name) : null;
  return (cat && typeof dccNeedsWeapon === 'function' && dccNeedsWeapon(cat)) ? cat.name : '';
}

// Is this exact item in a Gear Slot right now? Identity, not name: two Clubs
// are two Clubs, and only the one you drew is in your hand.
function dccItemInHand(item, char) {
  const eq = char && char.blocks && char.blocks.gear && char.blocks.gear.equipped;
  if (!eq || !item) return false;
  return Object.keys(eq).some(function (sl) {
    return (eq[sl] || []).some(function (x) { return x === item; });
  });
}

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

  // The shell's default look is Daring Comics': a comic display face, all-caps
  // titles, hard drop shadows. Wrong for a dungeon crawl, and the display face
  // was never actually loaded, so it fell back to Comic Sans.
  // One fixed identity, measured from the rulebook — no picker. The five
  // themes in the shell are Daring Comics' own and stay with it; offering them
  // here would let a player pick a comic palette for a dungeon crawl.
  defaultTheme: 'crawler',

  // The app is the Crawler Interface, so the words are the System AI's.
  lexicon: {
    universe: 'Crawl',        universes: 'Crawls',
    hero: 'Crawler',          heroes: 'Crawlers',
    roster: 'Bestiary',       npc: 'Mob',           npcs: 'Mobs',
    team: 'Party',            region: 'Neighborhood', regions: 'Neighborhoods',
    logBreak: 'Floor',        log: 'Crawl Log',     wiki: 'Codex',
    save: 'Crawler File',     saves: 'Crawler Files', sheet: 'Crawler Sheet',
    // The opening gate's own copy. The shell falls back to Daring Comics'
    // wording for any pack that does not supply these.
    registerWorld: 'Register Your Crawl',
    startWorld: 'Begin the Crawl',
    joinWorld: 'Join a table',
    joinPrompt: 'Someone else already running the dungeon?',
    universeHint: 'e.g. Borant Prime, The Meat Grinder',
  },

  // The app is the Crawler Interface, and in the novels that interface talks:
  // clipped, official, addressing you as Crawler. "Welcome, Crawler. Welcome to
  // the First Floor." These are kept SHORT on purpose — you see "Logged" a
  // hundred times a session, and a joke that lands once is friction the
  // fiftieth time.
  //
  // Failures are deliberately absent. When a save fails you need to know what
  // to do about it, so those stay plain.
  voice: {
    saved: 'Logged',
    alreadyKnown: 'You have that already, Crawler.',
    noRoom: 'No room, Crawler.',
    noFreeSlot: 'Every slot is taken.',
  },

  // The map is a dungeon floor, not a city. These are the places the Atlas
  // actually describes on the tutorial floors: hallways that "connect rooms to
  // other rooms", stairwells that are "the only reliable way for crawlers to
  // reach the next floor down", saferooms, bathrooms, reward rooms and the
  // Tutorial Guilds.
  map: {
    firstRegion: 'The First Floor',
    zoneTypes: [
      { name: 'Room',      icon: '\u{1F6AA}' },
      { name: 'Hallway',   icon: '\u{1F6E4}' },
      { name: 'Stairwell', icon: '\u{1FA9C}' },
      { name: 'Saferoom',  icon: '\u{1F6E1}' },
      { name: 'Guild',     icon: '\u{1F3F0}' },
      { name: 'Boss Room', icon: '\u{1F480}' },
    ],
    hints: {
      cellName: 'e.g. Tutorial Guild, Bathroom, Reward Room',
      cellFeature: 'e.g. Stairwell down, Loot box, Mob nest',
      areaName: 'e.g. Storeroom, Kitchen, Collapsed hallway',
      areaFeature: 'e.g. Trapped door, Vending machine, Body',
    },
  },

  // A Mob stat block, in the sections the book lays out (pp. 270-273): Name,
  // Size, Type, Level, Health Bar slots, Damage Resistance, Evade, Move, Stats,
  // Attacks and Notes. Three of those are worked out rather than typed:
  //
  //   "The number of HB slots equals the Mob's Level, up to a maximum of 10."
  //   "A Mob's base DR is equal to the Floor Number."
  //
  // The floor comes from the table, so a Mob built on Floor 3 and a Mob built
  // on Floor 7 are not the same creature.
  npc: {
    label: 'Mob',
    hint: 'A stat block is the way to track a Mob. Level and Floor do most of the work: '
        + 'Health Bar slots follow the Level, and DR follows the Floor.',
    fields: () => [
      { key: 'name',  label: 'Name', group: 'Identity',
        hint: 'The Tongue Lasher, The Regret Collector...' },
      { key: 'kind',  label: 'Type', group: 'Identity',
        hint: 'Beastly, Undead, Humanoid, Ooze...' },
      { key: 'size',  label: 'Size', group: 'Identity',
        options: () => DCC_SIZES.map(z => ({ value: z.n, label: z.name + ' (' + z.n + ')' })),
        def: 4 },

      { key: 'level', label: 'Level', type: 'number', def: 1, group: 'Numbers' },
      { key: 'floor', label: 'Floor it belongs to', type: 'number', group: 'Numbers',
        def: () => (typeof S !== 'undefined' && S && S.floor) || 1,
        hint: 'A Mob from another floor keeps its home floor' },
      { key: 'hbSlots', label: 'Health Bar slots', group: 'Numbers',
        derive: (d) => Math.max(1, Math.min(10, Number(d.level) || 1)),
        hint: 'equals its Level, up to ten' },
      { key: 'dr', label: 'Damage Resistance', group: 'Numbers',
        derive: (d) => Number(d.floor) || 0,
        hint: 'equals the Floor Number' },
      { key: 'evade', label: 'Evade', type: 'number', def: 10, group: 'Numbers' },
      { key: 'move',  label: 'Move (feet)', type: 'number', def: DCC_BASE_MOVE, group: 'Numbers' },

      { key: 'stats', label: 'Stats', group: 'Stats', rows: 2,
        hint: 'STR 6, CON 8, DEX 4, INT 2, CHA 1' },

      { key: 'attacks', label: 'Attacks', group: 'Attacks', rows: 3,
        hint: 'Bite - 2d6 + STR Piercing, and the target gains the Bleeding Debuff' },

      { key: 'desc',  label: 'What the crawlers see', group: 'Notes', rows: 2 },
      { key: 'notes', label: 'Notes', group: 'Notes', rows: 3,
        hint: 'Tactics, loot, what it says when it dies' },
    ],
  },

  // ─── the crawler sheet ────────────────────────────────────────────────────
  schema: {
    identity: ['name', 'crawlerNumber', 'race', 'class', 'level'],
    // Which of those are actually numbers. Race and Class are free text, and a
    // crawler is perfectly entitled to call their Race "007".
    numericIdentity: ['crawlerNumber', 'level'],
    // `span` is desktop only: how many of the sheet's columns a block takes
    // when there is room for more than one. The Stats, the Health Bar and the
    // Gear all want the full width; a pool is a number and is happy narrow.
    // Everything without a span is one column, which is the phone unchanged.
    blocks: [
      {
        id: 'stats', type: 'traitGrid', label: 'The Five Core Stats', span: 'full',
        hint: 'Unenhanced is you. Enhanced adds gear, Spells and Buffs. Everything rolls off the Mod.',
        layers: ['Unenhanced', 'Enhanced'],
        mod: 'derive.statMod',
        traits: DCC_STATS.map(s => ({ id: s.id, name: s.name, desc: s.desc })),
        // editing a Stat changes Health, Mana and Evade, so repaint those too
        affects: ['health', 'mana', 'defence'],
        extra: 'derive.wornBonus',
      },
      {
        id: 'health', type: 'track', label: 'Health Bar', span: 'full',
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
        id: 'skills', type: 'skillList', label: 'Skills', span: 2,
        hint: 'Tick a Skill when you use it. Skills do not rise on level-up — they advance from use: '
            + 'roll d20 against the Skill’s current Rank, every 2 hours of play at Rank 4 or lower, '
            + 'at the end of each floor from Rank 5. Passive Skills never mark.',
        statMod: 'derive.skillStatMod',
        advanceRoll: 'derive.advanceSkill',
        lookup: 'derive.skillLookup',
        extra: 'derive.wornBonus',
        // Skills your gear lends you, which you have no Ranks of your own in.
        lent: 'derive.wornSkills',
        upgrades: 'derive.activeUpgrades',
        granted: 'derive.grantedSkills',
        catalog: 'skills',
        // What one Skill IS, for a Skill the book does not have — which the book
        // itself says you are entitled to (p. 174). Anything left blank falls
        // back to the catalogue.
        entryFields: 'derive.skillEntryFields',
        rankCap: DCC_SKILL_RANK_SOFT_CAP,
      },
      {
        id: 'spells', type: 'skillList', label: 'Spells', span: 2,
        hint: 'A Spell has to be in your Hotlist to cast it under pressure. Spells cannot be '
            + 'attempted untrained, except from a scroll.',
        statMod: 'derive.spellStatMod',
        advanceRoll: 'derive.advanceSkill',
        lookup: 'derive.spellLookup',
        upgrades: 'derive.activeUpgrades',
        granted: 'derive.grantedSpells',
        catalog: 'spells',
        // A Spell is craftable with Arcane (Table 45), so a crawler can hold one
        // that is not in the book at all. These are what it costs and what it
        // does; blank means "whatever the catalogue says", so correcting one
        // printed entry does not mean retyping the rest of it.
        entryFields: 'derive.spellEntryFields',
        // Table 45: Scrolls are crafted with Calligraphy. Knowing the Spell and
        // knowing the Skill is what the book asks for, so that is the gate.
        entryActions: 'derive.spellEntryActions',
        entryAct: 'derive.spellEntryAct',
        rankCap: DCC_SKILL_RANK_SOFT_CAP,
      },
      {
        id: 'gear', type: 'inventory', label: 'Gear', span: 'full',
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
        // A weapon is held, not worn. Without this the shell drops an item in
        // the first slot with room, which is Head.
        slotFor: 'derive.gearSlotFor',
        // What an item can BE, and what it does once it is that.
        itemOptions: 'derive.gearItemOptions',
        itemReadout: 'derive.gearItemReadout',
        itemLines: 'derive.gearItemLines',
        itemFields: 'derive.gearItemFields',
        itemActions: 'derive.gearItemActions',
        itemAct: 'derive.gearItemAct',
        lookup: 'derive.skillLookup',
        // The book's own items. `catalog` puts their names on the add box; the
        // template is what one of them arrives carrying, so typing "Healing
        // Potion" gets you the potion rather than the words.
        catalog: 'gear',
        itemTemplate: 'derive.gearTemplate',
        // Worn armour changes your Damage Resistance, so the defence readout
        // has to be redrawn when gear changes.
        affects: ['defence'],
      },
      {
        id: 'companions', type: 'entityList', label: 'Pets, Mounts & Minions', span: 2,
        hint: 'A pet levels twice as fast as you until 15, and rolls at the Floor Number '
            + 'however green it is. Track how many levels YOU have gained since it joined.',
        kinds: DCC_COMPANION_KINDS,
        readout: 'derive.companionReadout',
      },
      { id: 'aiFavor',    type: 'pool', label: 'AI Favor',   hint: 'Reroll a d20 (never a Nat 1), or gain an extra non-Attack Action.' },
      { id: 'popularity', type: 'pool', label: 'Popularity', hint: 'Fan Boxes at 25, 50, 100. Viewers are fickle.' },
      // Not a pool. The book prices a Sapper's Table at 3,000 gold and hands out
      // a 250,000 reward; two buttons that step by one do not reach those
      // numbers. See the `tally` block type.
      { id: 'gold', type: 'tally', label: 'Gold',
        hint: 'All of it fits in one Inventory slot, however much of it there is.' },
    ],
  },

  // A tab of this pack's own. Gear was the tallest thing on the sheet and the
  // thing most often reached for, and it sat below the Stats, the Health Bar,
  // the Skills and the Spells — so managing your bag meant scrolling past who
  // you are. It gets its own screen, and the sheet stops drawing it.
  //
  // The Hotlist keypad on the HUD is untouched: that is the fighting view. This
  // is the packing view. Same blocks, so they cannot disagree.
  tabs: [
    {
      id: 'items',
      label: 'Items',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
          + '<path d="M6 7h12l1.2 13H4.8z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>',
      // Two views: what this crawler is carrying, and everything the game knows
      // about. The catalogue is where you look an item up and where a GM builds
      // a floor's worth of loot without typing each one onto a sheet.
      views: [
        { id: 'bag', label: 'Bag', blocks: ['gear', 'gold'],
          hint: 'What you are carrying, what you are wearing, and what it is worth.' },
        { id: 'catalog', label: 'Catalogue', catalog: 'gear',
          hint: 'Everything in the book, plus what your table has made.' },
      ],
    },
  ],

  // The combat tracker for the conflict tab. State lives in S.conflict, which
  // multiplayer already syncs, so the whole table sees the same round.
  combat: { init: dccCombatInit, render: dccCombatRender, steps: DCC_COMBAT_STEPS },

  creation: DCC_SCREENS,
  finishCreation: dccFinishCreation,
  // The fight screen. Declaring this is what gives the pack a HUD tab at all;
  // a pack that omits it has no such tab. See systems/…/hud.js.
  renderHUD: dccRenderHUD,
  // Prose the block schema has nowhere to put: Race and Class benefits.
  sheetExtra: dccSheetTraits,

  // ─── formulas ─────────────────────────────────────────────────────────────
  // Pure: take the character, return a number. Called on every render.
  derive: {
    // Where a piece of gear goes when you equip it. Anything whose name matches
    // a weapon Skill is something you hold; armour and clothing are worn, and
    // the shell's own fallback handles those well enough.
    // A weapon is a weapon because of the Skill you swing it with. Naming a
    // Baseball Bat is not enough — linking it to Club is what makes it a real
    // 1d6 bludgeoning weapon that uses your Club Rank.
    gearItemOptions: () => DCC_SKILLS
      .filter(s => s.kind === 'attack')
      .map(s => ({ value: s.name, label: s.name + ' (' + (s.baseDamage || s.category || '') + ')' })),

    // One line describing what the thing actually does at the table, whichever
    // kind of thing it is.
    // The same facts as the one-line readout, but labelled and split, for print.
    // Deliberately brief: an item is usually one line, a magic weapon three.
    gearItemLines: (item, char) => {
      if (!item) return [];
      const out = [];
      if (item.skill) {
        const cat = dccSkillByName(item.skill);
        if (cat) {
          const bits = [];
          if (cat.baseDamage) bits.push(cat.baseDamage);
          if (cat.range) bits.push(cat.range);
          out.push({ label: 'Attack', text: cat.name + ' \u00b7 ' + bits.join(' \u00b7 ') });
          const list = (char && char.blocks && char.blocks.skills && char.blocks.skills.skills) || [];
          const mine = list.filter(function (x) {
            return String(x.name).toLowerCase() === String(cat.name).toLowerCase();
          })[0];
          if (mine) {
            const mod = cat.stat ? dccStatMod(dccStatOf(char, cat.stat)) : 0;
            const worn = SYS.derive.wornBonus(char, 'skill', cat.name);
            const tot = (mine.rank || 0) + mod + worn;
            out.push({ label: 'To hit', text: (tot >= 0 ? '+' : '') + tot +
              '  (Rank ' + (mine.rank || 0) + ', ' + (cat.stat || '') + ' Mod ' +
              (mod >= 0 ? '+' : '') + mod + ')' });
          } else {
            out.push({ label: 'To hit', text: 'untrained' });
          }
        }
      }
      const grants = [];
      if (item.dr) grants.push('+' + item.dr + ' DR');
      if (item.resist) grants.push(item.resist + ' Resistance');
      if (item.grantsStat && item.grantsStatN) grants.push((item.grantsStatN > 0 ? '+' : '') + item.grantsStatN + ' ' + item.grantsStat);
      if (item.grantsSkill && item.grantsSkillN) grants.push((item.grantsSkillN > 0 ? '+' : '') + item.grantsSkillN + ' ' + item.grantsSkill);
      if (grants.length) out.push({ label: 'Grants', text: grants.join(', ') });
      if (item.casts) {
        const sp = dccSpellByName(item.casts);
        out.push({ label: 'Casts', text: item.casts + (item.rank ? ' at Rank ' + item.rank : '') + ', untrained' });
        if (sp && sp.effect) out.push({ label: '', text: sp.mana + ' Mana \u00b7 ' + (sp.range || '') + ' \u00b7 ' + sp.effect });
      }
      if (item.teaches) out.push({ label: 'Teaches', text: item.teaches });
      // Only the upgrades this crawler has actually earned.
      SYS.derive.activeUpgrades(char, item.skill || item.casts || '')
        .forEach(function (u) { out.push({ label: 'Rank ' + u.rank, text: u.text, kind: 'upgrade' }); });
      if (item.notes) out.push({ label: 'Note', text: item.notes });
      return out;
    },

    gearItemReadout: (item, char) => {
      if (!item) return '';
      const out = [];
      // Only when it is a number: a DR typed as "abc" printed "+abc DR", which
      // reads as armour and contributes nothing.
      if (Number(item.dr)) out.push((Number(item.dr) > 0 ? '+' : '') + Number(item.dr) + ' DR');
      if (item.resist) out.push(item.resist + ' Resistance');
      if (item.casts) {
        // "A crawler can't attempt a Spell without Ranks in the Spell (unless
        // it's a scroll)" (p. 58), so a scroll is usable by anyone.
        out.push('Scroll · casts ' + item.casts +
                 (item.rank ? ' at Rank ' + item.rank : '') + ' untrained');
      }
      if (item.teaches) out.push('Tome · teaches ' + item.teaches);
      if (item.grantsStat && item.grantsStatN) {
        out.push((item.grantsStatN > 0 ? '+' : '') + item.grantsStatN + ' ' + item.grantsStat);
      }
      if (item.grantsSkill && item.grantsSkillN) {
        out.push((item.grantsSkillN > 0 ? '+' : '') + item.grantsSkillN + ' ' + item.grantsSkill);
      }
      if (item.skill) {
        const cat = dccSkillByName(item.skill);
        if (cat) {
          const bits = [cat.name];
          if (cat.baseDamage) bits.push(cat.baseDamage);
          if (cat.range) bits.push(cat.range);
          const list = (char && char.blocks && char.blocks.skills && char.blocks.skills.skills) || [];
          const mine = list.find(x => String(x.name).toLowerCase() === String(cat.name).toLowerCase());
          if (mine) {
            const mod = cat.stat ? dccStatMod(dccStatOf(char, cat.stat)) : 0;
            const worn = SYS.derive.wornBonus(char, 'skill', cat.name);
            const tot = (mine.rank || 0) + mod + worn;
            bits.push('Rank ' + (mine.rank || 0) + ', ' + (tot >= 0 ? '+' : '') + tot + ' to hit');
          } else {
            bits.push('untrained');
          }
          out.push(bits.join(' · '));
        }
      }
      // A Hotlist entry is often just a NAME. Creation writes {name:'Heal'} for
      // the Spell every crawler starts with, and the keypad resolves it by name
      // when you tap it — so it is connected, and nothing on screen said so. It
      // read as a stray label attached to nothing.
      // ...unless the book has an item by that name. A Torch is a torch: there
      // is also a Spell called Torch, and the name match was telling a crawler
      // holding a stick of burning wood that they had no Ranks in it.
      if (!item.skill && !item.casts && !item.teaches &&
          !(typeof dccGearByName === 'function' && dccGearByName(item.name))) {
        const n = String(item.name || '').toLowerCase();
        const own = function (blockId) {
          const b = char && char.blocks && char.blocks[blockId];
          return ((b && b.skills) || []).find(function (x) {
            return String(x.name).toLowerCase() === n;
          });
        };
        const mySpell = own('spells'), mySkill = own('skills');
        const catSpell = dccSpellByName(item.name), catSkill = dccSkillByName(item.name);
        if (mySpell) {
          const bits = ['Your Spell · Rank ' + (mySpell.rank || 0)];
          const mana = (catSpell && catSpell.mana !== undefined) ? catSpell.mana : mySpell.mana;
          if (mana !== undefined) bits.push(mana + ' Mana');
          if (catSpell && catSpell.range) bits.push(catSpell.range);
          out.push(bits.join(' · ') + ' — tap to cast');
        } else if (mySkill) {
          const mod = mySkill.stat ? dccStatMod(dccStatOf(char, mySkill.stat)) : 0;
          const tot = (mySkill.rank || 0) + mod + SYS.derive.wornBonus(char, 'skill', mySkill.name);
          out.push('Your Skill · Rank ' + (mySkill.rank || 0) + ', ' +
                   (tot >= 0 ? '+' : '') + tot + ' — tap to roll');
        } else if (catSpell) {
          // "A crawler can't attempt a Spell without Ranks in the Spell (unless
          // it's a scroll)" (p. 58).
          out.push('Spell — you have no Ranks in it, so only a scroll casts it');
        } else if (catSkill) {
          out.push('Skill — untrained');
        }
      }
      if (item.notes) out.push(item.notes);
      // Only what this crawler's Rank has actually unlocked.
      SYS.derive.activeUpgrades(char, item.skill || item.casts || '')
        .forEach(function (u) { out.push('Rank ' + u.rank + ': ' + u.text); });
      return out.filter(Boolean).join('  —  ');
    },

    // What an item can be. A weapon works as a Skill; armour grants Damage
    // Resistance, which comes from "Armor (natural or worn)" (p. 93); a scroll
    // casts a Spell you have no Ranks in (p. 58); a tome "can later be read to
    // learn the Spell" (p. 116).
    gearItemFields: () => [
      // Drawn as the shared game-icons picker, not a text box. The icon is what
      // you actually read on the Hotlist keypad mid-fight.
      { key: 'icon',    label: 'Icon',      type: 'icon' },
      { key: 'skill',   label: 'Works as',  options: () => DCC_SKILLS.filter(x => x.kind === 'attack').map(x => x.name) },
      { key: 'dr',      label: 'Armour DR', type: 'number', min: 0, hint: '0' },
      { key: 'resist',  label: 'Resists',   hint: 'e.g. Fire' },
      { key: 'casts',   label: 'Scroll of', options: () => DCC_SPELLS.map(x => x.name) },
      { key: 'rank',    label: 'at Rank',   type: 'number', hint: '1' },
      { key: 'teaches', label: 'Tome of',   options: () => DCC_SPELLS.map(x => x.name) },
      // "+3 to Strength or Dexterity" on a Platinum weapon, "+3 to Catcher or
      // Taunt Skills" on Platinum armour (p. 116) — gear that raises what you
      // are rather than what you hit with.
      { key: 'grantsStat',  label: 'Grants Stat',  options: () => DCC_STATS.map(x => x.id) },
      { key: 'grantsStatN', label: 'by',           type: 'number', hint: '0' },
      { key: 'grantsSkill', label: 'Grants Skill', options: () => DCC_SKILLS.map(x => x.name) },
      { key: 'grantsSkillN', label: 'by',          type: 'number', hint: '0' },
      { key: 'notes', label: 'Note', hint: 'What it is, where it came from' },
    ],

    // A tome is the one item that changes your sheet by being used.
    // The Spell vocabulary. Same shape as gearItemFields, and deliberately the
    // same words the book uses on a Spell entry, so filling one in is copying
    // rather than translating.
    spellEntryFields: () => [
      { key: 'mana',       label: 'Mana',        type: 'number', hint: '0' },
      { key: 'range',      label: 'Range',       hint: 'e.g. 30 feet' },
      { key: 'baseDamage', label: 'Base Damage', hint: 'e.g. 1d6 + INT Fire' },
      { key: 'checkType',  label: 'Check',       options: DCC_SKILL_CHECK_TYPES },
      { key: 'kind',       label: 'Type',        options: [
        { value: 'attack',  label: 'Attack' },
        { value: 'utility', label: 'Utility' },
      ] },
      { key: 'cooldown',   label: 'Cooldown',    hint: 'e.g. once per floor' },
      { key: 'effect',     label: 'What it does', type: 'lines', rows: 3,
        hint: 'The Spell in your own words — this is what the sheet, the HUD and the printed page will say.' },
      { key: 'limitations', label: 'Limitations', type: 'lines', rows: 2,
        hint: 'Anything it cannot do, or what it costs you.' },
    ],

    // A Skill the book does not have. Fewer fields than a Spell because a Skill
    // is mostly a Rank and a Stat, and both already have a home on the row.
    skillEntryFields: () => [
      { key: 'category',   label: 'Category',    hint: 'e.g. Ranged Weapon' },
      { key: 'baseDamage', label: 'Base Damage', hint: 'e.g. 1d8 Piercing' },
      { key: 'range',      label: 'Range',       hint: 'e.g. 150 feet' },
      { key: 'checkType',  label: 'Check',       options: DCC_SKILL_CHECK_TYPES },
      { key: 'kind',       label: 'Type',        options: [
        { value: 'attack',  label: 'Attack' },
        { value: 'utility', label: 'Utility' },
      ] },
      { key: 'effect',     label: 'What it does', type: 'lines', rows: 3,
        hint: 'What using it actually achieves.' },
    ],

    // Writing one of your own Spells onto a scroll — the loop the book has and
    // the sheet did not: a Spell was something you could only spend, never make
    // anything out of. What comes back is an ordinary item, so it stacks, it
    // sits in a Hotlist slot, and one tap casts it like any other scroll.
    spellEntryActions: (entry, char) => {
      if (!entry || !dccHotlistKnown(char, 'Calligraphy')) return [];
      return [{ id: 'scribe', label: '✎ Write a scroll of ' + entry.name }];
    },

    spellEntryAct: (action, entry, char) => {
      if (action !== 'scribe' || !entry) return { ok: false };
      if (!dccHotlistKnown(char, 'Calligraphy')) {
        return { ok: false, message: 'Writing a scroll takes Calligraphy (Table 45).' };
      }
      char.blocks = char.blocks || {};
      char.blocks.gear = char.blocks.gear || {};
      const inv = char.blocks.gear.inventory = char.blocks.gear.inventory || [];
      const name = 'Scroll of ' + entry.name;
      // Scrolls stack like anything else you are carrying.
      const have = inv.filter(function (x) {
        return x && String(x.name).toLowerCase() === name.toLowerCase() && x.casts === entry.name;
      })[0];
      if (have) have.qty = (have.qty || 1) + 1;
      else inv.push({ name: name, casts: entry.name, rank: entry.rank || 1, qty: 1 });
      return { ok: true, message: name + ' — written into your Inventory at Rank ' +
        (entry.rank || 1) + '. The GM sets the materials and the time.' };
    },

    gearItemActions: (item) => (item && item.teaches)
      ? [{ id: 'learn', label: 'Read it — learn ' + item.teaches }]
      : [],


    // What ONE TAP on a Hotlist slot does. Three different things, and only the
    // pack knows which is which: a potion is drunk, a scroll is cast and then
    // spent, a weapon left in the Hotlist is simply rolled. Returning null means
    // the slot is not tappable and the keypad says so rather than guessing.
    //   roll  — a Skill or Spell name to roll
    //   spend — take one off the stack (and empty the slot at the last one)
    gearItemTap: (item, char) => {
      if (!item) return null;
      // A scroll casts the Spell written on it and is consumed doing so.
      if (item.casts) return { roll: item.casts, spend: true, label: 'Cast ' + item.casts };
      // A weapon you are not holding is not an attack you can make: the Attacks
      // list already refuses to offer one, and the Hotlist tap must not quietly
      // disagree with it by rolling a gun out of your backpack. Drawing it is
      // the Action the Hotlist is for, so that is what one tap does; the next
      // tap, with the thing in your hand, rolls it.
      const wpn = dccItemWeaponSkill(item);
      if (wpn && !dccItemInHand(item, char)) {
        return { equip: 'hands', roll: '', spend: false, label: 'Draw ' + (item.name || wpn) };
      }
      if (wpn) return { roll: wpn, spend: false, label: 'Roll ' + wpn };
      // A tool works as a Skill in the same way. Rolling it costs you nothing.
      if (item.skill) return { roll: item.skill, spend: false, label: 'Roll ' + item.skill };
      // A Spell or Skill you know, parked in the Hotlist so it is reachable
      // under pressure. Rolling it does not consume the slot.
      const known = dccHotlistKnown(char, item.name);
      if (known) return { roll: known, spend: false, label: 'Roll ' + known };
      // A tome is read, and reading it is exactly the kind of thing the Hotlist
      // is for. It used to return null here — "leave it to the detail panel" —
      // which made the key inert: tapping the tome you had put within reach did
      // nothing, and the panel behind a long-press did not offer to read it
      // either, so on a phone there was no way to read it at all.
      if (item.teaches) {
        return { act: 'learn', roll: '', spend: false, label: 'Read it — learn ' + item.teaches };
      }
      // Everything else that stacks is a consumable: potions, rations, ammo.
      return { roll: '', spend: true, label: 'Use ' + item.name };
    },

    gearItemAct: (action, item, char) => {
      if (action !== 'learn' || !item || !item.teaches) return { ok: false };
      const cat = dccSpellByName(item.teaches);
      char.blocks = char.blocks || {};
      char.blocks.spells = char.blocks.spells || { skills: [] };
      const have = char.blocks.spells.skills || [];
      if (have.some(x => String(x.name).toLowerCase() === String(item.teaches).toLowerCase())) {
        return { ok: false, message: 'You already know ' + item.teaches };
      }
      have.push({
        name: cat ? cat.name : item.teaches,
        rank: 1, stat: cat ? cat.stat : 'INT',
        checkType: cat ? cat.checkType : null,
        passive: false, source: 'tome', marked: false,
      });
      char.blocks.spells.skills = have;
      return { ok: true, remove: true };      // the tome is spent once read
    },

    // Skills your worn gear grants that you have no Ranks in. Without this a
    // "+3 Tracking" bow is invisible on a sheet with no Tracking Skill.
    wornSkills: (char) => {
      const eq = char && char.blocks && char.blocks.gear && char.blocks.gear.equipped;
      if (!eq) return [];
      const out = [];
      Object.keys(eq).forEach(function (slot) {
        (eq[slot] || []).forEach(function (it) {
          if (!it || !it.grantsSkill) return;
          const cat = dccSkillByName(it.grantsSkill);
          out.push({ name: cat ? cat.name : it.grantsSkill, stat: cat ? cat.stat : '', from: it.name });
        });
      });
      return out;
    },

    // Weapon and Spell upgrades unlock at Rank 5, 10 and 15. A crawler at Rank
    // 9 has the Rank 5 upgrade live and nothing has ever said so. Only what is
    // EARNED is returned: showing a Rank 15 upgrade to a Rank 9 crawler is an
    // invitation rather than information.
    activeUpgrades: (char, name) => {
      if (!name) return [];
      const cat = dccSkillByName(name) || dccSpellByName(name);
      if (!cat || !cat.upgrades) return [];
      let rank = 0;
      [(char && char.blocks && char.blocks.skills && char.blocks.skills.skills) || [],
       (char && char.blocks && char.blocks.spells && char.blocks.spells.skills) || []]
        .forEach(function (l) {
          l.forEach(function (x) {
            if (String(x.name).toLowerCase() === String(cat.name).toLowerCase()) {
              rank = Math.max(rank, x.rank || 0);
            }
          });
        });
      return Object.keys(cat.upgrades).map(Number)
        .filter(function (n) { return n <= rank; })
        .sort(function (a, b) { return a - b; })
        .map(function (n) { return { rank: n, text: cat.upgrades[String(n)] }; });
    },

    // What the gear you are WEARING adds. "Only what is in a Gear Slot gives
    // you anything" (p. 112), so a bonus is live exactly while the item is
    // equipped — stow it and the bonus goes with it.
    wornBonus: (char, kind, id) => {
      const eq = char && char.blocks && char.blocks.gear && char.blocks.gear.equipped;
      if (!eq) return 0;
      let n = 0;
      Object.keys(eq).forEach(function (slot) {
        (eq[slot] || []).forEach(function (it) {
          if (!it) return;
          if (kind === 'trait' && it.grantsStat === id) n += Number(it.grantsStatN) || 0;
          if (kind === 'skill' && it.grantsSkill &&
              String(it.grantsSkill).toLowerCase() === String(id).toLowerCase()) {
            n += Number(it.grantsSkillN) || 0;
          }
        });
      });
      return n;
    },

    gearTemplate: (name) => dccGearTemplate(name),

    gearSlotFor: (item) => {
      // The catalogue knows where its own things are worn: a ring is an
      // Accessory, a random piece of armour goes on your Torso.
      const row = (typeof dccGearByName === 'function') ? dccGearByName(item && item.name) : null;
      if (row && row.slot) return row.slot;
      // What it WORKS AS decides, not what it is called. Asking the name alone
      // sent a Club renamed "Tire Iron" to the first slot with room, which is
      // Head — while the HUD's Draw put the same weapon in your hands, so the
      // two surfaces disagreed about the same item.
      const name = (typeof dccItemSkillName === 'function') ? dccItemSkillName(item) : (item && item.name);
      const cat = name ? dccSkillByName(name) : null;
      if (cat && /Weapon|Hand-To-Hand/i.test(cat.category || '')) return 'hands';
      return '';
    },

    // What creation granted, so the sheet can put back anything deleted by
    // mistake without rebuilding the character.
    grantedSkills: char => dccFinalSkills(char),
    grantedSpells: char => dccStartingSpells(char),
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
    // "Only what is in a Gear Slot gives you anything" (p. 112), so armour in
    // the Hotlist or Inventory contributes nothing.
    dr: (char) => {
      let n = (char && char.dr) || 0;
      const eq = char && char.blocks && char.blocks.gear && char.blocks.gear.equipped;
      if (eq) {
        Object.keys(eq).forEach(function (slot) {
          (eq[slot] || []).forEach(function (it) { n += Number(it && it.dr) || 0; });
        });
      }
      return n;
    },
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
    // Rolling a raw Stat is a Stat Check — 10 + Floor, and no Skill Ranks added
    // (p. 123). Naming it here is what lets the roller switch the difficulty by
    // itself when you pick a Stat instead of a Skill; without it a Stat rolled
    // against the Unopposed number, which is six higher on Floor 3.
    statKind: 'stat',
    roll: dccRollD20,
    resolve: dccResolveCheck,
    difficulty: dccDifficulty,
    degrees: DCC_DEGREES,
  },

  // ─── content the shell can already use ────────────────────────────────────
  catalogs: {
    skills: DCC_SKILLS,
    spells: DCC_SPELLS,
    gear: DCC_GEAR,
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
      // The identity screen draws Human as the selected option when species is
      // unset, but its validator refused to continue until species was actually
      // written — so the button looked chosen and you had to press it anyway.
      species: 'human',
      name: '', crawlerNumber: 500000 + Math.floor(Math.random() * 12400000),
      race: '', class: '', level: 10,
      dr: 0, move: DCC_BASE_MOVE, step: DCC_BASE_STEP, size: 4,
      blocks: {},
    };
  },
});

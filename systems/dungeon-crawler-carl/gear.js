// systems/dungeon-crawler-carl/gear.js — the item catalogue.
//
// Source: DCC RPG Core Rulebook (Royal Court Edition), Renegade Game Studios.
// Page numbers are per row and are the page the item's MECHANICS are printed
// on, not the page it is first named on.
//
// SCOPE: the regular items — the mundane gear and consumables the book actually
// gives numbers for. That is the sample-loot lists by box tier (pp. 216–218),
// the starting-loot consumables (p. 116), the sample vehicles (Table 7, p. 72)
// and the soul crystal explosives (Table 75, p. 328).
//
// NOT here, deliberately:
//   - randomly generated magic items. Tables 38–42 GENERATE those from a d6 and
//     the loot tier; they are not a list of things, and creation.js already
//     carries the generator.
//   - the named sample and iconic gear (the Bitchass Buckler, Carl's Xistera,
//     the Night Wyrm set). Those are a catalogue of their own and want their
//     own pass, with their effects read one at a time.
//
// A row is an ITEM TEMPLATE: every key below the bookkeeping ones is a field
// the gear block already understands, so adding one from the catalogue is a
// copy rather than a translation. `effect` lands in the item's Note, which is
// what the readout prints, so a potion says what it does on the sheet, on the
// HUD keypad and on the printed page without any of them learning about
// potions.
//
// Extraction note: the markdown source is a damaged OCR (see PLAN.md §11).
// Wrapped table cells were rejoined by hand and every number below was read in
// context. Where the book's own wording is ambiguous it is quoted rather than
// interpreted — "one shot, no Mana casting" is the book's phrase.

const DCC_GEAR = [
  // ─── healing (pp. 116, 216–218) ──────────────────────────────────────────
  { id: 'healing-potion', name: 'Healing Potion', kind: 'consumable', tier: 'bronze',
    effect: 'Heals 5 Health Bar slots.', page: 216 },
  { id: 'good-healing-potion', name: 'Good Healing Potion', kind: 'consumable', tier: 'silver',
    effect: 'Heals 6 Health Bar slots.', page: 216 },
  { id: 'gold-standard-healing-potion', name: 'Gold Standard Healing Potion', kind: 'consumable', tier: 'gold',
    effect: 'Heals 7 Health Bar slots and mends one Minor Injury.', page: 216 },
  { id: 'supreme-healing-potion', name: 'Supreme Healing Potion', kind: 'consumable', tier: 'platinum',
    effect: 'Heals 8 Health Bar slots and mends one Minor or Major Injury; or deals 8d8 Holy damage to an undead Mob.',
    page: 217 },
  { id: 'heal-severe-injury-potion', name: 'Heal Severe Injury Potion', kind: 'consumable', tier: 'legendary',
    effect: 'Heals 9 Health Bar slots and mends all Injuries.', page: 218 },
  { id: 'heal-pet-potion', name: 'Heal Pet Potion', kind: 'consumable', tier: 'silver',
    effect: 'Heals a pet 5 Health Bar slots.', page: 216 },

  // ─── mana (pp. 111, 216–217) ─────────────────────────────────────────────
  { id: 'mana-potion', name: 'Mana Potion', kind: 'consumable', tier: 'bronze',
    effect: 'Fully restores your Mana.', page: 216 },
  { id: 'standard-mana-potion', name: 'Standard Mana Potion', kind: 'consumable', tier: 'bronze',
    effect: 'Fully restores your Mana when you spend an Action to drink it. A crawler who takes a Spell as their combat Skill starts with five.',
    page: 111 },
  { id: 'good-mana-refill-potion', name: 'Good Mana Refill Potion', kind: 'consumable', tier: 'platinum',
    effect: 'Restores 15 Mana per round for 10 rounds.', page: 217 },

  // ─── permanent Skill potions (pp. 116, 216–218) ──────────────────────────
  { id: 'potion-skill-1', name: 'Potion of +1 Skill', kind: 'consumable', tier: 'silver',
    effect: 'Permanent. Choose a Skill and gain 1 Rank in it.', page: 216 },
  { id: 'potion-skill-2', name: 'Potion of +2 Skill', kind: 'consumable', tier: 'gold',
    effect: 'Permanent. Choose a Skill and gain 2 Ranks in it.', page: 216 },
  { id: 'potion-skill-3', name: 'Potion of +3 Skill', kind: 'consumable', tier: 'platinum',
    effect: 'Permanent. Choose a Skill and gain 3 Ranks in it.', page: 116 },
  { id: 'potion-skill-5', name: 'Potion of +5 Skill', kind: 'consumable', tier: 'legendary',
    effect: 'Permanent. Choose a Skill and gain 5 Ranks in it.', page: 218 },
  { id: 'potion-skill-max', name: 'Potion that Maxes Out a Skill', kind: 'consumable', tier: 'celestial',
    effect: 'Permanent. Choose a Skill and max it out.', page: 218 },

  // ─── first aid and food (pp. 90, 116, 216) ───────────────────────────────
  { id: 'bandage', name: 'Bandage', kind: 'consumable', tier: 'bronze',
    effect: 'Spend an Action to remove the Blood Trail Debuff.', page: 116 },
  { id: 'poison-antidote', name: 'Poison Antidote', kind: 'consumable', tier: 'silver',
    effect: 'Treats the Poisoned Debuff, which otherwise keeps dealing 1d8+F Poison damage each round.', page: 116 },
  { id: 'crawler-biscuit', name: 'Crawler Biscuit', kind: 'consumable', tier: 'silver',
    effect: 'Crawler rations. Silver boxes hand them out a hundred at a time.', page: 216 },
  { id: 'mana-toast', name: 'Mana Toast', kind: 'consumable',
    effect: 'Saferoom food that restores Mana.', page: 88 },

  // ─── light, rope, paper (pp. 116, 216) ───────────────────────────────────
  { id: 'torch', name: 'Torch', kind: 'tool', tier: 'bronze',
    effect: 'Bright light for 20 feet and dim light for another 20. Burns out in about an hour.', page: 116 },
  { id: 'rope', name: 'Rope', kind: 'tool', tier: 'bronze',
    effect: '50 feet.', page: 216 },
  { id: 'magic-paper', name: 'Magic Paper', kind: 'tool', tier: 'silver',
    effect: 'For scroll-writing. Writing a scroll takes Calligraphy (Table 45).', page: 216 },

  // ─── scrolls and books (pp. 98, 216–218) ─────────────────────────────────
  // `casts` and `teaches` are left for the player: the book says "a weak Spell"
  // and "a new Spell" rather than naming one, and the ⋯ panel is where you say
  // which. Setting them here would invent a Spell the book did not print.
  { id: 'spell-scroll', name: 'Spell Scroll', kind: 'book', tier: 'bronze',
    effect: 'One shot, no Mana casting. Cast the Spell written on it even with no Ranks in that Spell.', page: 216 },
  { id: 'rare-spell-scroll', name: 'Rare Spell Scroll', kind: 'book', tier: 'legendary',
    effect: 'One shot, no Mana casting, of a rare Spell.', page: 218 },
  { id: 'magic-tome', name: 'Magic Tome', kind: 'book', tier: 'bronze',
    effect: 'Read it to learn a new, weak Spell.', page: 216 },
  { id: 'spellbook', name: 'Spellbook', kind: 'book', tier: 'silver',
    effect: 'Read it to learn the Spell it holds, at a Rank the book decides.', page: 98 },
  { id: 'rare-spellbook', name: 'Rare Spellbook', kind: 'book', tier: 'legendary',
    effect: 'Read it to learn a rare Spell.', page: 218 },
  { id: 'scroll-of-upgrade', name: 'Scroll of Upgrade', kind: 'book', tier: 'gold',
    effect: "Upgrades a crawler's signature weapon. Roll on Table 26 for the effect.", page: 216 },

  // ─── explosives (pp. 116, 216, 328) ──────────────────────────────────────
  { id: 'basic-dynamite', name: 'Stick of Basic Dynamite', kind: 'explosive', tier: 'bronze',
    effect: '1d6 Bludgeoning damage, 0ft Blast radius +5ft Splash.', page: 216 },
  { id: 'goblin-dynamite', name: 'Stick of Good Goblin Dynamite', kind: 'explosive', tier: 'silver',
    effect: '2d6 Bludgeoning damage, 5ft Blast radius +5ft Splash.', page: 116 },
  // Table 75. F is the Floor Number, as everywhere else in the book.
  { id: 'soul-crystal-a', name: 'A-Grade Soul Crystal', kind: 'explosive',
    effect: 'Fd20+F Force damage when it goes off.', page: 328 },
  { id: 'soul-crystal-b', name: 'B-Grade Soul Crystal', kind: 'explosive',
    effect: 'Fd12+F Force damage when it goes off.', page: 328 },
  { id: 'soul-crystal-c', name: 'C-Grade Soul Crystal', kind: 'explosive',
    effect: 'Fd10+F Force damage when it goes off.', page: 328 },
  { id: 'soul-crystal-d', name: 'D-Grade Soul Crystal', kind: 'explosive',
    effect: 'Fd8+F Force damage when it goes off.', page: 328 },
  { id: 'soul-crystal-e', name: 'E-Grade Soul Crystal', kind: 'explosive',
    effect: 'Fd6+F Force damage when it goes off.', page: 328 },

  // ─── scratcher tickets (p. 218) ──────────────────────────────────────────
  { id: 'scratcher-medicine-or-lube', name: 'Medicine or Lube? Scratcher', kind: 'consumable', tier: 'platinum',
    effect: 'As an Action in combat, roll 1d2. On a 1 a target within 20 feet is covered in lube and gains the Staggered Debuff; on a 2 they are affected by a Level 15 Heal Other. Cooldown 30 minutes.',
    page: 218 },
  { id: 'scratcher-nebular-roulette', name: 'Nebular Roulette Scratcher', kind: 'consumable', tier: 'platinum',
    effect: 'As an Action in combat, roll 1d6. On a 1 you take 2d12+F Electric damage; on a 2–6 the target does. Cooldown 30 minutes.',
    page: 218 },

  // ─── worn, generic (pp. 216–217) ─────────────────────────────────────────
  // The book describes these by what they give rather than by what they are:
  // "a random piece of armor with +1 Damage Resistance". The Stat and the Skill
  // they raise are the player's to pick, so the amount is filled in and the
  // choice is left open in the ⋯ panel.
  { id: 'armor-plus-1', name: 'Random Piece of Armor', kind: 'armor', tier: 'bronze',
    slot: 'torso', dr: 1, effect: '+1 Damage Resistance.', page: 216 },
  { id: 'silver-ring-stat', name: 'Silver Ring of +2 to a Stat', kind: 'accessory', tier: 'silver',
    slot: 'accessories', grantsStatN: 2, effect: '+2 to a Stat of your choice.', page: 216 },
  { id: 'golden-ring-stat', name: 'Golden Ring of +3 to a Stat', kind: 'accessory', tier: 'gold',
    slot: 'accessories', grantsStatN: 3, effect: '+3 to a Stat of your choice.', page: 216 },
  { id: 'interesting-item-stat', name: 'Interesting Item of +4 to a Stat', kind: 'accessory', tier: 'platinum',
    slot: 'accessories', grantsStatN: 4, effect: '+4 to a Stat of your choice.', page: 217 },

  // ─── vehicles (Table 7, p. 72) ───────────────────────────────────────────
  // Move, Size, DR and Occupancy as printed. A vehicle is not worn, so it takes
  // no Gear Slot; it is in the catalogue because the loot lists hand them out.
  { id: 'skateboard', name: 'Skateboard', kind: 'vehicle',
    effect: 'Move 30 · Size 2 · DR 0 · carries 1.', page: 72 },
  { id: 'bicycle', name: 'Bicycle', kind: 'vehicle', tier: 'bronze',
    effect: 'Move 40 · Size 3 · DR 0 · carries 1–2.', page: 72 },
  { id: 'motorcycle', name: 'Motorcycle', kind: 'vehicle',
    effect: 'Move 120 · Size 4 · DR 1 · carries 1–2.', page: 72 },
  { id: 'sportscar', name: 'Sportscar', kind: 'vehicle',
    effect: 'Move 100 · Size 5 · DR 2 · carries 2.', page: 72 },
  { id: 'sedan', name: 'Mid-Sized Sedan', kind: 'vehicle',
    effect: 'Move 80 · Size 5 · DR 3 · carries 5–6.', page: 72 },
  { id: 'large-truck', name: 'Large Truck', kind: 'vehicle',
    effect: 'Move 70 · Size 6 · DR 4 · carries 3, plus 5 in the cargo bed.', page: 72 },
  { id: 'eighteen-wheeler', name: '18-Wheeler', kind: 'vehicle',
    effect: 'Move 60 · Size 7 · DR 4 · carries 4, plus 50 in the trailer.', page: 72 },
  { id: 'tank', name: 'Tank', kind: 'vehicle',
    effect: 'Move 50 · Size 6 · DR 10 · carries 4.', page: 72 },
  // The book says "(Staff)"; the Skill it means is Quarterstaff, which is what
  // the Skill catalogue calls it. The validator caught the difference.
  { id: 'canoe', name: 'Canoe and Paddle', kind: 'vehicle', tier: 'bronze',
    effect: 'The paddle works as a Staff.', skill: 'Quarterstaff', page: 216 },
  { id: 'hang-glider', name: 'Hang Glider', kind: 'vehicle', tier: 'bronze',
    effect: 'Bronze-box flight, such as it is.', page: 216 },
];

// The keys above that are BOOKKEEPING rather than item data. Everything else on
// a row is a field the gear block understands, so the template is "the row,
// minus these".
const DCC_GEAR_META_KEYS = ['id', 'kind', 'tier', 'page', 'effect', 'slot'];

function dccGearByName(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  return DCC_GEAR.filter(function (g) { return g.name.toLowerCase() === n; })[0] || null;
}

// One catalogue row as an item you are carrying. The book's mechanics go into
// the Note, which is what every readout already prints — so a Healing Potion
// says "Heals 5 Health Bar slots" on the sheet, on the HUD keypad and on paper
// without any of those learning what a potion is.
function dccGearTemplate(name) {
  const row = dccGearByName(name);
  if (!row) return null;
  const out = { name: row.name, qty: 1 };
  Object.keys(row).forEach(function (k) {
    if (DCC_GEAR_META_KEYS.indexOf(k) >= 0) return;
    if (k === 'name') return;
    out[k] = row[k];
  });
  if (row.effect) out.notes = row.effect;
  return out;
}

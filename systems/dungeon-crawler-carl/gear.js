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
// The named gear — the samples printed with each loot tier, the Night Wyrm
// artifacts and Appendix 1's iconic gear from the novels — follows the regular
// items below, under its own heading.
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
  // ═══════════════════════════════════════════════════════════════════════
  // NAMED GEAR
  //
  // The sample magical gear printed with each loot tier (pp. 216-218), the
  // Night Wyrm artifacts (p. 326) and Appendix 1: Iconic Gear (pp. 633-638) —
  // the gear from the novels, which the book offers "to use as-is, or modify".
  //
  // These are one-off items rather than stock, so most of what they do is
  // prose. What the sheet can actually COMPUTE is lifted into fields — DR, a
  // flat Stat bonus, a Skill bonus, a resistance, the Skill a weapon swings
  // with — and the rest stays in `effect`, printed verbatim under the item.
  // Percentage bonuses (+5% Strength), Buffs, cooldowns and once-per-floor
  // powers have no home in the sheet's numbers and are deliberately left as
  // text rather than approximated into a number that would then be wrong.
  //
  // Two Skills these items grant — Rooted in Place and Marked for Death — are
  // not in the Skill catalogue, because the book grants them THROUGH the item
  // rather than listing them. They stay in the text: the catalogue only links
  // what resolves, and a test enforces that.

  // ─── sample magical gear, silver boxes (p. 216) ──────────────────────────
  { id: 'bitchass-buckler', name: 'Bitchass Buckler', kind: 'magic', tier: 'silver',
    slot: 'hands', dr: 3, grantsSkill: 'Shield Block', grantsSkillN: 1,
    page: 216 },
  { id: 'bernie-boots', name: 'Bernie Boots', kind: 'magic', tier: 'silver', slot: 'feet',
    effect: 'When you gain the Dying Debuff you can still take Move Actions and read HUD messages about moving in a direction.',
    page: 216 },
  { id: 'big-purple-plume', name: 'Big Purple Plume', kind: 'magic', tier: 'silver',
    slot: 'accessories', grantsStat: 'CHA', grantsStatN: 2, effect: '', page: 216 },
  { id: 'friendship-bracelet', name: 'Friendship Bracelet of [Race]kind', kind: 'magic', tier: 'silver',
    slot: 'accessories',
    effect: 'Roll 1d10 for the Race: 1-2 dwarven, 3-4 elven, 5-6 fairy, 7-8 orc, 9-10 skyfowl. Mobs and NPCs of that Race are no longer automatically hostile and can be bargained with. Take it off or break it and they are automatically hostile for the rest of the Floor.',
    page: 216 },

  // ─── gold boxes (p. 216) ─────────────────────────────────────────────────
  { id: 'elbow-pads-turkeys', name: 'Enchanted Elbow Pads of the Elbow Walking Turkeys', kind: 'magic', tier: 'gold',
    slot: 'arms', dr: 2, grantsStat: 'DEX', grantsStatN: 2,
    page: 216 },
  { id: 'skullcap-of-sucking', name: 'Skullcap of Sucking', kind: 'magic', tier: 'gold',
    slot: 'head', dr: 1,
    effect: 'Each time you roll a Critical Fail, gain 1 AI Favor.', page: 216 },
  { id: 'tough-guy-tattoo', name: 'Tough Guy Tattoo', kind: 'magic', tier: 'gold',
    slot: 'accessories', grantsStat: 'CON', grantsStatN: 3,
    effect: 'Add 10 to your 100% Health Bar slot.', page: 216 },

  // ─── platinum boxes (pp. 217-218) ────────────────────────────────────────
  { id: 'selfie-stick', name: 'Selfie Stick of the Self-Mutilator', kind: 'magic', tier: 'platinum',
    slot: 'hands',
    effect: 'You have one fewer Health Bar slot while holding it. Enter combat with a Minor Injury and gain 1 Popularity, or 2 for a Major Injury — and an equal number of Actions each round of that combat.',
    page: 218 },
  { id: 'chesty-cheese-grater', name: 'Chesty Cheese Grater', kind: 'magic', tier: 'platinum',
    slot: 'torso', dr: 2,
    effect: '+5% Constitution. Damage Reflection 3:1 against melee attacks — for every 3 Health Bar slots you lose, the attacker loses 1.',
    page: 218 },
  { id: 'leggings-of-insanity', name: 'Enchanted Leggings of Insanity', kind: 'magic', tier: 'platinum',
    slot: 'legs', dr: 1, grantsSkill: 'Escape Artist', grantsSkillN: 3,
    effect: 'You may fit your body south of your wedding tackle into any sized opening.',
    page: 218 },

  // ─── legendary boxes (p. 218) ────────────────────────────────────────────
  { id: 'cloak-slippery-perv', name: 'Enchanted Cloak of the Slippery Perv', kind: 'magic', tier: 'legendary',
    slot: 'accessories', grantsStat: 'CHA', grantsStatN: 6,
    effect: '+3 Evade Buff when you accuse your attacker of wanting to penetrate you in a way you have not used before.',
    page: 218 },
  { id: 'wand-of-incontinence', name: 'Enchanted Wand of Incontinence', kind: 'magic', tier: 'legendary',
    slot: 'hands',
    effect: '+10% Constitution. Once per session, as an Action, a creature within 30 feet voids their bowels and gains the Fatigued Debuff.',
    page: 218 },
  { id: 'hand-grips-hella-holding', name: 'Hand Grips of Hella Holding', kind: 'magic', tier: 'legendary',
    slot: 'hands', dr: 3,
    effect: '+10% Strength. When you grab hold of something you do not let go until you wish to, short of divine intervention.',
    page: 218 },

  // ─── celestial boxes (p. 218) ────────────────────────────────────────────
  { id: 'borant-reset-button', name: 'Borant Corporation Reset Button', kind: 'magic', tier: 'celestial',
    slot: 'accessories',
    effect: 'Must be attached to clothing. Once per floor, restart the current scene up to 10 minutes into it. In combat it must be used in the first round.',
    page: 218 },
  { id: 'beret-divine-intervention', name: 'Beret of Divine Intervention', kind: 'magic', tier: 'celestial',
    slot: 'head',
    effect: 'Choose a Skill and max it out at Rank 15. In the presence of a deity, double your personal rewards; in the presence of your own deity, triple them.',
    page: 218 },
  { id: 'sassy-stiletto', name: 'The Sassy Stiletto', kind: 'magic', tier: 'celestial',
    slot: 'hands', skill: 'Dagger', grantsSkill: 'Dagger', grantsSkillN: 15,
    effect: '+5 to all Stats. Critical Hits on a Natural 16-20. The dagger is intelligent and makes Look for Clues Checks for you at no Action cost with 10 Ranks of Perception.',
    page: 218 },

  // ─── the Night Wyrm artifacts (p. 326) ───────────────────────────────────
  // A plot set. What they do unfolds over pp. 325-327, so the row says what it
  // is and where to read the rest rather than trying to hold a subplot.
  { id: 'night-wyrm-links', name: "Enchanted Night Wyrm's Links of Implacable Sorrow", kind: 'magic',
    slot: 'accessories',
    effect: 'A seamless onyx bracelet of the Night Wyrm devouring its own tail. Marks a hunting party; the Wyrm devours a segment for each marked target that dies, and a completion bonus follows the whole party dying. See pp. 325-327.',
    page: 326 },
  { id: 'night-wyrm-necklace', name: "Enchanted Night Wyrm's Necklace of Indelible Woe", kind: 'magic',
    slot: 'head',
    effect: 'Its Debuff makes you take damage equal to a Spell\'s Mana cost whenever you cast. Marking a target costs you one of your lowest-Rank Spells at random; if that target dies you gain one of their five highest instead. See pp. 325-327.',
    page: 326 },
  { id: 'night-wyrm-ring', name: "Enchanted Night Wyrm's Ring of Divine Suffering", kind: 'magic',
    slot: 'accessories',
    effect: '+1 to all Skill or Stat Checks. Grants the Marked for Death Skill (p. 325); marked targets gain the Marked for Death Debuff, and the ring prevents you from healing. See pp. 325-327.',
    page: 326 },

  // ─── Appendix 1: Iconic Gear (pp. 633-638) ───────────────────────────────
  { id: 'anklet-fallen-oak', name: 'Anklet of the Fallen Oak', kind: 'magic',
    slot: 'accessories', grantsSkill: 'Double Tap', grantsSkillN: 3,
    effect: '+1 Dexterity. +1 Constitution.', page: 633 },
  { id: 'carls-xistera', name: "Carl's Xistera", kind: 'magic', slot: 'hands',
    effect: 'A non-magical wicker scoop for Cesta Punta. Multiplies your Throwing Skill range by 4 for anything thrown with it, retracts on a pull-ring, and Inventory items may be summoned into the basket as an Action.',
    page: 633 },
  { id: 'kerchief-of-disorder', name: "Drakea's Enchanted Kerchief of Disorder", kind: 'magic',
    slot: 'accessories', grantsSkill: 'Detect Trap', grantsSkillN: 5,
    effect: 'Cast a Rank 15 Tripper Spell once every 5 hours. Worn at the neck, in the hair or over the face.',
    page: 633 },
  { id: 'earth-upgrade-patch', name: 'Earth Upgrade Patch', kind: 'magic', slot: 'accessories',
    effect: '+5% Strength. Immunity to Cone Area of Effect Attacks. Affix to an eligible garment; removing it destroys it.',
    page: 633 },
  { id: 'anarchists-battle-rattle', name: "Enchanted Anarchist's Battle Rattle", kind: 'magic', slot: 'torso',
    effect: '+1 to all five Stats, and another +1 for each compatible patch added — doubled if an eligible Back Patch is added. Access to the Desperado Club and the Naughty Boys Employment Agency. +50% Throwing range and DEX Mod a second time to hit with thrown explosives. +5 Accessory Gear Slots.',
    page: 633 },
  { id: 'bigboi-boxers', name: 'Enchanted BigBoi Boxers', kind: 'magic', slot: 'legs',
    grantsStat: 'CON', grantsStatN: 2,
    effect: 'Cast a Rank 15 Protective Shell Spell once every 30 hours. Always fits.',
    page: 634 },
  { id: 'crown-sepsis-whore', name: 'Enchanted Crown of the Sepsis Whore', kind: 'magic', slot: 'head',
    effect: 'Wearing it permanently places you in the line of succession for the Blood Sultanate. For its benefits in play see p. 238.',
    page: 634 },
  { id: 'fur-brush-ecclesiastic', name: 'Enchanted Fur Brush of the Ecclesiastic', kind: 'magic',
    grantsStat: 'CON', grantsStatN: 2,
    effect: 'Must be used by someone other than the target; 10 minutes of brushing imparts the Buff for 30 hours.',
    page: 634 },
  { id: 'pedicure-kit-sylph', name: 'Enchanted Pedicure Kit of the Sylph', kind: 'magic',
    grantsSkill: 'Smush', grantsSkillN: 3,
    effect: '15 minutes of use, then 30 hours barefoot: add your STR Mod a second time to Foot Soldier Attack damage, feet and toes cannot be broken or severed, and traps set off by your footfalls raise an alarm and delay 5 seconds.',
    page: 634 },
  { id: 'nightgaunt-cloak', name: 'Enchanted Nightgaunt Cloak of Stoutness', kind: 'magic',
    slot: 'accessories', grantsStat: 'CON', grantsStatN: 4, resist: 'Poison and Ice',
    effect: 'Adds Anti-Piercing to all worn armour. Nightgaunts will not be pleased.',
    page: 634 },
  { id: 'repeating-crossbow-scavenger', name: 'Enchanted Repeating Crossbow of the Scavenger Mother of Mothers',
    // "Gear Slot: Hand/Holding (requires two hands)" — the book says it on this
    // one item as well as on the Crossbow Skill.
    kind: 'magic', slot: 'hands', hands: 2, skill: 'Crossbow', grantsStat: 'DEX', grantsStatN: 15,
    effect: 'Two hands, and only a female may wield it. Never runs out of basic ammunition. +10 Strength. Spend 1 AI Favor for an extra Attack each round. Add your STR to damage, plus 1 for every female in your party to a maximum of +30. On Success the target gains the Birth Defect Debuff.',
    page: 635 },
  { id: 'never-ending-duct-tape', name: 'Enchanted Roll of Never-Ending Duct Tape', kind: 'magic',
    effect: '50 metres of ordinary-looking grey duct tape that regenerates a metre an hour until it is whole again.',
    page: 636 },
  { id: 'riot-shield', name: 'Enchanted Shade Gnoll Riot Forces Crowd Control Shield', kind: 'magic',
    slot: 'hands',
    effect: 'Only for those with a physical Line Attack — with no DR it is useless to anyone else. +5% Constitution. +5 Rooted in Place Skill (Passive): reduce feet pushed, pulled, slid or thrown by your Rank. Crowd Blast adds +5ft Splash to each side of your Line Attack, though each victim in the Splash has Advantage to Evade.',
    page: 636 },
  { id: 'riot-baton', name: 'Enchanted Shade Gnoll Riot Forces Telescoping Crowd Control Baton', kind: 'magic',
    slot: 'hands', skill: 'Club',
    effect: 'A single-handed Club that adjusts from 10 inches to 3½ feet. On a Club Attack with 10+ Mobs around you, make a free Rank 5 Cone of Knockback Spell Attack in a 20ft Cone; on Success the group is pushed or slid 10 feet. Cooldown 5 minutes.',
    page: 636 },
  { id: 'spiked-kneepads', name: 'Enchanted Spiked Kneepads of the Shade Gnoll Riot Forces', kind: 'magic',
    slot: 'legs',
    effect: 'Damage Reflection 8:1 — lose 8 or more Health Bar slots in one blow and the attacker loses 1. Immunity to momentum-based Attacks (Rush, Trample, Ramming).',
    page: 636 },
  { id: 'tiara-mana-genita', name: 'Enchanted Tiara of Mana Genita', kind: 'magic', slot: 'head',
    grantsStat: 'INT', grantsStatN: 3, grantsSkill: 'Acute Ears', grantsSkillN: 2,
    effect: 'Removes automatic hostility from worshipers of Mana Genita.',
    page: 636 },
  { id: 'trollskin-shirt', name: 'Enchanted Trollskin Shirt of Pummeling', kind: 'magic', slot: 'torso',
    grantsSkill: 'Regeneration', grantsSkillN: 7,
    effect: 'Immunity to melee damage Debuffs. Cool to the touch.', page: 636 },
  { id: 'war-gauntlet-grull', name: 'Enchanted War Gauntlet of the Exalted Grull', kind: 'magic',
    slot: 'hands', grantsStat: 'STR', grantsStatN: 3, grantsSkill: 'Iron Punch', grantsSkillN: 2,
    effect: '+1 Dexterity. +1 Powerful Strike Skill. On an Amazing Success with any Hand-to-Hand Attack the target gains the Stunned Debuff; on a Critical Hit against a worshiper of Grull, the target transforms into the deity.',
    page: 636 },
  { id: 'wrestling-belt-gorgo', name: 'Enchanted Wrestling Belt of the Great Gorgo', kind: 'magic',
    slot: 'accessories',
    effect: '+5% Strength. +5% Constitution. The Avalanche Benefit: a Move Action followed immediately by an Unarmed Combat Attack deals double total damage on Success — a Monster Truck Driver applies it to their Area Line Attack instead.',
    page: 637 },
  { id: 'prism-goggles-donut', name: 'Prism Industries Capacitating and Focusing Goggles, "The Princess Donut"',
    kind: 'magic', slot: 'head',
    effect: 'Immunity to the Blindness Debuff. Enhances vision and calibrates to visible-light spectra including heat. Cast Magic Missile twice with one Action, paying Mana as usual and rolling to hit twice; or with two Actions and double the Mana for double damage.',
    page: 636 },
  { id: 'seize-the-day-toothpaste', name: 'Seize the Day Toothpaste', kind: 'consumable',
    effect: 'Cherry-flavoured, comes with a toothbrush, 5 applications. The Buff lasts 30 hours: triple damage to all Bosses, or quadruple against Province or higher.',
    page: 637 },
  { id: 'stuffed-kimaris-figure', name: 'Stuffed Kimaris Figure', kind: 'consumable',
    effect: 'Pull the tag and it summons the creature it depicts as a minion at your own level, fighting for you unbidden. Use the Mob vs. Mob rules (p. 83). Duration follows rarity: a common one lasts 1d2+1 rounds. Once it times out it returns to its collectible form and cannot be used again.',
    page: 636 },
  { id: 'ring-water-breathing', name: 'Ring of Water Breathing', kind: 'magic', slot: 'accessories',
    grantsStat: 'CHA', grantsStatN: -1,
    effect: 'You can breathe underwater, and on land.', page: 637 },
  { id: 'scratcher-fireball-or-custard', name: 'Fireball or Custard? Scratcher', kind: 'consumable',
    effect: 'Five scratch-off spots, each a 50/50 chance of a level 15 Fireball or a beach-ball of healing custard onto the target. 30-minute cooldown.',
    page: 637 },
  { id: 'scratcher-dungeon-gold-rush', name: 'Dungeon Gold Rush Scratcher', kind: 'consumable',
    effect: 'Six prize slots and two dozen outcomes, among them a 5,000-coin Mob drop, doubled damage against the Mob, the Mob splitting in two, and the Mob becoming invulnerable for 30 seconds. One-hour cooldown.',
    page: 637 },
];

// The keys above that are BOOKKEEPING rather than item data. Everything else on
// a row is a field the gear block understands, so the template is "the row,
// minus these".
// `kind` is NOT bookkeeping: it travels with the item, because it is what the
// editor shapes itself around later and what a hundred-row catalogue is
// filtered by. The rest — where the row came from and where it is printed —
// stays in the pack.
const DCC_GEAR_META_KEYS = ['id', 'tier', 'page', 'effect', 'slot'];

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

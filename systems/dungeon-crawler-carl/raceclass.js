// systems/dungeon-crawler-carl/raceclass.js — Races and Classes (D6).
//
// Source: DCC RPG Core Rulebook, pp. 128-158. 30 Races and 52 Classes.
//
// COUNT. The back-cover blurb advertises "30 races and 49 classes". The
// Races match exactly. The chapter contains 52 Class entries, each with its own
// 'Class Type:' line, so 52 is what is here; the blurb appears to be approximate.
//
// NAMES came from font metadata, not text shape: the book sets every entry name
// in CitrusGothic 13pt, and nothing else on the page does. Shape cannot tell a
// name from a bullet continuation, and the display font drops doubled letters,
// so 13 names needed repair. Every repair was confirmed against an independent
// mention elsewhere in the book before being written here. None was guessed.
//
// needsReview: the PDF carries a clipped duplicate text layer that most filters
// remove, but 12 entries still have at least one benefit line that is merged or
// truncated. Their Stats, Size and Skill grants parsed cleanly; the free-text
// benefits may be incomplete. Those entries carry needsReview and a page number,
// and the UI says so rather than pretending the text is whole.

const DCC_RACES = [
  { id: 'amazonian', name: 'Amazonian', size: { name: 'Medium', n: 4 }, stats: { DEX: 3, STR: 6 }, skills: [{ skill: 'Bow', rank: 2 }, { skill: 'Endurance', rank: 2 }, { skill: 'Pugilism', rank: 2 }], prerequisites: 'This limited Race is only available to crawlers who have at least one Strength or Dexterity-based Skill at Rank 5+', page: 129, needsReview: true,
    benefits: ['+2 DR'] },
  { id: 'arachnid', name: 'Arachnid', size: { name: 'Medium', n: 4 }, stats: { DEX: 5 }, page: 129, needsReview: true,
    benefits: ['+3 Web Spell, which costs half the normal', 'You have an innate Climb normal Move value, without needing Checks (unless under duress)'] },
  { id: 'cat', name: 'Cat', size: { name: 'Small', n: 2 }, stats: { CHA: 1, CON: 2, DEX: 4 }, skills: [{ skill: 'Slice Attack', rank: 2 }], prerequisites: 'This limited Race is only available to crawlers who are already a Cat', page: 130,
    benefits: ['3 Strength', '+3 Cat-like Reflexes', 'Can see in total darkness', 'Advantage on Cat-like', 'Nine Lives: Take half damage from the first 9 attacks each day', 'Vulnerability: Take double damage from Dogs and Beasts'] },
  { id: 'cat-girl-cat-boy', name: 'Cat Girl/Cat Boy', size: { name: 'Medium', n: 4 }, stats: { CHA: 3, DEX: 3 }, page: 130,
    benefits: ['2 Constitution', '+2 Cat-like Reflexes, Good First Impression, Light on your Feet, and Slice Attack Skills', 'Your Slice Attacks may add your CHA Mod to the damage instead of STR ancient Egypt. at-like ecks half damage from the first 9 attacks', 'Toxoplasma G.: Once per day, your allies have Rank round to protect only you from attacks about to hit you. Those who do gain 1 AI Favor', 'When dealing with felines other than Cat Girls/ sad a tage'] },
  { id: 'changbi-demon', name: 'Changbi Demon', size: { name: 'Medium', n: 4 }, stats: { CON: 3, DEX: 5, STR: 3 }, page: 130,
    benefits: ['2 Charisma', '+3 Ambush and Creepy Chains (Club) Skills', 'Creepy Chains: Can use any chain as a weapon (use the Club Weapon Skill, but with a 10ft range). A by 50% once per scene', 'Each time a foe touches a Changbi Demon with their bare skin (such as with Hand-to-Hand attacks), that foe takes 1d4+F Acid', 'No need to breathe', 'Vulnerable to Holy damage', 'Cannot worship a deity'] },
  { id: 'changeling', name: 'Changeling', size: { name: 'Large', n: 5 }, stats: { CHA: 3, INT: 2 }, skills: [{ skill: 'Ambush', rank: 2 }, { skill: 'Deception', rank: 2 }, { skill: 'Escape Artist', rank: 1 }], page: 130, needsReview: true,
    benefits: ['Advantage on Deception Skill Checks when no talking is needed', 'Changelings gain free access to organizations and producers by impersonating other crawlers and relevant to the currently shifted individual', 'While shapeshifted into another to World Dungeon systems, including information on viewers\' systems', 'based Checks apeshifted into another se changes are conveyed information on viewers\' ini-maps, and other tures. hat'] },
  { id: 'crocodilian', name: 'Crocodilian', size: { name: 'Large', n: 5 }, stats: { CON: 3, STR: 4 }, page: 131,
    benefits: ['+2 Pugilism and Powerful', 'When physically menacing someone in person, roll', '+3 DR Buff', '+1 Buff for all of your Skill full meal', 'While you have the Fatigued'] },
  { id: 'doppelg-nger', name: 'Doppelgänger', stats: { CON: 4, STR: 3 }, skills: [{ skill: 'Deception', rank: 1 }, { skill: 'Endurance', rank: 1 }], page: 131, needsReview: true,
    benefits: ['Size: Unchanged, but size changes when shifting', '+2 DR', 'Advantage on Escape Artist Skill while being Held or watched', 'Once per scene, as an Action, you can incorporate a held weapon into their mass to deal additional damage equal to their CON Mod. Items incorporated this way can\'t be disarmed'] },
  { id: 'dwarf-classic', name: 'Dwarf, Classic', size: { name: 'Medium', n: 4 }, stats: { CON: 4, INT: 2 }, skills: [{ skill: 'Endurance', rank: 2 }], rank20: ['All crafting Skills can be raised to Rank 20'], page: 132,
    benefits: ['2 Charisma', '+3 in two different crafting Skills of your choice', 'Can see in total darkness', 'When dealing with elves or fairies, make all'] },
  { id: 'dwarf-fathom', name: 'Dwarf, Fathom', size: { name: 'Medium', n: 4 }, stats: { CON: 3, STR: 2 }, skills: [{ skill: 'Engineering', rank: 3 }, { skill: 'Dumpster Diving', rank: 2 }, { skill: 'Salvage', rank: 2 }], page: 132,
    benefits: ['Roll d20 Checks with Advantage when earth, rocks, and dirt are involved', 'Can produce a 15ft Cone of light from a harmless lizard nesting atop their heads, and can easily acquire a new lizard if the existing one is lost or killed'] },
  { id: 'elf-high', name: 'Elf, High', size: { name: 'Medium', n: 4 }, skills: [{ skill: 'Lore', rank: 1 }], page: 133, needsReview: true,
    benefits: ['eared atural hey t groves, er many to form workshops, is effortless y to make Elves well buckle up, ey\'re even worse s Earth stories untless authors\' mselves the better ces, particularly b in the ground like not being jerks is Race ensures arm, and a lywood starlets ace makes an d, or anyone else get their hands h, effort.', '+2 Intimidation Skill, and you can use your CHA', 'You recover Mana at twice the normal rate in a natural environment', 'Add 1d4 to your Evade Checks', 'When dealing with Dwarves, Rat-Kin, or anyone smelly or dirty, make all Charisma-based Checks with Disadvantage'] },
  { id: 'elf-city', name: 'Elf, City', size: { name: 'Medium', n: 4 }, skills: [{ skill: 'Good First Impression', rank: 3 }, { skill: 'Negotiation', rank: 2 }, { skill: 'Streetwise', rank: 2 }], page: 133,
    benefits: ['+6 to split as you please between Intelligence,', 'Once per floor during a Long Rest, a City Elf can adjust the +4 spent between Charisma, Intelligence, and Dexterity, reassigning those points between those Stats', 'When entering a settlement for the first time, make your first Charisma-based Check with Advantage. permanent contact permanent contact'] },
  { id: 'elf-night', name: 'Elf, Night', size: { name: 'Medium', n: 4 }, stats: { DEX: 3, INT: 3 }, skills: [{ skill: 'Acute Ears', rank: 3 }, { skill: 'Hide in Shadows', rank: 3 }], rank20: ['Hide in Shadows and one crafting Skill of your choice can be raised to Rank 20'], page: 134, needsReview: true,
    benefits: ['Can see total darkness', 'Gain Advantage when you use the Hide in Shadows', 'Once thing from y', 'Hide choic'] },
  { id: 'frost-maiden', name: 'Frost Maiden', size: { name: 'Petite', n: 3 }, stats: { CHA: 2, DEX: 2, INT: 2 }, skills: [{ skill: 'Persuasion', rank: 2 }], page: 134,
    benefits: ['Melee attacks deal +1d4 Ice damage', 'Roll with Advantage on INT and CON Stat Checks', 'The crawler\'s Game Guide becomes their Manager', 'Capable of flight for up to 1 minute per scene'] },
  { id: 'human', name: 'Human', page: 135,
    benefits: ['Size: Typically Medium (4)', '+2 to all Stats', 'At the end of each floor, roll one Skill Advancement', 'Gain 1 AI Favor each time you level up', 'When you take damage, you may spend 1 AI Favor to gain DR equal to your CON (as many times as you have AI Favor to spend)', 'Once per day, when you would make an untrained as if you had 2 Ranks in the Skill', 'Once per floor, you can spend an Action to remove any single Debuff you\'re suffering from, even Injuries'] },
  { id: 'igneous', name: 'Igneous', size: { name: 'Large', n: 5 }, stats: { CON: 6, STR: 4 }, skills: [{ skill: 'Endurance', rank: 1 }], page: 135, needsReview: true,
    benefits: ['2 Intelligence and Charisma', 'Once per day, double your Move for 20 seconds', 'As an Action, make a CON Stat Check. On Success, deal 1d8+F Fire damage, 5ft Burst radius', 'No Survival Checks needed in harsh heat conditions and can breathe underwater', 'Immunity to Fire damage, and vulnerable to Ice damage', 'Ability to burrow', 'Disadvantage on Checks to conceal your presence or nature (such as Stealth)'] },
  { id: 'lajables', name: 'Lajables', size: { name: 'Medium', n: 4 }, page: 136, needsReview: true,
    benefits: ['+5 Intelligence during the day, +5 Strength during the night', '+2 in two Spells of your choice', '+3 in one Weapon Skill of your choice', 'During the day, Strength is halved, but Spells cost half the Mana to cast', 'During the night, Strength is doubled, but Spells cost double the Mana to cast'] },
  { id: 'obsidian-butterfly', name: 'Obsidian Butterfly', size: { name: 'Medium', n: 4 }, stats: { DEX: 3, INT: 2 }, skills: [{ skill: 'Intimidate', rank: 2 }, { skill: 'Slice Attack', rank: 2 }], prerequisites: 'This limited R who earn Rank 5+ with an', page: 136, needsReview: true,
    benefits: ['4 Constitution', '+2 in a Spell of your choice', 'Has four translucent b up to 15 feet and deliv', 'Has four translucent butterfly wings that can reach up to 15 feet and deliver touch- or melee-range', 'Add 1d4 to your Evade Checks'] },
  { id: 'primal', name: 'Primal', rank20: ['All Skills can be raised to Rank 20 universe. After, they seemingly disappeared and have since become “the boogeymen of the cosmos.” crawler was a Primal, but since then, they\'ve been relegated to the back catalog, behind all of the shiny and popular Race choices. on hard mode—you\'re declining the many significant bonuses of choosing another Race (even plain old humans have more benefits) and accepting a penalty to all of your stats in exchange for the opportunity to raise any Skill above the World Dungeon\'s soft cap of 15 Ranks. concentration to reach that degree of mastery. as they careen into maximizing as many of their you—but don\'t say we didn\'t warn you.'], page: 137,
    benefits: ['Size: Unchanged', '1 to all Stats'] },
  { id: 'rat-hooligan', name: 'Rat Hooligan', size: { name: 'Petite', n: 3 }, stats: { CON: 1, DEX: 2 }, skills: [{ skill: 'Escape Plan', rank: 2 }, { skill: 'Stealth', rank: 2 }, { skill: 'Bite', rank: 1 }, { skill: 'Survival', rank: 1 }], page: 137,
    benefits: ['Advantage on Checks to resist hunger and thirst', 'Can converse with common house rats to gather minimal information while in buildings', 'May add DEX Mod to Bite damage instead of STR'] },
  { id: 'sasquatch', name: 'Sasquatch', size: { name: 'Large', n: 5 }, stats: { CON: 6, DEX: 2, STR: 6 }, skills: [{ skill: 'Foot Soldier', rank: 3 }, { skill: 'Smush', rank: 3 }], prerequisites: 'This limited Race is only available to crawlers who have attained Rank 5+ in the Smush Skill', rank20: ['Smush Skill can be raised to Rank 20'], page: 137,
    benefits: ['3 Intelligence', '1 Charisma'] },
  { id: 'tetrakai', name: 'Tetrakai', size: { name: 'Medium', n: 4 }, stats: { DEX: 6 }, page: 138,
    benefits: ['2 Charisma', '+2 Pugilism and Wrasslin\' Skills', '+1 in all Edged Weapon Skills', 'Four Arms: Your Hands/Holding Gear slot allows for four items (or two weapons requiring two hands)'] },
  { id: 'tigran', name: 'Tigran', stats: { DEX: 3, STR: 2 }, page: 138, needsReview: true,
    benefits: ['4 Charisma', '+2 Ambush, Cat-like Reflexes, and Slice Attack Skills', 'Can see in total darkness', '+1 DR Buff', '+10ft Move', 'When attacking during a total damage with melee attacks tot', 'Disadvantage on fine manipulation or motor coordination the Earth-based Classes. Instead, they gain a small benefit—usually popularity among their audience.'] },
  { id: 'bune', name: 'Bune', size: { name: 'Medium', n: 4 }, stats: { DEX: 2, INT: 3 }, skills: [{ skill: 'Determine Value', rank: 3 }, { skill: 'Fabricate', rank: 3 }, { skill: 'Negotiation', rank: 3 }], prerequisites: 'This limited Race is only available to crawlers with 3 or more Popularity', page: 139,
    benefits: ['2 Constitution', 'At Level 50, +2 Dexterity and gain wings capable of flying up to 500ft per scene', '+1 Popularity each time you roll a Critical Hit in combat'] },
  { id: 'caprid', name: 'Caprid', size: { name: 'Large', n: 5 }, stats: { CHA: 3, INT: 3 }, skills: [{ skill: 'Find Crawler', rank: 3 }, { skill: 'Investigation', rank: 3 }, { skill: 'Leadership', rank: 3 }], page: 139, needsReview: true,
    benefits: ['2 Strength', '+1 Popularity each time you roll a Critical Hit on a Charisma Skill Check or on a Spell Skill Check outside of combat'] },
  { id: 'grulke', name: 'Grulke', size: { name: 'Medium', n: 4 }, stats: { DEX: 3, STR: 2 }, prerequisites: 'This limited Race is only available to crawlers who have Rank 5+ in the Jumping or Light on', page: 139, needsReview: true,
    benefits: ['2 Charisma', '+3 in either Jumping or Light on Your Feet Skills', '+2 Zone of Control and a Reach Weapon Skill of your choice', 'Tongue Lashing: Ranged attack; [Rank = Floor always equal to the Floor Number and cannot be raised by other means', 'Gain a +2 DR breastplate (Torso) with your Grulke', '+1 Popularity when a troll-type enemy licks you or when you achieve an Amazing Success or better on an Attack against a troll-type enemy', '+1 Popularity when you score a Critical Hit on a larger foe in combat'] },
  { id: 'hobgoblin', name: 'Hobgoblin', size: { name: 'Medium', n: 4 }, stats: { DEX: 1 }, skills: [{ skill: 'Regeneration', rank: 1 }], prerequisites: 'This limited Race is only available to crawlers who have Rank 5+ in the Explosives Handling ilable to ank 5+ in the Explosives Handling any Trap-based Skill', rank20: ['At the end of each floor, roll one Explosive or Trap-based s and trap-making Skills d to Rank 20', 'All explosives and trap-making Skills can be raised to Rank 20'], page: 140, needsReview: true,
    benefits: ['+3 in all Trap-based and Explosive-based Skills', 'Free access to all Hobgoblin Sapper', '+1 Popularity when you kill an enemy with a trap or explosive once per scene'] },
  { id: 'pocket-kuma', name: 'Pocket Kuma', size: { name: 'Small', n: 2 }, stats: { CHA: 5, DEX: 5 }, skills: [{ skill: 'Bite', rank: 2 }, { skill: 'Dodge', rank: 2 }, { skill: 'Slice Attack', rank: 2 }, { skill: 'Ambush', rank: 1 }], rank20: ['Light on Your Feet Skill can be raised to Rank 20'], page: 140, needsReview: true,
    benefits: ['4 Constitution', 'You roll with Advantage on all', 'Can see in total darkness', 'Take no damage from falling', 'You deal half damage with Strength-based melee weapons', '+1 Popularity whe in the Surprise Ro', '+1 Popularity when you act in the Surprise Round of a combat or roll a Critical Fail on an Evade Check combat or roll a C on an Evade Che'] },
  { id: 'pterolykos', name: 'Pterolykos', size: { name: 'Medium', n: 4 }, stats: { CHA: 4, DEX: 2 }, skills: [{ skill: 'Bite', rank: 3 }, { skill: 'Performance', rank: 3 }, { skill: 'Tracking', rank: 3 }, { skill: 'Diplomacy', rank: 1 }], page: 140, needsReview: true,
    benefits: ['Has wings capable of flight for up to 50 seconds per scene', 'Disadvantage on all Checks to conceal emotion or presence (such as Deception and Stealth)'] },
  { id: 'skyfowl', name: 'Skyfowl', size: { name: 'Medium', n: 4 }, stats: { CHA: 3, DEX: 3 }, skills: [{ skill: 'Slice Attack', rank: 2 }], page: 141, needsReview: true,
    benefits: ['1 Strength and Constitution', '+2 in all Charisma-based Skills', 'Advantage on the Perception Skill for observing things 10+ feet away', 'Capable of flight for up to 3 minutes per scene. have their wings clipped and can only make short hops of up to 10 seconds per scene when flying'] },
];

const DCC_CLASSES = [
  { id: 'boring-ol-arcanist', name: 'Boring Ol\' Arcanist', classType: 'Arcanist', stats: { DEX: 2, INT: 3 }, skills: [{ skill: 'Arcane', rank: 5 }, { skill: 'Salvage', rank: 3 }], rank20: ['Arcane and one crafting Skill can be raised to Rank 20'], page: 142,
    benefits: ['+2 in a crafting Skill of your choice', '+1 in a crafting Skill of your choice', 'Tier 1 Arcanist table'] },
  { id: 'alchemist', name: 'Alchemist', classType: 'Arcanist', stats: { CON: 3, INT: 3 }, skills: [{ skill: 'Alchemy', rank: 5 }, { skill: 'Infusion', rank: 3 }], rank20: ['Alchemy Skill can be raised to Rank 20'], page: 142,
    benefits: ['Immunity to Poison', 'Tier 1 Alchemy table', 'At the end of each floor, add 1 to your Skill'] },
  { id: 'douchy-wizard-school-wand-maker', name: 'Douchy Wizard School Wand-Maker', classType: 'Arcanist', stats: { DEX: 1, INT: 5, STR: 1 }, skills: [{ skill: 'Arcane', rank: 5 }, { skill: 'Lore', rank: 2 }, { skill: 'Negotiation', rank: 2 }, { skill: 'Salvage', rank: 2 }], rank20: ['Arcanist Skill can be raised to Rank 20'], page: 142,
    benefits: ['2 Charisma', 'Tier-1 crafting table of your choice', 'Silver Earth Box, with guaranteed Earth Hobby Potion'] },
  { id: 'infernocrafter', name: 'Infernocrafter', classType: 'Arcanist', stats: { CON: 3, DEX: 1, STR: 3 }, skills: [{ skill: 'Arcane', rank: 5 }, { skill: 'Smithing', rank: 3 }], rank20: ['Arcane Skill can be raised to Rank 20'], page: 143,
    benefits: ['Resistance to Fire damage', 'Tier 1 Arcanist table', 'Tier 1 Smithing table'] },
  { id: 'prison-tattoo-artist', name: 'Prison Tattoo Artist', classType: 'Arcanist', stats: { CON: 3, DEX: 3, INT: 2 }, skills: [{ skill: 'Tattoo Artistry', rank: 5 }, { skill: 'Calligraphy', rank: 3 }, { skill: 'Dagger', rank: 2 }], rank20: ['Tattoo Artistry Skill can be raised to Rank 20'], page: 143, needsReview: true,
    benefits: ['Tier 1 Tattoo chair (table)'] },
  { id: 'boring-ol-barbarian', name: 'Boring Ol\' Barbarian', classType: 'Barbarian', stats: { CON: 5, STR: 6 }, skills: [{ skill: 'Endurance', rank: 2 }, { skill: 'Intimidate', rank: 1 }], page: 144,
    benefits: ['+3 in a Weapon Skill of your choice', 'Rage (Benefit): Your melee attacks deal +1 damage for each Health Bar slot you have lost', '+2 DR Buff'] },
  { id: 'gladiator', name: 'Gladiator', classType: 'Barbarian, Bard', stats: { CHA: 3, CON: 3, STR: 3 }, skills: [{ skill: 'Attack of Opportunity', rank: 1 }], rank20: ['One Weapon Skill can be raised to Rank 20'], page: 144,
    benefits: ['+2 in a Weapon Skill of your choice', '+2 Performance and Intimidation Skills', 'Rage (Benefit): Your melee attacks deal +1 damage for each Health Bar slot you have lost', '+1 DR Buff', 'Once per combat, after you kill an enemy, you can make an Unopposed Performance Skill Check. On an Amazing Success or better, gain +1 Popularity'] },
  { id: 'hari', name: 'Hari', classType: 'Barbarian, Rogue', stats: { DEX: 1, INT: 1, STR: 1 }, skills: [{ skill: 'Ambush', rank: 4 }, { skill: 'Stealth', rank: 4 }], page: 144,
    benefits: ['+2 in one Weapon Skill of your choice', 'Rage (Benefit): Your melee attacks deal +1 damage for each Health Bar slot you have lost', '+1 DR Buff', 'Can see in total darkness', 'Access to the Desperado Club', 'Silver Earth Box, with guaranteed Earth Hobby Potion'] },
  { id: 'feral-cat-berserker', name: 'Feral Cat Berserker', classType: 'Barbarian', stats: { CHA: 2, DEX: 2, STR: 2 }, skills: [{ skill: 'Slice Attack', rank: 3 }, { skill: 'Unarmed Combat', rank: 3 }, { skill: 'Dodge', rank: 2 }, { skill: 'Ambush', rank: 1 }], prerequisites: 'This limited Class is only available to cat-based Races, such as Cat, Cat Girl, and Tigran', page: 144,
    benefits: ['Rage (Benefit): Your melee attacks deal +1 damage for each Health Bar slot you have lost', '+1 DR Buff', 'Can see in total darkness', 'Silver Earth Box, with guaranteed Earth Hobby Potion'] },
  { id: 'shieldmaiden', name: 'Shieldmaiden', classType: 'Barbarian, Fighter', stats: { CHA: 3, DEX: 3, STR: 3 }, skills: [{ skill: 'Shield Block', rank: 5 }], prerequisites: 'This limited Class is only available to female crawlers', rank20: ['One Weapon Skill can be raised to Rank 20'], page: 144,
    benefits: ['2 Intelligence', '+2 in one Weapon Skill of your choice', 'Rage (Benefit): Your melee attacks deal +1 damage for each Health Bar slot you have lost', '+1 DR Buff', 'Add your STR Mod a second time to your melee attack damage against males', 'Silver Earth Box, with guaranteed Earth Hobby Potion are the custodians of the oral tradition, keeping track of historic people and events and sharing that information in a creative and entertaining way. Some just happen to be more entertaining than others (lookin\' at you, Jeff Hays). you\'ll have to find someone willing and able to serve as your Patron. It\'s fun, like a Quest to find one. The GM has information on the process and some characters who might fill this role (see Bard Patronage, p. 315).'] },
  { id: 'boring-ol-bard', name: 'Boring Ol\' Bard', classType: 'Bard', stats: { CHA: 3 }, skills: [{ skill: 'Performance', rank: 3 }, { skill: 'Diplomacy', rank: 2 }, { skill: 'Good First Impression', rank: 1 }, { skill: 'Lore', rank: 1 }], page: 145,
    benefits: ['+1 in a Weapon Skill of your choice', '+2 in a Spell of your choice', 'Access to all membership-based clubs, regardless of current memberships', 'Membership in the Dungeon Book of the Floor', 'Free room at all saferooms', 'You may gain access to a Patron', 'You pay +1 Mana to cast Spells that are not'] },
  { id: 'artist-alley-mogul', name: 'Artist Alley Mogul', classType: 'Bard, Merchant', stats: { CHA: 5, DEX: 5 }, skills: [{ skill: 'Dodge', rank: 2 }, { skill: 'Negotiation', rank: 2 }, { skill: 'Pathfinder', rank: 2 }], rank20: ['Dodge Skill can be raised to Rank 20'], page: 145,
    benefits: ['+2 Shield Spell', 'A 25% discount at all stores plus a 15% bonus to money earned from sales', '10% interest earned on all coins upon descent to the next floor', 'Silver Earth Box, with guaranteed Earth Hobby'] },
  { id: 'former-child-actor', name: 'Former Child Actor', classType: 'Bard', stats: { CHA: 10 }, skills: [{ skill: 'Character Actor', rank: 3 }, { skill: 'Cockroach', rank: 2 }], prerequisites: 'Must have Popularity 3+, receiving the', page: 145, needsReview: true,
    benefits: ['Immunity to Poison and all diseases', 'The Manager Benefit', 'Silver Earth Box, with guaranteed Earth Hobby Potion'] },
  { id: 'necrobard', name: 'NecroBard', classType: 'Bard, Necromancer', stats: { CHA: 3, CON: 3, INT: 3 }, skills: [{ skill: 'Performance', rank: 4 }], page: 146,
    benefits: ['2 Strength', '+3 Turn Undead and Panty Dropper Spells', 'Access to all membership-based clubs, regardless of current memberships', 'Free room at all saferooms', 'You pay +1 Mana to cast Spells that are not'] },
  { id: 'poet-laureate', name: 'Poet Laureate', classType: 'Bard', stats: { CHA: 2, INT: 3 }, page: 146, needsReview: true,
    benefits: ['+5 Performance Skill with the written word specialty', '+2 Earworm (as spoken word poetry), Heal Others, and Shield Spells', 'Access to all membership-based clubs, regardless of current memberships', 'You pay +1 Mana to cast Spells that are not', 'You must choose a Patron. The GM will give you a choice of at least two options when you select this class.', 'Silver Earth Box, with guaranteed Earth Hobby'] },
  { id: 'professional-roadie', name: 'Professional Roadie', classType: 'Bard, Rogue', skills: [{ skill: 'Negotiation', rank: 3 }, { skill: 'Iron Stomach', rank: 1 }, { skill: 'Repair', rank: 1 }], page: 146, needsReview: true,
    benefits: ['+4 Performance Skill, with a guitar specialty', 'Advantage on Checks against Poison or effects that give the Shit-Faced Debuff', 'At the start of each combat, you may declare that all the damage you deal is Sonic damage', 'Roll with Advantage when making a Repair Skill', 'Silver Earth Box, with guaranteed Earth Hobby Potion'] },
  { id: 'spellbinder', name: 'Spellbinder', classType: 'Bard', stats: { CHA: 2, INT: 2 }, skills: [{ skill: 'Good First Impression', rank: 2 }, { skill: 'Lore', rank: 2 }, { skill: 'Performance', rank: 2 }], page: 147, needsReview: true,
    benefits: ['+2 in Hot Stuff Aura and Panty Dropper Spells', 'Once per day, you can draw the attention of y,y everyone on the battlefield for a round, preventing them from attacking (this includes party members, Mobs, and minions, but not Bosses) of its power. They\'re not necessarily true believers, but they do need to keep their god\'s rules and regulations. And the gods are fickle bastards.'] },
  { id: 'boring-ol-cleric', name: 'Boring Ol\' Cleric', classType: 'Cleric', stats: { CHA: 4, INT: 3 }, skills: [{ skill: 'Religion', rank: 3 }], page: 148,
    benefits: ['+2 in a Weapon Skill of your choice', '+2 Heal Others, Shield, and Turn Undead Spells', 'Access to the Spell Book of the Level club (“Favored: Cleric” Spells only)', 'Access to Club Vanquisher', 'Must worship a deity (see Deities & Worship, p. 163)', 'You cannot choose a Cleric-type Class if you have access to the Desperado Club'] },
  { id: 'black-inquisitor-general', name: 'Black Inquisitor General', classType: 'Class Types: Cleric, Mage, Paladin', stats: { CHA: 1, INT: 3, STR: 3 }, skills: [{ skill: 'Find Trap', rank: 3 }, { skill: 'Trap Engineer', rank: 2 }, { skill: 'Religion', rank: 1 }], page: 148,
    benefits: ['2 Constitution', '+3 in a Weapon Skill of your choice', '+2 in a Spell of your choice', 'Can see in total darkness', 'Must worship a deity (see Deities & Worship, p. 163)', 'Access to all membership-based clubs, regardless of current memberships'] },
  { id: 'santero', name: 'Santero', classType: 'Cleric', stats: { CHA: 3, CON: 2, STR: 3 }, skills: [{ skill: 'Religion', rank: 2 }, { skill: 'Endurance', rank: 1 }], page: 148,
    benefits: ['2 Intelligence', '+2 Heal Others, Shield, and Soul Collector Spells', '+2 in a Weapon Skill of your choice', 'Access to the Dungeon Book of the Floor club (“Favored: Cleric” Spells only)', 'Access to Club Vanquisher', 'Must worship a deity (see Deities & Worship, p. 163)', 'You cannot choose this Class if you have access to the Desperado Club typically as defenders of the wild. Their magic grants them Spells that harm, heal, and manipulate the environment.'] },
  { id: 'boring-ol-druid', name: 'Boring Ol\' Druid', classType: 'Druid', stats: { CON: 2, DEX: 2, INT: 2 }, skills: [{ skill: 'Survival', rank: 2 }], page: 148,
    benefits: ['+3 Nature\'s Breath Spell', '+3 in a Spell of your choice', '+2 in a Spell of your choice', 'Your Mana recovers at twice the normal rate in a natural environment', 'Access to the Dungeon Book of the Floor club (“Favored: Druid” Spells only)'] },
  { id: 'herbalist', name: 'Herbalist', classType: 'Arcanist, Druid', stats: { CON: 2, INT: 2 }, skills: [{ skill: 'Alchemy', rank: 2 }, { skill: 'Cooking', rank: 2 }, { skill: 'First Aid', rank: 2 }, { skill: 'Survival', rank: 2 }], page: 149,
    benefits: ['+2 Nature\'s Breath and Dirt Clod Spells', 'Your Mana recovers at twice the normal rate in a natural environment'] },
  { id: 'lifebringer', name: 'Lifebringer', classType: 'Druid', stats: { CON: 2, INT: 1 }, skills: [{ skill: 'First Aid', rank: 2 }, { skill: 'Pathfinder', rank: 2 }, { skill: 'Regeneration', rank: 2 }, { skill: 'Survival', rank: 2 }], page: 149, needsReview: true,
    benefits: ['+2 Nature\'s Breath Spell', '+1 Rank in all Spells with the Heal keyword'] },
  { id: 'physicker', name: 'Physicker', classType: 'Druid', stats: { CON: 3, INT: 3 }, page: 149,
    benefits: ['+3 Nature\'s Breath and Oakhide Spells', '+2 Rootfoot and Solsplash Spells', 'Double Mana regeneration when outdoors', 'Able to grant +1 DR to your party for 1 scene, once per day'] },
  { id: 'shepherd', name: 'Shepherd', classType: 'Druid', stats: { CHA: 2, CON: 2, INT: 2 }, skills: [{ skill: 'Animal Handling', rank: 3 }, { skill: 'Pathfinder', rank: 2 }], page: 150,
    benefits: ['+2 Nature\'s Breath and Drain Life Spells', 'You can see twice as far as most creatures', 'Your Mana recovers at twice the normal rate in a natural environment', 'The Shepherd may not use melee weapons other than Herding Weapons (see p. 182)', 'Gain a friendly Pet', 'Pets in your Herd gain +2 DR', 'Silver Earth Box, with guaranteed Earth Hobby Potion manner of martial weapons. They are durable damage-dealing frontliners, generally with good armor and lots of Hit Points.'] },
  { id: 'boring-ol-fighter', name: 'Boring Ol\' Fighter', classType: 'Fighter', stats: { CON: 2, STR: 2 }, skills: [{ skill: 'Dodge', rank: 3 }], page: 150,
    benefits: ['+5 in a Weapon Skill of your choice', '+2 to your choice of two of the following Skills:', 'Can access any Weapon Training Guild. Upon arriv- al on each floor, you receive a coupon good for one free training at a Weapon Training Guild'] },
  { id: 'pit-fighter', name: 'Pit Fighter', classType: 'Fighter', stats: { DEX: 3, INT: 2, STR: 1 }, skills: [{ skill: 'Attack of Opportunity', rank: 3 }, { skill: 'Dirty Fighting', rank: 3 }, { skill: 'Dodge', rank: 2 }, { skill: 'Improvised Weapons', rank: 2 }], page: 150,
    benefits: ['+2 DR Buff', 'Silver Earth Box, with guaranteed Earth Hobby Potion'] },
  { id: 'shotgun-messenger', name: 'Shotgun Messenger', classType: 'Fighter', stats: { CON: 2, DEX: 2, STR: 2 }, skills: [{ skill: 'Aiming', rank: 2 }, { skill: 'Intimidate', rank: 2 }], page: 150, needsReview: true,
    benefits: ['2 Charisma', '+5 in a Ranged Weapon Skill', '+1 in all muscle-powered movement-related Skills', 'Access to the Desperado Club', 'Silver Earth Box, with guaranteed Earth Hobby Potion'] },
  { id: 'straight-to-dvd-action-hero', name: 'Straight-to-DVD Action Hero', classType: 'Fighter', stats: { CHA: 3, CON: 3, DEX: 3, STR: 3 }, skills: [{ skill: 'Unarmed Combat', rank: 2 }, { skill: 'Driving', rank: 1 }, { skill: 'Running', rank: 1 }, { skill: 'Performance', rank: 1 }], page: 151,
    benefits: ['2 Intelligence', 'Take no damage from falling', 'The Manager Benefit', 'Silver Earth Box, with guaranteed Earth Hobby Potion'] },
  { id: 'sword-and-boarder', name: 'Sword and Boarder', classType: 'Fighter', stats: { CON: 2, DEX: 2, STR: 2 }, skills: [{ skill: 'Shield Block', rank: 5 }, { skill: 'Attack of Opportunity', rank: 2 }, { skill: 'Catcher', rank: 2 }], page: 151,
    benefits: ['2 Intelligence', '+3 in an Edged Weapon Skill of your choice', 'Access to the Desperado Club'] },
  { id: 'monster-truck-driver', name: 'Monster Truck Driver', classType: 'Fighter', stats: { CON: 4, DEX: 2 }, skills: [{ skill: 'Gear Head', rank: 3 }, { skill: 'Driving', rank: 3 }, { skill: 'Pathfinder', rank: 3 }], prerequisites: 'This limited Class is only available to crawlers who have Rank 5+ in the Driving Skill', page: 152,
    benefits: ['2 Strength', '2 Intelligence', 'While moving in combat, you have a CON Mod bonus in your Health Bar slots (only) equal to conveyance. If on foot, you must have spent a Move', 'You bolt across the room and slam through each entity in the way. [Rank = Floor Number] + DEX to hit, 1d12 Bludgeoning, 2d10+3ft Line, then you gain the Fatigued Debuff. Critical Fail on a Natural 4 or less. Cooldown: 30 hours. Add 1d at Rank 5, 10, and 15. Rank only increases by Floor', 'Once per combat, roll 1d2 when you lose 2+ Health', 'Resistance to Force damage', 'Silver Earth Box, with guaranteed Earth Hobby'] },
  { id: 'zulu-warrior', name: 'Zulu Warrior', classType: 'Fighter', stats: { CON: 3, DEX: 3, STR: 3 }, skills: [{ skill: 'Attack of Opportunity', rank: 2 }, { skill: 'Endurance', rank: 2 }, { skill: 'Running', rank: 2 }], rank20: ['One Weapon Skill can be raised to Rank 20'], page: 152,
    benefits: ['+3 in one Melee Weapon Skill of your choice', '+1 DR', 'Silver Earth Box, with guaranteed Earth Hobby mastery of magic is rare. Most who practice magic maintain some form of martial or spiritual traditions, so they can access a wider range of tools. There is an order, however, which based much of its training on mastering only the metaphysical, for they believe that by perfecting their craft, they can transcend reality and escape into the source of all magic. gets you through to the next Floor, amiright?'] },
  { id: 'boring-ol-mage', name: 'Boring Ol\' Mage', classType: 'Mage', stats: { CHA: 5, INT: 5 }, skills: [{ skill: 'Lore', rank: 2 }, { skill: 'Arcane', rank: 1 }], page: 152, needsReview: true,
    benefits: ['2 Strength and Dexterity', '+3 in a Fire Spell', '+2 in one Force Spell and one Sonic Spell', '+2 in two different Passive Spells'] },
  { id: 'blizardmancer', name: 'Blizardmancer', classType: 'Mage', stats: { DEX: 3, INT: 4 }, skills: [{ skill: 'Aiming', rank: 2 }], page: 153,
    benefits: ['2 Strength', '+4 Ice Blast and Frost Scar Spells', 'Resistance to Ice damage', 'You can use the Aiming Skill for single-target Ice'] },
  { id: 'crisper', name: 'Crisper', classType: 'Mage', stats: { DEX: 2, INT: 3 }, skills: [{ skill: 'Lore', rank: 2 }], page: 153,
    benefits: ['2 Constitution', '+3 Wall of Fire and Fire Fingers', '+2 Fireball and Wilbur\'s Slow-Build', 'Resistance to Fire damage', 'No DR against Ice or water-based damage', 'No DR damage'] },
  { id: 'fire-spiritualist', name: 'Fire Spiritualist', classType: 'Bar', stats: { CHA: 2, INT: 2 }, page: 153, needsReview: true,
    benefits: ['+2 Holy Aura and Hot Stuff Aura Spells', '+2 Heal Others and Intimate Touches Spells', 'Ethereal Hug: Once per day for one scene, you can grant your party +1 DR, Rank 4 Regeneration (as per the Skill), +1 to hit on Weapon and Spell Skill Checks, and add 1d4 bonus when they deal damage', 'Vulnerable to Ice damage'] },
  { id: 'forsaken-aerialist', name: 'Forsaken Aerialist', classType: 'Mage', stats: { INT: 5 }, skills: [{ skill: 'Alchemy', rank: 1 }, { skill: 'Infusion', rank: 1 }, { skill: 'Tactics', rank: 1 }], page: 153,
    benefits: ['2 Charisma', '+3 Drain Life and Soul Collector Spells', 'Double the duration of your Rank 5 and lower', 'Your Spells can be applied to a creature without it realizing it is under a Spell effect'] },
  { id: 'necromancer', name: 'Necromancer', classType: 'Mage, Necromancer', stats: { DEX: 2, INT: 2 }, page: 154,
    benefits: ['2 Constitution and Charisma', '+4 Soul Collector and Rise, Dead Minion! Spells', '+2 Drain Life and Second Chance Spells', 'Once per rest, you can ask the corpse of a dead creature a number of questions equal to your INT. what it knew in life', 'Whenever you kill an undead Mob, you heal 1 focus on spells, Monks seek harmony and natural balance within themselves and the world around them. And they kick a lot of ass doing it—turns out it\'s pretty meditative to slam your fists, elbows, knees, and feet into your enemies!'] },
  { id: 'boring-ol-monk', name: 'Boring Ol\' Monk', classType: 'Monk', stats: { CON: 3, DEX: 3, STR: 1 }, skills: [{ skill: 'Unarmed Combat', rank: 3 }, { skill: 'Foot Soldier', rank: 1 }, { skill: 'Iron Punch', rank: 1 }, { skill: 'Powerful Strike', rank: 1 }], rank20: ['Unarmed Combat Skill can be raised to Rank 20'], page: 154,
    benefits: ['+1 in Dexterity-based Weapon Skills'] },
  { id: 'elemental-monk', name: 'Elemental Monk', classType: 'Mage, Monk', stats: { DEX: 2, INT: 2 }, skills: [{ skill: 'Unarmed Combat', rank: 3 }], page: 154,
    benefits: ['+1 Dirt Clod, Fire Fingers, and Frost Scar Spells', '+1 in all Spells with the Electric, Fire, and Ice damage types', 'Advantage when attacking elemental creatures', 'The ability to breathe underwater', 'The ability to burrow', 'The ability to fly'] },
  { id: 'prizefighter', name: 'Prizefighter', classType: 'Bard, Monk', stats: { CON: 5, STR: 2 }, skills: [{ skill: 'Pugilism', rank: 5 }, { skill: 'Iron Punch', rank: 5 }], prerequisites: 'This limited Class is only available to crawlers who have Rank 5+ in the Pugilism Skill', rank20: ['Pugilism Skill can be raised to Rank 20'], page: 154,
    benefits: ['2 Intelligence and Charisma', '1 × Floor Number gold for every Mob you kill with a Pugilism or Unarmed Combat Skill attack', 'When you kill a foe with a Pugilism or Unarmed', 'Silver Earth Box, with guaranteed Earth Hobby'] },
  { id: 'spirit-healer', name: 'Spirit Healer', classType: 'Druid, Monk', stats: { CON: 3, DEX: 1, STR: 3 }, skills: [{ skill: 'Smush', rank: 3 }], page: 155, needsReview: true,
    benefits: ['+3 Drain Life Spell', '+2 Heal Others and Heal Self Spells', 'Your healing Skills and Spells heal targeting a single individual', 'Access to Club Vanquisher', 'Silver Earth Box, with guaranteed'] },
  { id: 'street-monk', name: 'Street Monk', classType: 'Fighter, Monk', stats: { CHA: 1, DEX: 2, STR: 1 }, skills: [{ skill: 'Dirty Fighting', rank: 2 }, { skill: 'Streetwise', rank: 2 }, { skill: 'Unarmed Combat', rank: 2 }, { skill: 'Pugilism', rank: 1 }], page: 155, needsReview: true,
    benefits: ['+1 in Dexterity-based Weapon Skills', '+3 DR Buff', 'Silver Earth Box, with guaranteed Earth Hobby'] },
  { id: 'boring-ol-paladin', name: 'Boring Ol\' Paladin', classType: 'Paladin', stats: { CHA: 3 }, page: 155, needsReview: true,
    benefits: ['+3 Protective Shell, Heal', '+3 in a Weapon Skill of your choice', '+3 in a W choice', '+2 Catcher or Shield Block', 'Access to Club Vanquisher', 'Must worship a deity', 'You cannot choose this to the Desperado'] },
  { id: 'cavalier', name: 'Cavalier', classType: 'Fighter, Paladin', stats: { CON: 2, STR: 2 }, skills: [{ skill: 'Catcher', rank: 2 }, { skill: 'Riding', rank: 2 }, { skill: 'Lance', rank: 2 }], page: 156, needsReview: true,
    benefits: ['+2 Shield and Smite Spells', 'Gain a bonded Mount one size bigger than you with Move 40, barding with DR 10, a Trample attack, and a pet carrier for it', 'When you or your Mount is the target of an Attack, your fancy riding allows you to redirect an attack at your Mount to yourself or vice versa', 'Access to Club Vanquisher', 'Must worship a deity'] },
  { id: 'sacred-paladin', name: 'Sacred Paladin', classType: 'Paladin', stats: { CHA: 2, STR: 3 }, skills: [{ skill: 'Catcher', rank: 2 }], page: 156,
    benefits: ['+2 in a Weapon Skill of your choice', '+2 Heal Others, Smite, and Turn Undead Spells', 'Access to the Dungeon Book of the Floor club (Favored: Cleric or Paladin Spells only)', '+2 DR Buff', 'Access to Club Vanquisher', 'Must worship a deity', 'You cannot choose this Class if you have access to the Desperado Club knife in the dark, and the nimble hands disarming a trap before it blows your head into a fine red paste. These are all the hallmarks of a Rogue, one of the most useful teammates to have in the World decide you\'re worth more dead than alive.'] },
  { id: 'boring-ol-rogue', name: 'Boring Ol\' Rogue', classType: 'Rogue', stats: { CHA: 1, DEX: 1, INT: 1 }, skills: [{ skill: 'Stealth', rank: 3 }, { skill: 'Dagger', rank: 2 }, { skill: 'Detect Trap', rank: 2 }, { skill: 'Dodge', rank: 2 }, { skill: 'Lockpicking', rank: 2 }, { skill: 'Ambush', rank: 1 }], page: 156,
    benefits: ['Can see in total darkness', '1 x Floor Number gold for every Mob killed with a melee weapon', 'Access to the Desperado Club', 'Cannot choose this Class if you have access to Club'] },
  { id: 'bomb-squad-tech', name: 'Bomb Squad Tech', classType: 'Rogue', stats: { CON: 1, DEX: 2 }, skills: [{ skill: 'Bomb Surgeon', rank: 3 }, { skill: 'Find Trap', rank: 3 }], prerequisites: 'This limited Class is only available to crawlers who\'ve earned the Boom! Achievement', page: 156, needsReview: true,
    benefits: ['2 Intelligence (After all, only dumbasses would choose to do this for a living.)', '+2 in all Explosive-based Skills', '+1 DR Buff', 'Silver Earth Box, with guaranteed Earth Hobby Potion'] },
  { id: 'compensated-anarchist', name: 'Compensated Anarchist', classType: 'Monk, Rogue', stats: { CHA: 5, INT: 1 }, skills: [{ skill: 'Backfire', rank: 2 }, { skill: 'Escape Plan', rank: 2 }, { skill: 'Find Trap', rank: 2 }, { skill: 'Bomb Surgeon', rank: 1 }, { skill: 'Hide in Shadows', rank: 1 }, { skill: 'Trap Engineer', rank: 1 }, { skill: 'Unarmed Combat', rank: 1 }], prerequisites: 'This limited Class is only available to crawlers who have Popularity 3 or higher and have', page: 157,
    benefits: ['+1 Fear Spell', 'Add no Stat Mod bonus damage when using Edged', 'You pay +3 Mana to cast damage-dealing Spells', 'At the end of each floor, add 1 to one of your trap-related Skill Advancement Checks', 'At the end of each floor, add 1 to one of your bomb-related Skill Advancement Checks', 'Access to the Desperado Club', 'Access to the Naughty Boys Employment Agency', 'Silver Earth Box, with guaranteed Earth Hobby Potion'] },
  { id: 'high-rise-grifter', name: 'High Rise Grifter', classType: 'Rogue', stats: { CHA: 1, INT: 1 }, skills: [{ skill: 'Deception', rank: 4 }, { skill: 'Stealth', rank: 4 }, { skill: 'Dagger', rank: 2 }, { skill: 'Escape Plan', rank: 2 }, { skill: 'Determine Value', rank: 1 }, { skill: 'Negotiation', rank: 1 }], page: 157,
    benefits: ['Access to the Desperado Club', 'Cannot choose this Class if you have access to Club', 'Silver Earth Box, with guaranteed Earth Hobby Potion'] },
  { id: 'identity-thief', name: 'Identity Thief', classType: 'Rogue', stats: { CHA: 4, DEX: 3 }, skills: [{ skill: 'Deception', rank: 5 }, { skill: 'Dagger', rank: 3 }, { skill: 'Investigation', rank: 2 }], page: 157,
    benefits: ['Tier 3 Makeup Table', 'Access to the Desperado Club', 'Cannot choose this Class if you have access to Club', 'Silver Earth Box, with guaranteed Earth Hobby Potion'] },
  { id: 'swashbuckler', name: 'Swashbuckler', classType: 'Bard, Fighter, Rogue', stats: { CHA: 3, DEX: 3 }, skills: [{ skill: 'Balance', rank: 2 }, { skill: 'Dodge', rank: 2 }, { skill: 'Performance', rank: 1 }, { skill: 'Light on your Feet', rank: 1 }], rank20: ['Rapier or Longsword Skill can be raised to Rank 20'], page: 158,
    benefits: ['+3 Rapier or Longsword Skill', 'You have Advantage when using a melee attack from a higher position than your opponent', 'Once per combat, after you kill an enemy, you can make an Unopposed Performance Skill Check. On an Amazing Success or better, gain +1 Popularity news for you picky and persnickety types: Players can simulate the thousands of options offered to their crawler by creating an entirely new Race or the menu below to create your custom crawler. You have 25 Race Build Points and 30 Class Build Points to purchase specific abilities, and you can optionally select drawbacks to gain more Build Points to spend. and spend, spend, spend! bringing into the World Dungeon. Once you\'ve got a clear idea, take deep breaths and push, just like in off-the-wall nature of the World Dungeon? from Earth—including Earth folklore, mythology, and legend—or if they\'re an alien entity entirely! Alien they\'ve got planets of fans who want to see the crawler represent them in the most popular program in the galaxy, but don\'t get access to Earth Classes. mostly-useless Earth Hobby Potion, which grants 3 experiences on the Tutorial Floors, you should consider the theme for the Class you want to design. a crazy mash-up of modern pop-culture memes and traditional fantasy tropes. Feel free to come up with themes for Classes from out in left field—it\'s bound to be available in the dungeon! give mechanical benefits to the Race or Class you\'ve imagined. These benefits are ranked by general useful- ness and power. They\'re just examples, and players are encouraged to come up with original benefits and discuss them with the GM. Characteristics that don\'t provide any mechanical benefits are free, such as a strange skin color, emitting an unusual smell, or having an odd voice. groups of Skills. The cost of such bonuses depends on the size of the group of Skills (4 or 6 points).'] },
];

function dccRace(id) { return DCC_RACES.find(r => r.id === id) || null; }
function dccClass(id) { return DCC_CLASSES.find(c => c.id === id) || null; }

// Does a crawler meet an entry's Stat and Skill prerequisites?
//
// The Skill list has to come from dccFinalSkills(), which is live throughout
// creation. Reading char.blocks.skills instead — which dccFinishCreation does
// not write until the wizard has already ended — meant that during creation
// this saw an empty list: the one gate it could parse was unsatisfiable, and
// the other thirteen fell through to "no opinion" and were free picks.
//
// The book also gates some entries on things the app cannot see (achievements,
// story events, the crawler's gender). Those come back ok:true with a note, so
// the card can show the requirement without pretending to have checked it.
function dccPrereqSkills(char) {
  if (typeof dccFinalSkills === 'function') {
    try { const l = dccFinalSkills(char); if (l && l.length) return l; } catch (e) {}
  }
  return (char.blocks && char.blocks.skills && char.blocks.skills.skills) || [];
}
function dccPrereqPopularity(char) {
  if (char.blocks && char.blocks.popularity && typeof char.blocks.popularity.current === 'number') {
    return char.blocks.popularity.current;
  }
  // Before the finish step lands the block, Popularity is CHA Mod x2 (p. 111).
  return (typeof dccModOf === 'function' ? dccModOf(char, 'CHA') : 0) * 2;
}
const DCC_STAT_WORDS = { Strength: 'STR', Intelligence: 'INT', Constitution: 'CON',
                         Dexterity: 'DEX', Charisma: 'CHA' };

function dccMeetsPrereq(char, entry) {
  const text = entry.prerequisites;
  if (!text) return { ok: true };
  const list = dccPrereqSkills(char);

  // "at least one Strength or Dexterity-based Skill at Rank 5+"
  const byStat = text.match(/at least one (\w+)[ -]?(?:or (\w+)[ -]?)?based Skill at Rank (\d+)/i);
  if (byStat) {
    const want = [byStat[1], byStat[2]].filter(Boolean)
      .map(w => DCC_STAT_WORDS[w]).filter(Boolean);
    const rank = parseInt(byStat[3], 10) || 0;
    const hit = list.some(s => (s.rank || 0) >= rank && want.indexOf(s.stat) >= 0);
    return hit ? { ok: true } : { ok: false, why: text };
  }

  // "Rank 5+ in the Smush Skill", "Rank 5+ in the Jumping or Light on Your Feet"
  const byName = text.match(/Rank (\d+)\+?\s*(?:with|in)\s+(?:the\s+)?([A-Za-z' ]+?)(?:\s+Skill|\s*$|,)/i);
  if (byName) {
    const rank = parseInt(byName[1], 10) || 0;
    const names = byName[2].split(/\s+or\s+/i).map(n => n.trim().toLowerCase()).filter(Boolean);
    // The source text for a few entries is truncated mid-sentence, so a name
    // that matches nothing in the catalogue is not evidence the crawler fails.
    const known = names.filter(n => typeof dccSkillByName === 'function' && dccSkillByName(n));
    if (!known.length) return { ok: true, note: text };
    const hit = list.some(s => (s.rank || 0) >= rank && known.indexOf(String(s.name).toLowerCase()) >= 0);
    return hit ? { ok: true } : { ok: false, why: text };
  }

  // "3 or more Popularity", "Popularity 3+", "Popularity 3 or higher"
  const pop = text.match(/(\d+)\s+or more Popularity/i)
           || text.match(/Popularity\s+(\d+)\s*(?:\+|or higher)/i);
  if (pop) {
    const need = parseInt(pop[1], 10) || 0;
    const have = dccPrereqPopularity(char);
    return have >= need ? { ok: true }
      : { ok: false, why: text + ' (you have ' + have + ')' };
  }

  // "only available to crawlers who are already a Cat" / "to cat-based Races"
  const family = text.match(/already an? ([A-Za-z ]+?)(?:\s*$|,|\.)/i)
              || text.match(/only available to ([a-z]+)-based Races/i);
  if (family) {
    const want = family[1].trim().toLowerCase();
    const mine = String((char.race || '')).toLowerCase();
    const picked = char.dcc && char.dcc.picks && char.dcc.picks.race;
    const pickedName = picked ? String((dccRace(picked) || {}).name || '').toLowerCase() : '';
    const hit = (mine + ' ' + pickedName).indexOf(want) >= 0;
    return hit ? { ok: true } : { ok: false, why: text };
  }

  return { ok: true, note: text };
}

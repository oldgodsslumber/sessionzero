// systems/dungeon-crawler-carl/creation.js — character-creation tables (D5).
//
// Source: DCC RPG Core Rulebook, pp. 101-118. Extracted from the PDF with
// reading order rebuilt from block geometry, for the reasons in skills.js.
//
// Every Skill named below is asserted to exist in DCC_SKILLS by test/dcc.js:
// a background that hands out a Skill with no catalogue entry is a Skill with
// no rules behind it. See CREATION.md section 5.

// Human backgrounds roll 1d12; animal backgrounds roll 1d6. Pick a row, then
// take TWO of its three Skills. No double-dipping: the same Skill taken twice
// does not stack (p. 103).
const DCC_BACKGROUNDS = {
  human: {
    childhood: { rank: 1, die: 12, table: 12, rows: [
      { roll:  1, description: 'Latchkey Kid', skills: [{s:'Streetwise',st:'CHA'}, {s:'Perception',st:'INT'}, {s:'Stealth',st:'DEX'}] },
      { roll:  2, description: 'Crafty Kid', skills: [{s:'Fabricate',st:'INT'}, {s:'Repair',st:'INT'}, {s:'Salvage',st:'INT'}] },
      { roll:  3, description: 'Excitable Kid', skills: [{s:'Escape Artist',st:'DEX'}, {s:'Endurance',st:'CON'}, {s:'Running',st:'DEX'}] },
      { roll:  4, description: 'Gymnast', skills: [{s:'Endurance',st:'CON'}, {s:'Jumping',st:'STR'}, {s:'Performance',st:'CHA'}] },
      { roll:  5, description: 'Military Brat', skills: [{s:'Deception',st:'CHA'}, {s:'Streetwise',st:'CHA'}, {s:'Tactics',st:'INT'}] },
      { roll:  6, description: 'MMO Kid', skills: [{s:'Fabricate',st:'INT'}, {s:'Engineering',st:'INT'}, {s:'Tactics',st:'INT'}] },
      { roll:  7, description: 'Only Child', skills: [{s:'Good First Impression',st:'CHA'}, {s:'Investigation',st:'INT'}, {s:'Negotiation',st:'CHA'}] },
      { roll:  8, description: 'Outdoor Kid', skills: [{s:'Animal Handling',st:'CHA'}, {s:'Climbing',st:'STR'}, {s:'Swimming',st:'STR'}] },
      { roll:  9, description: 'Problem Child', skills: [{s:'Intimidate',st:'STR'}, {s:'Deception',st:'CHA'}, {s:'Pugilism',st:'DEX'}] },
      { roll: 10, description: 'Scamp', skills: [{s:'Hide in Shadows',st:'DEX'}, {s:'Jumping',st:'STR'}, {s:'Throwing',st:'STR'}] },
      { roll: 11, description: 'Teacher\'s Pet', skills: [{s:'Catcher',st:'None'}, {s:'Perception',st:'INT'}, {s:'Good First Impression',st:'CHA'}] },
      { roll: 12, description: 'Wild Child', skills: [{s:'Stealth',st:'DEX'}, {s:'Survival',st:'CON'}, {s:'Running',st:'DEX'}] },
    ] },
    adolescence: { rank: 1, die: 12, table: 13, rows: [
      { roll:  1, description: 'Family Farm', skills: [{s:'Animal Handling',st:'CHA'}, {s:'Fabricate',st:'INT'}, {s:'Tracking',st:'INT'}] },
      { roll:  2, description: 'Drama Nerd', skills: [{s:'Fabricate',st:'INT'}, {s:'Deception',st:'CHA'}, {s:'Performance',st:'CHA'}] },
      { roll:  3, description: 'Drop-Out', skills: [{s:'Chopper Pilot',st:'DEX'}, {s:'Streetwise',st:'CHA'}, {s:'Survival',st:'CON'}] },
      { roll:  4, description: 'Greek Life', skills: [{s:'Negotiation',st:'CHA'}, {s:'Intimidate',st:'STR'}, {s:'Taunt',st:'CHA'}] },
      { roll:  5, description: 'Influencer', skills: [{s:'Negotiation',st:'CHA'}, {s:'Persuasion',st:'CHA'}, {s:'Performance',st:'CHA'}] },
      { roll:  6, description: 'Jock', skills: [{s:'Endurance',st:'CON'}, {s:'Jumping',st:'STR'}, {s:'Throwing',st:'STR'}] },
      { roll:  7, description: 'McJob', skills: [{s:'Determine Value',st:'None'}, {s:'Negotiation',st:'CHA'}, {s:'Repair',st:'INT'}] },
      { roll:  8, description: 'Popular', skills: [{s:'Good First Impression',st:'CHA'}, {s:'Perception',st:'INT'}, {s:'Persuasion',st:'CHA'}] },
      { roll:  9, description: 'Religious', skills: [{s:'Catcher',st:'None'}, {s:'First Aid',st:'INT'}, {s:'Persuasion',st:'CHA'}] },
      { roll: 10, description: 'Student Government', skills: [{s:'Deception',st:'CHA'}, {s:'Persuasion',st:'CHA'}, {s:'Investigation',st:'INT'}] },
      { roll: 11, description: 'Nerd', skills: [{s:'Investigation',st:'INT'}, {s:'Repair',st:'INT'}, {s:'Fabricate',st:'INT'}] },
      { roll: 12, description: 'Weirdo', skills: [{s:'Streetwise',st:'CHA'}, {s:'Intimidate',st:'STR'}, {s:'Fabricate',st:'INT'}] },
    ] },
    career: { rank: 3, die: 12, table: 14, rows: [
      { roll:  1, description: 'Criminal', skills: [{s:'Deception',st:'CHA'}, {s:'Stealth',st:'DEX'}, {s:'Streetwise',st:'CHA'}] },
      { roll:  2, description: 'Service Industry', skills: [{s:'Dagger',st:'DEX'}, {s:'Endurance',st:'CON'}, {s:'Sleight of Hand',st:'DEX'}] },
      { roll:  3, description: 'Small Business Owner', skills: [{s:'Determine Value',st:'None'}, {s:'Negotiation',st:'CHA'}, {s:'Perception',st:'INT'}] },
      { roll:  4, description: 'Medical', skills: [{s:'Sleight of Hand',st:'DEX'}, {s:'Detect Lies',st:'INT'}, {s:'First Aid',st:'INT'}] },
      { roll:  5, description: 'Law Enforcement', skills: [{s:'Detect Lies',st:'INT'}, {s:'Handgun',st:'DEX'}, {s:'Investigation',st:'INT'}] },
      { roll:  6, description: 'Gig Worker', skills: [{s:'Driving',st:'DEX'}, {s:'Escape Artist',st:'DEX',printedStat:'STR'}, {s:'Negotiation',st:'CHA'}] },
      { roll:  7, description: 'Teacher', skills: [{s:'Detect Lies',st:'INT'}, {s:'Perception',st:'INT'}, {s:'Performance',st:'CHA',printedStat:'INT'}] },
      { roll:  8, description: 'Office Drone', skills: [{s:'Dumpster Diving',st:'INT'}, {s:'Endurance',st:'CON'}, {s:'Investigation',st:'INT'}] },
      { roll:  9, description: 'Entertainer', skills: [{s:'Deception',st:'CHA'}, {s:'Good First Impression',st:'CHA'}, {s:'Performance',st:'CHA'}] },
      { roll: 10, description: 'Unhoused', skills: [{s:'Dumpster Diving',st:'INT'}, {s:'Streetwise',st:'CHA'}, {s:'Survival',st:'CON'}] },
      { roll: 11, description: 'Middle Manager', skills: [{s:'Deception',st:'CHA'}, {s:'Intimidate',st:'STR'}, {s:'Negotiation',st:'CHA'}] },
      { roll: 12, description: 'Military', skills: [{s:'Handgun',st:'DEX'}, {s:'Survival',st:'CON'}, {s:'Tactics',st:'INT'}] },
    ] },
    hobby: { rank: 3, die: 12, table: 15, rows: [
      { roll:  1, description: 'Collector', skills: [{s:'Fabricate',st:'INT'}, {s:'Determine Value',st:'None'}, {s:'Investigation',st:'INT'}] },
      { roll:  2, description: 'Cosplay', skills: [{s:'Fabricate',st:'INT'}, {s:'Performance',st:'CHA'}, {s:'Salvage',st:'INT'}] },
      { roll:  3, description: 'Drinker', skills: [{s:'Deception',st:'CHA'}, {s:'Intimidate',st:'STR'}, {s:'Streetwise',st:'CHA'}] },
      { roll:  4, description: 'Gamer', skills: [{s:'Aiming',st:'DEX'}, {s:'Perception',st:'INT'}, {s:'Tactics',st:'INT'}] },
      { roll:  5, description: 'Gym Rat', skills: [{s:'Running',st:'DEX'}, {s:'Endurance',st:'CON'}, {s:'Swimming',st:'STR'}] },
      { roll:  6, description: 'Hunting', skills: [{s:'Tracking',st:'INT'}, {s:'Shotgun',st:'DEX'}, {s:'Stealth',st:'DEX'}] },
      { roll:  7, description: 'Music', skills: [{s:'Perception',st:'INT'}, {s:'Performance',st:'CHA'}, {s:'Sleight of Hand',st:'DEX'}] },
      { roll:  8, description: 'Motorsports', skills: [{s:'Driving',st:'DEX'}, {s:'Repair',st:'INT'}, {s:'Salvage',st:'INT'}] },
      { roll:  9, description: 'Climber', skills: [{s:'Climbing',st:'STR'}, {s:'Jumping',st:'STR'}, {s:'Endurance',st:'CON'}] },
      { roll: 10, description: 'Pop Culture', skills: [{s:'Determine Value',st:'None'}, {s:'Investigation',st:'INT'}, {s:'Perception',st:'INT'}] },
      { roll: 11, description: 'Tinkering', skills: [{s:'Engineering',st:'INT'}, {s:'Repair',st:'INT'}, {s:'Salvage',st:'INT'}] },
      { roll: 12, description: 'Travel', skills: [{s:'Endurance',st:'CON'}, {s:'Negotiation',st:'CHA'}, {s:'Streetwise',st:'CHA'}] },
    ] },
  },
  animal: {
    childhood: { rank: 1, die: 6, table: 16, rows: [
      { roll:  1, description: 'Abandoned', skills: [{s:'Hide in Shadows',st:'DEX'}, {s:'Endurance',st:'CON'}, {s:'Survival',st:'CON'}] },
      { roll:  2, description: 'Farmed', skills: [{s:'Escape Artist',st:'DEX'}, {s:'Climbing',st:'STR'}, {s:'Light on Your Feet',st:'DEX'}] },
      { roll:  3, description: 'Litter-Raised', skills: [{s:'Animal Handling',st:'CHA'}, {s:'Detect Lies',st:'INT'}, {s:'Back Claw',st:'STR'}] },
      { roll:  4, description: 'Pampered', skills: [{s:'Negotiation',st:'CHA'}, {s:'Good First Impression',st:'CHA'}, {s:'Persuasion',st:'CHA'}] },
      { roll:  5, description: 'Runt', skills: [{s:'Hide in Shadows',st:'DEX'}, {s:'Escape Artist',st:'DEX'}, {s:'Stealth',st:'DEX'}] },
      { roll:  6, description: 'Stray', skills: [{s:'Back Claw',st:'STR'}, {s:'Streetwise',st:'CHA'}, {s:'Survival',st:'CON'}] },
    ] },
    adolescence: { rank: 1, die: 6, table: 17, rows: [
      { roll:  1, description: 'Clever', skills: [{s:'Investigation',st:'INT'}, {s:'Detect Lies',st:'INT'}, {s:'Dodge',st:'None'}] },
      { roll:  2, description: 'Free Range', skills: [{s:'Escape Artist',st:'DEX'}, {s:'Survival',st:'CON'}, {s:'Tracking',st:'INT'}] },
      { roll:  3, description: 'Pack Mentality', skills: [{s:'Animal Handling',st:'CHA'}, {s:'Persuasion',st:'CHA'}, {s:'Tactics',st:'INT'}] },
      { roll:  4, description: 'Mischievous', skills: [{s:'Deception',st:'CHA'}, {s:'Persuasion',st:'CHA'}, {s:'Sleight of Hand',st:'DEX'}] },
      { roll:  5, description: 'Watcher', skills: [{s:'Ambush',st:'INT'}, {s:'Investigation',st:'INT'}, {s:'Perception',st:'INT'}] },
      { roll:  6, description: 'Well-Trained', skills: [{s:'Light on Your Feet',st:'DEX'}, {s:'Catcher',st:'None'}, {s:'Performance',st:'CHA'}] },
    ] },
    career: { rank: 3, die: 6, table: 18, rows: [
      { roll:  1, description: 'Chow Hound', skills: [{s:'Dumpster Diving',st:'INT'}, {s:'Investigation',st:'INT'}, {s:'Intimidate',st:'STR'}] },
      { roll:  2, description: 'Cuddly', skills: [{s:'Good First Impression',st:'CHA'}, {s:'Persuasion',st:'CHA'}, {s:'Negotiation',st:'CHA'}] },
      { roll:  3, description: 'Curious', skills: [{s:'Climbing',st:'STR'}, {s:'Perception',st:'INT'}, {s:'Swimming',st:'STR'}] },
      { roll:  4, description: 'Hunter', skills: [{s:'Hide in Shadows',st:'DEX'}, {s:'Stealth',st:'DEX'}, {s:'Tracking',st:'INT'}] },
      { roll:  5, description: 'Playful', skills: [{s:'Persuasion',st:'CHA'}, {s:'Dodge',st:'None'}, {s:'Intimidate',st:'STR'}] },
      { roll:  6, description: 'Social', skills: [{s:'Animal Handling',st:'CHA'}, {s:'Taunt',st:'CHA'}, {s:'Perception',st:'INT'}] },
    ] },
    hobby: { rank: 3, die: 6, table: 19, rows: [
      { roll:  1, description: 'Guard', skills: [{s:'Catcher',st:'None'}, {s:'Perception',st:'INT'}, {s:'Taunt',st:'CHA'}] },
      { roll:  2, description: 'Pile of Floof', skills: [{s:'Escape Artist',st:'DEX'}, {s:'Deception',st:'CHA'}, {s:'Persuasion',st:'CHA'}] },
      { roll:  3, description: 'Scrapper', skills: [{s:'Light on Your Feet',st:'DEX'}, {s:'Streetwise',st:'CHA'}, {s:'Survival',st:'CON'}] },
      { roll:  4, description: 'Show Animal', skills: [{s:'Good First Impression',st:'CHA'}, {s:'Light on Your Feet',st:'DEX'}, {s:'Performance',st:'CHA'}] },
      { roll:  5, description: 'Support Animal', skills: [{s:'Determine Value',st:'None'}, {s:'First Aid',st:'INT'}, {s:'Perception',st:'INT'}] },
      { roll:  6, description: 'Working', skills: [{s:'Animal Handling',st:'CHA'}, {s:'Endurance',st:'CON'}, {s:'Perception',st:'INT'}] },
    ] },
  },
};

// Step 9 (p. 113). These are the safety-tools conversation, not decoration:
// the book says to use them to tell your GM what you do AND do not want at
// the table. The wizard presents them that way.
const DCC_STORY_TABLES = {
  pastTrauma: [
    { roll:  1, text: 'I was abused by someone I trusted.' },
    { roll:  2, text: 'I was in a terrible accident.' },
    { roll:  3, text: 'I witnessed a death.' },
    { roll:  4, text: 'I was betrayed by a family member, friend, or lover.' },
    { roll:  5, text: 'I was abandoned by one or more parents.' },
    { roll:  6, text: 'I have a fear of open spaces.' },
    { roll:  7, text: 'I have a fear of the dark or being alone.' },
    { roll:  8, text: 'My home burned down.' },
    { roll:  9, text: 'I was falsely accused of a betrayal or crime.' },
    { roll: 10, text: 'I was deeply humiliated by a family member, friend, or lover.' },
    { roll: 11, text: 'I let someone take the blame for something terrible that I did.' },
    { roll: 12, text: 'I have a fear of heights.' },
  ],
  looseEnd: [
    { roll:  1, text: 'I never finished high school or my college degree.' },
    { roll:  2, text: 'I was about to open a restaurant or other business.' },
    { roll:  3, text: 'I didn\'t finish writing my novel.' },
    { roll:  4, text: 'A family member, friend, or lover recently died, but I couldn\'t say my goodbyes.' },
    { roll:  5, text: 'I was on the verge of inventing or discovering something.' },
    { roll:  6, text: 'I made a promise that I might no longer be able to fulfill.' },
    { roll:  7, text: 'My collection was almost complete.' },
    { roll:  8, text: 'I was about to perform for the first time when the collapse happened.' },
    { roll:  9, text: 'I wanted to dump my partner, but…' },
    { roll: 10, text: 'I was just about to buy or finish renovating my home.' },
    { roll: 11, text: 'I never sent that letter to a family member, friend, or loved one.' },
    { roll: 12, text: 'I never got to travel to my dream destination.' },
  ],
  regret: [
    { roll:  1, text: 'I didn\'t ask them to marry me.' },
    { roll:  2, text: 'I turned down the perfect job.' },
    { roll:  3, text: 'I stayed quiet when I shouldn\'t have.' },
    { roll:  4, text: 'I chose my own safety when I should have leapt into action.' },
    { roll:  5, text: 'I never said goodbye.' },
    { roll:  6, text: 'I spent way too much time on something pointless.' },
    { roll:  7, text: 'I did something illegal, immoral, and probably both.' },
    { roll:  8, text: 'I lied to avoid an event important to those close to me.' },
    { roll:  9, text: 'I kept a secret that hurt someone badly.' },
    { roll: 10, text: 'I didn\'t apologize for something terrible that I did.' },
    { roll: 11, text: 'I abandoned someone when they needed me the most.' },
    { roll: 12, text: 'I trusted the wrong people.' },
  ],
};

// Step 2 (p. 106). Everyone gets a free combat Skill at Rank 3 -- Unarmed
// Combat for humans, Slice Attack for animals -- then ONE of three routes for
// the second, also at Rank 3. Weapon options are read from the Skills
// catalogue by category so the two can never drift apart.
const DCC_FREE_COMBAT_SKILL = { human: 'Unarmed Combat', animal: 'Slice Attack' };
const DCC_WEAPON_CATEGORIES = [
  { category: 'Bashing Weapon', skills: ['Club', 'Improvised Weapons', 'Warhammer'] },
  { category: 'Edged Weapon', skills: ['Axe', 'Dagger', 'Longsword', 'Rapier'] },
  { category: 'Ranged Weapon', skills: ['Bow', 'Crossbow', 'Handgun', 'Javelin', 'Shotgun', 'Shuriken', 'Slingshot'] },
  { category: 'Reach Weapon', skills: ['Herding Weapons', 'Lance', 'Polearm', 'Quarterstaff'] },
];

// Requires Intelligence 4+, which is set on the NEXT screen -- the wizard has
// to carry that constraint forward. Grants 5 Standard Mana Potions.
const DCC_STARTING_SPELLS = [
  'Dirt Clod',
  'Fire Fingers',
  'Frost Scar',
  'Mind Tickle',
  'Shock Treatment',
  'Soul Collector',
  'Vine Porn',
];
const DCC_STARTING_SPELL_MIN_INT = 4;
const DCC_STARTING_SPELL_POTIONS = 5;

// Arrive unarmed and the AI gives you a Skill, its Damage Effect, an
// achievement, and a Bronze Weapon Box containing the weapon you should have
// brought -- with a drawback.
const DCC_HAND_TO_HAND = [
  { skill: 'Pugilism', damageEffect: 'Iron Punch' },
  { skill: 'Foot Soldier', damageEffect: 'Smush' },
  { skill: 'Noggin Nocker', damageEffect: 'Skullcracker' },
  { skill: 'Wrasslin\'', damageEffect: 'Toss' },
];

// Phase 2 (pp. 115-118): advancing a finished Floor-1 crawler to the floor
// you actually start on. Stat points = (Level - 1) x 3, and they must be spent
// BEFORE Race and Class, which have Stat prerequisites.
const DCC_FLOOR_START = [
  { floor: 3, level: 10, statPoints: 27, primaryBump: '2d4', otherBump: '1d4', rankCap: 10 },
  { floor: 4, level: 20, statPoints: 57, primaryBump: '2d4', otherBump: '1d4', rankCap: 10 },
];
const DCC_CREATION_STEPS = [
  { id: 'identity', label: 'Who are you' },
  { id: 'background', label: 'Background' },
  { id: 'combat', label: 'How you fight' },
  { id: 'stats', label: 'Stats' },
  { id: 'story', label: 'Scars' },
  { id: 'gear', label: 'What you brought' },
  { id: 'tutorial', label: 'The tutorial floors' },
  { id: 'raceclass', label: 'Race & Class' },
  { id: 'review', label: 'Review' },
];

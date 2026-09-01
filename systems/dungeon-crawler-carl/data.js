// systems/dungeon-crawler-carl/data.js — rules data.
//
// Source: DCC RPG Core Rulebook (Royal Court Edition), Renegade Game Studios.
// Page references are to that book.
//
// SCOPE: phases D0–D2 only — the numbers the core engine and the crawler sheet
// need. The big catalogues (Skills D3, Spells/Loot D7, Races & Classes D6) are
// deliberately absent; see PLAN.md §11 for why they must be extracted and
// verified catalogue-by-catalogue rather than bulk-parsed.

// ─── the five core stats (p. 56) ────────────────────────────────────────────
const DCC_STATS = [
  { id: 'STR', name: 'Strength',     desc: 'Physical power. Backbone of brawn and physical combat.' },
  { id: 'INT', name: 'Intelligence', desc: 'Smarts and knowledge. Sets your Mana, 1:1.' },
  { id: 'CON', name: 'Constitution', desc: 'Toughness. Determines your Health Bar.' },
  { id: 'DEX', name: 'Dexterity',    desc: 'Agility and coordination. Enhances Evade.' },
  { id: 'CHA', name: 'Charisma',     desc: 'Presence. Attracts viewers.' },
];

// Table 2 / Table 20 (pp. 57, 110). The Mod comes off the ENHANCED value.
const DCC_STAT_MODS = [
  { min: 1,   max: 2,    mod: 1 },
  { min: 3,   max: 5,    mod: 2 },
  { min: 6,   max: 9,    mod: 3 },
  { min: 10,  max: 19,   mod: 4 },
  { min: 20,  max: 49,   mod: 5 },
  { min: 50,  max: 99,   mod: 6 },
  { min: 100, max: 149,  mod: 7 },
  { min: 150, max: 199,  mod: 8 },
  { min: 200, max: 299,  mod: 9 },
  { min: 300, max: Infinity, mod: 10 },
];

function dccStatMod(enhancedValue) {
  const v = Number(enhancedValue) || 0;
  if (v < 1) return 0;                       // a 0 score is off the table entirely
  const row = DCC_STAT_MODS.find(r => v >= r.min && v <= r.max);
  return row ? row.mod : 0;
}

// ─── character creation constants (pp. 109–112) ─────────────────────────────
const DCC_STANDARD_ARRAY = [2, 3, 4, 5, 6];   // assign each exactly once
const DCC_BASE_MOVE = 20;                     // feet, Move Action
const DCC_BASE_STEP = 10;                     // feet, free per Action
const DCC_HB_SLOTS = 10;                      // crawlers always have 10
const DCC_HOTLIST_SLOTS = 10;
const DCC_MAX_EXTERNAL_BUFFS = 3;             // "The Rule of Three", p. 96
const DCC_SKILL_RANK_SOFT_CAP = 15;           // 20 only where a Race/Class allows
const DCC_LEVEL_CAP = 250;

// Table 21 (p. 112). Humans are Medium (4).
const DCC_SIZES = [
  { n: 1, name: 'Tiny',   eg: 'Scatterer, Rat' },
  { n: 2, name: 'Small',  eg: 'Cat, Raccoon' },
  { n: 3, name: 'Petite', eg: 'Dog, Boar' },
  { n: 4, name: 'Medium', eg: 'Chimpanzee, Wolf' },
  { n: 5, name: 'Large',  eg: 'Horse, Mantaur' },
];

// ─── damage (Table 10, p. 93) ───────────────────────────────────────────────
const DCC_DAMAGE_TYPES = [
  { id: 'bludgeoning', name: 'Bludgeoning', rarity: 'Common' },
  { id: 'fire',        name: 'Fire',        rarity: 'Common' },
  { id: 'piercing',    name: 'Piercing',    rarity: 'Common' },
  { id: 'poison',      name: 'Poison',      rarity: 'Common' },
  { id: 'slashing',    name: 'Slashing',    rarity: 'Common' },
  { id: 'acid',        name: 'Acid',        rarity: 'Uncommon' },
  { id: 'electric',    name: 'Electric',    rarity: 'Uncommon' },
  { id: 'force',       name: 'Force',       rarity: 'Uncommon' },
  { id: 'holy',        name: 'Holy',        rarity: 'Uncommon' },
  { id: 'ice',         name: 'Ice',         rarity: 'Uncommon' },
  { id: 'necrotic',    name: 'Necrotic',    rarity: 'Uncommon' },
  { id: 'psychic',     name: 'Psychic',     rarity: 'Uncommon' },
  { id: 'sonic',       name: 'Sonic',       rarity: 'Uncommon' },
];

// ─── gear slots (p. 98) ─────────────────────────────────────────────────────
// One item each, except Accessories. Hands/Holding is special: a pair of gloves
// plus one item per hand; a two-handed weapon consumes both.
const DCC_GEAR_SLOTS = [
  { id: 'head',        name: 'Head',          max: 1,  eg: 'helmets, bandanas, cunning hats' },
  { id: 'torso',       name: 'Torso',         max: 1,  eg: 'shirts, jerkins, breastplates' },
  { id: 'arms',        name: 'Arms',          max: 1,  eg: 'bracers, elbow pads' },
  { id: 'legs',        name: 'Legs',          max: 1,  eg: 'pants, skirts, kilts' },
  { id: 'feet',        name: 'Feet',          max: 1,  eg: 'boots, sandals, socks' },
  { id: 'hands',       name: 'Hands/Holding', max: 3,  eg: 'gloves, plus one item per hand' },
  { id: 'accessories', name: 'Accessories',   max: 10, eg: 'rings, amulets, tattoos, belts, capes' },
];

// ─── degrees of success & failure (p. 60) ───────────────────────────────────
// Crits do NOT also trigger the by-10 results; the single highest degree wins.
const DCC_DEGREES = [
  { id: 'crit_hit',  name: 'Critical Hit',    good: true,  note: 'Natural 20 — the best possible result.' },
  { id: 'amazing',   name: 'Amazing Success', good: true,  note: 'Beat the Difficulty by 10 or more.' },
  { id: 'success',   name: 'Success',         good: true,  note: 'Met or beat the Difficulty.' },
  { id: 'near_miss', name: 'Near Miss',       good: false, note: 'Missed by 1–2. The GM tells you this one.' },
  { id: 'fail',      name: 'Fail',            good: false, note: 'Missed by 3–9. Consider failing forward.' },
  { id: 'major_fail',name: 'Major Fail',      good: false, note: 'Missed by 10 or more. Consequences.' },
  { id: 'crit_fail', name: 'Critical Fail',   good: false, note: 'Natural 1 — the worst possible outcome.' },
];

// Classify a finished Check. `nat` is the raw d20 face (after adv/disadv).
function dccDegree(total, difficulty, nat) {
  if (nat === 20) return 'crit_hit';
  if (nat === 1)  return 'crit_fail';
  const d = total - difficulty;
  if (d >= 10) return 'amazing';
  if (d >= 0)  return 'success';
  if (d >= -2) return 'near_miss';
  if (d >= -9) return 'fail';
  return 'major_fail';
}

// ─── difficulty formulas (p. 59) ────────────────────────────────────────────
// The GM never rolls a d20; a Mob's quality is a Difficulty the player rolls at.
function dccDifficulty(kind, floor, antagonistMod) {
  const F = Number(floor) || 0;
  if (kind === 'opposed')   return 10 + (Number(antagonistMod) || 0) + F;
  if (kind === 'unopposed') return 10 + (F * 2);
  if (kind === 'stat')      return 10 + F;
  return 10 + F;
}
const DCC_CHECK_KINDS = [
  { id: 'unopposed', name: 'Unopposed', hint: '10 + (Floor × 2) — climbing, endurance, surviving the dungeon' },
  { id: 'opposed',   name: 'Opposed',   hint: "10 + antagonist's Stat Mod + Floor — social, combat" },
  { id: 'stat',      name: 'Stat Check', hint: '10 + Floor — resisting an effect, no Skill Ranks added' },
];

// How a Skill or Spell is checked, as the catalogue records it. Separate from
// the difficulty kinds above: this says what you are rolling AGAINST, and it is
// the vocabulary a player picks from when describing a Skill the book has not
// got.
const DCC_SKILL_CHECK_TYPES = [
  { value: 'evade',     label: 'vs Evade (an attack)' },
  { value: 'unopposed', label: 'Unopposed' },
  { value: 'opposed',   label: 'Opposed' },
  { value: 'passive',   label: 'Passive — never rolled' },
];

// ─── the Health Bar (pp. 93–94) ─────────────────────────────────────────────
// Damage is NOT subtracted. Walk the unmarked slots consuming one slot per
// `slotValue` of damage; the remainder that cannot fill a whole slot is lost.
// Returns how many slots the hit costs.
function dccSlotsLost(damage, slotValue, slotsRemaining) {
  const v = Number(slotValue) || 0;
  let dmg = Number(damage) || 0;
  if (v <= 0 || dmg < v) return 0;              // less than one slot ⇒ no damage
  const lost = Math.floor(dmg / v);
  return Math.min(lost, Math.max(0, slotsRemaining));
}

// ─── resting & mending (p. 94) ──────────────────────────────────────────────
const DCC_RESTS = [
  { id: 'short', name: 'Short Rest', hours: 2,  hb: 5,   mana: 'half',  note: 'Heal 5 HB slots, regain half your max Mana (round down).' },
  { id: 'long',  name: 'Long Rest',  hours: 8,  hb: 'full', mana: 'full', note: 'Full Health Bar and Mana. Clears all Fatigued.' },
  { id: 'day',   name: "Full Day's Rest", hours: 30, hb: 'full', mana: 'full', note: 'Full recovery, and the only way back from long-term injuries.' },
];
const DCC_MEND_PER_HOUR = { hb: 1, mana: 5 };   // per idle hour outside combat
const DCC_HOURS_PER_DAY = 30;
const DCC_FLOOR_DAYS = { 3: 8, 4: 10, 5: 15 };  // days before the floor collapses

// ─── debuffs (Table 11, p. 97) ──────────────────────────────────────────────
// `F` in a damage string is the Floor Number.
const DCC_DEBUFFS = [
  { id: 'blinded',      name: 'Blinded',      stackable: false, effect: 'Roll all Skill Checks that require sight with Disadvantage.', duration: 'Until the end of the next round.' },
  { id: 'blood_trail',  name: 'Blood Trail',  stackable: true,  effect: 'You take 1d6+F at the end of each round.', duration: 'Until cured with a bandage or a First Aid Skill Check.' },
  { id: 'burned',       name: 'Burned',       stackable: false, effect: 'You take 1d10+F Fire damage at the end of each round.', duration: 'Until the end of combat or 5 minutes. As an Action, a DEX Stat Check extinguishes the flames.' },
  { id: 'drowning',     name: 'Drowning',     stackable: false, effect: 'You take 1d6+F damage at the end of each round.', duration: 'Until your head is above water.' },
  { id: 'dying',        name: 'Dying',        stackable: false, effect: 'You are at 0% HB. No Actions, Move, speech or HUD. Your CON Mod is how many rounds you have.', duration: 'Until you die or heal at least 1 HB slot.' },
  { id: 'enraged',      name: 'Enraged',      stackable: false, effect: 'You may only perform Attack and Move Actions.', duration: 'Until the end of 2 rounds or 20 seconds.' },
  { id: 'fatigued',     name: 'Fatigued',     stackable: true,  effect: '−1 penalty on all Checks and your Move is halved.', duration: 'Until the end of a long rest.' },
  { id: 'held',         name: 'Held',         stackable: false, effect: "No Move Actions or Steps, but you may still Evade. Attacks against you are made with Advantage.", duration: 'Until released, or you escape with a STR-Opposed Escape Artist Check.' },
  { id: 'lt_major_injury', name: 'Long-Term Major Injury', stackable: false, effect: '−5 penalty to all Checks.', duration: 'Until the end of a full day of rest.' },
  { id: 'lt_minor_injury', name: 'Long-Term Minor Injury', stackable: false, effect: '−2 penalty to all Checks.', duration: 'Until the end of a long rest.' },
  { id: 'major_injury', name: 'Major Injury', stackable: false, effect: '−5 penalty to all Checks. Gaining it a second time makes it Long-Term.', duration: 'Until the end of a long rest.' },
  { id: 'minor_injury', name: 'Minor Injury', stackable: false, effect: '−2 penalty to all Checks. Gaining it a second time makes it Long-Term.', duration: 'Until the end of a short rest.' },
  { id: 'muted',        name: 'Muted',        stackable: false, effect: "You can't speak or cast Spells.", duration: 'Until the end of combat or 5 minutes.' },
  { id: 'paralyzed',    name: 'Paralyzed',    stackable: false, effect: "You can't take any Actions.", duration: 'Until the end of the next round.' },
  { id: 'poisoned',     name: 'Poisoned',     stackable: true,  effect: 'You take 1d8+F Poison damage at the end of each round.', duration: 'Until treated with an antidote.' },
  { id: 'queasy',       name: 'Queasy',       stackable: false, effect: 'If your next Action requires a roll, it is made with Disadvantage.', duration: 'At the end of the next Action you take.' },
  { id: 'sepsis',       name: 'Sepsis',       stackable: false, effect: "You're Staggered and take 1d10+F Poison damage at the end of each round.", duration: 'As Staggered; the damage continues until you are healed.' },
  { id: 'shit_faced',   name: 'Shit-Faced',   stackable: false, effect: 'You make all your Checks with Disadvantage.', duration: 'Until the end of 10 minutes.' },
  { id: 'shocked',      name: 'Shocked',      stackable: false, effect: 'You lose your next Action.', duration: 'Once you forfeit that Action.' },
  { id: 'sore',         name: 'Sore as Shit', stackable: false, effect: '−1 penalty to all rolls.', duration: 'Until the end of 1 hour.' },
  { id: 'staggered',    name: 'Staggered',    stackable: false, effect: "Your next Action can't be a Move; an Attack is made with Disadvantage; no 10ft Step.", duration: 'At the end of the next Action you take.' },
  { id: 'stiff_legs',   name: 'Stiff Legs',   stackable: false, effect: "You can't take 10ft Steps.", duration: 'Until the end of combat or 5 minutes.' },
  { id: 'stunned',      name: 'Stunned',      stackable: false, effect: 'Disadvantage on your next Check.', duration: 'Once you make a Check.' },
  { id: 'take_down',    name: 'Take Down',    stackable: false, effect: 'You fall prone. While prone, all Attacks against you are made with Advantage.', duration: 'Use your 10ft Step to stand.' },
  { id: 'terrified',    name: 'Terrified',    stackable: false, effect: "No Move Actions or Steps. You make all Attacks with Disadvantage.", duration: 'Until the end of the next round, or you take at least 1 HB slot of damage.' },
  { id: 'the_taint',    name: 'The Taint',    stackable: false, effect: "You can't be healed.", duration: 'Until the end of combat or 5 minutes.' },
  { id: 'woozy',        name: 'Woozy',        stackable: false, effect: "You can't add your DEX Mod to Attack or Evade Checks.", duration: 'Until the end of the next round.' },
];

// ─── mobs & bosses (Tables 50–51, pp. 270–271) — used by the D9 generators ───
const DCC_BOSS_TIERS = [
  { id: 'neighborhood', name: 'Neighborhood Boss', statsPerLevel: 3,  hbSlots: '10 + F', levels: 1 },
  { id: 'borough',      name: 'Borough Boss',      statsPerLevel: 4,  hbSlots: '15 + F', levels: 2 },
  { id: 'city',         name: 'City Boss',         statsPerLevel: 5,  hbSlots: '20 + F', levels: 3 },
  { id: 'province',     name: 'Province Boss',     statsPerLevel: 6,  hbSlots: '25 + F', levels: 4 },
  { id: 'country',      name: 'Country Boss',      statsPerLevel: 8,  hbSlots: '30 + F', levels: 5 },
  { id: 'floor',        name: 'Floor Boss',        statsPerLevel: 10, hbSlots: '40 + F', levels: 6 },
];
const DCC_MOB_LEVEL_BANDS = [
  { min: 1,   max: 4,   dice: 1, floors: '1' },
  { min: 5,   max: 9,   dice: 2, floors: '2' },
  { min: 10,  max: 29,  dice: 3, floors: '3–4' },
  { min: 30,  max: 59,  dice: 5, floors: '5–7' },
  { min: 60,  max: 99,  dice: 7, floors: '8–10' },
  { min: 100, max: 159, dice: 9, floors: '11–13' },
];
// Table 49 (p. 268): mob count by party size and intended pressure.
const DCC_ADVERSARY_POWER = {
  weak:         { 2: 1, 3: 2, 4: 2, 5: 3, 6: 3,  7: 4 },
  moderate:     { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6,  7: 7 },
  strong:       { 2: 3, 3: 5, 4: 6, 5: 8, 6: 9,  7: 11 },
  overwhelming: { 2: 4, 3: 6, 4: 8, 5: 10, 6: 12, 7: 14 },
};

// ─── popularity triggers (p. 280) ───────────────────────────────────────────
// Deliberately a checklist: these fire from narrative events on fixed cadences,
// not from spending a resource.
const DCC_POPULARITY_TRIGGERS = [
  { delta: +1, cadence: 'session', text: 'You rolled a Critical Hit or Critical Fail in a fight or a life-or-death Check' },
  { delta: +1, cadence: 'session', text: 'You performed a courageous act (not just using Catcher)' },
  { delta: +1, cadence: 'session', text: 'You came up with an original, entertaining solution to a problem — and it worked' },
  { delta: +1, cadence: 'day',     text: 'You appeared on the end-of-day recap episode' },
  { delta: +1, cadence: 'floor',   text: 'Your Pet did something cute on the Floor' },
  { delta: +1, cadence: 'floor',   text: 'Your Charisma is 5 × Floor or higher' },
  { delta: +1, cadence: 'floor',   text: 'You used an original catchphrase — memorably, not annoyingly' },
  { delta: -1, cadence: 'session', text: 'You avoided a fight' },
  { delta: -1, cadence: 'session', text: 'You were boring (hid in a saferoom for hours) or gross' },
  { delta: -1, cadence: 'floor',   text: 'You used a big, boring d10+ damage Attack as your primary Attack' },
  { delta: -1, cadence: 'floor',   text: 'Your Charisma is only 2 × Floor or lower' },
  { delta: -1, cadence: 'floor',   text: 'You entered the stairwell more than 30 hours early' },
  { delta: -1, cadence: 'floor',   text: 'You were grinding for more than 15 of the final 30 hours' },
];

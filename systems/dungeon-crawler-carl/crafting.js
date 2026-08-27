// systems/dungeon-crawler-carl/crafting.js — crafting (D7, pp. 221-227).
//
// Tables 44, 45, 47 and 48. Each was extracted against a known set of row keys
// so a missing or renamed row fails the build rather than shrinking the table
// quietly. Every Skill named in Table 45 is asserted to exist in DCC_SKILLS.
//
// Tables 43 (item sizes) and 46 (bonus level examples) are not here yet: they
// are reference the app does not act on, and they interleave with the prose
// more badly than these four.

// Which crafting table makes what (Table 44).
const DCC_CRAFTING_TABLES = [
  { id: 'alchemy', table: 'Alchemy', makes: 'Potions and poisons' },
  { id: 'arcanist', table: 'Arcanist', makes: 'Imbuing items with inherent Spells' },
  { id: 'armorer', table: 'Armorer', makes: 'Armor' },
  { id: 'engineering', table: 'Engineering', makes: 'Making things with moving parts, fluids, and/or chemicals (such as bullets)' },
  { id: 'metalworking', table: 'Metalworking', makes: 'Weapons' },
  { id: 'sapper-s', table: 'Sapper\'s', makes: 'Explosives' },
  { id: 'writing', table: 'Writing', makes: 'Scrolls' },
];

// Which Skill you need to craft a thing (Table 45). `skills` is a list because
// Explosives can be made with either of two.
const DCC_CRAFTING_SKILLS = [
  { id: 'damage-resistance', item: 'Damage Resistance', skills: ['Smithing'] },
  { id: 'explosives', item: 'Explosives', skills: ['Explosives Handling', 'Goblin Explosives'] },
  { id: 'potions', item: 'Potions', skills: ['Alchemy'] },
  { id: 'scrolls', item: 'Scrolls', skills: ['Calligraphy'] },
  { id: 'spells', item: 'Spells', skills: ['Arcane'] },
  { id: 'tattoos', item: 'Tattoos', skills: ['Tattoo Artistry'] },
];

// What you get back from a failed craft, by how far you missed (Table 47).
const DCC_SALVAGE = [
  { band: '10+', min: 10, max: 999, result: 'You messed things up so bad that there is nothing left to salvage.*' },
  { band: '3-9', min: 3, max: 9, result: 'You can salvage half of the raw material.*' },
  { band: '1-2', min: 1, max: 2, result: 'You can fully salvage the raw materials.' },
];

// What mixing two potions produced, by degree of success (Table 48).
const DCC_CONCOCTIONS = [
  { degree: 'crit_hit', label: 'Critical Hit', effect: 'You created something unique, more powerful than the ingredients used, and are credited as the inventor. You collect 1 gold every time someone uses a copy of your creation.' },
  { degree: 'amazing', label: 'Amazing Success', effect: 'You have something at least as good as the effects of the two potions, but it could produce unexpectedly bitchin\' results.' },
  { degree: 'success', label: 'Standard Success', effect: 'Your creation only slightly improves one of the two base potions. For example, combining a healing potion and a mana potion might only create a new mana potion that also heals 1 Health Bar slot.' },
  { degree: 'near_miss', label: 'Near Miss or Failure', effect: 'Your mixture is smelly and unsuited for further use. No salvage is possible.' },
  { degree: 'crit_fail', label: 'Critical Fail', effect: 'It blows up in your face, dealing you Xd6 Acid damage, where X is the bonus level you aimed for. Or the GM might come up with a disaster more befitting the potions used or the intended creation.' },
];

// A concoction table row covers more than one degree: 'Near Miss or Failure'
// also answers a Standard Fail and a Major Fail.
const DCC_CONCOCTION_FALLBACK = { fail: 'near_miss', major_fail: 'near_miss' };

function dccCraftingSkillFor(item) {
  const n = String(item || '').toLowerCase();
  return DCC_CRAFTING_SKILLS.find(r => r.item.toLowerCase() === n) || null;
}
// How far you missed by decides what is left of your materials.
function dccSalvageFor(missedBy) {
  const m = Number(missedBy) || 0;
  if (m <= 0) return null;
  return DCC_SALVAGE.find(s => m >= s.min && m <= s.max) || null;
}
function dccConcoctionFor(degreeId) {
  const id = DCC_CONCOCTION_FALLBACK[degreeId] || degreeId;
  return DCC_CONCOCTIONS.find(c => c.degree === id) || null;
}

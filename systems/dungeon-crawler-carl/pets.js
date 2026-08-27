// systems/dungeon-crawler-carl/pets.js — Pets, Mounts and Minions (D7, pp. 228-233).
//
// This section of the book is rules prose rather than tables, so there is
// nothing here to extract: the mechanics are written out as functions instead,
// which is both more useful to the app and keeps the book's wording in the book.
//
// The rules encoded, all from pp. 231-233:
//   - a pet gains TWO levels for each one the crawler gains, until the pet
//     reaches level 15; after that it levels at the same rate
//   - a pet gets 3 Stat points per level, placeable anywhere EXCEPT Intelligence
//   - a pet has no trackable Skill Ranks. Its Rank for Attacks, Spells and
//     abilities is the FLOOR NUMBER, even at level 1, and does not improve by
//     grinding, training or potions
//   - a pet's Attacks gain an extra base damage die at Ranks 5, 10 and 15 —
//     which, since Rank is the floor, means on floors 5, 10 and 15
//   - at level 15 a pet is mature and stops growing
//   - a mount has one Action per round, taken in the Crawler Action Phase, does
//     not attack unless it has Trample or similar, and costs a Move Action to
//     mount or dismount
//   - Spells and effects that work on pets typically also work on minions

const DCC_PET_DOUBLE_UNTIL = 15;      // pet level at which double-speed stops
const DCC_PET_STAT_POINTS_PER_LEVEL = 3;
const DCC_PET_UPGRADE_RANKS = [5, 10, 15];

const DCC_COMPANION_KINDS = [
  {
    id: 'pet', label: 'Pet',
    note: 'Levels twice as fast as you until level 15. Its Rank for Attacks, Spells and '
        + 'abilities is the Floor Number, and no amount of grinding changes that.',
  },
  {
    id: 'mount', label: 'Mount',
    note: 'One Action per round, taken during the Crawler Action Phase. Does not attack '
        + 'unless it has Trample or similar. Mounting or dismounting costs a Move Action.',
  },
  {
    id: 'minion', label: 'Minion',
    note: 'Subservient creatures, animated corpses or objects that fight or run errands. '
        + 'Spells and effects that work on pets usually work on these too.',
  },
];

// A pet's level, given how many levels its crawler has gained since it joined.
// Two per level while the pet is under 15, then one per level.
function dccPetLevel(crawlerLevelsGained) {
  const n = Math.max(0, Number(crawlerLevelsGained) || 0);
  const doubled = 1 + 2 * n;
  if (doubled <= DCC_PET_DOUBLE_UNTIL) return doubled;
  // levels needed to reach the cap at double speed, then one per level after
  const nAtCap = (DCC_PET_DOUBLE_UNTIL - 1) / 2;
  return DCC_PET_DOUBLE_UNTIL + (n - nAtCap);
}

// 3 Stat points per level gained, and none of them may go into Intelligence.
function dccPetStatPoints(fromLevel, toLevel) {
  const gained = Math.max(0, (Number(toLevel) || 0) - (Number(fromLevel) || 0));
  return gained * DCC_PET_STAT_POINTS_PER_LEVEL;
}
const DCC_PET_STAT_EXCLUDED = 'INT';

// A pet rolls at the Floor Number, whatever its level.
function dccPetRank(floor) {
  return Math.max(0, Number(floor) || 0);
}

// Extra base damage dice on a pet's Attacks: one at each of Ranks 5, 10 and 15,
// and since a pet's Rank IS the floor, that means on those floors.
function dccPetAttackDice(floor) {
  const r = dccPetRank(floor);
  return DCC_PET_UPGRADE_RANKS.filter(x => r >= x).length;
}

function dccPetIsMature(petLevel) {
  return (Number(petLevel) || 0) >= DCC_PET_DOUBLE_UNTIL;
}

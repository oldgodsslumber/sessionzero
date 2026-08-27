// systems/dungeon-crawler-carl/combat.js — the combat tracker (D8).
//
// DCC's round is a fixed five-step loop (p. 81), and the tracker is built on it
// rather than on a turn order, because that is how the game actually plays:
//
//   1 Mob Action Declaration   the GM says what the Mobs are about to do
//   2 Crawler Reaction Phase   crawlers may spend Actions on Interrupts
//   3 Mob Action Resolution    the declared Mob Actions happen
//   4 Crawler Action Phase     crawlers act
//   5 Clean Up                 ongoing effects tick, counters advance
//
// The GM never rolls a d20. A Mob's quality is a Difficulty the players roll
// against, so there is nothing here to roll for the other side — Advantage and
// Disadvantage on a Mob move its Difficulty by 5 instead (p. 60).
//
// State lives in S.conflict, which is what multiplayer already syncs, so a
// tracker opened by the GM shows up at the whole table.

const DCC_COMBAT_STEPS = [
  { n: 1, name: 'Mob Action Declaration',
    hint: 'Say what the Mobs are about to do. Nothing is rolled: their Attack values are the '
        + 'Difficulty the crawlers will roll against.' },
  { n: 2, name: 'Crawler Reaction Phase',
    hint: 'Interrupts only — Evade, Catcher, Taunt, Intervene, Heal. These still cost one of '
        + 'the two Actions a crawler has this round.' },
  { n: 3, name: 'Mob Action Resolution',
    hint: 'Resolve what was declared, minus anything the crawlers just changed.' },
  { n: 4, name: 'Crawler Action Phase',
    hint: 'Crawlers spend whatever Actions they have left. Each Action also allows a 10ft Step.' },
  { n: 5, name: 'Clean Up',
    hint: 'Damaging Debuffs tick, durations count down, Dying crawlers lose a round. '
        + 'Then the next round begins.' },
];

// Actions per round, by what you are (pp. 64, 270).
const DCC_ACTIONS = {
  crawler: 2,          // "each crawler gets two Actions each round"
  mob: 2,              // 1 Move and 1 other, usually an Attack
  boss: null,          // 1 per crawler — worked out from the party size
};

const DCC_SIDES = [
  { id: 'crawler', label: 'Crawler' },
  { id: 'mob', label: 'Mob' },
  { id: 'boss', label: 'Boss' },
];

function dccCombatInit() {
  return { systemId: 'dungeon-crawler-carl', active: false, round: 1, step: 0,
           combatants: [], log: [] };
}

// A Boss gets one Action per crawler, even after a crawler dies (p. 270).
function dccActionsFor(side, state) {
  if (side === 'boss') {
    const crawlers = (state.combatants || []).filter(c => c.side === 'crawler').length;
    return Math.max(1, crawlers);
  }
  return DCC_ACTIONS[side] || 2;
}

function dccCombatRender(ctx) {
  const c = ctx.state;
  let h = `<div class="pg-title">${esc(lexU('team'))} Combat</div>
    <div class="pg-sub">The five-step round</div>`;

  if (!c.active) {
    h += `<div class="tac" style="padding:26px">
      <div style="font-size:34px;margin-bottom:8px">&#9876;</div>
      <div style="color:var(--muted);font-size:13px;margin-bottom:14px">
        Nothing is trying to kill you at the moment.</div>
      <button class="btn btn-primary" onclick="dccCombatStart()">Start combat</button></div>`;
    return h;
  }

  const step = DCC_COMBAT_STEPS[c.step] || DCC_COMBAT_STEPS[0];
  h += `<div class="card" style="border-color:var(--accent)">
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <div><span class="label" style="margin:0">Round</span>
        <span style="font-size:22px;font-weight:800;margin-left:6px">${c.round}</span></div>
      <button class="btn btn-secondary btn-xs" onclick="dccCombatEnd()">End combat</button></div>
    <div style="display:flex;gap:3px;margin:8px 0">`;
  DCC_COMBAT_STEPS.forEach((s, i) => {
    h += `<div onclick="dccCombatGoto(${i})" title="${esc(s.name)}"
      style="flex:1;height:6px;border-radius:3px;cursor:pointer;background:${
        i === c.step ? 'var(--accent)' : i < c.step ? 'var(--accent2)' : 'var(--surface3)'}"></div>`;
  });
  h += `</div>
    <div style="font-size:15px;font-weight:700">${step.n}. ${esc(step.name)}</div>
    <div style="font-size:11px;color:var(--muted);margin-top:2px">${esc(step.hint)}</div>
    <button class="btn btn-primary btn-full" style="margin-top:8px" onclick="dccCombatNext()">
      ${c.step === DCC_COMBAT_STEPS.length - 1 ? 'Clean up and start round ' + (c.round + 1) : 'Next step →'}
    </button></div>`;

  // ── combatants ────────────────────────────────────────────────────────────
  h += `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <div class="label" style="margin:0">In the fight</div>
    <div style="display:flex;gap:4px">
      <input id="dcc-cb-name" placeholder="Name" style="width:118px;padding:5px">
      <select id="dcc-cb-side" style="width:88px">
        ${DCC_SIDES.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
      </select>
      <button class="btn btn-secondary btn-xs" onclick="dccCombatAdd()">Add</button>
    </div></div>`;

  if (!c.combatants.length) {
    h += `<div style="font-size:12px;color:var(--muted);padding:8px 0">Nobody yet.</div>`;
  }
  c.combatants.forEach((m, i) => {
    const max = m.maxActions || dccActionsFor(m.side, c);
    const dying = m.dying !== null && m.dying !== undefined;
    h += `<div style="padding:6px 0;border-bottom:1px solid var(--border);${dying ? 'opacity:.75' : ''}">
      <div style="display:flex;align-items:center;gap:6px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700">${esc(m.name)}
            <span style="font-size:9px;color:var(--muted);font-weight:400">${esc(m.side)}</span>
            ${dying ? `<span style="font-size:9px;color:var(--red)">DYING &mdash; ${m.dying} round${m.dying === 1 ? '' : 's'}</span>` : ''}
          </div>
          ${(m.debuffs || []).length ? `<div style="font-size:10px;color:var(--red)">${m.debuffs.map(esc).join(' · ')}</div>` : ''}
        </div>
        <div style="display:flex;gap:2px;align-items:center" title="Actions left this round">`;
    for (let a = 0; a < max; a++) {
      const spent = a < (max - (m.actions === undefined ? max : m.actions));
      h += `<div onclick="dccCombatAction(${i},${a})"
        style="width:15px;height:15px;border-radius:50%;cursor:pointer;
        border:2px solid ${spent ? 'var(--border)' : 'var(--accent)'};
        background:${spent ? 'transparent' : 'var(--accent)'}"></div>`;
    }
    h += `</div>
        <button class="btn btn-secondary btn-xs" onclick="dccCombatDebuff(${i})">Debuff</button>
        <button class="btn btn-secondary btn-xs" onclick="dccCombatDrop(${i})">&#10005;</button>
      </div></div>`;
  });
  h += `</div>`;

  // ── reference the GM actually needs mid-fight ─────────────────────────────
  h += `<div class="card"><div class="label mb-1">While you are here</div>
    <div style="font-size:11px;color:var(--muted);line-height:1.7">
      A Mob with Advantage adds <strong>5 to its Difficulty</strong>; with Disadvantage it loses 5,
      and the target gets a free Evade Check.<br>
      Damage is not subtracted &mdash; it consumes whole Health Bar slots, and anything left over
      that cannot fill a slot is lost.<br>
      A crawler at 0% is <strong>Dying</strong> for CON Mod rounds, minus one every time they are
      damaged again.<br>
      Debuff damage lands in Clean Up and bypasses DR, though Resistances and Immunities still apply.
    </div></div>`;

  if ((c.log || []).length) {
    h += `<div class="card"><div class="label mb-1">This fight</div>
      <div style="max-height:120px;overflow-y:auto;font-size:11px;color:var(--muted)">
      ${c.log.slice().reverse().map(l => `<div>${esc(l)}</div>`).join('')}</div></div>`;
  }
  return h;
}

// ─── mutators ───────────────────────────────────────────────────────────────
function _cb() { return (typeof S !== 'undefined' && S) ? S.conflict : null; }
function _cbSave() { save(); renderConflict(); }

function dccCombatStart() {
  S.conflict = dccCombatInit();
  S.conflict.active = true;
  S.conflict.log = ['Round 1 begins.'];
  _cbSave();
}
function dccCombatEnd() {
  if (typeof confirm === 'function' && !confirm('End the fight?')) return;
  S.conflict = dccCombatInit();
  _cbSave();
}
function dccCombatAdd() {
  const c = _cb(); if (!c) return;
  const name = (document.getElementById('dcc-cb-name') || {}).value || '';
  const side = (document.getElementById('dcc-cb-side') || {}).value || 'crawler';
  if (!name.trim()) return;
  const max = dccActionsFor(side, c);
  c.combatants.push({ name: name.trim(), side, actions: max, maxActions: max,
                      debuffs: [], dying: null });
  // a Boss's Action count follows the number of crawlers, so refresh them all
  c.combatants.forEach(m => {
    if (m.side === 'boss') { m.maxActions = dccActionsFor('boss', c); m.actions = Math.min(m.actions, m.maxActions); }
  });
  const el = document.getElementById('dcc-cb-name');
  if (el) el.value = '';
  _cbSave();
}
function dccCombatDrop(i) {
  const c = _cb(); if (!c) return;
  c.combatants.splice(i, 1);
  c.combatants.forEach(m => { if (m.side === 'boss') m.maxActions = dccActionsFor('boss', c); });
  _cbSave();
}
// Clicking a pip spends down to it, or gives one back.
function dccCombatAction(i, pip) {
  const c = _cb(); if (!c) return;
  const m = c.combatants[i]; if (!m) return;
  const max = m.maxActions || dccActionsFor(m.side, c);
  const left = m.actions === undefined ? max : m.actions;
  const spent = max - left;
  m.actions = pip < spent ? max - pip : max - (pip + 1);
  m.actions = Math.max(0, Math.min(max, m.actions));
  _cbSave();
}
function dccCombatDebuff(i) {
  const c = _cb(); if (!c) return;
  const m = c.combatants[i]; if (!m) return;
  const names = DCC_DEBUFFS.map(d => d.name);
  const pick = typeof prompt === 'function'
    ? prompt('Which Debuff?\n\n' + names.join(', '), m.debuffs[0] || '')
    : null;
  if (!pick) return;
  const found = DCC_DEBUFFS.find(d => d.name.toLowerCase() === pick.trim().toLowerCase());
  const label = found ? found.name : pick.trim();
  m.debuffs = m.debuffs || [];
  const at = m.debuffs.indexOf(label);
  if (at >= 0) m.debuffs.splice(at, 1);
  else m.debuffs.push(label);
  // Dying is a Debuff with a countdown attached (p. 94).
  if (label === 'Dying') m.dying = m.debuffs.indexOf('Dying') >= 0 ? (m.dying || 3) : null;
  _cbSave();
}
function dccCombatGoto(i) {
  const c = _cb(); if (!c || !c.active) return;
  c.step = Math.max(0, Math.min(DCC_COMBAT_STEPS.length - 1, i));
  _cbSave();
}
// Advance a step. Rolling off the end of Clean Up starts the next round: every
// combatant gets their Actions back, and anything Dying loses a round.
function dccCombatNext() {
  const c = _cb(); if (!c || !c.active) return;
  if (c.step < DCC_COMBAT_STEPS.length - 1) { c.step++; _cbSave(); return; }
  c.round++;
  c.step = 0;
  const ticked = [];
  c.combatants.forEach(m => {
    m.actions = m.maxActions || dccActionsFor(m.side, c);
    if (m.dying !== null && m.dying !== undefined) {
      m.dying--;
      if (m.dying <= 0) ticked.push(m.name + ' has run out of rounds.');
      else ticked.push(m.name + ' is Dying: ' + m.dying + ' left.');
    }
  });
  c.log = (c.log || []).concat(['Round ' + c.round + ' begins.']).concat(ticked).slice(-40);
  _cbSave();
}

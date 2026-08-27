// systems/dungeon-crawler-carl/screens.js — the creation wizard screens.
//
// Screens 1-4 of the nine in CREATION.md: identity, background, combat, stats.
// That is a complete Floor-1 crawler. Screens 5-9 (scars, gear, tutorial floors,
// Race & Class, review) come next.
//
// Repaint discipline: text inputs only STORE, they never repaint. Picks and
// rolls repaint. See core/wizard.js.

// ─── shared state helpers ───────────────────────────────────────────────────
function dccCre(char) {
  if (!char.dcc) char.dcc = {};
  const d = char.dcc;
  if (!d.background) d.background = {};       // stage -> {roll, picks:[skillName]}
  if (!d.combat) d.combat = { route: null };
  if (!d.statMethod) d.statMethod = null;
  return d;
}

// Every Skill the background screen has already handed out, so the same Skill
// cannot be taken twice (p. 103: Ranks do not stack).
function dccTakenSkills(char, exceptStage) {
  const d = dccCre(char), out = {};
  Object.keys(d.background).forEach(stage => {
    if (stage === exceptStage) return;
    (d.background[stage].picks || []).forEach(n => { out[n] = stage; });
  });
  return out;
}

function dccStages(char) {
  const sp = char.species === 'animal' ? 'animal' : 'human';
  return DCC_BACKGROUNDS[sp];
}

// The ten starting Skills, assembled from the background picks plus the two
// combat Skills. Recomputed rather than stored, so going back and changing a
// pick cannot leave a stale Skill on the sheet.
function dccStartingSkills(char) {
  const d = dccCre(char), sp = char.species === 'animal' ? 'animal' : 'human';
  const out = [];
  const add = (name, rank, source) => {
    const cat = dccSkillByName(name);
    if (!cat) return;
    const found = out.find(s => s.name === cat.name);
    if (found) { found.rank = Math.max(found.rank, rank); return; }
    out.push({ name: cat.name, rank, stat: cat.stat, checkType: cat.checkType,
               passive: !!cat.passive, source, marked: false });
  };
  ['childhood', 'adolescence', 'career', 'hobby'].forEach(stage => {
    const b = DCC_BACKGROUNDS[sp][stage];
    (d.background[stage] && d.background[stage].picks || []).forEach(n => add(n, b.rank, stage));
  });
  add(DCC_FREE_COMBAT_SKILL[sp], 3, 'combat');
  const c = d.combat;
  if (c.route === 'weapon' && c.weaponSkill) add(c.weaponSkill, 3, 'weapon');
  if (c.route === 'handtohand' && c.h2h) {
    const pair = DCC_HAND_TO_HAND.find(h => h.skill === c.h2h);
    if (pair) { add(pair.skill, 3, 'weapon'); add(pair.damageEffect, 3, 'weapon'); }
  }
  return out;
}

// ─── screen 1: who are you ──────────────────────────────────────────────────
function dccScreenIdentity(ctx) {
  const c = ctx.char;
  const animal = c.species === 'animal';
  let h = `<div class="card">
    <div class="label">Species</div>
    <div style="display:flex;gap:8px;margin-bottom:4px">
      <button class="btn btn-xs ${!animal ? 'btn-primary' : 'btn-secondary'}" onclick="dccSetSpecies('human')">Human</button>
      <button class="btn btn-xs ${animal ? 'btn-primary' : 'btn-secondary'}" onclick="dccSetSpecies('animal')">Animal</button>
    </div>
    <div style="font-size:11px;color:var(--muted)">
      ${animal
        ? 'Animal crawlers use their own background tables, start with Slice Attack instead of Unarmed Combat, and spend their starting AI Favor on the Enhanced Pet Biscuit. Your GM has to allow it, and the book suggests only one animal per party.'
        : 'The vast majority of crawlers are Human. You start with 1 AI Favor and the Unarmed Combat Skill.'}
    </div></div>`;

  h += `<div class="card"><div class="form-group"><label>Name</label>
      <input value="${esc(c.name || '')}" oninput="dccStore('name',this.value)" placeholder="What the HUD calls you"></div>
    <div class="form-group" style="margin-bottom:0"><label>Crawler Number</label>
      <div style="display:flex;gap:6px">
        <input style="flex:1" value="${esc(String(c.crawlerNumber || ''))}" oninput="dccStore('crawlerNumber',this.value)">
        <button class="btn btn-gold btn-xs" onclick="dccRollCrawlerNumber()">Roll</button></div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px">
        Between 500,000 and 12,900,000. Carl is 4,122 and Donut is 4,119 — the book asks you not to take a number already in use.</div>
    </div></div>`;

  if (animal) {
    h += `<div class="card"><div class="label">Size</div><div>`;
    h += DCC_SIZES.map(s => `<button class="btn btn-xs ${(c.size || 4) === s.n ? 'btn-primary' : 'btn-secondary'}"
      style="margin:0 4px 4px 0" onclick="dccSetSize(${s.n})">${esc(s.name)} (${s.n})</button>`).join('');
    h += `</div><div style="font-size:10px;color:var(--muted)">${esc((DCC_SIZES.find(s => s.n === (c.size || 4)) || {}).eg || '')}</div></div>`;
  }
  return h;
}

function dccSetSpecies(sp) {
  const c = S.char; if (!c) return;
  if (c.species === sp) return;
  c.species = sp;
  c.size = sp === 'animal' ? 2 : 4;
  // the background tables differ per species, so previous picks no longer apply
  dccCre(c).background = {};
  save(); wizRepaint();
}
function dccSetSize(n) { S.char.size = n; save(); wizRepaint(); }
function dccStore(field, v) {
  const c = S.char; if (!c) return;
  c[field] = (field === 'crawlerNumber') ? (parseInt(String(v).replace(/\D/g, ''), 10) || '') : v;
  save();                                   // store only; never repaint on typing
}
function dccRollCrawlerNumber() {
  S.char.crawlerNumber = 500000 + Math.floor(Math.random() * 12400000);
  save(); wizRepaint();
}

// ─── screen 2: background ───────────────────────────────────────────────────
const DCC_STAGE_LABELS = {
  childhood: 'Childhood', adolescence: 'Adolescence', career: 'Career', hobby: 'Hobby',
};

function dccScreenBackground(ctx) {
  const c = ctx.char, d = dccCre(c), stages = dccStages(c);
  const sp = c.species === 'animal' ? 'animal' : 'human';
  let h = `<div class="card-sm" style="font-size:11px;color:var(--muted)">
    Eight Skills, two from each stage of your life. Pick a background or roll for it, then take
    <strong>two of its three</strong> Skills. The same Skill twice does not stack, so it locks after
    you take it. ${sp === 'animal' ? 'Animal tables roll 1d6.' : 'Human tables roll 1d12.'}</div>`;

  ['childhood', 'adolescence', 'career', 'hobby'].forEach(stage => {
    const tbl = stages[stage];
    const st = d.background[stage] || {};
    const row = tbl.rows.find(r => r.roll === st.roll);
    const taken = dccTakenSkills(c, stage);
    const picks = st.picks || [];
    h += `<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
      <div class="pg-title" style="font-size:16px">${DCC_STAGE_LABELS[stage]}</div>
      <div style="font-size:10px;color:var(--muted)">Rank ${tbl.rank} · Table ${tbl.table} · 1d${tbl.die}</div></div>`;
    h += `<div style="margin-bottom:6px">`;
    h += tbl.rows.map(r => `<button class="btn btn-xs ${st.roll === r.roll ? 'btn-primary' : 'btn-secondary'}"
      style="margin:0 4px 4px 0" onclick="dccPickBackground('${stage}',${r.roll})">${esc(r.description)}</button>`).join('');
    h += `<button class="btn btn-gold btn-xs" style="margin:0 0 4px 0" onclick="dccRollBackground('${stage}')">Roll 1d${tbl.die}</button></div>`;
    if (row) {
      h += `<div class="label" style="margin-bottom:4px">Take two</div>`;
      row.skills.forEach(x => {
        const chosen = picks.indexOf(x.s) >= 0;
        const lockedBy = taken[x.s];
        const full = picks.length >= 2 && !chosen;
        const dis = !!lockedBy || full;
        h += `<button class="btn btn-xs ${chosen ? 'btn-primary' : 'btn-secondary'}"
          style="margin:0 4px 4px 0;${dis ? 'opacity:.4' : ''}"
          ${dis ? '' : `onclick="dccPickSkill('${stage}',${JSON.stringify(x.s).replace(/"/g, '&quot;')})"`}
          title="${lockedBy ? 'Already taken from your ' + DCC_STAGE_LABELS[lockedBy].toLowerCase() : ''}">
          ${esc(x.s)} <span style="opacity:.7">(${esc(x.st)})</span>${lockedBy ? ' 🔒' : ''}</button>`;
      });
      h += `<div style="font-size:10px;color:var(--muted);margin-top:2px">${picks.length}/2 chosen</div>`;
    }
    h += `</div>`;
  });
  return h;
}

function dccPickBackground(stage, roll) {
  const c = S.char, d = dccCre(c);
  const cur = d.background[stage] || {};
  d.background[stage] = { roll: cur.roll === roll ? null : roll, picks: [] };
  save(); wizRepaint();
}
function dccRollBackground(stage) {
  const c = S.char, tbl = dccStages(c)[stage];
  dccCre(c).background[stage] = { roll: wizRoll(tbl.die), picks: [] };
  save(); wizRepaint();
}
function dccPickSkill(stage, name) {
  const c = S.char, d = dccCre(c);
  const st = d.background[stage]; if (!st) return;
  st.picks = st.picks || [];
  const i = st.picks.indexOf(name);
  if (i >= 0) st.picks.splice(i, 1);
  else if (st.picks.length < 2) st.picks.push(name);
  save(); wizRepaint();
}

// ─── screen 3: how you fight ────────────────────────────────────────────────
function dccScreenCombat(ctx) {
  const c = ctx.char, d = dccCre(c), cm = d.combat;
  const sp = c.species === 'animal' ? 'animal' : 'human';
  const free = DCC_FREE_COMBAT_SKILL[sp];
  const freeCat = dccSkillByName(free) || {};
  let h = `<div class="card"><div class="label">Free combat Skill</div>
    <div style="font-size:14px;font-weight:700">${esc(free)} <span style="color:var(--muted);font-weight:400">Rank 3</span></div>
    <div style="font-size:11px;color:var(--muted)">${esc(freeCat.baseDamage || '')}</div></div>`;

  h += `<div class="card-sm" style="font-size:11px;color:var(--muted)">
    Your second combat Skill, also at Rank 3. Pick one route.</div>`;

  const route = (id, label, on) => `<button class="btn btn-xs ${cm.route === id ? 'btn-primary' : 'btn-secondary'}"
    style="margin:0 4px 4px 0" onclick="dccSetRoute('${id}')">${label}</button>`;
  h += `<div class="card"><div style="margin-bottom:6px">
      ${route('weapon', 'A weapon')}${route('spell', 'An attack Spell')}${route('handtohand', 'Bare hands')}</div>`;

  if (cm.route === 'weapon') {
    DCC_WEAPON_CATEGORIES.forEach(cat => {
      h += `<div class="label" style="margin:6px 0 3px">${esc(cat.category)}</div>`;
      h += cat.skills.map(n => {
        const s = dccSkillByName(n) || {};
        return `<button class="btn btn-xs ${cm.weaponSkill === n ? 'btn-primary' : 'btn-secondary'}"
          style="margin:0 4px 4px 0" title="${esc(s.baseDamage || '')}"
          onclick="dccSetWeapon(${JSON.stringify(n).replace(/"/g, '&quot;')})">${esc(n)}</button>`;
      }).join('');
    });
    if (cm.weaponSkill) {
      const s = dccSkillByName(cm.weaponSkill) || {};
      h += `<div class="form-group" style="margin-top:8px;margin-bottom:0"><label>Call it something else (optional)</label>
        <input value="${esc(cm.weaponName || '')}" oninput="dccStoreCombat('weaponName',this.value)"
          placeholder="e.g. Tire Iron — it still works as a ${esc(cm.weaponSkill)}">
        <div style="font-size:10px;color:var(--muted);margin-top:4px">${esc(s.baseDamage || '')}</div></div>`;
    }
  }

  if (cm.route === 'spell') {
    h += DCC_STARTING_SPELLS.map(n => `<button class="btn btn-xs ${cm.spell === n ? 'btn-primary' : 'btn-secondary'}"
      style="margin:0 4px 4px 0" onclick="dccSetSpell(${JSON.stringify(n).replace(/"/g, '&quot;')})">${esc(n)}</button>`).join('');
    h += `<div style="font-size:11px;color:var(--accent);margin-top:6px">
      Needs Intelligence ${DCC_STARTING_SPELL_MIN_INT}+, which you set on the next screen.
      You also get ${DCC_STARTING_SPELL_POTIONS} Standard Mana Potions in one Hotlist slot.</div>`;
  }

  if (cm.route === 'handtohand') {
    h += DCC_HAND_TO_HAND.map(p => `<button class="btn btn-xs ${cm.h2h === p.skill ? 'btn-primary' : 'btn-secondary'}"
      style="margin:0 4px 4px 0" onclick="dccSetH2H(${JSON.stringify(p.skill).replace(/"/g, '&quot;')})">
      ${esc(p.skill)} <span style="opacity:.7">+ ${esc(p.damageEffect)}</span></button>`).join('');
    h += `<div style="font-size:11px;color:var(--muted);margin-top:6px">
      Turning up unarmed earns an achievement and a Bronze Weapon Box — containing the weapon you
      should have brought, with a drawback.</div>`;
  }
  return h + '</div>';
}

function dccSetRoute(r) { const d = dccCre(S.char); d.combat = { route: d.combat.route === r ? null : r }; save(); wizRepaint(); }
function dccSetWeapon(n) { dccCre(S.char).combat.weaponSkill = n; save(); wizRepaint(); }
function dccSetSpell(n) { dccCre(S.char).combat.spell = n; save(); wizRepaint(); }
function dccSetH2H(n) { dccCre(S.char).combat.h2h = n; save(); wizRepaint(); }
function dccStoreCombat(k, v) { dccCre(S.char).combat[k] = v; save(); }

// ─── screen 4: stats ────────────────────────────────────────────────────────
function dccScreenStats(ctx) {
  const c = ctx.char, d = dccCre(c);
  if (!c.blocks) c.blocks = {};
  if (!c.blocks.stats) c.blocks.stats = {};
  const cur = c.blocks.stats;
  const used = DCC_STATS.map(s => (cur[s.id] || {}).base).filter(v => v);

  let h = `<div class="card"><div class="label">How do you want your Stats?</div>
    <button class="btn btn-xs ${d.statMethod === 'array' ? 'btn-primary' : 'btn-secondary'}"
      style="margin:0 4px 4px 0" onclick="dccStatMethod('array')">Standard array</button>
    <button class="btn btn-xs ${d.statMethod === 'roll' ? 'btn-primary' : 'btn-secondary'}"
      style="margin:0 4px 4px 0" onclick="dccStatMethod('roll')">Leave it to chance</button>
    <div style="font-size:11px;color:var(--muted);margin-top:4px">
      ${d.statMethod === 'roll'
        ? 'One 1d6 per Stat, rerolling 1s, in order. No swapping afterwards — the book is firm about that.'
        : 'Assign 2, 3, 4, 5 and 6, each exactly once.'}</div></div>`;

  if (d.statMethod === 'array') {
    h += `<div class="card"><div style="display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center">`;
    DCC_STATS.forEach(s => {
      const v = (cur[s.id] || {}).base || 0;
      h += `<div style="font-size:13px" title="${esc(s.desc)}">${esc(s.name)} <span style="color:var(--muted)">${s.id}</span></div><div>`;
      h += DCC_STANDARD_ARRAY.map(n => {
        const takenBy = DCC_STATS.find(o => o.id !== s.id && (cur[o.id] || {}).base === n);
        return `<button class="btn btn-xs ${v === n ? 'btn-primary' : 'btn-secondary'}"
          style="margin:0 3px 0 0;${takenBy ? 'opacity:.35' : ''}"
          ${takenBy ? '' : `onclick="dccAssignStat('${s.id}',${n})"`}>${n}</button>`;
      }).join('');
      h += `</div>`;
    });
    h += `</div><div style="font-size:11px;color:var(--muted);margin-top:6px">${used.length}/5 assigned</div></div>`;
  } else if (d.statMethod === 'roll') {
    h += `<div class="card">`;
    if (!used.length) {
      h += `<button class="btn btn-gold btn-full" onclick="dccRollStats()">Roll all five</button>`;
    } else {
      h += `<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px 10px;align-items:center">`;
      DCC_STATS.forEach(s => {
        const v = (cur[s.id] || {}).base || 0;
        h += `<div style="font-size:13px">${esc(s.name)}</div>
              <div style="font-weight:700;text-align:center;min-width:30px">${v}</div>
              <div style="color:var(--accent);font-weight:700">+${dccStatMod(v)}</div>`;
      });
      h += `</div><button class="btn btn-secondary btn-xs" style="margin-top:8px" onclick="dccRollStats()">Roll again (starts over)</button>`;
    }
    h += `</div>`;
  }

  if (used.length === 5) {
    const mod = id => dccModOf(c, id);
    h += `<div class="card"><div class="label">What falls out of that</div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:space-around;text-align:center">
        <div><div style="font-size:22px;font-weight:800;color:var(--accent)">10 × ${mod('CON')}</div><div class="label" style="margin:0">Health Bar</div></div>
        <div><div style="font-size:22px;font-weight:800;color:var(--accent)">${dccStatOf(c, 'INT')}</div><div class="label" style="margin:0">Max Mana</div></div>
        <div><div style="font-size:22px;font-weight:800;color:var(--accent)">+${mod('DEX')}</div><div class="label" style="margin:0">Evade</div></div>
        <div><div style="font-size:22px;font-weight:800;color:var(--accent)">20 / 10</div><div class="label" style="margin:0">Move / Step</div></div>
        <div><div style="font-size:22px;font-weight:800;color:var(--accent)">${c.species === 'animal' ? 0 : 1}</div><div class="label" style="margin:0">AI Favor</div></div>
      </div></div>`;
  }
  return h;
}

function dccStatMethod(m) {
  const c = S.char, d = dccCre(c);
  if (d.statMethod === m) return;
  d.statMethod = m;
  c.blocks = c.blocks || {}; c.blocks.stats = {};      // switching method starts over
  save(); wizRepaint();
}
function dccAssignStat(id, n) {
  const c = S.char;
  c.blocks.stats = c.blocks.stats || {};
  // each array value is used exactly once, so clear whoever held it
  DCC_STATS.forEach(s => {
    if ((c.blocks.stats[s.id] || {}).base === n) c.blocks.stats[s.id] = { base: 0, bonus: 0 };
  });
  const cell = c.blocks.stats[id] || { base: 0, bonus: 0 };
  cell.base = (cell.base === n) ? 0 : n;
  c.blocks.stats[id] = cell;
  save(); wizRepaint();
}
function dccRollStats() {
  const c = S.char;
  c.blocks.stats = {};
  DCC_STATS.forEach(s => {
    let v = wizRoll(6);
    while (v === 1) v = wizRoll(6);            // reroll 1s
    c.blocks.stats[s.id] = { base: v, bonus: 0 };
  });
  save(); wizRepaint();
}

// ─── the manifest's creation array ──────────────────────────────────────────
const DCC_SCREENS = [
  {
    id: 'identity', label: 'Who are you',
    render: dccScreenIdentity,
    validate(c) {
      if (!c.species) return 'Human or animal?';
      if (!String(c.name || '').trim()) return 'Your crawler needs a name.';
      const n = parseInt(c.crawlerNumber, 10);
      if (!n || n < 500000 || n > 12900000) return 'Crawler number must be between 500,000 and 12,900,000.';
      return true;
    },
  },
  {
    id: 'background', label: 'Background',
    render: dccScreenBackground,
    validate(c) {
      const d = dccCre(c);
      const missing = ['childhood', 'adolescence', 'career', 'hobby'].filter(s => {
        const st = d.background[s];
        return !st || !st.roll || (st.picks || []).length !== 2;
      });
      return missing.length ? 'Still to do: ' + missing.map(m => DCC_STAGE_LABELS[m]).join(', ') : true;
    },
  },
  {
    id: 'combat', label: 'How you fight',
    render: dccScreenCombat,
    validate(c) {
      const cm = dccCre(c).combat;
      if (!cm.route) return 'Pick how you fight.';
      if (cm.route === 'weapon' && !cm.weaponSkill) return 'Pick a weapon.';
      if (cm.route === 'spell' && !cm.spell) return 'Pick a Spell.';
      if (cm.route === 'handtohand' && !cm.h2h) return 'Pick a fighting style.';
      return true;
    },
  },
  {
    id: 'stats', label: 'Stats',
    render: dccScreenStats,
    validate(c) {
      const d = dccCre(c);
      if (!d.statMethod) return 'Choose a method.';
      const vals = DCC_STATS.map(s => ((c.blocks && c.blocks.stats || {})[s.id] || {}).base || 0);
      if (vals.some(v => !v)) return 'Every Stat needs a value.';
      // the Spell route was chosen a screen ago and needs INT 4+ (p. 106)
      if (dccCre(c).combat.route === 'spell' && dccStatOf(c, 'INT') < DCC_STARTING_SPELL_MIN_INT) {
        return 'Your attack Spell needs Intelligence ' + DCC_STARTING_SPELL_MIN_INT +
               '+. Raise it, or go back and fight some other way.';
      }
      return true;
    },
  },
];

// Called by the wizard when the last screen is finished: turn the choices into
// the Skills the sheet actually carries.
function dccFinishCreation(char) {
  if (!char.blocks) char.blocks = {};
  char.blocks.skills = { skills: dccStartingSkills(char) };
  char.blocks.mana = { current: dccStatOf(char, 'INT') };
  char.blocks.aiFavor = { current: char.species === 'animal' ? 0 : 1 };
  char.blocks.health = { marked: 0 };
}

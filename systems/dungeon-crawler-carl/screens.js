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
          ${dis ? '' : `onclick="dccPickSkill('${stage}',${jsArg(x.s)})"`}
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
          onclick="dccSetWeapon(${jsArg(n)})">${esc(n)}</button>`;
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
      style="margin:0 4px 4px 0" onclick="dccSetSpell(${jsArg(n)})">${esc(n)}</button>`).join('');
    h += `<div style="font-size:11px;color:var(--accent);margin-top:6px">
      Needs Intelligence ${DCC_STARTING_SPELL_MIN_INT}+, which you set on the next screen.
      You also get ${DCC_STARTING_SPELL_POTIONS} Standard Mana Potions in one Hotlist slot.</div>`;
  }

  if (cm.route === 'handtohand') {
    h += DCC_HAND_TO_HAND.map(p => `<button class="btn btn-xs ${cm.h2h === p.skill ? 'btn-primary' : 'btn-secondary'}"
      style="margin:0 4px 4px 0" onclick="dccSetH2H(${jsArg(p.skill)})">
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
  {
    id: 'story', label: 'Scars',
    render: dccScreenStory,
    validate(c) {
      const st = dccStory(c);
      const missing = DCC_STORY_FIELDS.filter(f => !String(st[f.key] || '').trim());
      return missing.length ? 'Still to fill in: ' + missing.map(f => f.label).join(', ') : true;
    },
  },
  {
    id: 'gear', label: 'What you brought',
    render: dccScreenGear,
    // Deliberately always satisfied: what you carried is a conversation with the
    // GM, not a rule the app should gate on.
    validate() { return true; },
  },
  {
    id: 'tutorial', label: 'The tutorial floors',
    render: dccScreenTutorial,
    validate(c) {
      const fs = dccFloorStart(c), cfg = dccFloorCfg(c);
      // Same order as the screen, so the message names the first thing you
      // still have to do rather than something further down.
      if (!fs.bumps) return 'Roll your tutorial-floor Skill Ranks.';
      const left = cfg.statPoints - dccPointsSpent(c);
      if (left > 0) return left + ' Stat points still unspent — Races and Classes check these.';
      if (fs.favor === null) return 'Roll your AI Favor.';
      if (!(fs.loot && fs.loot.spread)) return 'Roll for your Acquired Loot.';
      if ((fs.experiences || []).length !== DCC_EXPERIENCE_COUNT) {
        return 'Roll your six Tutorial Floor Experiences.';
      }
      return true;
    },
  },
  {
    id: 'raceclass', label: 'Race & Class',
    render: dccScreenRaceClass,
    validate(c) {
      const p = dccPick(c);
      if (!p.race) return 'Choose a Race, or build your own.';
      if (!p.cls) return 'Choose a Class, or build your own.';
      if (p.race === 'custom-race' && !dccCustomEntry(c, 'race')) return 'Name your custom Race.';
      if (p.cls === 'custom-class' && !dccCustomEntry(c, 'class')) return 'Name your custom Class.';
      // A printed pick can stop qualifying if you go back and move Stat points
      // around. A custom one has no prerequisites: you built it yourself.
      const race = p.race === 'custom-race' ? null : dccRace(p.race);
      if (race) {
        const r = dccMeetsPrereq(c, race);
        if (r.ok === false) return 'You no longer qualify for that Race: ' + r.why;
      }
      const cls = p.cls === 'custom-class' ? null : dccClass(p.cls);
      if (cls) {
        const k = dccMeetsPrereq(c, cls);
        if (k.ok === false) return 'You no longer qualify for that Class: ' + k.why;
      }
      return true;
    },
  },
  {
    id: 'review', label: 'Review',
    render: dccScreenReview,
    validate() { return true; },
  },
];

// Called by the wizard when the last screen is finished: turn the choices into
// the Skills the sheet actually carries.
function dccFinishCreation(char) {
  if (!char.blocks) char.blocks = {};
  const diff = dccRcDiff(char);
  const fs = dccFloorStart(char);

  // Apply the Race/Class Stat deltas onto the Enhanced layer, on top of the
  // tutorial-floor points already there. This is the only moment the shopping
  // on screen 8 actually lands.
  if (diff) {
    Object.keys(diff.stats).forEach(function (k) {
      const cell = char.blocks.stats[k] || { base: 0, bonus: 0 };
      cell.bonus = (cell.bonus || 0) + diff.stats[k].delta;
      char.blocks.stats[k] = cell;
    });
    if (diff.race) char.race = diff.race.name;
    if (diff.cls) char.class = diff.cls.name;
    if (diff.race && diff.race.size) char.size = diff.race.size.n;
  }

  char.blocks.skills = { skills: dccFinalSkills(char) };
  char.blocks.spells = { skills: dccStartingSpells(char) };
  char.blocks.gear = char.blocks.gear || blockCtx(sysBlock('gear'), char) && char.blocks.gear;
  if (char.blocks.gear) char.blocks.gear.hotlist = dccStartingHotlist(char);
  char.blocks.mana = { current: dccStatOf(char, 'INT') };
  char.blocks.health = { marked: 0 };
  char.level = dccFloorCfg(char).level;
  char.floor = fs.floor;
  char.blocks.popularity = { current: dccModOf(char, 'CHA') * 2 };
  char.blocks.aiFavor = {
    current: (char.species === 'animal' ? 0 : 1) + (fs.favor || 0),
  };
}

// ─── screen 5: scars ────────────────────────────────────────────────────────
// Past Trauma, Loose End, Regret (Tables 22-24). The book is explicit that this
// is where you tell the GM what you want in the story AND what you do not want
// at the table, so it gets that framing and a free-text field of its own rather
// than being three more random tables.
const DCC_STORY_FIELDS = [
  { key: 'pastTrauma', label: 'Past Trauma',
    prompt: 'Other than the world ending, what is the worst thing that ever happened to you?' },
  { key: 'looseEnd', label: 'Loose End',
    prompt: 'What did you leave unfinished that still haunts you?' },
  { key: 'regret', label: 'Regret',
    prompt: 'What did you do, or fail to do, that left a scar?' },
];

function dccStory(char) {
  if (!char.story) char.story = {};
  return char.story;
}

function dccScreenStory(ctx) {
  const c = ctx.char, st = dccStory(c);
  let h = `<div class="card-sm" style="font-size:11px;color:var(--muted)">
    The System AI mines your worst memories because flaws make better television. Mechanically this
    is how you tell your GM which stories you want. It is also where you say which ones you
    <strong>don't</strong> want — that part is not on any table, and it counts just as much.</div>`;

  DCC_STORY_FIELDS.forEach(f => {
    const val = st[f.key] || '';
    const rows = DCC_STORY_TABLES[f.key] || [];
    h += `<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline">
      <div class="pg-title" style="font-size:16px">${f.label}</div>
      <button class="btn btn-gold btn-xs" onclick="dccRollStory('${f.key}')">Roll 1d12</button></div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px">${esc(f.prompt)}</div>
      <div class="form-group" style="margin-bottom:6px">
        <input value="${esc(val)}" oninput="dccStoreStory('${f.key}',this.value)"
          placeholder="Write your own, or pick one below"></div>
      <div style="max-height:132px;overflow-y:auto">`;
    rows.forEach(r => {
      const on = val === r.text;
      h += `<div onclick="dccSetStory('${f.key}',${r.roll})"
        style="font-size:12px;padding:4px 6px;border-radius:5px;cursor:pointer;margin-bottom:2px;
        background:${on ? 'var(--surface3)' : 'transparent'};
        border:1px solid ${on ? 'var(--accent)' : 'transparent'}">
        <span style="color:var(--muted);font-size:10px">${r.roll}</span> ${esc(r.text)}</div>`;
    });
    h += `</div></div>`;
  });

  h += `<div class="card" style="border-color:var(--accent)">
    <div class="pg-title" style="font-size:16px">Lines I'd rather not cross</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:6px">
      Anything you do not want turning up at the table. Optional, always editable, and worth
      saying out loud in session zero as well as writing here.</div>
    <textarea rows="3" oninput="dccStoreStory('linesNotToCross',this.value)"
      placeholder="e.g. nothing involving harm to animals">${esc(st.linesNotToCross || '')}</textarea></div>`;
  return h;
}

function dccStoreStory(k, v) { dccStory(S.char)[k] = v; save(); }   // store only
function dccSetStory(k, roll) {
  const rows = DCC_STORY_TABLES[k] || [];
  const r = rows.find(x => x.roll === roll);
  if (!r) return;
  const st = dccStory(S.char);
  st[k] = (st[k] === r.text) ? '' : r.text;
  save(); wizRepaint();
}
function dccRollStory(k) {
  const rows = DCC_STORY_TABLES[k] || [];
  const r = rows[Math.floor(Math.random() * rows.length)];
  if (r) { dccStory(S.char)[k] = r.text; save(); wizRepaint(); }
}

// ─── screen 6: what you brought ─────────────────────────────────────────────
// Whatever was on you when the world ended. Free-form and negotiated with the
// GM, so the app prefills what it can infer and otherwise stays out of the way.
function dccGear(char) {
  if (!char.gearNotes) char.gearNotes = {};
  return char.gearNotes;
}

function dccScreenGear(ctx) {
  const c = ctx.char, g = dccGear(c), cm = dccCre(c).combat;
  const weapon = cm.route === 'weapon' ? (cm.weaponName || cm.weaponSkill)
               : cm.route === 'spell' ? cm.spell + ' (a Spell, not a thing you carry)'
               : 'Nothing — you came in swinging';
  let h = `<div class="card-sm" style="font-size:11px;color:var(--muted)">
    No sirens, no countdown, no helpful flyer about what to pack. You brought whatever happened to
    be on you. Your GM may want a word about the weird stuff.</div>`;

  h += `<div class="card"><div class="label">From what you already chose</div>
    <div style="font-size:13px">${esc(weapon)}</div>
    ${cm.route === 'spell' ? `<div style="font-size:11px;color:var(--muted)">Plus ${DCC_STARTING_SPELL_POTIONS} Standard Mana Potions in one Hotlist slot.</div>` : ''}
    ${cm.route === 'handtohand' ? `<div style="font-size:11px;color:var(--muted)">Plus an achievement and a Bronze Weapon Box, containing the weapon you should have brought.</div>` : ''}
    </div>`;

  const field = (k, label, ph, rows) => `<div class="card"><div class="form-group" style="margin-bottom:0">
    <label>${label}</label>
    ${rows ? `<textarea rows="${rows}" oninput="dccStoreGear('${k}',this.value)" placeholder="${esc(ph)}">${esc(g[k] || '')}</textarea>`
           : `<input value="${esc(g[k] || '')}" oninput="dccStoreGear('${k}',this.value)" placeholder="${esc(ph)}">`}
    </div></div>`;

  h += field('clothes', 'What you are wearing', 'e.g. jeans, a t-shirt and a hoodie');
  h += field('item', 'One interesting or useful item',
             'A second weapon counts, if a background gave you the Skill for it');
  h += field('weird', 'Weird stuff', 'Be creative. This is the part the AI enjoys.', 3);
  return h;
}
function dccStoreGear(k, v) { dccGear(S.char)[k] = v; save(); }     // store only

// ─── screen 7: the tutorial floors ──────────────────────────────────────────
// Phase 2 of creation: advance a finished Floor-1 crawler to the floor you are
// actually starting on. Order matters — the Stat points are spent HERE, before
// Race & Class, because those have Stat prerequisites (p. 115).
const DCC_RC_RANK_CAP = 10;   // the Rank ceiling during Race/Class selection, p.129

function dccFloorStart(char) {
  const d = dccCre(char);
  if (!d.floorStart) d.floorStart = { floor: 3, bumps: null, favor: null, points: {} };
  return d.floorStart;
}
function dccFloorCfg(char) {
  const f = dccFloorStart(char).floor;
  return DCC_FLOOR_START.find(x => x.floor === f) || DCC_FLOOR_START[0];
}
function dccPrimaryAttack(char) {
  const cm = dccCre(char).combat;
  return cm.route === 'weapon' ? cm.weaponSkill
       : cm.route === 'spell' ? cm.spell
       : cm.route === 'handtohand' ? cm.h2h : null;
}
function dccPointsSpent(char) {
  const p = dccFloorStart(char).points || {};
  return DCC_STATS.reduce((n, s) => n + (p[s.id] || 0), 0);
}

function dccScreenTutorial(ctx) {
  const c = ctx.char, fs = dccFloorStart(c), cfg = dccFloorCfg(c);
  const primary = dccPrimaryAttack(c);
  let h = '<div class="card"><div class="label">Which floor are you starting on?</div>';
  h += DCC_FLOOR_START.map(f => '<button class="btn btn-xs ' + (fs.floor === f.floor ? 'btn-primary' : 'btn-secondary') +
    '" style="margin:0 4px 4px 0" onclick="dccSetFloor(' + f.floor + ')">Floor ' + f.floor + ' &middot; Level ' + f.level + '</button>').join('');
  h += '<div style="font-size:11px;color:var(--muted);margin-top:4px">You did not appear here from nowhere. ' +
       'Everything below is what the Tutorial Floors did to you.</div></div>';

  h += '<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline">' +
       '<div class="pg-title" style="font-size:16px">Skill Ranks</div>' +
       '<button class="btn btn-gold btn-xs" onclick="dccRollBumps()">' + (fs.bumps ? 'Roll again' : 'Roll') + '</button></div>' +
       '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">+' + cfg.primaryBump + ' to ' +
       esc(primary || 'your primary attack Skill') + ', +' + cfg.otherBump + ' to each of the others. ' +
       'Nothing passes Rank ' + cfg.rankCap + ' here, and anything over is wasted.</div>';
  if (fs.bumps) {
    h += '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:2px 8px;font-size:12px;align-items:center">';
    fs.bumps.forEach(function (b) {
      h += '<div>' + esc(b.name) + (b.primary ? ' <span style="color:var(--accent);font-size:9px">PRIMARY</span>' : '') + '</div>' +
           '<div style="color:var(--muted)">' + b.from + '</div>' +
           '<div style="color:var(--muted)">+' + b.roll + '</div>' +
           '<div style="font-weight:700;text-align:right">' + b.to +
           (b.wasted ? ' <span style="color:var(--red);font-size:9px">' + b.wasted + ' wasted</span>' : '') + '</div>';
    });
    h += '</div>';
  }
  h += '</div>';

  const spent = dccPointsSpent(c), left = cfg.statPoints - spent;
  h += '<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline">' +
       '<div class="pg-title" style="font-size:16px">Stat points</div>' +
       '<div style="font-size:12px;color:' + (left ? 'var(--accent)' : 'var(--muted)') + '">' +
       left + ' of ' + cfg.statPoints + ' left</div></div>' +
       '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">(Level &minus; 1) &times; 3. Spend them now: ' +
       'Races and Classes have Stat requirements, and the next screen checks them.</div>' +
       '<div style="display:grid;grid-template-columns:1fr auto auto auto auto;gap:4px 8px;align-items:center">';
  DCC_STATS.forEach(function (s) {
    const add = (fs.points || {})[s.id] || 0;
    const base = ((c.blocks && c.blocks.stats || {})[s.id] || {}).base || 0;
    h += '<div style="font-size:13px">' + esc(s.name) + '</div>' +
         '<div style="color:var(--muted);min-width:22px;text-align:right">' + base + '</div>' +
         '<button class="btn btn-secondary btn-xs" onclick="dccStatPoint(\'' + s.id + '\',-1)">&minus;</button>' +
         '<div style="min-width:34px;text-align:center;font-weight:700">' + (base + add) + '</div>' +
         '<button class="btn btn-secondary btn-xs" ' + (left <= 0 ? 'disabled style="opacity:.4"' : '') +
         ' onclick="dccStatPoint(\'' + s.id + '\',1)">+</button>';
  });
  h += '</div></div>';

  const pop = dccModOf(c, 'CHA') * 2;
  h += '<div class="card"><div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;justify-content:space-around;text-align:center">' +
       '<div><div style="font-size:22px;font-weight:800;color:var(--accent)">' + (fs.favor === null ? '&mdash;' : fs.favor) + '</div>' +
       '<div class="label" style="margin:0">AI Favor</div>' +
       '<button class="btn btn-gold btn-xs" style="margin-top:4px" onclick="dccRollFavor()">Roll 1d2</button></div>' +
       '<div><div style="font-size:22px;font-weight:800;color:var(--accent)">' + pop + '</div>' +
       '<div class="label" style="margin:0">Popularity</div>' +
       '<div style="font-size:10px;color:var(--muted)">CHA Mod &times; 2</div></div></div></div>';

  h += dccScreenLoot(ctx);
  return h;
}

function dccSetFloor(n) { dccFloorStart(S.char).floor = n; save(); wizRepaint(); }
function dccStatPoint(id, d) {
  const c = S.char, fs = dccFloorStart(c), cfg = dccFloorCfg(c);
  fs.points = fs.points || {};
  if (d > 0 && dccPointsSpent(c) >= cfg.statPoints) return;
  const next = Math.max(0, (fs.points[id] || 0) + d);
  fs.points[id] = next;
  // Tutorial points raise the Enhanced layer, which is what the Mod reads.
  c.blocks = c.blocks || {};
  c.blocks.stats = c.blocks.stats || {};
  const cell = c.blocks.stats[id] || { base: 0, bonus: 0 };
  cell.bonus = next;
  c.blocks.stats[id] = cell;
  save(); wizRepaint();
}
function dccRollFavor() { dccFloorStart(S.char).favor = wizRoll(2); save(); wizRepaint(); }

// +2d4 to the primary attack Skill, +1d4 to each of the other nine, capped.
function dccRollBumps() {
  const c = S.char, cfg = dccFloorCfg(c), primary = dccPrimaryAttack(c);
  const d4 = function () { return wizRoll(4); };
  const list = dccStartingSkills(c);
  const bumps = list.map(function (s) {
    const isPrimary = !!(primary && s.name === primary);
    const roll = isPrimary ? d4() + d4() : d4();
    const to = Math.min(cfg.rankCap, s.rank + roll);
    return { name: s.name, from: s.rank, roll: roll, to: to,
             wasted: Math.max(0, s.rank + roll - cfg.rankCap), primary: isPrimary };
  });
  // If the primary attack is a Spell, it is not in the Skills catalogue yet
  // (Spells are D7), so it would silently miss its +2d4. Record it anyway,
  // flagged, rather than quietly shortchanging the crawler.
  // A Spell-route crawler's primary attack is a Spell, which lives in its own
  // catalogue rather than among the Skills, so it needs its bump adding here.
  if (primary && !bumps.some(function (b) { return b.primary; })) {
    const roll = d4() + d4();
    const to = Math.min(cfg.rankCap, 3 + roll);
    bumps.unshift({ name: primary, from: 3, roll: roll, to: to,
                    wasted: Math.max(0, 3 + roll - cfg.rankCap),
                    primary: true, spell: !!dccSpellByName(primary) });
  }
  dccFloorStart(c).bumps = bumps;
  save(); wizRepaint();
}

// ─── screen 8: Race & Class ─────────────────────────────────────────────────
// Nothing is applied while you shop. The screen computes a live before/after
// diff and the change only lands when creation finishes, so backing out is free.
function dccPick(char) {
  const d = dccCre(char);
  if (!d.pick) d.pick = { race: null, cls: null, raceQuery: '', clsQuery: '' };
  return d.pick;
}

function dccEntryCard(char, e, kind, chosen) {
  const gate = dccMeetsPrereq(char, e);
  const locked = gate.ok === false;
  const bits = [];
  if (e.size) bits.push(esc(e.size.name) + ' (' + e.size.n + ')');
  Object.keys(e.stats || {}).forEach(function (k) {
    bits.push((e.stats[k] > 0 ? '+' : '') + e.stats[k] + ' ' + k);
  });
  (e.skills || []).forEach(function (s) {
    bits.push((s.rank > 0 ? '+' : '') + s.rank + ' ' + esc(s.skill));
  });
  return '<div ' + (locked ? '' : 'onclick="dccChoose(\'' + kind + '\',\'' + esc(e.id) + '\')"') +
    ' style="padding:6px 8px;border-radius:6px;margin-bottom:3px;cursor:' + (locked ? 'not-allowed' : 'pointer') +
    ';opacity:' + (locked ? '.45' : '1') + ';background:' + (chosen ? 'var(--surface3)' : 'transparent') +
    ';border:1px solid ' + (chosen ? 'var(--accent)' : 'var(--border)') + '">' +
    '<div style="display:flex;justify-content:space-between;gap:6px">' +
    '<div style="font-size:13px;font-weight:600">' + esc(e.name) + (locked ? ' &#128274;' : '') + '</div>' +
    (e.classType ? '<div style="font-size:10px;color:var(--muted)">' + esc(e.classType) + '</div>' : '') + '</div>' +
    (bits.length ? '<div style="font-size:11px;color:var(--muted)">' + bits.join(' &middot; ') + '</div>' : '') +
    (locked ? '<div style="font-size:10px;color:var(--accent)">' + esc(gate.why) + '</div>' : '') +
    (e.needsReview ? '<div style="font-size:10px;color:var(--muted)">Some benefit text is incomplete &mdash; see p.' +
      e.page + ' of the book.</div>' : '') + '</div>';
}

function dccRcFilter(pool, q) {
  const s = (q || '').toLowerCase();
  if (!s) return pool;
  return pool.filter(function (e) {
    return e.name.toLowerCase().indexOf(s) >= 0 ||
           (e.classType || '').toLowerCase().indexOf(s) >= 0;
  });
}

function dccScreenRaceClass(ctx) {
  const c = ctx.char, p = dccPick(c);
  let h = '<div class="card-sm" style="font-size:11px;color:var(--muted)">The AI offers you three of each. ' +
    'This shows all of them, with anything you do not qualify for locked and the reason given. ' +
    'Nothing changes on your sheet until you finish &mdash; the preview below is what it would do.</div>';

  h += '<div class="card"><div class="pg-title" style="font-size:16px">Race</div>' +
    dccCustomCard(c, 'race', p.race === 'custom-race') +
    '<input id="rc-race-q" placeholder="Search ' + DCC_RACES.length + ' Races" value="' + esc(p.raceQuery || '') +
    '" oninput="dccRcQuery(\'race\',this.value)" style="margin-bottom:6px">' +
    '<div id="rc-race-list" style="max-height:210px;overflow-y:auto">' +
    dccRcFilter(DCC_RACES, p.raceQuery).map(function (e) {
      return dccEntryCard(c, e, 'race', p.race === e.id);
    }).join('') + '</div></div>';

  h += '<div class="card"><div class="pg-title" style="font-size:16px">Class</div>' +
    dccCustomCard(c, 'class', p.cls === 'custom-class') +
    '<input id="rc-cls-q" placeholder="Search ' + DCC_CLASSES.length + ' Classes" value="' + esc(p.clsQuery || '') +
    '" oninput="dccRcQuery(\'cls\',this.value)" style="margin-bottom:6px">' +
    '<div id="rc-cls-list" style="max-height:210px;overflow-y:auto">' +
    dccRcFilter(DCC_CLASSES, p.clsQuery).map(function (e) {
      return dccEntryCard(c, e, 'cls', p.cls === e.id);
    }).join('') + '</div></div>';

  const diff = dccRcDiff(c);
  if (diff) {
    h += '<div class="card" style="border-color:var(--accent)">' +
         '<div class="pg-title" style="font-size:16px">What this would do</div>';
    const statKeys = Object.keys(diff.stats);
    if (statKeys.length) {
      h += '<div class="label" style="margin:6px 0 2px">Stats</div>' +
           '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:4px">';
      DCC_STATS.forEach(function (s) {
        const d = diff.stats[s.id];
        if (!d) return;
        h += '<div style="font-size:12px">' + s.id + ' <span style="color:var(--muted)">' + d.from + '</span> &rarr; ' +
             '<strong>' + d.to + '</strong> <span style="color:var(--accent)">(' +
             (d.delta > 0 ? '+' : '') + d.delta + ')</span></div>';
      });
      h += '</div>';
    }
    if (diff.skills.length) {
      h += '<div class="label" style="margin:8px 0 2px">Skills</div>';
      diff.skills.forEach(function (s) {
        h += '<div style="font-size:12px">' + esc(s.name) + ' <span style="color:var(--muted)">' + s.from +
             '</span> &rarr; <strong>' + s.to + '</strong>' +
             (s.wasted ? ' <span style="color:var(--red);font-size:10px">' + s.wasted +
                         ' wasted at the Rank ' + DCC_RC_RANK_CAP + ' cap</span>' : '') +
             (s.isNew ? ' <span style="font-size:9px;color:var(--accent)">NEW</span>' : '') + '</div>';
      });
    }
    if (diff.notes.length) {
      h += '<div class="label" style="margin:8px 0 2px">Also</div>';
      diff.notes.forEach(function (n) {
        h += '<div style="font-size:11px;color:var(--muted)">&bull; ' + esc(n) + '</div>';
      });
    }
    h += '</div>';
  }
  return h;
}

function dccRcQuery(which, v) {
  const p = dccPick(S.char);
  if (which === 'race') p.raceQuery = v; else p.clsQuery = v;
  save();
  // Repaint ONLY the list. Repainting the screen would replace the search box
  // mid-keystroke and drop the caret — the bug this whole project started with.
  const el = document.getElementById(which === 'race' ? 'rc-race-list' : 'rc-cls-list');
  if (!el) return;
  const pool = which === 'race' ? DCC_RACES : DCC_CLASSES;
  const sel = which === 'race' ? p.race : p.cls;
  el.innerHTML = dccRcFilter(pool, v).map(function (e) {
    return dccEntryCard(S.char, e, which, sel === e.id);
  }).join('');
}

function dccChoose(kind, id) {
  const p = dccPick(S.char);
  if (kind === 'race') p.race = p.race === id ? null : id;
  else p.cls = p.cls === id ? null : id;
  save(); wizRepaint();
}

// The transaction: computed, shown, and only applied when creation finishes.
function dccRcDiff(char) {
  const p = dccPick(char);
  const race = p.race === 'custom-race' ? dccCustomEntry(char, 'race')
             : p.race ? dccRace(p.race) : null;
  const cls = p.cls === 'custom-class' ? dccCustomEntry(char, 'class')
            : p.cls ? dccClass(p.cls) : null;
  if (!race && !cls) return null;
  const stats = {}, notes = [];
  [race, cls].filter(Boolean).forEach(function (e) {
    Object.keys(e.stats || {}).forEach(function (k) {
      const from = dccStatOf(char, k);
      const delta = (stats[k] ? stats[k].delta : 0) + e.stats[k];
      stats[k] = { from: from, delta: delta, to: from + delta };
    });
    (e.benefits || []).forEach(function (b) { notes.push(b); });
    (e.rank20 || []).forEach(function (b) { notes.push(b); });
    if (e.needsReview) {
      notes.push('Some of ' + e.name + "'s benefits are not fully captured — see p." + e.page + '.');
    }
  });
  const have = dccStartingSkills(char);
  const bumps = dccFloorStart(char).bumps || [];
  const rankOf = function (n) {
    const b = bumps.find(function (x) { return x.name === n; });
    if (b) return b.to;
    const s = have.find(function (x) { return x.name === n; });
    return s ? s.rank : 0;
  };
  const skills = [];
  [race, cls].filter(Boolean).forEach(function (e) {
    (e.skills || []).forEach(function (g) {
      const existing = skills.find(function (x) { return x.name === g.skill; });
      const base = existing ? existing.to : rankOf(g.skill);
      const raw = base + g.rank;
      const to = Math.min(DCC_RC_RANK_CAP, raw);
      if (existing) {
        existing.to = to;
        existing.wasted += Math.max(0, raw - DCC_RC_RANK_CAP);
      } else {
        skills.push({ name: g.skill, from: base, to: to,
                      wasted: Math.max(0, raw - DCC_RC_RANK_CAP),
                      isNew: rankOf(g.skill) === 0 });
      }
    });
  });
  return { race: race, cls: cls, stats: stats, skills: skills, notes: notes };
}

// ─── screen 9: review ───────────────────────────────────────────────────────
function dccScreenReview(ctx) {
  const c = ctx.char, d = dccCre(c);
  const diff = dccRcDiff(c);
  const fs = dccFloorStart(c);
  const st = c.story || {};
  const row = function (k, v) {
    return '<div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:2px 0">' +
           '<span style="color:var(--muted)">' + k + '</span><span style="text-align:right">' + v + '</span></div>';
  };
  let h = '<div class="card"><div class="pg-title" style="font-size:18px">' +
    esc(c.name || 'Unnamed') + '</div>' +
    '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Crawler #' +
    esc(String(c.crawlerNumber || '')) + ' &middot; ' + (c.species === 'animal' ? 'Animal' : 'Human') +
    ' &middot; Floor ' + fs.floor + ' &middot; Level ' + dccFloorCfg(c).level + '</div>' +
    row('Race', diff && diff.race ? esc(diff.race.name) : '<span style="color:var(--muted)">none</span>') +
    row('Class', diff && diff.cls ? esc(diff.cls.name) : '<span style="color:var(--muted)">none</span>') +
    '</div>';

  h += '<div class="card"><div class="label">Stats</div>' +
       '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:6px;text-align:center">';
  DCC_STATS.forEach(function (s) {
    const after = diff && diff.stats[s.id] ? diff.stats[s.id].to : dccStatOf(c, s.id);
    h += '<div><div style="font-size:20px;font-weight:800">' + after + '</div>' +
         '<div style="font-size:11px;color:var(--accent)">+' + dccStatMod(after) + '</div>' +
         '<div class="label" style="margin:0">' + s.id + '</div></div>';
  });
  h += '</div></div>';

  h += '<div class="card"><div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:space-around;text-align:center">' +
       '<div><div style="font-size:20px;font-weight:800;color:var(--accent)">10 &times; ' + dccModOf(c, 'CON') + '</div>' +
       '<div class="label" style="margin:0">Health Bar</div></div>' +
       '<div><div style="font-size:20px;font-weight:800;color:var(--accent)">' + dccStatOf(c, 'INT') + '</div>' +
       '<div class="label" style="margin:0">Mana</div></div>' +
       '<div><div style="font-size:20px;font-weight:800;color:var(--accent)">+' + dccModOf(c, 'DEX') + '</div>' +
       '<div class="label" style="margin:0">Evade</div></div>' +
       '<div><div style="font-size:20px;font-weight:800;color:var(--accent)">' + (fs.favor === null ? '—' : fs.favor) + '</div>' +
       '<div class="label" style="margin:0">AI Favor</div></div>' +
       '<div><div style="font-size:20px;font-weight:800;color:var(--accent)">' + (dccModOf(c, 'CHA') * 2) + '</div>' +
       '<div class="label" style="margin:0">Popularity</div></div></div></div>';

  const final = dccFinalSkills(c);
  h += '<div class="card"><div class="label">Skills (' + final.length + ')</div>' +
       '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:2px 10px">';
  final.slice().sort(function (a, b) { return b.rank - a.rank || a.name.localeCompare(b.name); })
    .forEach(function (s) {
      h += '<div style="font-size:12px;display:flex;justify-content:space-between">' +
           '<span>' + esc(s.name) + '</span><span style="font-weight:700">' + s.rank +
           ' <span style="color:var(--muted);font-weight:400">' + (s.stat || '—') + '</span></span></div>';
    });
  h += '</div></div>';

  h += '<div class="card"><div class="label">Scars</div>' +
       row('Past Trauma', esc(st.pastTrauma || '—')) +
       row('Loose End', esc(st.looseEnd || '—')) +
       row('Regret', esc(st.regret || '—'));
  if (st.linesNotToCross) {
    h += '<div style="margin-top:6px;padding:6px;border:1px solid var(--accent);border-radius:6px;font-size:11px">' +
         '<strong style="color:var(--accent)">Lines not to cross:</strong> ' + esc(st.linesNotToCross) + '</div>';
  }
  h += '</div>';
  return h;
}

// The Skills a finished crawler ends up with: background and combat picks, then
// the tutorial-floor bumps, then whatever Race and Class grant. Recomputed from
// the choices rather than accumulated, so going back and changing one is safe.
function dccFinalSkills(char) {
  const out = dccStartingSkills(char).map(function (s) { return Object.assign({}, s); });
  (dccFloorStart(char).bumps || []).forEach(function (b) {
    if (b.spell) return;                 // Spells are not Skills; D7 will carry them
    const s = out.find(function (x) { return x.name === b.name; });
    if (s) s.rank = b.to;
  });
  const diff = dccRcDiff(char);
  if (diff) {
    diff.skills.forEach(function (g) {
      const s = out.find(function (x) { return x.name === g.name; });
      if (s) { s.rank = g.to; return; }
      const cat = dccSkillByName(g.name);
      out.push({ name: g.name, rank: g.to, stat: cat ? cat.stat : null,
                 checkType: cat ? cat.checkType : null,
                 passive: !!(cat && cat.passive), source: 'raceclass', marked: false });
    });
  }
  return out;
}


// ─── the Spells a new crawler knows ─────────────────────────────────────────
// Everyone learns Heal on entering the dungeon (p. 111). A crawler who took the
// Spell route on screen 3 also has that Spell at Rank 3, plus whatever the
// tutorial floors added to it.
function dccStartingSpells(char) {
  const out = [];
  const add = function (name, rank) {
    const cat = dccSpellByName(name);
    if (!cat) return;
    const found = out.find(function (x) { return x.name === cat.name; });
    if (found) { found.rank = Math.max(found.rank, rank); return; }
    out.push({ name: cat.name, rank: rank, stat: 'INT', checkType: cat.kind === 'attack' ? 'evade' : 'unopposed',
               passive: false, source: 'start', marked: false, mana: cat.mana });
  };
  add('Heal', 1);                                  // Rank 1 maximum, per the entry
  const cm = dccCre(char).combat;
  if (cm.route === 'spell' && cm.spell) {
    const bump = (dccFloorStart(char).bumps || []).find(function (b) { return b.name === cm.spell; });
    add(cm.spell, bump ? bump.to : 3);
  }
  return out;
}

// Everything a Spell-route crawler should be carrying in the Hotlist at the
// start: their attack Spell, Heal, and the five Mana Potions the book grants.
function dccStartingHotlist(char) {
  const cm = dccCre(char).combat;
  const out = [{ name: 'Heal', qty: 1 }];
  if (cm.route === 'spell' && cm.spell) {
    out.push({ name: cm.spell, qty: 1 });
    out.push({ name: 'Standard Mana Potion', qty: DCC_STARTING_SPELL_POTIONS });
  }
  return out;
}

// ─── screen 7, continued: Acquired Loot and the Tutorial Floor Experiences ──
// What the Tutorial Floors left you holding, and what happened to you there.
// The Experiences are rolled and recorded — table, result and page — but their
// narrative stays in the book, which is where a story hook belongs.
function dccLoot(char) {
  const fs = dccFloorStart(char);
  if (!fs.loot) fs.loot = { spread: null, slots: {}, upgrade: null };
  if (!fs.experiences) fs.experiences = [];
  return fs;
}

// A spread row reads "Platinum Weapon/Spells, Gold Armor/Spells, …". Pull the
// tier out for each of the four slots rather than making the player parse it.
function dccSpreadTiers(text) {
  const out = {};
  DCC_LOOT_SLOTS.forEach(slot => {
    const re = new RegExp('(' + DCC_LOOT_TIERS.join('|') + ')\\s+' + slot.label, 'i');
    const m = re.exec(text || '');
    if (m) out[slot.id] = m[1];
  });
  return out;
}

function dccScreenLoot(ctx) {
  const c = ctx.char, fs = dccLoot(c);
  const spread = fs.loot.spread ? DCC_LOOT_SPREAD.find(r => r.roll === fs.loot.spread) : null;
  const tiers = spread ? dccSpreadTiers(spread.text) : {};

  let h = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline">' +
    '<div class="pg-title" style="font-size:16px">Acquired Loot</div>' +
    '<button class="btn btn-gold btn-xs" onclick="dccRollSpread()">' +
    (spread ? 'Roll again' : 'Roll 1d4') + '</button></div>' +
    '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">' +
    'What you were carrying when you reached the stairs. Spells can replace the weapon, ' +
    'armor or item, but never the consumable.</div>';

  if (!spread) {
    h += '<div style="font-size:12px;color:var(--muted)">Not rolled yet.</div></div>';
  } else {
    h += '<div style="font-size:12px;margin-bottom:8px">' + esc(spread.text) + '</div>';
    DCC_LOOT_SLOTS.forEach(slot => {
      const tier = tiers[slot.id] || '—';
      const val = (fs.loot.slots || {})[slot.id] || '';
      h += '<div style="display:flex;gap:8px;align-items:center;padding:3px 0">' +
        '<div style="width:88px;flex-shrink:0"><div style="font-size:12px;font-weight:700">' + esc(slot.label) + '</div>' +
        '<div style="font-size:10px;color:var(--accent)">' + esc(tier) + '</div></div>' +
        '<input style="flex:1" value="' + esc(val) + '" placeholder="What you took" ' +
        'oninput="dccStoreLoot(\'' + slot.id + '\',this.value)">';
      if (slot.spellsInstead) {
        h += '<button class="btn btn-secondary btn-xs" onclick="dccRollLootSpell(\'' + slot.id + '\')">Spell instead</button>';
      }
      h += '</div>';
    });
    h += '<div style="font-size:10px;color:var(--muted);margin-top:4px">' +
      'What each tier grants is on p.116 of the book.</div>';
    const wt = (tiers.weapon || '').toLowerCase();
    if (wt === 'gold' || wt === 'platinum') {
      h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div style="font-size:12px;font-weight:700">Scroll of Upgrade</div>' +
        '<button class="btn btn-gold btn-xs" onclick="dccRollUpgrade()">Roll 1d12</button></div>' +
        '<div style="font-size:10px;color:var(--muted)">A ' + esc(tiers.weapon) +
        ' weapon comes with one (Table 26).</div>';
      if (fs.loot.upgrade) {
        const u = DCC_WEAPON_UPGRADES.find(x => x.roll === fs.loot.upgrade);
        if (u) h += '<div style="font-size:12px;margin-top:4px">' + esc(u.text) + '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
  }

  // ── the six Experiences ──────────────────────────────────────────────────
  const exp = fs.experiences || [];
  h += '<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline">' +
    '<div class="pg-title" style="font-size:16px">Tutorial Floor Experiences</div>' +
    '<button class="btn btn-gold btn-xs" onclick="dccRollExperiences()">' +
    (exp.length ? 'Roll again' : 'Roll all six') + '</button></div>' +
    '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">' +
    'Six things that happened to you down there. 1d6 picks the table, 1d12 picks the result. ' +
    'The app records which — read what it says in your book, and tell your GM: these are ' +
    'the hooks they are meant to bring back.</div>';
  if (!exp.length) {
    h += '<div style="font-size:12px;color:var(--muted)">Not rolled yet.</div>';
  } else {
    exp.forEach((e, i) => {
      h += '<div style="display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">' +
        '<div style="width:22px;color:var(--muted);font-size:11px">' + (i + 1) + '</div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600">' + esc(e.title) + '</div>' +
        '<div style="font-size:10px;color:var(--muted)">Table ' + e.table + ', roll ' + e.result +
        ' &middot; p.' + e.page + '</div></div>' +
        '<button class="btn btn-secondary btn-xs" onclick="dccRerollExperience(' + i + ')">Reroll</button></div>';
    });
    h += '<div style="font-size:10px;color:var(--muted);margin-top:6px">' +
      'Some of these grant a Skill. Add it on the sheet once you have read the entry.</div>';
  }
  return h + '</div>';
}

function dccRollSpread() {
  const fs = dccLoot(S.char);
  fs.loot.spread = wizRoll(DCC_LOOT_SPREAD.length);
  fs.loot.upgrade = null;
  save(); wizRepaint();
}
function dccStoreLoot(slot, v) {            // store only; never repaint on typing
  const fs = dccLoot(S.char);
  fs.loot.slots = fs.loot.slots || {};
  fs.loot.slots[slot] = v;
  save();
}
function dccRollLootSpell(slot) {
  const fs = dccLoot(S.char);
  const row = DCC_RANDOM_SPELLS[Math.floor(Math.random() * DCC_RANDOM_SPELLS.length)];
  fs.loot.slots = fs.loot.slots || {};
  fs.loot.slots[slot] = row.spell + ' (Spell)';
  save(); wizRepaint();
}
function dccRollUpgrade() {
  dccLoot(S.char).loot.upgrade = wizRoll(DCC_WEAPON_UPGRADES.length);
  save(); wizRepaint();
}
function dccRollOneExperience() {
  const t = DCC_EXPERIENCE_TABLES[Math.floor(Math.random() * DCC_EXPERIENCE_TABLES.length)];
  return { table: t.table, title: t.title, page: t.page, result: wizRoll(t.rolls || 12) };
}
function dccRollExperiences() {
  const fs = dccLoot(S.char);
  fs.experiences = [];
  for (let i = 0; i < DCC_EXPERIENCE_COUNT; i++) fs.experiences.push(dccRollOneExperience());
  save(); wizRepaint();
}
function dccRerollExperience(i) {
  const fs = dccLoot(S.char);
  if (!fs.experiences[i]) return;
  fs.experiences[i] = dccRollOneExperience();
  save(); wizRepaint();
}


// ─── custom Races and Classes ───────────────────────────────────────────────
// The Build System (pp. 158-162) lets you invent your own with 25 Race points
// or 30 Class points. The point calculator is a later phase; this is the place
// to record what you built, so the screen never forces a pick from the lists.
function dccCustom(char, kind) {
  const p = dccPick(char);
  if (!p.custom) p.custom = {};
  if (!p.custom[kind]) p.custom[kind] = { name: '', notes: '', stats: {} };
  return p.custom[kind];
}

// A custom entry pretends to be a catalogue entry, so the diff, the finish step
// and the review screen all treat it the same as a printed one.
function dccCustomEntry(char, kind) {
  const c = dccCustom(char, kind);
  if (!String(c.name || '').trim()) return null;
  return {
    id: 'custom-' + kind, name: c.name.trim(), custom: true,
    stats: Object.keys(c.stats || {}).reduce((o, k) => {
      if (c.stats[k]) o[k] = c.stats[k];
      return o;
    }, {}),
    skills: [], benefits: c.notes ? [c.notes] : [], rank20: [],
  };
}

function dccCustomCard(char, kind, chosen) {
  const c = dccCustom(char, kind);
  const label = kind === 'race' ? 'Race' : 'Class';
  let h = '<div style="padding:6px 8px;border-radius:6px;margin-bottom:6px;border:1px solid '
    + (chosen ? 'var(--accent)' : 'var(--border)') + ';background:'
    + (chosen ? 'var(--surface3)' : 'transparent') + '">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">'
    + '<div style="font-size:13px;font-weight:600">Build your own ' + label + '</div>'
    + '<button class="btn btn-xs ' + (chosen ? 'btn-primary' : 'btn-secondary') + '" '
    + 'onclick="dccChooseCustom(' + jsArg(kind) + ')">'
    + (chosen ? 'Using this' : 'Use this') + '</button></div>'
    + '<div style="font-size:10px;color:var(--muted);margin-bottom:4px">'
    + (kind === 'race' ? '25 Race Build Points' : '30 Class Build Points')
    + ' (pp. 158-162). Work it out in the book, then record it here.</div>'
    + '<input value="' + esc(c.name || '') + '" placeholder="' + label + ' name" '
    + 'oninput="dccCustomSet(' + jsArg(kind) + ',' + jsArg('name') + ',this.value)" '
    + 'style="margin-bottom:4px">';
  if (chosen) {
    h += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-bottom:4px">';
    DCC_STATS.forEach(function (st) {
      const v = (c.stats || {})[st.id] || 0;
      h += '<div style="text-align:center">'
        + '<div style="font-size:10px;color:var(--muted)">' + st.id + '</div>'
        + '<div style="display:flex;align-items:center;justify-content:center;gap:2px">'
        + '<button class="btn btn-secondary btn-xs" onclick="dccCustomStat(' + jsArg(kind)
        + ',' + jsArg(st.id) + ',-1)">&minus;</button>'
        + '<span style="min-width:20px;font-weight:700">' + (v > 0 ? '+' : '') + v + '</span>'
        + '<button class="btn btn-secondary btn-xs" onclick="dccCustomStat(' + jsArg(kind)
        + ',' + jsArg(st.id) + ',1)">+</button></div></div>';
    });
    h += '</div><textarea rows="2" placeholder="Benefits and drawbacks, in your own words" '
      + 'oninput="dccCustomSet(' + jsArg(kind) + ',' + jsArg('notes') + ',this.value)">'
      + esc(c.notes || '') + '</textarea>';
  }
  return h + '</div>';
}

function dccCustomSet(kind, field, v) {   // store only; never repaint on typing
  dccCustom(S.char, kind)[field] = v;
  save();
}
function dccCustomStat(kind, stat, delta) {
  const c = dccCustom(S.char, kind);
  c.stats = c.stats || {};
  c.stats[stat] = (c.stats[stat] || 0) + delta;
  if (!c.stats[stat]) delete c.stats[stat];
  save(); wizRepaint();
}
function dccChooseCustom(kind) {
  const p = dccPick(S.char);
  const key = kind === 'race' ? 'race' : 'cls';
  p[key] = p[key] === 'custom-' + kind ? null : 'custom-' + kind;
  save(); wizRepaint();
}

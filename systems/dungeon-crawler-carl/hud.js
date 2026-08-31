// systems/dungeon-crawler-carl/hud.js — the crawler's fight screen.
//
// The sheet is ~31,000 characters and the Health Bar is the second block on it,
// so taking a hit means scrolling past the Stat grid, and the Hotlist is at the
// bottom past the Gear Slots. Worse, a crawler's Attacks are not shown anywhere
// AS attacks: they are Skills with kind:'attack' sorted alphabetically in among
// Perception and Sleight of Hand, with their damage left behind in the
// catalogue. This screen is the four things you touch in a round — hit points,
// the ten slots you can reach in one Action, what you can swing, what you can
// cast — and nothing else.
//
// It is a PACK file on purpose. The shell owns the nav slot, the page container
// and exactly one call (SYS.renderHUD); everything below is Dungeon Crawler
// Carl's, so it cannot be silently withheld from the next pack the way
// core/sheet.js withheld the dice roller for a year. When a second pack wants a
// HUD, the generic parts move UP into core/ — the direction that costs nobody
// anything. See PORTING.md.
//
// SYS is this pack whenever these run: renderHUD() is only reached through
// SYS.renderHUD, so SYS.derive.* below is safe in a way it would not be in a
// helper the sheet renderer can call with somebody else's character.

function dccRenderHUD(char) {
  if (!char || !char.blocks) {
    return '<div class="card tac" style="padding:26px;color:var(--muted);font-size:13px">' +
      'No crawler yet. Finish creation and this is where the fight lives.</div>';
  }
  return dccHudHeader(char) +
    '<div id="hud-roll"></div>' +
    dccHudVitals(char) +
    dccHudHotlist(char) +
    dccHudActions(char, 'skills') +
    dccHudActions(char, 'spells');
}

function dccHudHeader(char) {
  const floor = (typeof S !== 'undefined' && S && S.floor) || char.floor || 3;
  const name = (char.name || '').trim();
  return '<div style="display:flex;justify-content:space-between;align-items:baseline;' +
    'gap:8px;margin-bottom:8px;flex-wrap:wrap">' +
    '<div class="pg-title" style="font-size:22px">' + esc(name || 'Crawler') + '</div>' +
    '<div style="font-size:11px;color:var(--muted)">' +
    esc(lexU('logBreak')) + ' ' + esc(String(floor)) + '</div></div>';
}

// ── vitals ──────────────────────────────────────────────────────────────────
// The real blocks, not a copy of them. Damage input, the dying warning and the
// Mana clamp all come along, and because blockRepaint() now walks every mount,
// taking a hit here also moves the bar on the sheet. Drawing a second health
// bar by hand is how the two would drift.
function dccHudVitals(char) {
  return ['health', 'mana'].map(function (id) {
    const b = (typeof sysBlock === 'function') ? sysBlock(id) : null;
    if (!b) return '';
    try { return renderBlock(b, char, 'hud'); } catch (e) { return ''; }
  }).join('');
}

// ── the Hotlist ─────────────────────────────────────────────────────────────
// "Ten slots, reachable with one Action" is the book's own description of a
// quick bar, so it is drawn as one. The controls call the same inv* handlers
// the Gear block uses, so an item drunk here is drunk on the sheet too; the HUD
// then redraws itself, because it is not a gear-block mount and would otherwise
// go stale under its own buttons.
function dccHudHotlist(char) {
  const b = (typeof sysBlock === 'function') ? sysBlock('gear') : null;
  if (!b) return '';
  const c = (b.containers || []).find(function (x) { return x.id === 'hotlist'; });
  if (!c) return '';
  const d = (char.blocks && char.blocks.gear) || {};
  const items = d.hotlist || [];
  const size = c.size || 10;
  const used = items.filter(Boolean).length;
  let h = '<div class="card"><div style="display:flex;justify-content:space-between;' +
    'align-items:center;margin-bottom:6px"><div class="blk-title">' + esc(c.label || 'Hotlist') +
    '</div><span style="font-size:11px;color:var(--muted)">' + used + ' of ' + size +
    ' · one Action to reach</span></div>';
  for (let i = 0; i < size; i++) {
    const it = items[i];
    h += '<div class="inv-row"><div class="inv-slotno">' + (i + 1) + '</div>';
    if (!it) { h += '<div class="inv-name" style="color:var(--muted)">empty</div></div>'; continue; }
    const line = invReadout(b, it, char);
    // A weapon works as a Skill; a scroll or tome casts a Spell. Either way
    // there is something to roll, so offer it here rather than sending the
    // player to another tab to find the name again.
    const rollable = it.skill || it.casts || dccHudRollableName(char, it.name);
    h += '<div class="inv-name">' + esc(it.name) +
      (line ? '<span class="inv-stat">' + esc(line) + '</span>' : '') + '</div>' +
      '<div class="inv-ctl">' +
      (rollable ? '<button class="btn btn-secondary btn-xs" title="Roll ' + esc(rollable) +
        '" onclick="dccHudRoll(' + dccHudArg(rollable) + ')">\u{1F3B2}</button>' : '') +
      '<button class="btn btn-secondary btn-xs" title="Use one" ' +
      'onclick="dccHudQty(' + i + ',-1)">−</button>' +
      '<div class="num" style="min-width:28px;text-align:center;font-weight:700">' +
      (it.qty || 1) + '</div>' +
      '<button class="btn btn-secondary btn-xs" onclick="dccHudQty(' + i + ',1)">+</button>' +
      '</div></div>';
  }
  return h + '</div>';
}

// A Hotlist entry is often just a name — creation writes {name:'Heal'} for a
// Spell. If that name is a Skill or Spell the crawler actually has, it is
// rollable from here.
function dccHudRollableName(char, name) {
  const n = String(name || '').toLowerCase();
  if (!n) return '';
  const has = dccHudKnown(char).find(function (s) { return s.name.toLowerCase() === n; });
  return has ? has.name : '';
}

function dccHudKnown(char) {
  return ['skills', 'spells'].reduce(function (out, id) {
    const b = char.blocks && char.blocks[id];
    return out.concat((b && b.skills) || []);
  }, []);
}

function dccHudQty(i, delta) {
  invQty('gear', 'hotlist', i, delta);
  renderHUD();
}

// ── attacks and spells ──────────────────────────────────────────────────────
// Attacks are Skills the catalogue calls kind:'attack'. A crawler is entitled to
// a Skill the book does not have (p. 174), and a custom one carries no kind — so
// fall back to its check type, because checking against Evade is what makes a
// Skill an attack in the first place.
function dccHudIsAttack(s, cat) {
  if (cat && cat.kind) return cat.kind === 'attack';
  return s.checkType === 'evade';
}

function dccHudActions(char, blockId) {
  const spells = blockId === 'spells';
  const list = ((char.blocks && char.blocks[blockId] && char.blocks[blockId].skills) || [])
    .filter(function (s) { return s && s.name && !s.passive; });
  const look = spells ? dccSpellByName : dccSkillByName;
  let rows = list.map(function (s) { return { s: s, cat: look(s.name) }; });
  if (!spells) rows = rows.filter(function (r) { return dccHudIsAttack(r.s, r.cat); });
  // Attack Spells first — mid-fight the healing ones are the exception.
  rows.sort(function (a, z) {
    const ak = (a.cat && a.cat.kind === 'attack') ? 0 : 1;
    const zk = (z.cat && z.cat.kind === 'attack') ? 0 : 1;
    return ak - zk || a.s.name.localeCompare(z.s.name);
  });
  const label = spells ? lexU('spell') + 's' : 'Attacks';
  let h = '<div class="card"><div class="blk-title" style="margin-bottom:6px">' + esc(label) + '</div>';
  if (!rows.length) {
    h += '<div class="tac text-muted" style="padding:14px;font-size:12px">' +
      (spells ? 'No Spells known.' : 'Nothing to attack with yet — a weapon Skill or Unarmed Combat goes here.') +
      '</div>';
    return h + '</div>';
  }
  rows.forEach(function (r) { h += dccHudCard(char, r.s, r.cat, spells); });
  return h + '</div>';
}

function dccHudCard(char, s, cat, spells) {
  const rank = s.rank || 0;
  const stat = s.stat || (spells ? 'INT' : '');
  const statMod = stat ? dccModOf(char, stat) : 0;
  const worn = dccHudWorn(char, s.name);
  const hit = rank + statMod + worn;
  // Rank damage dice are damage. Heal has a Rank like anything else, and
  // appending its "+1" under a healing Spell read as though it hurt someone.
  const isAtk = dccHudIsAttack(s, cat);
  const dmg = isAtk ? [cat && cat.baseDamage, dccRankDamage(rank)].filter(Boolean).join(' ') : '';
  const ups = dccHudUpgrades(char, s.name);
  const gate = spells ? dccHudHotlistGate(char, s.name) : '';

  let h = '<div class="hud-act">' +
    '<div class="hud-act-top">' +
    '<div class="hud-act-name">' + esc(s.name) + '</div>' +
    '<button class="btn btn-primary btn-xs" onclick="dccHudRoll(' + dccHudArg(s.name) + ')">\u{1F3B2} Roll</button>' +
    '</div>' +
    '<div class="hud-act-nums">' +
    '<span class="hud-hit">' + (hit >= 0 ? '+' : '') + hit + '</span>' +
    '<span class="hud-act-vs">' +
    (isAtk ? ('to hit' + (cat && cat.checkType === 'evade' ? ' vs Evade' : '')) : 'to cast') +
    '</span>' +
    (dmg ? '<span class="hud-dmg">' + esc(dmg) + '</span>' : '') +
    '</div>';

  const bits = ['Rank ' + rank + (stat ? ' · ' + esc(stat) + ' ' + (statMod >= 0 ? '+' : '') + statMod : '')];
  if (worn) bits.push('gear ' + (worn >= 0 ? '+' : '') + worn);
  if (spells && cat && cat.mana !== undefined) bits.push(cat.mana + ' Mana');
  if (cat && cat.range) bits.push(esc(cat.range));
  if (cat && cat.cooldown) bits.push(esc(String(cat.cooldown).split('.')[0]));
  h += '<div class="hud-act-meta">' + bits.join(' · ') + '</div>';

  if (spells && cat && cat.mana !== undefined) {
    h += '<div style="margin-top:4px"><button class="btn btn-secondary btn-xs" ' +
      'title="Spend the Mana this Spell costs" onclick="dccHudSpend(' + (Number(cat.mana) || 0) + ')">' +
      'Spend ' + (Number(cat.mana) || 0) + ' Mana</button></div>';
  }
  if (gate) h += '<div class="hud-gate">' + gate + '</div>';
  if (cat && cat.traits && cat.traits.length) {
    h += '<div style="margin-top:4px">' + cat.traits.map(function (t) {
      return '<span class="tag" style="background:var(--surface3);color:var(--text);' +
        'border:1px solid var(--border)">' + esc(t) + '</span>';
    }).join(' ') + '</div>';
  }
  if (ups.length) {
    h += '<div class="sk-effect"><strong>Earned:</strong> ' +
      ups.map(function (u) { return esc(u); }).join(' ') + '</div>';
  }
  return h + '</div>';
}

// "A Spell has to be in your Hotlist to cast it under pressure." That rule has
// been sitting in the Spells block's hint text, enforced by nobody. It is a
// warning rather than a block: the GM decides what counts as pressure.
function dccHudHotlistGate(char, name) {
  const g = (char.blocks && char.blocks.gear) || {};
  const n = String(name).toLowerCase();
  const inList = (g.hotlist || []).some(function (it) {
    if (!it) return false;
    return String(it.name || '').toLowerCase() === n ||
           String(it.casts || '').toLowerCase() === n;
  });
  return inList ? '' : 'Not in your Hotlist — you cannot cast this under pressure.';
}

function dccHudWorn(char, name) {
  try { return Number(SYS.derive.wornBonus(char, 'skill', name)) || 0; } catch (e) { return 0; }
}
function dccHudUpgrades(char, name) {
  try { return SYS.derive.activeUpgrades(char, name) || []; } catch (e) { return []; }
}

// Names come from the rulebook and carry apostrophes — Wrasslin' would close
// the onclick string and take the rest of the card with it.
function dccHudArg(name) {
  return '&#39;' + esc(String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'")) + '&#39;';
}

// ── rolling from a card ─────────────────────────────────────────────────────
// sysRollSkill() is the shell's single roll choke point, so a roll made here
// reaches the multiplayer table feed exactly like one made from the Dice tab.
function dccHudRoll(name) {
  if (!SYS.dice || typeof SYS.dice.resolve !== 'function') return;
  sysRollSkill(name);
  sysRenderRollInto('hud-roll', true);
  const el = document.getElementById('hud-roll');
  if (el && typeof el.scrollIntoView === 'function') {
    try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }
}

function dccHudSpend(n) {
  if (!n) return;
  poolAdj('mana', -Math.abs(n));
  renderHUD();
}

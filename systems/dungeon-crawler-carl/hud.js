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
    // The HUD wears the Hero page's layout: the shell fills a sticky roller
    // beside it on desktop, and this is the mobile half of that pair. The
    // attack cards below answer into the same instance, so there is one place
    // on this screen where a result appears.
    rollBarHTML('hm', { sheet: false, resultIn: 'hm-result', toast: false }) +
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

// ── the Hotlist keypad ──────────────────────────────────────────────────────
// "Ten slots, reachable with one Action" is the book's own description of a
// quick bar, so it is drawn as one — ten big buttons laid out like an
// old telephone: 3×3 with the tenth centred underneath on a phone, 5×2 on
// desktop. Empty slots stay rendered, because a fixed shape is the whole point:
// what makes this fast at the table is knowing that Slot 4 is your Heal without
// reading it.
//
// One tap does the thing. What "the thing" is depends on the item and only the
// pack knows — a potion is drunk, a scroll is cast and then spent, a weapon is
// rolled and costs nothing — so it comes from derive.gearItemTap. The controls
// go through the same inv* handlers the Gear block uses, so an item spent here
// is spent on the sheet too.
//
// The sheet's own Hotlist is left alone: that is the management view, where you
// add things, move them between containers and set quantities. This is the one
// you use while something is trying to kill you.
function dccHudHotlist(char) {
  const b = (typeof sysBlock === 'function') ? sysBlock('gear') : null;
  if (!b) return '';
  const c = (b.containers || []).find(function (x) { return x.id === 'hotlist'; });
  if (!c) return '';
  const items = ((char.blocks && char.blocks.gear) || {}).hotlist || [];
  const size = c.size || 10;
  const used = items.filter(Boolean).length;
  let h = '<div class="card"><div style="display:flex;justify-content:space-between;' +
    'align-items:center;margin-bottom:8px"><div class="blk-title">' + esc(c.label || 'Hotlist') +
    '</div><span style="font-size:11px;color:var(--muted)">' + used + ' of ' + size +
    ' · one Action to reach</span></div><div class="hot-pad">';
  for (let i = 0; i < size; i++) h += dccHudSlot(b, char, items[i], i);
  return h + '</div><div id="hot-undo"></div></div>';
}

function dccHudSlot(b, char, it, i) {
  const n = '<span class="hot-no">' + (i + 1) + '</span>';
  if (!it) {
    return '<div class="hot-slot is-empty" title="Slot ' + (i + 1) + ' — empty">' + n +
      '<span class="hot-ico"></span><span class="hot-name">empty</span></div>';
  }
  const tap = dccHudTapFor(it, char);
  const qty = it.qty || 1;
  // The icon is the point of the button: at arm's length on a phone you read the
  // picture, not the label. Falls back to the first letter so an item with no
  // icon chosen is still distinguishable from its neighbours.
  const ico = it.icon
    ? iconHTML(it.icon, 34)
    : '<span class="hot-letter">' + esc(String(it.name || '?').charAt(0).toUpperCase()) + '</span>';
  const attrs = tap
    ? ' onclick="dccHudTap(' + i + ')" title="' + esc(tap.label || it.name) + '"'
    : ' title="' + esc(it.name) + ' — nothing to tap; hold for detail"';
  return '<button type="button" class="hot-slot' + (tap ? '' : ' is-inert') + '"' + attrs +
    ' oncontextmenu="return dccHudSlotDetail(' + i + ',event)">' + n +
    (qty > 1 ? '<span class="hot-qty">' + qty + '</span>' : '') +
    '<span class="hot-ico">' + ico + '</span>' +
    '<span class="hot-name">' + esc(it.name) + '</span></button>';
}

// What one tap on this slot does, asked of the pack. A pack that declares no
// gearItemTap gets inert buttons rather than a guess.
function dccHudTapFor(it, char) {
  const fn = sysDerive('gearItemTap');
  if (!fn) return null;
  try { return fn(it, char) || null; } catch (e) { return null; }
}

// The tap. Roll first so the result is on screen, then spend, then offer the way
// back — a button that takes a potion with no ± to correct it needs an undo.
function dccHudTap(i) {
  const char = S.char;
  const items = ((char.blocks && char.blocks.gear) || {}).hotlist || [];
  const it = items[i];
  if (!it) return;
  const tap = dccHudTapFor(it, char);
  if (!tap) return;
  if (tap.roll) dccHudRoll(tap.roll);
  let undo = null;
  if (tap.spend) undo = invSpend('gear', 'hotlist', i);
  renderHUD();
  if (undo) dccHudUndo(undo, it.name);
}

let _hudUndo = null;
function dccHudUndo(undo, name) {
  _hudUndo = undo;
  const el = document.getElementById('hot-undo');
  if (!el) return;
  el.innerHTML = '<div class="hot-undo">Spent ' + esc(name) +
    (undo.emptied ? ' — the slot is empty now' : '') +
    ' <button class="btn btn-secondary btn-xs" onclick="dccHudUndoTake()">Undo</button></div>';
}

function dccHudUndoTake() {
  if (!_hudUndo) return;
  invUnspend(_hudUndo);
  _hudUndo = null;
  renderHUD();
}

// Long-press / right-click: what the thing actually is, without leaving the HUD.
function dccHudSlotDetail(i, ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  const char = S.char;
  const it = (((char.blocks && char.blocks.gear) || {}).hotlist || [])[i];
  if (!it) return false;
  const b = sysBlock('gear');
  const line = b ? invReadout(b, it, char) : '';
  const tap = dccHudTapFor(it, char);
  popOpen('<div class="pg-title" style="font-size:15px;margin-bottom:4px">' + esc(it.name) + '</div>' +
    (line ? '<div class="sk-effect">' + esc(line) + '</div>' : '') +
    '<div style="font-size:11px;color:var(--muted);margin:6px 0">Slot ' + (i + 1) +
    ' · ' + (it.qty || 1) + ' carried' + (tap ? ' · tap to ' + esc(tap.label) : '') + '</div>' +
    '<button class="btn btn-danger btn-xs" onclick="dccHudSlotClear(' + i + ')">Remove from Hotlist</button>',
    ev && ev.currentTarget);
  return false;
}

function dccHudSlotClear(i) {
  invRemove('gear', 'hotlist', '', i);
  popClose();
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

// What is actually in your hands. Only the Gear Slots count — "only what is in
// a Gear Slot gives you anything" (p. 112) — so a weapon in the Hotlist is
// reachable in one Action but is not what you are holding this second.
function dccHeldWeapons(char) {
  const b = (typeof sysBlock === 'function') ? sysBlock('gear') : null;
  const d = (char && char.blocks && char.blocks.gear) || {};
  const out = [];
  ((b && b.containers) || []).filter(function (c) { return c.kind === 'slots'; })
    .forEach(function (c) {
      const held = d[c.id] || {};
      Object.keys(held).forEach(function (sl) {
        (held[sl] || []).forEach(function (it) {
          if (!it) return;
          const name = it.skill || it.grantsSkill;
          if (!name) return;
          const cat = dccSkillByName(name);
          if (cat && cat.kind !== 'attack') return;
          out.push({ skill: cat ? cat.name : name, item: it, cat: cat });
        });
      });
    });
  return out;
}

function dccHudActions(char, blockId) {
  const spells = blockId === 'spells';
  const list = ((char.blocks && char.blocks[blockId] && char.blocks[blockId].skills) || [])
    .filter(function (s) { return s && s.name && !s.passive; });
  const look = spells ? dccSpellByName : dccSkillByName;
  let rows = list.map(function (s) { return { s: s, cat: look(s.name) }; });
  if (!spells) rows = rows.filter(function (r) { return dccHudIsAttack(r.s, r.cat); });

  // The weapon in your hand belongs at the top of the Attacks list, and belongs
  // there even when you have no Ranks in it — a Skill may be attempted untrained
  // (p. 174), which is exactly what picking up somebody else's bow means.
  //
  // Without this the section was a list of Skills rather than a list of what you
  // can attack with right now: a crawler holding a Bow they had no Ranks in saw
  // their Handgun sitting at the top as though it were the live weapon.
  if (!spells) {
    dccHeldWeapons(char).forEach(function (h) {
      const key = h.skill.toLowerCase();
      const owned = rows.find(function (r) { return r.s.name.toLowerCase() === key; });
      if (owned) { owned.held = h.item; return; }
      rows.push({
        s: { name: h.skill, rank: 0, stat: h.cat ? h.cat.stat : '', checkType: 'evade', untrained: true },
        cat: h.cat, held: h.item,
      });
    });
  }

  // A weapon Skill is only an attack you can actually make if the weapon is in
  // your hand. Knowing Handgun does not let you shoot one out of your backpack —
  // drawing it is an Action — so a stowed weapon's card does not belong in a
  // list of what you can do this round. Hand-To-Hand Skills need nothing and are
  // always here; so is a custom Skill, because a Skill the book does not have
  // (p. 174) carries no category and we cannot prove it needs a weapon.
  let stowed = [];
  if (!spells) {
    const keep = [];
    rows.forEach(function (r) {
      if (r.held || !dccNeedsWeapon(r.cat)) keep.push(r);
      else stowed.push(r.s.name);
    });
    rows = keep;
  }

  rows.sort(function (a, z) {
    // In hand first, then attack Spells before the healing ones.
    if (!!a.held !== !!z.held) return a.held ? -1 : 1;
    const ak = (a.cat && a.cat.kind === 'attack') ? 0 : 1;
    const zk = (z.cat && z.cat.kind === 'attack') ? 0 : 1;
    return ak - zk || a.s.name.localeCompare(z.s.name);
  });
  const label = spells ? lexU('spell') + 's' : 'Attacks';
  let h = '<div class="card"><div class="blk-title" style="margin-bottom:6px">' + esc(label) + '</div>';
  if (!rows.length) {
    h += '<div class="tac text-muted" style="padding:14px;font-size:12px">' +
      (spells ? 'No Spells known.'
              : stowed.length ? 'Nothing in your hands. Equip a weapon in a Gear Slot to attack with it.'
              : 'Nothing to attack with yet — a weapon Skill or Unarmed Combat goes here.') +
      '</div>';
    return h + dccHudStowed(stowed) + '</div>';
  }
  rows.forEach(function (r) { h += dccHudCard(char, r.s, r.cat, spells, r.held); });
  return h + dccHudStowed(stowed) + '</div>';
}

// Does this Skill need a weapon in hand to use? The catalogue says so by
// category: the four Weapon categories do, Hand-To-Hand does not.
function dccNeedsWeapon(cat) {
  return !!(cat && /Weapon/i.test(cat.category || ''));
}

// Weapon Skills you know but are not holding. Named rather than silently
// dropped, so "where did my Handgun go?" answers itself.
function dccHudStowed(names) {
  if (!names || !names.length) return '';
  return '<div class="hud-stowed">Not in hand: ' +
    names.sort().map(function (n) { return esc(n); }).join(' · ') +
    '<span class="hud-stowed-n">equip one to attack with it</span></div>';
}

function dccHudCard(char, s, cat, spells, held) {
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

  // The thing in your hand supplies the picture when there is one.
  const ico = (held && held.icon) || dccAttackIcon(char, s);

  let h = '<div class="hud-act' + (held ? ' is-held' : '') + '">' +
    (ico ? '<div class="hud-act-ico">' + iconHTML(ico) + '</div>' : '') +
    '<div class="hud-act-body">' +
    '<div class="hud-act-top">' +
    '<div class="hud-act-name">' + esc(s.name) +
    // Which weapon this actually is, when it is not simply named after the
    // Skill — "Ol Betsy" tells you more than "Handgun" does.
    (held && String(held.name || '').toLowerCase() !== String(s.name).toLowerCase()
      ? ' <span class="hud-act-of">' + esc(held.name) + '</span>' : '') +
    (held ? ' <span class="hud-held">in hand</span>' : '') +
    (s.untrained ? ' <span class="hud-untrained">untrained</span>' : '') +
    '</div>' +
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
  return h + '</div></div>';
}

// Every item the crawler is carrying, wherever it lives, flagged with whether
// it is actually worn or held. The gear block declares its own containers, so
// this does not need to know that they are called equipped/hotlist/inventory.
function dccGearItems(char) {
  const b = (typeof sysBlock === 'function') ? sysBlock('gear') : null;
  const d = (char && char.blocks && char.blocks.gear) || {};
  const out = [];
  ((b && b.containers) || []).forEach(function (c) {
    const held = d[c.id];
    if (!held) return;
    if (c.kind === 'slots') {
      Object.keys(held).forEach(function (sl) {
        (held[sl] || []).forEach(function (it) { if (it) out.push({ it: it, worn: true }); });
      });
    } else {
      (held || []).forEach(function (it) { if (it) out.push({ it: it, worn: false }); });
    }
  });
  return out;
}

// The picture on an attack card. The WEAPON's icon wins: an attack is the thing
// in your hand, and a crawler who has given their Handgun an icon should see the
// Handgun, not a generic Ranged Weapon glyph.
//
// Finding the weapon is the whole difficulty, and the first version got it
// wrong in four of five realistic cases. It only searched the Gear Slots and
// only matched item.skill — the "Works as" field — so a gun named "Handgun"
// with an icon and no "Works as" set showed nothing, and so did one kept in the
// Hotlist, which is where a crawler puts the thing they want to reach fastest.
//
// Matching the item's NAME against the Skill is what the pack already does
// elsewhere: gearItemTap resolves a Hotlist entry by name so that {name:'Heal'}
// rolls Heal. So: an explicit link beats a name, and something worn beats
// something stowed, but any of the four connects.
function dccAttackIcon(char, s) {
  const want = String(s.name || '').toLowerCase();
  if (!want) return s.icon || '';
  let best = '', bestRank = 99;
  dccGearItems(char).forEach(function (g) {
    const it = g.it;
    if (!it.icon) return;
    const asSkill = String(it.skill || '').toLowerCase();
    const lends = String(it.grantsSkill || '').toLowerCase();
    const named = String(it.name || '').toLowerCase();
    let rank = 99;
    if (asSkill === want || lends === want) rank = g.worn ? 0 : 2;
    else if (named === want) rank = g.worn ? 1 : 3;
    if (rank < bestRank) { bestRank = rank; best = it.icon; }
  });
  // Then the Skill's own icon — all a Spell or an unarmed attack has — and then
  // nothing, in which case the card renders as it did before icons existed.
  return best || s.icon || '';
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
  // Into every roller on this screen: the HUD has two (a sidebar and a
  // collapsible bar) and the CSS decides which one the player can see.
  sysRenderRollAll();
}

function dccHudSpend(n) {
  if (!n) return;
  poolAdj('mana', -Math.abs(n));
  renderHUD();
}

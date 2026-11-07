// systems/marvel-multiverse/roster.js — the official characters, in the app.
//
// MMR_PROFILES (profiles.js) ships with the pack, so every table has all of them with
// nothing to sync and nothing to pay for. They are read-only. "Add to table" copies one
// into the universe's roster, which is what syncs through Firebase; from there a Narrator
// can edit their own copy without touching the book's. "Play as Hero" copies one into a
// new save file. Both are plain copies: the book's row never changes under anybody.

const MMR_ABILITY_ORDER = [
  ['melee', 'Melee'], ['agility', 'Agility'], ['resilience', 'Resilience'],
  ['vigilance', 'Vigilance'], ['ego', 'Ego'], ['logic', 'Logic'],
];
const MMR_KIND_LABEL = { hero: 'Hero', villain: 'Villain', other: 'Other' };

function mmrProfile(id) { return MMR_PROFILES.filter(p => p.id === id)[0] || null; }

function mmrSigned(n) { return n > 0 ? '+' + n : String(n); }

function mmrSpeedText(p) {
  return Object.keys(p.speeds || {}).map(k => k[0].toUpperCase() + k.slice(1) + ' ' + p.speeds[k]).join(', ');
}
function mmrAbilityText(p) {
  return MMR_ABILITY_ORDER.map(([k, n]) => {
    const a = p.abilities[k];
    return n + ' ' + a.score + ' (Defense ' + a.def + ', Check ' + mmrSigned(a.check) + ')';
  }).join('; ');
}
function mmrDamageText(p) {
  return MMR_ABILITY_ORDER.filter(([k]) => p.damage[k]).map(([k, n]) => {
    const d = p.damage[k];
    return n + ' dMarvel × ' + d.mult + ' ' + (d.ability < 0 ? '− ' + (-d.ability) : '+ ' + d.ability);
  }).join('; ');
}
function mmrPowerGroups(p) {
  const out = [];
  (p.powers || []).forEach(x => {
    let g = out.filter(o => o.set === x.set)[0];
    if (!g) { g = { set: x.set, names: [] }; out.push(g); }
    g.names.push(x.name);
  });
  return out;
}
function mmrPowerText(p) {
  return mmrPowerGroups(p).map(g => g.set + ': ' + g.names.join(', ')).join('; ');
}

// ─── the copy a table keeps ──────────────────────────────────────────────────
// Flat strings and numbers, so it is editable in the shell's builder, readable on a
// roster card and safe to sync: Firebase refuses `undefined` outright, and one such value
// wedges every later save.
function mmrRosterRow(p) {
  return {
    type: p.kind, profile: p.id, name: p.name, rank: p.rank,
    health: p.health, healthDR: p.healthDR, focus: p.focus, focusDR: p.focusDR,
    karma: p.karma, init: mmrSigned(p.init) + (p.initEdge ? 'E' : ''),
    speed: mmrSpeedText(p), abilities: mmrAbilityText(p), damage: mmrDamageText(p),
    origin: p.origin, occupation: p.occupation, teams: p.teams, base: p.base,
    traits: p.traits.join(', '), tags: p.tags.join(', '), powers: mmrPowerText(p),
    history: p.history, personality: p.personality,
    notes: p.formNote || '',
  };
}

function mmrAddProfileToTable(id) {
  const p = mmrProfile(id);
  if (!p) return;
  const row = mmrRosterRow(p);
  ensureId(row);
  S.npcs.push(row);
  save();
  renderNPCs();
}

// ─── the copy a player keeps ─────────────────────────────────────────────────
function mmrCharFromProfile(p) {
  const abilities = {};
  MMR_ABILITY_ORDER.forEach(([k]) => { abilities[k] = p.abilities[k].score; });
  return { systemId: SYS.id, name: p.name, profile: p.id, blocks: { abilities } };
}

// The roster row a played hero mirrors to. Its own name and id come from the mirror.
function mmrHeroRow(ch) {
  const p = ch && ch.profile ? mmrProfile(ch.profile) : null;
  if (!p) return null;
  const row = mmrRosterRow(p);
  delete row.type; delete row.name;
  return row;
}

function mmrPlayProfile(id) {
  const p = mmrProfile(id);
  if (!p) return;
  // The sheet a new table opens on is blank. Fill that in rather than leave an empty
  // save and an unnamed roster row behind.
  const cur = S.char;
  if (cur && !sysCharName(cur) && !cur.profile) {
    const char = mmrCharFromProfile(p);
    if (cur.heroId) char.heroId = cur.heroId;
    S.char = char;
    save();
    renderAll();
    showTab('hero');
    return;
  }
  if (!confirm('Start a new ' + lex('hero') + ' as ' + p.name + '?\n\nYour current one stays in its own save file.')) return;
  const u = currentUniverse();
  const st = packNewState();
  if (u) st.universeId = u.id;
  st.char = mmrCharFromProfile(p);
  const sid = createSave(st);
  if (!sid) return;
  loadSave(sid);
  renderAll();
  showTab('hero');
}

// The stat block, the sheet and the printed page all live in sheet.js now: what the
// pack shows OF a character grew past what it does WITH one, and the two were sharing
// a file. This one keeps the book's rows, the copies a table makes of them, and the
// browser you pick one from.

let _mmrOfficialQuery = '', _mmrOfficialKind = '', _mmrOfficialOpen = {};

function mmrOfficialMatches() {
  const q = _mmrOfficialQuery.trim().toLowerCase();
  return MMR_PROFILES.filter(p => (!_mmrOfficialKind || p.kind === _mmrOfficialKind)
    && (!q || (p.name + ' ' + (p.realName || '') + ' ' + (p.teams || '')).toLowerCase().indexOf(q) >= 0));
}

function mmrOfficialCardsHTML() {
  const list = mmrOfficialMatches();
  if (!list.length) return `<div class="tac text-muted" style="grid-column:1/-1;padding:20px 10px;font-size:12px">Nobody by that name.</div>`;
  return list.map(p => {
    const open = !!_mmrOfficialOpen[p.id];
    const onTable = S.npcs.some(n => n.profile === p.id);
    let h = `<div class="npc-card ${open ? 'open' : ''}">`;
    h += `<div class="npc-card-head" onclick="mmrToggleOfficial('${esc(p.id)}')"><div class="npc-card-main">`;
    h += `<div class="npc-card-name">${esc(p.name)}</div><div class="npc-card-chips">`;
    h += `<span class="npc-chip">Rank ${esc(String(p.rank))}</span><span class="npc-chip">${esc(MMR_KIND_LABEL[p.kind] || '')}</span>`;
    if (onTable) h += `<span class="npc-chip hero">On your table</span>`;
    h += `</div></div><div class="npc-caret">▶</div></div>`;
    if (open) {
      // An open card spans the shelf (see #mmr-official-list in shell.css), so the
      // block inside it gets the same room as the hero sheet rather than a 250px
      // column with a paragraph of rules text squeezed down it.
      h += `<div class="npc-card-body">${mmrStatBlockHTML(p, { wide: true })}<div class="npc-card-acts">`;
      h += `<button class="btn btn-gold btn-xs" onclick="mmrAddProfileToTable('${esc(p.id)}')">${onTable ? 'Add another' : 'Add to table'}</button>`;
      h += `<button class="btn btn-secondary btn-xs" onclick="mmrPlayProfile('${esc(p.id)}')">Play as ${esc(lex('hero'))}</button>`;
      h += `</div></div>`;
    }
    return h + `</div>`;
  }).join('');
}

// The list repaints on its own, so typing in the search box keeps the caret.
function mmrRepaintOfficial() {
  const el = document.getElementById('mmr-official-list');
  if (el) el.innerHTML = mmrOfficialCardsHTML();
}
function mmrFilterOfficial(q) { _mmrOfficialQuery = q; mmrRepaintOfficial(); }
function mmrKindOfficial(k) { _mmrOfficialKind = k; mmrRepaintOfficial(); }
function mmrToggleOfficial(id) { _mmrOfficialOpen[id] = !_mmrOfficialOpen[id]; mmrRepaintOfficial(); }

function mmrOfficialPanelHTML() {
  const opt = (v, t) => `<option value="${v}"${_mmrOfficialKind === v ? ' selected' : ''}>${t}</option>`;
  mmrApplyRulesPref();
  let h = `<div style="font-size:11px;color:var(--muted);margin:-6px 0 8px">Every profile in the Core Rulebook. `
    + `Add one to your table to run or edit your own copy, or play one as your ${esc(lex('hero'))}.</div>`;
  h += `<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">`;
  h += `<input style="flex:1 1 180px;min-width:140px" placeholder="Search ${MMR_PROFILES.length} characters" value="${esc(_mmrOfficialQuery)}" oninput="mmrFilterOfficial(this.value)">`;
  // width:auto and no grow: a <select> inherits width:100% from the shell's form
  // styles, so left to itself it took a whole row and pushed the filters into a stack
  // of full-width bars.
  h += `<select style="flex:0 0 auto;width:auto" onchange="mmrKindOfficial(this.value)">${opt('', 'Everyone')}${opt('hero', 'Heroes')}${opt('villain', 'Villains')}${opt('other', 'Others')}</select>`;
  h += mmrRulesBtnHTML() + `</div>`;
  h += `<div class="npc-grid" id="mmr-official-list">${mmrOfficialCardsHTML()}</div>`;
  return h;
}

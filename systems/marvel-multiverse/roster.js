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

// What the sheet shows of a pregen until the sheet's own blocks arrive (PLAN §10, M3).
function mmrSheetExtra(ch) {
  const p = ch && ch.profile ? mmrProfile(ch.profile) : null;
  if (p) return '<div class="card">' + mmrStatBlockHTML(p) + '</div>';
  if (ch && sysCharName(ch)) return '';
  return `<div class="card tac" style="padding:20px">`
    + `<div class="fw-700 mb-1">No ${esc(lex('hero'))} yet</div>`
    + `<div class="text-muted mb-3" style="font-size:13px">Pick one of the ${MMR_PROFILES.length} official characters to play. Building your own comes with the full sheet.</div>`
    + `<button class="btn btn-primary" onclick="showTab('npcs')">Browse the official characters</button></div>`;
}

// ─── drawing one ─────────────────────────────────────────────────────────────
function mmrStatBlockHTML(p) {
  const fact = (k, v) => (v === null || v === undefined || v === '') ? ''
    : `<div class="npc-derived"><span>${esc(k)}</span><strong style="font-size:13px;color:var(--text)">${esc(String(v))}</strong></div>`;
  const head = t => `<div class="label mb-1" style="margin-top:10px">${esc(t)}</div>`;
  const prose = t => `<div style="font-size:12px;line-height:1.5">${esc(t)}</div>`;
  const dr = n => (n ? ' (DR ' + n + ')' : '');
  let h = `<div class="label mb-1">Rank ${esc(String(p.rank))} · ${esc(MMR_KIND_LABEL[p.kind] || '')} · Book p. ${esc(String(p.page))}</div>`;
  h += fact('Health', p.health + dr(p.healthDR));
  h += fact('Focus', p.focus + dr(p.focusDR));
  h += fact('Karma', p.karma);
  h += fact('Initiative', mmrSigned(p.init) + (p.initEdge ? ' with an edge' : ''));
  h += fact('Speed', mmrSpeedText(p));

  // One row per ability, so the six can be compared at a glance on a phone.
  const th = (t, al) => `<th style="font-weight:600;color:var(--muted);text-align:${al};padding:3px 4px">${t}</th>`;
  const td = (t, al, st) => `<td style="text-align:${al};padding:4px;border-top:1px solid var(--border);${st || ''}">${esc(String(t))}</td>`;
  h += head('Abilities');
  h += `<table style="width:100%;border-collapse:collapse;font-size:13px"><tr>${th('', 'left')}${th('Score', 'right')}${th('Def', 'right')}${th('Check', 'right')}${th('Damage', 'right')}</tr>`;
  MMR_ABILITY_ORDER.forEach(([k, n]) => {
    const a = p.abilities[k], d = p.damage[k];
    h += '<tr>' + td(n, 'left') + td(a.score, 'right', 'font-weight:700') + td(a.def, 'right') + td(mmrSigned(a.check), 'right')
      + td(d ? '×' + d.mult + ' ' + mmrSigned(d.ability) : '', 'right') + '</tr>';
  });
  h += '</table>';

  if (p.formNote) h += head('Note') + prose(p.formNote);
  h += head('Background');
  h += fact('Real name', p.realName) + fact('Origin', p.origin) + fact('Occupation', p.occupation)
    + fact('Size', p.size) + fact('Teams', p.teams) + fact('Base', p.base);
  if (p.traits.length) h += head('Traits') + prose(p.traits.join(', '));
  if (p.tags.length) h += head('Tags') + prose(p.tags.join(', '));
  if (p.powers.length) {
    h += head('Powers');
    mmrPowerGroups(p).forEach(g => {
      h += `<div style="font-size:12px;line-height:1.5;margin-bottom:6px"><strong>${esc(g.set)}:</strong> ${esc(g.names.join(', '))}</div>`;
    });
  }
  const story = t => `<div style="font-size:13px;line-height:1.55;white-space:pre-wrap">${esc(t)}</div>`;
  if (p.history) h += head('History') + story(p.history);
  if (p.personality) h += head('Personality') + story(p.personality);
  return h;
}

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
      h += `<div class="npc-card-body">${mmrStatBlockHTML(p)}<div class="npc-card-acts">`;
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
  let h = `<div style="font-size:11px;color:var(--muted);margin:-6px 0 8px">Every profile in the Core Rulebook. `
    + `Add one to your table to run or edit your own copy, or play one as your ${esc(lex('hero'))}.</div>`;
  h += `<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">`;
  h += `<input style="flex:1;min-width:160px" placeholder="Search ${MMR_PROFILES.length} characters" value="${esc(_mmrOfficialQuery)}" oninput="mmrFilterOfficial(this.value)">`;
  h += `<select onchange="mmrKindOfficial(this.value)">${opt('', 'Everyone')}${opt('hero', 'Heroes')}${opt('villain', 'Villains')}${opt('other', 'Others')}</select></div>`;
  h += `<div class="npc-grid" id="mmr-official-list">${mmrOfficialCardsHTML()}</div>`;
  return h;
}

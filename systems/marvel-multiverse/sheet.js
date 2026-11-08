// systems/marvel-multiverse/sheet.js — the character, read rather than looked up.
//
// The pack's first sheet listed power names and nothing else, which is as much as the
// official sheets give you: you read "Spider-Sense", and then you go and find the book.
// powers.js and traits.js carry what each one DOES, and everything here is about
// getting that text in front of a reader:
//
//   - a power is a card: its name, the chips that matter in play (action, duration,
//     cost, range), and then the rule.
//   - the cards sit in COLUMNS whose width is a measure, not a page width. A rule set
//     across 1,100px of desktop is a row you read by dragging a finger along the
//     monitor. Columns rather than a grid, too: a grid lines the cards up in rows, so
//     one long power leaves a hole beside every short one next to it.
//   - traits and tags are the same idea at a smaller size, because a tag is a line and
//     a power is a paragraph.
//
// The same renderer draws three of them — the hero sheet, an open card in the Official
// tab, and a copy on the table — so no piece may assume the room it is given.
//
// Two of those three are read-only: the book's row never changes under anybody (own.js
// freezes it) and a table's copy is a synced roster row the shell's own builder edits.
// The hero sheet is the one that is YOURS, and `opts.edit` is what turns its numbers
// into fields. What it reads is never ch.sheet directly — always mmrEffective(ch), so
// the armor you have on is the character you see.

// ─── finding the rule for a printed name ─────────────────────────────────────
// Chapter 8 prints a power with its own particulars attached — "Animal Communication
// (Bugs)", "Elemental Protection 3 (30 points to shatter)", "Iconic Weapon: Mjolnir
// [+1 Melee and Agility damage multiplier...]" — so the name on a profile is a rule
// name plus a note, and a bare index lookup finds nothing. Peel the note off, keep it,
// and show both.
function mmrRuleFor(table, raw) {
  const name = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!name) return null;
  const tries = [];
  const push = (key, note) => {
    const k = String(key || '').trim().replace(/[([]+$/, '').trim();
    if (k) tries.push({ key: k, note: String(note || '').trim() });
  };
  push(name, '');
  // Trailing bracket groups, outermost last, so "Surprising Power (2) (Grand Illusion,
  // Mirror Images)" loses both and keeps both.
  let n = name, notes = [];
  for (let i = 0; i < 4; i++) {
    const m = /^(.*?)\s*[([]\s*([^()[\]]*?)\s*[)\]]?\s*$/.exec(n);
    if (!m || !m[1] || m[1] === n) break;
    n = m[1].trim();
    if (m[2]) notes.unshift(m[2]);
    push(n, notes.join('; '));
  }
  // Then a colon off whatever is left of each candidate: "Connections: Military" is the
  // trait Connections, and the book has no entry under the longer name.
  tries.slice().forEach(t => {
    const i = t.key.indexOf(':');
    if (i > 0) push(t.key.slice(0, i), [t.key.slice(i + 1).trim(), t.note].filter(Boolean).join(' — '));
  });
  // A numbered power the book prints unnumbered (it prints "Mighty"; the current rules
  // call it Mighty 1).
  push(name.replace(/\s*\d+$/, ''), '');
  for (let i = 0; i < tries.length; i++) {
    const t = tries[i];
    if (table && table[t.key]) return { name: t.key, note: t.note, rule: table[t.key] };
  }
  // Nothing printed under that name. Doctor Strange's Prescription Pad is the one such
  // tag in the book, and the honest thing is the name with no rule under it.
  return { name: name, note: '', rule: null };
}
function mmrPowerRule(name) { return mmrRuleFor(MMR_POWER_RULES, name); }
function mmrTraitRule(name) { return mmrRuleFor(MMR_TRAIT_RULES, name); }
function mmrTagRule(name) { return mmrRuleFor(MMR_TAG_RULES, name); }

// The set as Chapter 8 prints it above the power list, which the OCR read in its own
// spellings: MARTIALARTS, SUPER-STRENGTHS, "MAGIC (SORCERY SET)".
function mmrSetLabel(raw) {
  let s = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!s) return 'Powers';
  if (typeof MMR_SET_FIX !== 'undefined' && MMR_SET_FIX[s]) s = MMR_SET_FIX[s];
  return s.replace(/\s*Sets?\)$/i, ')');
}

// ─── whether the rules text is on show ───────────────────────────────────────
// A class on <html>, not a re-render: the same page draws the hero sheet and the 128
// official cards, and the switch has to reach both without either losing its place.
// The button's label comes from CSS for the same reason.
function mmrRulesKey() { return (typeof storeKey === 'function') ? storeKey('mmr_rules') : 'mmr_rules'; }
function mmrRulesShown() {
  try { return localStorage.getItem(mmrRulesKey()) !== 'off'; } catch (e) { return true; }
}
function mmrApplyRulesPref() {
  document.documentElement.classList.toggle('mmr-no-rules', !mmrRulesShown());
}
function mmrToggleRules() {
  const next = mmrRulesShown() ? 'off' : 'on';
  try { localStorage.setItem(mmrRulesKey(), next); } catch (e) { /* a private window still gets the toggle */ }
  mmrApplyRulesPref();
}
function mmrRulesBtnHTML() {
  return '<button class="btn btn-secondary btn-xs mmr-rules-btn" onclick="mmrToggleRules()"'
    + ' title="Show or hide the rules text under every power, trait and tag"></button>';
}

// ─── editing: fields that do not repaint themselves ─────────────────────────
// Every one of these writes and saves and draws nothing. A handler that re-rendered its
// own input would take the caret out of the box mid-word, which is what the shell's
// `focus` suite exists to catch. Only a STRUCTURAL change — a power added, a loadout
// switched — repaints, and those are buttons, not keystrokes.
//
// A name goes into a handler through data-n and `this.dataset.n`, never inlined into the
// JS string: esc() leaves the apostrophe alone, and "Devil's Luck" would end the
// argument early.
function mmrIn(field, value, num, title) {
  return `<input class="mmr-in"${num ? ' type="number"' : ''}`
    + ` value="${esc(String(value === undefined || value === null ? '' : value))}"`
    + (title ? ` title="${esc(title)}"` : '')
    + ` oninput="mmrOwnSet('${field}',this.value)">`;
}
function mmrField(label, field, value, num, title) {
  return `<div class="mmr-f"><label>${esc(label)}</label>${mmrIn(field, value, num, title)}</div>`;
}
function mmrRmBtn(kind, name) {
  return `<button class="btn btn-secondary btn-xs mmr-rm" data-n="${esc(name)}"`
    + ` onclick="mmrOwnRemove('${kind}',this.dataset.n)" title="Remove ${esc(name)}">✕</button>`;
}
// One datalist per catalogue, so adding is a search of the book rather than typing a
// name from memory — but still a free text box, because a name the book does not have
// is allowed and simply shows no rule under it.
function mmrDataList(id, names) {
  return `<datalist id="${id}">` + names.map(n => `<option value="${esc(n)}"></option>`).join('') + '</datalist>';
}
function mmrAddRowHTML(kind, listId, what) {
  return `<div class="mmr-add"><input id="mmr-add-${kind}" list="${listId}" placeholder="Add a ${esc(what)}…"`
    + ` onkeydown="if(event.key==='Enter'){event.preventDefault();mmrAddFrom('${kind}')}">`
    + `<button class="btn btn-gold btn-xs" onclick="mmrAddFrom('${kind}')">Add</button></div>`;
}
function mmrAddFrom(kind) {
  const el = document.getElementById('mmr-add-' + kind);
  if (!el || !el.value.trim()) return;
  mmrOwnAdd(kind, el.value.trim());   // repaints, so the box goes with it
}

// ─── the pieces ──────────────────────────────────────────────────────────────
function mmrChip(label, value) {
  if (value === null || value === undefined || value === '') return '';
  return `<span class="mmr-chip"><span class="mmr-chip-k">${esc(label)}</span>${esc(String(value))}</span>`;
}
function mmrPage(n) { return n ? `<span class="mmr-page">p.&nbsp;${esc(String(n))}</span>` : ''; }

// One tile per number you read every round. A grid of tiles rather than a column of
// rows: four short facts do not need four full-width lines.
function mmrVitalsHTML(p, ed) {
  if (ed) {
    let h = '<div class="mmr-fgrid">';
    h += mmrField('Rank', 'rank', p.rank, true);
    h += mmrField('Health', 'health', p.health, true);
    h += mmrField('Health DR', 'healthDR', p.healthDR, true);
    h += mmrField('Focus', 'focus', p.focus, true);
    h += mmrField('Focus DR', 'focusDR', p.focusDR, true);
    h += mmrField('Karma', 'karma', p.karma, true);
    h += mmrField('Initiative', 'init', p.init, true);
    h += `<div class="mmr-f"><label>Edge</label><label class="mmr-chk">`
      + `<input type="checkbox"${p.initEdge ? ' checked' : ''} onchange="mmrOwnSetBool('initEdge',this.checked)">`
      + ` on initiative</label></div>`;
    h += '</div>';
    // Speeds as the line the sheet already prints, parsed back — which is what makes a
    // speed addable and removable without a screen of its own.
    h += `<div class="mmr-f"><label>Speed</label><input class="mmr-in" value="${esc(mmrSpeedText(p))}"`
      + ` title="Name and number, comma separated: Run 6, Climb 3, Jump 30"`
      + ` oninput="mmrOwnSpeedsSet(this.value)"></div>`;
    return h;
  }
  const dr = n => (n ? `<span class="mmr-tile-s">DR ${esc(String(n))}</span>` : '');
  const tile = (k, v, sub) => `<div class="mmr-tile"><div class="mmr-tile-k">${esc(k)}</div>`
    + `<div class="mmr-tile-v">${esc(String(v))}</div>${sub || ''}</div>`;
  let h = '<div class="mmr-tiles">';
  h += tile('Health', p.health, dr(p.healthDR));
  h += tile('Focus', p.focus, dr(p.focusDR));
  h += tile('Karma', p.karma);
  h += tile('Initiative', mmrSigned(p.init), p.initEdge ? '<span class="mmr-tile-s">with an edge</span>' : '');
  h += '</div>';
  const sp = mmrSpeedText(p);
  if (sp) h += `<div class="mmr-kv"><span class="mmr-kv-k">Speed</span>${esc(sp)}</div>`;
  return h;
}

// Score, defense, check and damage for each of the six, in M.A.R.V.E.L. order. Capped:
// a four-column table of two-digit numbers has no use for 1,100px.
// A modifier, which is signed even when it is nothing: the table reads down a column,
// and a bare "0" beside "+6" looks like a different kind of number. mmrSigned stays as
// it is — it writes the roster rows a table syncs, and those are the book's own strings.
function mmrMod(n) { return (n >= 0 ? '+' : '') + n; }

function mmrAbilitiesHTML(p, ed) {
  const num = (v, fn, a, k) => `<input class="mmr-in mmr-in-n" type="number" value="${esc(String(v === undefined || v === null ? '' : v))}"`
    + ` oninput="${fn}('${a}','${k}',this.value)">`;
  let h = `<table class="mmr-abil${ed ? ' is-edit' : ''}"><thead><tr><th></th><th>Score</th><th>Def</th><th>Check</th><th>Damage</th></tr></thead><tbody>`;
  MMR_ABILITY_ORDER.forEach(([k, n]) => {
    const a = (p.abilities || {})[k] || {}, d = (p.damage || {})[k];
    if (ed) {
      // Score, Defense and Check are three independent trained numbers (§2): nothing
      // here derives anything, so all three are typeable and none of them argues.
      h += `<tr><th scope="row">${esc(n)}</th>`
        + `<td>${num(a.score, 'mmrOwnAbilitySet', k, 'score')}</td>`
        + `<td>${num(a.def, 'mmrOwnAbilitySet', k, 'def')}</td>`
        + `<td>${num(a.check, 'mmrOwnAbilitySet', k, 'check')}</td>`
        + `<td class="mmr-dmg-c">${num(d ? d.mult : '', 'mmrOwnDamageSet', k, 'mult')}`
        + `${num(d ? d.ability : '', 'mmrOwnDamageSet', k, 'ability')}</td></tr>`;
      return;
    }
    h += `<tr><th scope="row">${esc(n)}</th><td class="mmr-abil-s">${esc(String(a.score))}</td>`
      + `<td>${esc(String(a.def))}</td><td>${esc(mmrMod(a.check))}</td>`
      + `<td>${d ? esc('×' + d.mult + ' ' + mmrMod(d.ability)) : ''}</td></tr>`;
  });
  return h + '</tbody></table>'
    + (ed ? '<div class="mmr-hint">Damage is the multiplier and then the flat bonus.</div>' : '');
}

// A power: name, the chips that decide whether you can use it this turn, then the rule.
function mmrPowerCardHTML(printedName, ed) {
  const r = mmrPowerRule(printedName);
  if (!r) return '';          // an empty name in a hand-typed list
  const u = r.rule || {};
  let h = '<div class="mmr-pow">';
  h += `<div class="mmr-pow-h"><span class="mmr-pow-n">${esc(r.name)}</span>${mmrPage(u.page)}`
    // The printed name, not the resolved one: removing is removing the row on the
    // sheet, which may carry its own particulars — "Elemental Protection 3 (30 points)".
    + (ed ? mmrRmBtn('powers', printedName) : '') + '</div>';
  if (r.note) h += `<div class="mmr-pow-note">${esc(r.note)}</div>`;
  const chips = mmrChip('', u.action) + mmrChip('', u.duration)
    + mmrChip('Cost', u.cost) + mmrChip('Range', u.range) + mmrChip('Rank', u.rank);
  if (chips) h += `<div class="mmr-chips">${chips}</div>`;
  if (u.effect) h += `<div class="mmr-eff">${esc(u.effect)}</div>`;
  else h += `<div class="mmr-eff mmr-eff-none">No rules text for this one — it is named on the profile but not described in the Core Rulebook.</div>`;
  if (u.trigger) h += `<div class="mmr-eff mmr-sub"><span class="mmr-kv-k">Trigger</span>${esc(u.trigger)}</div>`;
  if (u.prereqs && u.prereqs.length) h += `<div class="mmr-eff mmr-sub"><span class="mmr-kv-k">Needs</span>${esc(u.prereqs.join(', '))}</div>`;
  return h + '</div>';
}

function mmrPowersHTML(p, ed) {
  const groups = mmrPowerGroups(p);
  if (!groups.length && !ed) return '';
  let h = '';
  groups.forEach(g => {
    h += `<div class="mmr-set"><div class="mmr-set-h"><span class="mmr-set-n">${esc(mmrSetLabel(g.set))}</span>`
      + `<span class="mmr-set-c">${g.names.length}</span></div><div class="mmr-pow-grid">`;
    g.names.forEach(n => { h += mmrPowerCardHTML(n, ed); });
    h += '</div></div>';
  });
  if (ed) h += mmrAddRowHTML('powers', 'mmr-dl-powers', 'power');
  return h;
}

// Traits and tags: a name, the character's own particulars if the book prints any, and
// the rule. Denser than a power card because most of them are two sentences.
function mmrLabelListHTML(names, lookup, ed, kind) {
  let h = '<div class="mmr-defs">';
  (names || []).forEach(raw => {
    const r = lookup(raw);
    if (!r) return;
    const u = r.rule || {};
    h += '<div class="mmr-def">';
    h += `<div class="mmr-def-h"><span class="mmr-def-n">${esc(r.name)}</span>${mmrPage(u.page)}`
      + (ed && kind ? mmrRmBtn(kind, raw) : '') + '</div>';
    if (r.note) h += `<div class="mmr-pow-note">${esc(r.note)}</div>`;
    if (u.effect) h += `<div class="mmr-eff">${esc(u.effect)}</div>`;
    else if (ed) h += `<div class="mmr-eff mmr-eff-none">Not a name the Core Rulebook describes, so there is no rule to show.</div>`;
    h += '</div>';
  });
  h += '</div>';
  if (ed && kind) h += mmrAddRowHTML(kind, 'mmr-dl-' + kind, kind === 'traits' ? 'trait' : 'tag');
  return h;
}

function mmrBackgroundHTML(p, ed) {
  if (ed) {
    return '<div class="mmr-fgrid is-wide">'
      + mmrField('Real name', 'realName', p.realName)
      + mmrField('Origin', 'origin', p.origin)
      + mmrField('Occupation', 'occupation', p.occupation)
      + mmrField('Size', 'size', p.size)
      + mmrField('Teams', 'teams', p.teams)
      + mmrField('Base', 'base', p.base)
      + '</div>';
  }
  const kv = (k, v) => (v === null || v === undefined || v === '') ? ''
    : `<div class="mmr-kv"><span class="mmr-kv-k">${esc(k)}</span>${esc(String(v))}</div>`;
  return kv('Real name', p.realName) + kv('Origin', p.origin) + kv('Occupation', p.occupation)
    + kv('Size', p.size) + kv('Teams', p.teams) + kv('Base', p.base);
}

// ─── the loadout switcher: Tony's armors ─────────────────────────────────────
// The switcher lives in the head row, beside Rank and the book page, because it is the
// one control you reach for mid-fight. "Base" is the sheet with no overlay on it.
function mmrLoadoutBarHTML(ch) {
  const list = mmrLoadouts(ch);
  const active = ch.activeLoadout || 'base';
  if (!list.length) {
    return `<div class="mmr-lo-bar"><button class="btn btn-secondary btn-xs" onclick="mmrLoadoutNew()"`
      + ` title="A second set of powers and numbers for the same character — a battle suit, a transformation, a form">`
      + `+ Loadout</button><span class="mmr-hint">More than one armor, or a transformed state.</span></div>`;
  }
  let h = '<div class="mmr-lo-bar"><span class="mmr-kv-k">Loadout</span><div class="mmr-lo-tabs">';
  const tab = (id, name) => `<button class="btn btn-xs ${active === id ? 'btn-gold' : 'btn-secondary'}"`
    + ` data-n="${esc(id)}" onclick="mmrLoadoutActivate(this.dataset.n)">${esc(name)}</button>`;
  h += tab('base', 'Base');
  list.forEach(l => { h += tab(l.id, l.name || 'Unnamed'); });
  h += '</div>';
  h += `<button class="btn btn-secondary btn-xs" onclick="mmrLoadoutNew()" title="Add another loadout">+</button>`;
  return h + '</div>';
}

// What each one changes, which is the screen the overlay exists for.
function mmrLoadoutsCardHTML(ch) {
  const list = mmrLoadouts(ch);
  if (!list.length) return '';
  const active = ch.activeLoadout || 'base';
  const show = v => (v === true ? 'yes' : v === false ? 'no' : (v === '' || v === null || v === undefined) ? '—' : String(v));
  let h = '';
  list.forEach(l => {
    const d = mmrLoadoutDelta(ch, l);
    h += `<div class="mmr-lo${active === l.id ? ' is-on' : ''}">`;
    h += `<div class="mmr-lo-h"><span class="mmr-lo-n">${esc(l.name || 'Unnamed')}</span>`
      + (active === l.id ? '<span class="mmr-chip">on</span>' : '')
      + `<span class="mmr-lo-acts">`
      + (active === l.id
        ? `<button class="btn btn-secondary btn-xs" onclick="mmrLoadoutActivate('base')">Take off</button>`
        : `<button class="btn btn-gold btn-xs" data-n="${esc(l.id)}" onclick="mmrLoadoutActivate(this.dataset.n)">Wear</button>`)
      + `<button class="btn btn-secondary btn-xs" data-n="${esc(l.id)}" onclick="mmrLoadoutRename(this.dataset.n)">Rename</button>`
      + `<button class="btn btn-secondary btn-xs" data-n="${esc(l.id)}" onclick="mmrLoadoutDuplicate(this.dataset.n)">Duplicate</button>`
      + `<button class="btn btn-secondary btn-xs" data-n="${esc(l.id)}" onclick="mmrLoadoutDelete(this.dataset.n)">Delete</button>`
      + `</span></div>`;
    h += `<input class="mmr-in" value="${esc(l.note || '')}" placeholder="A note — where it came from, when you wear it"`
      + ` data-n="${esc(l.id)}" oninput="mmrLoadoutNote(this.dataset.n,this.value)">`;
    if (!d.length) h += `<div class="mmr-hint">Changes nothing yet. Wear it, then edit — everything you change while it is on belongs to it.</div>`;
    else {
      h += '<ul class="mmr-delta">';
      d.forEach(x => {
        if (x.how === 'add') h += `<li class="is-add">+ ${esc(x.what)} <b>${esc(x.text)}</b></li>`;
        else if (x.how === 'remove') h += `<li class="is-rm">− ${esc(x.what)} <b>${esc(x.text)}</b></li>`;
        else h += `<li class="is-set">${esc(x.what)} <span class="mmr-was">${esc(show(x.from))}</span> → <b>${esc(show(x.to))}</b></li>`;
      });
      h += '</ul>';
    }
    h += '</div>';
  });
  return h;
}

// ─── the book changing under a copy ──────────────────────────────────────────
function mmrDriftHTML(ch) {
  const drift = mmrProfileDrift(ch);
  if (!drift.length) return '';
  let h = `<section class="card mmr-card mmr-wide mmr-drift"><div class="label mmr-card-t">The book's row has changed</div>`;
  h += `<div class="mmr-hint">This ${esc(lex('hero'))} was copied from the Core Rulebook, and the pack's data for `
    + `${esc(drift.length === 1 ? 'one field' : drift.length + ' fields')} has been corrected since. Yours is untouched — take across only what you want.</div>`;
  h += '<div class="mmr-add">';
  drift.forEach(f => {
    h += `<button class="btn btn-secondary btn-xs" data-n="${esc(f.field)}" onclick="mmrTakeBookField(this.dataset.n)">`
      + `Take the book's ${esc(f.label)}</button>`;
  });
  h += `<button class="btn btn-secondary btn-xs" onclick="mmrDismissDrift()" title="Keep yours and stop asking">Keep mine</button>`;
  return h + '</div></section>';
}

// ─── the legality report ─────────────────────────────────────────────────────
// Held in a variable rather than recomputed on every paint, so pressing the button is
// what runs it and the sheet does not quietly audit you while you read it.
let _mmrReport = null;
function mmrRunReport() {
  const ch = S && S.char;
  _mmrReport = mmrLegalityReport(mmrEffective(ch)) || [];
  renderHero();
}
function mmrClearReport() { _mmrReport = null; renderHero(); }
function mmrReportHTML() {
  if (!_mmrReport) return '';
  let h = `<section class="card mmr-card mmr-wide mmr-report"><div class="label mmr-card-t">Against the rules`
    + `<button class="btn btn-secondary btn-xs" onclick="mmrClearReport()">Close</button></div>`;
  if (!_mmrReport.length) h += `<div class="mmr-hint">Nothing to flag: the vitals follow the formulas, every name is in the book, and every prerequisite is met.</div>`;
  else {
    h += '<ul class="mmr-delta">';
    _mmrReport.forEach(r => { h += `<li><b>${esc(r.what)}</b> ${esc(r.text)}</li>`; });
    h += '</ul>';
  }
  h += `<div class="mmr-hint">Nothing here is enforced, and the book's own characters trip it: Iron Man prints 75 Health `
    + `on Resilience 3. Defense and non-combat Checks are not checked at all, because size and powers move them `
    + `legitimately. The pick budget arrives with the creation wizard.</div>`;
  return h + '</section>';
}

// ─── the whole block ─────────────────────────────────────────────────────────
// `wide` is the hero sheet, which has the page to itself; the Official tab draws the
// same block inside a 250px card and passes nothing. `ch` means this is somebody's own
// character — loadouts, drift and the report hang off it — and `edit` turns the numbers
// into fields.
function mmrStatBlockHTML(p, opts) {
  opts = opts || {};
  const ed = !!opts.edit;
  const ch = opts.ch || null;
  const card = (cls, title, body, extra) => body
    ? `<section class="card mmr-card ${cls || ''}"><div class="label mmr-card-t">${esc(title)}${extra || ''}</div>${body}</section>`
    : '';
  let h = opts.wide ? '<div class="mmr-sheet">' : '<div class="mmr-sheet is-narrow">';
  h += `<div class="mmr-head mmr-wide"><div class="mmr-head-m">`
    + `<span class="mmr-rank">Rank ${esc(String(p.rank))}</span>`
    + `<span class="mmr-kind">${esc(MMR_KIND_LABEL[p.kind] || '')}</span>`
    + (ch && mmrLoadoutName(ch) ? `<span class="mmr-lo-now">${esc(mmrLoadoutName(ch))}</span>` : '')
    + (p.page ? `<span class="mmr-page">Book p.&nbsp;${esc(String(p.page))}</span>` : '')
    + '</div>'
    // The Official tab keeps one switch above the whole shelf, so a card inside it must
    // not add a second one of its own.
    + (opts.toggle ? mmrRulesBtnHTML() : '')
    + (ch ? `<button class="btn btn-secondary btn-xs" onclick="mmrRunReport()" title="What a strict reading of the creation rules would say about this sheet">Check the rules</button>` : '')
    + '</div>';
  if (ch) h += `<div class="mmr-wide">${mmrLoadoutBarHTML(ch)}</div>`;
  // Which of the two an edit lands on. Guessing wrong here is how somebody edits Tony
  // and finds they have edited the suit, so the sheet says it outright.
  if (ed && ch) {
    const lo = mmrLoadoutName(ch);
    h += `<div class="mmr-wide mmr-edit-note">${lo
      ? 'Editing <b>' + esc(lo) + '</b> — what you change here belongs to this loadout, and the base sheet keeps its own values.'
      : 'Editing the base sheet — what you change here is true of this ' + esc(lex('hero')) + ' in every loadout.'}</div>`;
  }
  h += card('is-vitals', 'Vitals', mmrVitalsHTML(p, ed));
  h += card('is-abil' + (ed ? ' is-edit' : ''), 'Abilities', mmrAbilitiesHTML(p, ed));
  h += card('is-bg' + (ed ? ' is-edit' : ''), 'Background', mmrBackgroundHTML(p, ed));
  if (p.formNote || ed) h += card('mmr-wide', 'Note', ed
    ? `<textarea class="mmr-in" rows="2" oninput="mmrOwnSet('formNote',this.value)" placeholder="A rules note — an alternate form, a condition">${esc(p.formNote || '')}</textarea>`
    : `<div class="mmr-eff mmr-eff-on">${esc(p.formNote)}</div>`);
  const powers = mmrPowersHTML(p, ed);
  if (powers) h += card('mmr-wide is-powers', 'Powers', powers);
  if ((p.traits && p.traits.length) || ed) h += card('mmr-wide', 'Traits', mmrLabelListHTML(p.traits, mmrTraitRule, ed, 'traits'));
  if ((p.tags && p.tags.length) || ed) h += card('mmr-wide', 'Tags', mmrLabelListHTML(p.tags, mmrTagRule, ed, 'tags'));
  if (ch) h += card('mmr-wide mmr-los', 'Loadouts', mmrLoadoutsCardHTML(ch));
  const story = (field, t) => ed
    ? `<textarea class="mmr-in" rows="6" oninput="mmrOwnSet('${field}',this.value)">${esc(t || '')}</textarea>`
    : `<div class="mmr-prose">${esc(t)}</div>`;
  if (p.history || ed) h += card('mmr-wide', 'History', story('history', p.history));
  if (p.personality || ed) h += card('mmr-wide', 'Personality', story('personality', p.personality));
  if (ch) h += mmrDriftHTML(ch) + mmrReportHTML();
  if (ed) {
    h += mmrDataList('mmr-dl-powers', Object.keys(MMR_POWER_RULES));
    h += mmrDataList('mmr-dl-traits', Object.keys(MMR_TRAIT_RULES));
    h += mmrDataList('mmr-dl-tags', Object.keys(MMR_TAG_RULES));
  }
  return h + '</div>';
}

// What the sheet shows of a character a save OWNS — which, for one copied from the
// book, is their own data now and not the book's row (own.js). A hand-built one gets
// the blocks in SYS.schema and, at M4, the wizard; until then it is pointed at the
// characters that do work.
function mmrSheetExtra(ch) {
  mmrApplyRulesPref();
  // The migration runs on the way past. It does not save itself — it is also called
  // from the roster mirror, which runs inside save() — so this is where it gets
  // written down.
  const fresh = (ch && !ch.sheet && ch.profile) ? mmrMigrateChar(ch) : false;
  const eff = mmrEffective(ch);
  if (eff) {
    if (fresh && typeof save === 'function') save();
    return mmrStatBlockHTML(eff, {
      wide: true, toggle: true, ch: ch,
      edit: (typeof sysEditing === 'function') ? sysEditing() : false,
    });
  }
  if (ch && sysCharName(ch)) return '';
  return `<div class="card tac" style="padding:20px">`
    + `<div class="fw-700 mb-1">No ${esc(lex('hero'))} yet</div>`
    + `<div class="text-muted mb-3" style="font-size:13px">Pick one of the ${MMR_PROFILES.length} official characters to play. Once they are yours, everything on the sheet is yours to change.</div>`
    + `<button class="btn btn-primary" onclick="showTab('npcs')">Browse the official characters</button></div>`;
}

// ─── the copy a table keeps ──────────────────────────────────────────────────
// A roster row is flat text, because that is what syncs: "Spider-Powers: Spider-Sense,
// Webcasting; Basic: Mighty 1". A Narrator reading that mid-fight is back where they
// started — names, and then go and find the book. So the names on the row get their
// rules underneath, and they are the row's OWN names: if the Narrator edited their
// copy, their list is what is looked up, and anything the book has no entry for simply
// shows no rule rather than the book's idea of what they meant.
function mmrSplitList(text) {
  return String(text === undefined || text === null ? '' : text)
    .split(',').map(s => s.trim()).filter(Boolean);
}
function mmrRowPowerGroups(n) {
  // An untouched copy still matches the profile it came from, and the profile has the
  // powers as data — which is the only way to be sure of a name that contains a comma.
  const p = n && n.profile ? mmrProfile(n.profile) : null;
  if (p && n.powers === mmrPowerText(p)) return mmrPowerGroups(p);
  return String(n && n.powers ? n.powers : '').split(';').map(chunk => {
    const i = chunk.indexOf(':');
    const set = i > 0 ? chunk.slice(0, i).trim() : '';
    return { set: set, names: mmrSplitList(i > 0 ? chunk.slice(i + 1) : chunk) };
  }).filter(g => g.names.length);
}
function mmrNpcRulesHTML(n) {
  if (!n) return '';
  const groups = mmrRowPowerGroups(n);
  const traits = mmrSplitList(n.traits), tags = mmrSplitList(n.tags);
  if (!groups.length && !traits.length && !tags.length) return '';
  mmrApplyRulesPref();
  const sec = (title, body) => body
    ? `<div class="label mb-1" style="margin-top:10px">${esc(title)}</div>${body}` : '';
  let h = '<div class="mmr-npc-rules">';
  h += '<div class="mmr-head" style="margin-bottom:4px">' + mmrRulesBtnHTML() + '</div>';
  h += sec('Powers', groups.map(g => `<div class="mmr-set"><div class="mmr-set-h">`
    + `<span class="mmr-set-n">${esc(mmrSetLabel(g.set))}</span>`
    + `<span class="mmr-set-c">${g.names.length}</span></div><div class="mmr-pow-grid">`
    // Not `.map(mmrPowerCardHTML)`: map would hand the index in as the edit flag and a
    // Narrator's read-only card would sprout remove buttons from the second power on.
    + g.names.map(n => mmrPowerCardHTML(n)).join('') + '</div></div>').join(''));
  h += sec('Traits', traits.length ? mmrLabelListHTML(traits, mmrTraitRule) : '');
  h += sec('Tags', tags.length ? mmrLabelListHTML(tags, mmrTagRule) : '');
  return h + '</div>';
}

// ─── on paper ────────────────────────────────────────────────────────────────
// The printed sheet used to be this block with its tags stripped out, which for a
// character out of the book is 2,000 words of one paragraph. Same content, set as the
// print stylesheet's own blocks: two columns, powers under their sets, and the rule
// under every name — the point of printing it is to not need the book beside you.
function mmrSheetPrintHTML(ch) {
  // The effective sheet, so the page you carry to the table is the armor you have on.
  const p = mmrEffective(ch);
  if (!p) return '';
  const lo = mmrLoadoutName(ch);
  const E = (typeof prE === 'function') ? prE : (s => esc(String(s)));
  const blk = (title, body, wide) => body
    ? `<div class="pr-blk${wide ? ' pr-wide' : ''}"><div class="pr-blk-t">${E(title)}</div>${body}</div>` : '';
  const rows = pairs => '<table class="pr-t"><tbody>' + pairs.filter(r => r[1] !== '' && r[1] !== null && r[1] !== undefined)
    .map(r => `<tr><td class="pr-nm">${E(r[0])}</td><td class="pr-n">${E(String(r[1]))}</td></tr>`).join('') + '</tbody></table>';

  let h = `<div class="pr-note">Rank ${E(String(p.rank))} · ${E(MMR_KIND_LABEL[p.kind] || '')}`
    + (lo ? ' · ' + E(lo) : '')
    + (p.page ? ' · Core Rulebook p. ' + E(String(p.page)) : '')
    + (mmrLoadouts(ch).length > 1 || (mmrLoadouts(ch).length === 1 && !lo)
      ? '<br>Other loadouts: ' + E(mmrLoadouts(ch).filter(l => l.name !== lo).map(l => l.name || 'Unnamed').join(', '))
      : '')
    + (p.formNote ? '<br>' + E(p.formNote) : '') + '</div>';
  h += '<div class="pr-cols">';
  h += blk('Vitals', rows([
    ['Health', p.health + (p.healthDR ? ' (DR ' + p.healthDR + ')' : '')],
    ['Focus', p.focus + (p.focusDR ? ' (DR ' + p.focusDR + ')' : '')],
    ['Karma', p.karma],
    ['Initiative', mmrSigned(p.init) + (p.initEdge ? ' with an edge' : '')],
    ['Speed', mmrSpeedText(p)],
  ]));
  h += blk('Abilities', '<table class="pr-t"><tbody>' + MMR_ABILITY_ORDER.map(([k, n]) => {
    const a = p.abilities[k], d = p.damage[k];
    return `<tr><td class="pr-nm">${E(n)}</td><td class="pr-n">${E(a.score + ' / def ' + a.def + ' / ' + mmrMod(a.check)
      + (d ? ' / ×' + d.mult + ' ' + mmrMod(d.ability) : ''))}</td></tr>`;
  }).join('') + '</tbody></table>');
  h += blk('Background', rows([['Real name', p.realName], ['Origin', p.origin], ['Occupation', p.occupation],
    ['Size', p.size], ['Teams', p.teams], ['Base', p.base]]));

  // Each entry is its own .pr-blk, flowing through the two columns the print
  // stylesheet already sets. Wrapping Powers in ONE block instead made it span the
  // page, and an 8pt rule set across a letter sheet is a line you read by moving your
  // head. The headings are break-after:avoid, so a set never ends a column alone.
  const entry = (name, note, facts, effect) =>
    `<div class="pr-blk"><span class="pr-nm">${E(name)}</span>`
    + (note ? ` <span class="pr-q">(${E(note)})</span>` : '')
    + (facts ? `<div class="pr-sub"><b>${E(facts)}</b></div>` : '')
    + (effect ? `<div class="pr-sub">${E(effect)}</div>` : '') + '</div>';
  const head = t => `<div class="pr-blk-t">${E(t)}</div>`;
  const defs = (names, lookup) => (names || []).map(raw => {
    const r = lookup(raw), u = r.rule || {};
    return entry(r.name, r.note, '', u.effect || '');
  }).join('');

  const groups = mmrPowerGroups(p);
  if (groups.length) {
    h += head('Powers');
    groups.forEach(g => {
      h += head(mmrSetLabel(g.set));
      g.names.forEach(n => {
        const r = mmrPowerRule(n), u = r.rule || {};
        const facts = [u.action, u.duration, u.cost ? 'Cost ' + u.cost : '',
          u.range ? 'Range ' + u.range : '', u.prereqs && u.prereqs.length ? 'Needs ' + u.prereqs.join(', ') : '']
          .filter(Boolean).join(' · ');
        h += entry(r.name, r.note, facts, u.effect || '');
      });
    });
  }
  if (p.traits && p.traits.length) h += head('Traits') + defs(p.traits, mmrTraitRule);
  if (p.tags && p.tags.length) h += head('Tags') + defs(p.tags, mmrTagRule);
  if (p.history) h += head('History') + `<div class="pr-blk"><div class="pr-sub">${E(p.history)}</div></div>`;
  if (p.personality) h += head('Personality') + `<div class="pr-blk"><div class="pr-sub">${E(p.personality)}</div></div>`;
  return h + '</div>';
}

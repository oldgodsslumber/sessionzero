// systems/marvel-multiverse/own.js — the character a save OWNS. PLAN.md §5A.
//
// "The pre-generated characters should not be altered. However, once a hero is yours,
// they can be editable. Tony Stark wears more than one armor, for instance!"
//
// Both halves of that are one change, and it is not a UI change. Play as Hero used to
// write a POINTER — {profile:'iron-man-tony-stark', blocks:{abilities}} — and the sheet
// read every number back out of MMR_PROFILES. There was nothing to edit, and the only
// thing an edit could have reached is the catalogue that every save and the Official tab
// share. So:
//
//   MMR_PROFILES is deep-frozen here, at load, and is never written again. A correction
//   to the book's row goes through tools/profile-overrides.json and a regeneration.
//
//   Adoption deep-copies the playable fields into ch.sheet, which the save owns.
//   ch.profile and ch.profileFields survive as PROVENANCE — what this character was
//   copied from, and what the book said at the time — never as a source of numbers.
//
//   An armor is an OVERLAY on that sheet, not a second sheet. Six armors as six sheets
//   is six places to fix a typo in Tony's history, and it makes the one screen worth
//   having — what this armor CHANGES — impossible to draw.
//
// Every reader goes through mmrEffective(). A reader that reaches past it to ch.sheet
// shows the base value while an armor is on, which is the bug this file exists to stop.

// ─── the book is read-only, and that is enforced rather than promised ────────
function mmrDeepFreeze(x) {
  if (!x || typeof x !== 'object' || Object.isFrozen(x)) return x;
  Object.freeze(x);
  Object.keys(x).forEach(k => mmrDeepFreeze(x[k]));
  return x;
}

// ─── provenance: what the book said when this copy was taken ─────────────────
// A hash per field rather than a second copy of the row. The point is to notice that
// the BOOK changed — a regenerated profiles.js, months from now — and a hash answers
// that in a few bytes, where keeping the whole original row would double the prose in
// every save file. What the player needs to decide is the book's value NOW against
// theirs, and both of those are in hand.
function mmrHash(s) {
  let h = 5381;
  const t = String(s);
  for (let i = 0; i < t.length; i++) h = (((h << 5) + h) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const MMR_OWN_FIELDS = [
  'page', 'kind', 'rank', 'karma', 'health', 'healthDR', 'focus', 'focusDR',
  'init', 'initEdge', 'speeds', 'abilities', 'damage', 'realName', 'origin',
  'occupation', 'size', 'teams', 'base', 'history', 'personality',
  'traits', 'tags', 'powers', 'formNote',
];
function mmrFieldRevs(sheet) {
  const out = {};
  MMR_OWN_FIELDS.forEach(k => { out[k] = mmrHash(JSON.stringify(sheet[k] === undefined ? null : sheet[k])); });
  return out;
}

// ─── adoption ────────────────────────────────────────────────────────────────
// Deliberately a deep copy of the playable fields and nothing else: no id (the save has
// one), no name (the shell's identity row owns it). `page` stays as provenance — the
// sheet prints "Book p. 196", which is true of where they came from however much they
// are changed afterwards.
function mmrSheetFromProfile(p) {
  const sheet = {};
  MMR_OWN_FIELDS.forEach(k => {
    if (p[k] === undefined) return;
    sheet[k] = (p[k] && typeof p[k] === 'object') ? JSON.parse(JSON.stringify(p[k])) : p[k];
  });
  // Firebase refuses `undefined` outright and one such value wedges every later save,
  // so every list is a list and every optional string is a string.
  ['traits', 'tags', 'powers'].forEach(k => { if (!sheet[k]) sheet[k] = []; });
  if (sheet.formNote === undefined) sheet.formNote = '';
  if (!sheet.speeds) sheet.speeds = {};
  return sheet;
}

function mmrCharFromProfile(p) {
  // blocks.abilities stays filled: it is what the shell's traitGrid and its roller read
  // for a pack-built character, and keeping the two in step costs one loop.
  const abilities = {};
  MMR_ABILITY_ORDER.forEach(([k]) => { abilities[k] = p.abilities[k].score; });
  const sheet = mmrSheetFromProfile(p);
  return {
    systemId: SYS.id, name: p.name, profile: p.id,
    sheet: sheet, profileFields: mmrFieldRevs(sheet),
    loadouts: [], activeLoadout: 'base',
    blocks: { abilities: abilities },
  };
}

// ─── the migration, which matters more than any of the rest ──────────────────
// An existing save is {profile, blocks:{abilities}} and nothing else. It adopts once,
// lazily, the next time anything reads it, and it must carry across whatever is already
// in blocks.abilities — a changed score is the one thing a player can have done to one
// of these before today. Defense and Check are TRAINED values (§2) and are not touched:
// they cannot be derived from a score, so a changed score leaves them as the book had
// them and the legality report is what points that out.
//
// Idempotent by construction: ch.sheet exists afterwards, so this returns false forever
// after. It does not save — it is called from render paths and from the roster mirror,
// and the mirror runs inside save() already. mmrSheetExtra() is what writes it down.
function mmrMigrateChar(ch) {
  if (!ch || ch.sheet || !ch.profile) return false;
  const p = (typeof mmrProfile === 'function') ? mmrProfile(ch.profile) : null;
  if (!p) return false;
  const sheet = mmrSheetFromProfile(p);
  const had = ch.blocks && ch.blocks.abilities;
  if (had) MMR_ABILITY_ORDER.forEach(([k]) => {
    const v = Number(had[k]);
    if (had[k] === '' || had[k] === null || had[k] === undefined || isNaN(v)) return;
    if (sheet.abilities[k]) sheet.abilities[k].score = v;
  });
  ch.sheet = sheet;
  ch.profileFields = mmrFieldRevs(mmrSheetFromProfile(p));   // the BOOK's values, not the carried ones
  if (!ch.loadouts) ch.loadouts = [];
  if (!ch.activeLoadout) ch.activeLoadout = 'base';
  return true;
}

// The owned sheet, migrating on the way past. Null for a character that was never
// copied from a profile — a hand-built one, which gets SYS.schema's blocks until M4.
function mmrOwnSheet(ch) {
  if (!ch) return null;
  if (!ch.sheet) mmrMigrateChar(ch);
  return ch.sheet || null;
}
function mmrIsOwned(ch) { return !!mmrOwnSheet(ch); }

// ─── loadouts ────────────────────────────────────────────────────────────────
// { id, name, note, add:{powers:[{set,name}],traits:[],tags:[]}, remove:{...}, set:{...} }
function mmrLoadouts(ch) { return (ch && ch.loadouts) || []; }
function mmrActiveLoadout(ch) {
  if (!ch || !ch.activeLoadout || ch.activeLoadout === 'base') return null;
  return mmrLoadouts(ch).filter(l => l.id === ch.activeLoadout)[0] || null;
}
function mmrLoadoutName(ch) {
  const l = mmrActiveLoadout(ch);
  return l ? (l.name || 'Unnamed') : '';
}
function mmrBlankLoadout(name) {
  return {
    id: (typeof uid === 'function') ? uid() : ('lo' + Math.random().toString(36).slice(2)),
    name: String(name || 'New loadout'), note: '',
    add: { powers: [], traits: [], tags: [] },
    remove: { powers: [], traits: [], tags: [] },
    set: {},
  };
}

// ─── the one reader ──────────────────────────────────────────────────────────
// Remove before add, so a loadout can swap one power for another of the same name
// shape; then `set` over the top. Scalars replace, abilities and speeds merge per key,
// so a loadout that raises Melee does not have to restate the other five.
function mmrEffective(ch) {
  const base = mmrOwnSheet(ch);
  if (!base) return null;
  const lo = mmrActiveLoadout(ch);
  // A COPY even with no loadout on. Handing back the live sheet made every reader an
  // accidental writer: the legality report adjusts a value to answer a what-if, and
  // that quietly rewrote the character it was reporting on. Writers go through
  // mmrOwnSheet() and mmrOwnTarget(), which is the whole point of having those.
  const eff = JSON.parse(JSON.stringify(base));
  if (!lo) return eff;
  const rm = (lo.remove || {});
  const add = (lo.add || {});
  const gone = {};
  (rm.powers || []).forEach(n => { gone[String(n).toLowerCase()] = 1; });
  eff.powers = (eff.powers || []).filter(x => !gone[String(x.name).toLowerCase()]);
  (add.powers || []).forEach(x => {
    const n = (x && x.name) ? x : { set: 'Added', name: String(x) };
    if (!eff.powers.some(y => y.name === n.name)) eff.powers.push({ set: n.set || 'Added', name: n.name });
  });
  ['traits', 'tags'].forEach(k => {
    const out = {};
    (rm[k] || []).forEach(n => { out[String(n).toLowerCase()] = 1; });
    eff[k] = (eff[k] || []).filter(n => !out[String(n).toLowerCase()]);
    (add[k] || []).forEach(n => { if (eff[k].indexOf(n) < 0) eff[k].push(n); });
  });
  Object.keys(lo.set || {}).forEach(k => {
    const v = lo.set[k];
    if (k === 'abilities' || k === 'damage') {
      eff[k] = eff[k] || {};
      Object.keys(v || {}).forEach(a => { eff[k][a] = Object.assign({}, eff[k][a], v[a]); });
    } else if (k === 'speeds') {
      eff.speeds = Object.assign({}, eff.speeds, v);
    } else {
      eff[k] = v;
    }
  });
  return eff;
}

// ─── pools when an armor changes the maximum ─────────────────────────────────
// 40 of 75 into a suit that prints 100 is 65 of 100: he is 35 down and he stays 35 down.
// A bigger maximum is never healing, and a smaller one cannot leave you above it.
// Pure, and called from the switch below against ch.blocks.pools — which is where M3's
// tracked Health and Focus will live. Marvel's pools go negative by the rules (p. 33),
// so there is no floor here on purpose.
function mmrCarryPool(cur, oldMax, newMax) {
  const c = Number(cur), o = Number(oldMax), n = Number(newMax);
  if (isNaN(c) || isNaN(o) || isNaN(n)) return cur;
  return Math.min(n, n - (o - c));
}
function mmrCarryPools(ch, before, after) {
  const pools = ch && ch.blocks && ch.blocks.pools;
  if (!pools || !before || !after) return;
  // Karma is a resource and not a capacity, so it does not move at all.
  ['health', 'focus'].forEach(k => {
    if (pools[k] === undefined || pools[k] === null) return;
    if (before[k] === after[k]) return;
    pools[k] = mmrCarryPool(pools[k], before[k], after[k]);
  });
}

// ─── writing: edits land on whatever is active ───────────────────────────────
// With an armor on, an edit belongs to THAT armor — "Hulkbuster's Health is 100" — which
// is also how `set` gets filled without a second screen for it. With no armor on, the
// edit is the base sheet's. The sheet says which, above the fields, because guessing
// wrong here is how a player edits Tony and finds they edited the suit.
function mmrOwnTarget(ch) {
  const lo = mmrActiveLoadout(ch);
  return lo ? { kind: 'loadout', lo: lo, set: (lo.set = lo.set || {}) } : { kind: 'base', sheet: mmrOwnSheet(ch) };
}
function mmrOwnNum(v, fallback) {
  if (v === '' || v === null || v === undefined) return fallback;
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

function mmrOwnSet(field, value) {
  const ch = S && S.char;
  if (!ch || !mmrOwnSheet(ch)) return;
  const numeric = ['rank', 'karma', 'health', 'healthDR', 'focus', 'focusDR', 'init', 'page'];
  const before = mmrEffective(ch);
  const v = numeric.indexOf(field) >= 0 ? mmrOwnNum(value, 0) : value;
  const t = mmrOwnTarget(ch);
  if (t.kind === 'loadout') t.set[field] = v; else t.sheet[field] = v;
  if (field === 'health' || field === 'focus') mmrCarryPools(ch, before, mmrEffective(ch));
  save();
}
function mmrOwnSetBool(field, value) {
  const ch = S && S.char;
  if (!ch || !mmrOwnSheet(ch)) return;
  const t = mmrOwnTarget(ch);
  if (t.kind === 'loadout') t.set[field] = !!value; else t.sheet[field] = !!value;
  save();
}
// Score, Defense and Check are three independent trained numbers (§2), and so is each
// damage line. Nothing derives anything here; the legality report is where disagreement
// gets mentioned.
function mmrOwnAbilitySet(ability, key, value) {
  const ch = S && S.char;
  const base = mmrOwnSheet(ch);
  if (!base || !base.abilities || !base.abilities[ability]) return;
  const v = mmrOwnNum(value, 0);
  const t = mmrOwnTarget(ch);
  if (t.kind === 'loadout') {
    t.set.abilities = t.set.abilities || {};
    t.set.abilities[ability] = Object.assign({}, t.set.abilities[ability]);
    t.set.abilities[ability][key] = v;
  } else {
    base.abilities[ability][key] = v;
    if (key === 'score' && ch.blocks && ch.blocks.abilities) ch.blocks.abilities[ability] = v;
  }
  save();
}
function mmrOwnDamageSet(ability, key, value) {
  const ch = S && S.char;
  const base = mmrOwnSheet(ch);
  if (!base) return;
  const v = mmrOwnNum(value, 0);
  const t = mmrOwnTarget(ch);
  if (t.kind === 'loadout') {
    t.set.damage = t.set.damage || {};
    const cur = (mmrEffective(ch).damage || {})[ability] || { mult: 1, ability: 0 };
    t.set.damage[ability] = Object.assign({ mult: cur.mult, ability: cur.ability }, t.set.damage[ability]);
    t.set.damage[ability][key] = v;
  } else {
    base.damage = base.damage || {};
    base.damage[ability] = Object.assign({ mult: 1, ability: 0 }, base.damage[ability]);
    base.damage[ability][key] = v;
  }
  save();
}

// Speeds as the one line the sheet already prints — "Run 6, Climb 3, Jump 30" — parsed
// back. That is what makes a speed addable and removable without a screen of its own,
// and mmrSpeedText() is the exact inverse, which a test holds to.
function mmrParseSpeeds(text) {
  const out = {};
  String(text === undefined || text === null ? '' : text).split(',').forEach(part => {
    const m = /^\s*([A-Za-z][A-Za-z ]*?)\s+(-?\d+)\s*$/.exec(part);
    if (!m) return;
    const k = m[1].trim().replace(/\s+/g, ' ');
    out[k[0].toLowerCase() + k.slice(1)] = Number(m[2]);
  });
  return out;
}
function mmrOwnSpeedsSet(text) {
  const ch = S && S.char;
  if (!ch || !mmrOwnSheet(ch)) return;
  const t = mmrOwnTarget(ch);
  const v = mmrParseSpeeds(text);
  if (t.kind === 'loadout') t.set.speeds = v; else t.sheet.speeds = v;
  save();
}

// ─── adding and removing powers, traits and tags ─────────────────────────────
// With an armor on, adding pushes to its `add` and removing pushes the name to its
// `remove` — unless the name was the armor's own addition, in which case it just goes.
// That is the delta the Loadouts card draws, and it is why this is an overlay.
function mmrOwnAdd(kind, raw) {
  const ch = S && S.char;
  const base = mmrOwnSheet(ch);
  const name = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!base || !name) return;
  const lo = mmrActiveLoadout(ch);
  const list = lo ? ((lo.add = lo.add || {})[kind] = lo.add[kind] || []) : (base[kind] = base[kind] || []);
  if (kind === 'powers') {
    if (list.some(x => x && x.name === name)) return;
    // The set comes from the rule, so an added power files itself under the set the
    // book prints it in rather than a bucket called "other".
    const r = (typeof mmrPowerRule === 'function') ? mmrPowerRule(name) : null;
    const set = (r && r.rule && r.rule.set) ? mmrSetLabel(r.rule.set) : 'Added';
    list.push({ set: set, name: name });
  } else {
    if (list.indexOf(name) >= 0) return;
    list.push(name);
  }
  if (lo) {
    const out = (lo.remove = lo.remove || {})[kind] || [];
    const i = out.map(x => String(x).toLowerCase()).indexOf(name.toLowerCase());
    if (i >= 0) out.splice(i, 1);
  }
  save();
  renderHero();
}
function mmrOwnRemove(kind, raw) {
  const ch = S && S.char;
  const base = mmrOwnSheet(ch);
  const name = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!base || !name) return;
  const lo = mmrActiveLoadout(ch);
  const drop = (list, isPow) => {
    if (!list) return false;
    for (let i = list.length - 1; i >= 0; i--) {
      const n = isPow ? (list[i] && list[i].name) : list[i];
      if (String(n).toLowerCase() === name.toLowerCase()) { list.splice(i, 1); return true; }
    }
    return false;
  };
  const isPow = kind === 'powers';
  if (lo) {
    // Its own addition disappears; one of the base sheet's is masked instead.
    if (!drop((lo.add || {})[kind], isPow)) {
      lo.remove = lo.remove || {};
      lo.remove[kind] = lo.remove[kind] || [];
      if (lo.remove[kind].map(x => String(x).toLowerCase()).indexOf(name.toLowerCase()) < 0) lo.remove[kind].push(name);
    }
  } else {
    drop(base[kind], isPow);
  }
  save();
  renderHero();
}

// ─── loadout CRUD ────────────────────────────────────────────────────────────
function mmrLoadoutNew(name) {
  const ch = S && S.char;
  if (!ch || !mmrOwnSheet(ch)) return;
  const n = (name === undefined)
    ? prompt('Name this loadout\n\nIt starts as a copy of what you have now; everything you change while it is on belongs to it.', 'New loadout')
    : name;
  if (n === null || String(n).trim() === '') return;
  const lo = mmrBlankLoadout(String(n).trim());
  ch.loadouts = ch.loadouts || [];
  ch.loadouts.push(lo);
  ch.activeLoadout = lo.id;        // no pools carry: an empty overlay changes no maximum
  save();
  renderHero();
}
function mmrLoadoutDuplicate(id) {
  const ch = S && S.char;
  const src = mmrLoadouts(ch).filter(l => l.id === id)[0];
  if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = mmrBlankLoadout('').id;
  copy.name = src.name + ' copy';
  ch.loadouts.push(copy);
  save();
  renderHero();
}
function mmrLoadoutRename(id) {
  const ch = S && S.char;
  const lo = mmrLoadouts(ch).filter(l => l.id === id)[0];
  if (!lo) return;
  const n = prompt('Name this loadout', lo.name || '');
  if (n === null || String(n).trim() === '') return;
  lo.name = String(n).trim();
  save();
  renderHero();
}
function mmrLoadoutNote(id, text) {
  const ch = S && S.char;
  const lo = mmrLoadouts(ch).filter(l => l.id === id)[0];
  if (!lo) return;
  lo.note = String(text === undefined || text === null ? '' : text);
  save();
}
function mmrLoadoutDelete(id) {
  const ch = S && S.char;
  const lo = mmrLoadouts(ch).filter(l => l.id === id)[0];
  if (!lo) return;
  if (!confirm('Delete the loadout "' + (lo.name || 'Unnamed') + '"?\n\nWhat it changes goes with it. The base sheet is untouched.')) return;
  const before = mmrEffective(ch);
  ch.loadouts = mmrLoadouts(ch).filter(l => l.id !== id);
  if (ch.activeLoadout === id) ch.activeLoadout = 'base';
  mmrCarryPools(ch, before, mmrEffective(ch));
  save();
  renderHero();
}
function mmrLoadoutActivate(id) {
  const ch = S && S.char;
  if (!ch || !mmrOwnSheet(ch)) return;
  const want = (id === 'base' || !id) ? 'base' : id;
  if (want !== 'base' && !mmrLoadouts(ch).some(l => l.id === want)) return;
  if (ch.activeLoadout === want) return;
  const before = mmrEffective(ch);
  ch.activeLoadout = want;
  mmrCarryPools(ch, before, mmrEffective(ch));
  save();
  renderHero();
}

// ─── what an armor changes, in words ─────────────────────────────────────────
// The screen the overlay exists for. Scalars read "Health 75 → 100" against the BASE
// sheet, because that is the comparison a player is making when they look at this.
const MMR_SET_LABEL = {
  rank: 'Rank', karma: 'Karma', health: 'Health', healthDR: 'Health DR',
  focus: 'Focus', focusDR: 'Focus DR', init: 'Initiative', initEdge: 'Initiative edge',
  size: 'Size', speeds: 'Speed', realName: 'Real name', origin: 'Origin',
  occupation: 'Occupation', teams: 'Teams', base: 'Base', kind: 'Kind',
  history: 'History', personality: 'Personality', formNote: 'Note', page: 'Book page',
};
function mmrLoadoutDelta(ch, lo) {
  const base = mmrOwnSheet(ch);
  const out = [];
  if (!base || !lo) return out;
  const abil = k => (MMR_ABILITY_ORDER.filter(a => a[0] === k)[0] || [k, k])[1];
  (((lo.add || {}).powers) || []).forEach(x => out.push({ how: 'add', what: 'Power', text: (x && x.name) || String(x) }));
  (((lo.add || {}).traits) || []).forEach(n => out.push({ how: 'add', what: 'Trait', text: n }));
  (((lo.add || {}).tags) || []).forEach(n => out.push({ how: 'add', what: 'Tag', text: n }));
  (((lo.remove || {}).powers) || []).forEach(n => out.push({ how: 'remove', what: 'Power', text: n }));
  (((lo.remove || {}).traits) || []).forEach(n => out.push({ how: 'remove', what: 'Trait', text: n }));
  (((lo.remove || {}).tags) || []).forEach(n => out.push({ how: 'remove', what: 'Tag', text: n }));
  Object.keys(lo.set || {}).forEach(k => {
    const v = lo.set[k];
    if (k === 'abilities' || k === 'damage') {
      Object.keys(v || {}).forEach(a => Object.keys(v[a] || {}).forEach(f => {
        const was = ((base[k] || {})[a] || {})[f];
        const name = abil(a) + ' ' + (k === 'damage' ? (f === 'mult' ? 'multiplier' : 'damage bonus') : f);
        out.push({ how: 'set', what: name, from: was, to: v[a][f] });
      }));
    } else if (k === 'speeds') {
      out.push({ how: 'set', what: 'Speed', from: mmrSpeedText(base), to: mmrSpeedText({ speeds: v }) });
    } else if (k === 'history' || k === 'personality') {
      out.push({ how: 'set', what: MMR_SET_LABEL[k] || k, from: '', to: 'rewritten' });
    } else {
      out.push({ how: 'set', what: MMR_SET_LABEL[k] || k, from: base[k], to: v });
    }
  });
  return out;
}

// ─── the book changing under a copy ──────────────────────────────────────────
// profileFields was stamped at adoption. When a regenerated profiles.js disagrees with
// it, the sheet says so and the player takes a field across one at a time. Nothing is
// ever overwritten for them — which is also the honest answer to a correction we make
// months from now.
function mmrProfileDrift(ch) {
  if (!ch || !ch.profile || !ch.profileFields) return [];
  const p = (typeof mmrProfile === 'function') ? mmrProfile(ch.profile) : null;
  if (!p) return [];
  const now = mmrFieldRevs(mmrSheetFromProfile(p));
  return MMR_OWN_FIELDS.filter(k => ch.profileFields[k] !== undefined && ch.profileFields[k] !== now[k])
    .map(k => ({ field: k, label: MMR_SET_LABEL[k] || k }));
}
function mmrTakeBookField(field) {
  const ch = S && S.char;
  const base = mmrOwnSheet(ch);
  if (!base || !ch.profile) return;
  const p = mmrProfile(ch.profile);
  if (!p) return;
  const fresh = mmrSheetFromProfile(p);
  if (fresh[field] === undefined) return;
  base[field] = (fresh[field] && typeof fresh[field] === 'object')
    ? JSON.parse(JSON.stringify(fresh[field])) : fresh[field];
  ch.profileFields = ch.profileFields || {};
  ch.profileFields[field] = mmrFieldRevs(fresh)[field];
  if (field === 'abilities' && ch.blocks && ch.blocks.abilities) {
    MMR_ABILITY_ORDER.forEach(([k]) => { ch.blocks.abilities[k] = base.abilities[k].score; });
  }
  save();
  renderHero();
}
function mmrDismissDrift() {
  // "I have read it and I am keeping mine": re-stamp without taking anything.
  const ch = S && S.char;
  if (!ch || !ch.profile) return;
  const p = mmrProfile(ch.profile);
  if (!p) return;
  ch.profileFields = mmrFieldRevs(mmrSheetFromProfile(p));
  save();
  renderHero();
}

// ─── the legality report, which reports and does not refuse ──────────────────
// The book's own pregens are illegal by its creation rules — Iron Man prints 75 Health
// on Resilience 3 — and §3A settled that we keep what the book prints. So this says what
// is off and changes nothing. The wizard (M4) is where a pick gets refused, because
// there the player is spending a budget.
function mmrTierOf(name) {
  const m = /^(.*?)\s+(\d+)$/.exec(String(name || ''));
  return m ? { base: m[1], n: Number(m[2]) } : { base: String(name || ''), n: 0 };
}
function mmrLegalityReport(eff) {
  const out = [];
  if (!eff) return out;
  const say = (what, text) => out.push({ what: what, text: text });
  const res = ((eff.abilities || {}).resilience || {}).score;
  const vig = ((eff.abilities || {}).vigilance || {}).score;
  const traits = eff.traits || [], tags = eff.tags || [];
  const has = (list, word) => list.some(n => String(n).toLowerCase().indexOf(word) === 0);

  if (res !== undefined) {
    const want = Math.max(10, res * 30);
    if (eff.health !== want) say('Health', 'reads ' + eff.health + '; Resilience ' + res + ' works out to ' + want + '.');
  }
  if (vig !== undefined) {
    const br = has(traits, 'battle ready');
    const want = Math.max(10, vig * 30) + (br ? 30 : 0);
    if (eff.focus !== want) say('Focus', 'reads ' + eff.focus + '; Vigilance ' + vig
      + (br ? ' with Battle Ready' : '') + ' works out to ' + want + '.');
  }
  const wantK = has(tags, 'heroic') ? eff.rank : 0;
  if (eff.karma !== wantK) say('Karma', 'reads ' + eff.karma + '; ' + (wantK ? 'Rank ' + eff.rank + ' with the Heroic tag is ' + wantK : 'without the Heroic tag it is 0') + '.');

  MMR_ABILITY_ORDER.forEach(([k, n]) => {
    const a = (eff.abilities || {})[k];
    if (!a) return;
    const cap = eff.rank + 3;
    if (a.score > cap) say(n, 'is ' + a.score + ', above Rank ' + eff.rank + ' + 3 — before any bonus from a matching power tier.');
  });
  // Defense and the non-combat Check are deliberately NOT checked. Score + 10 is the
  // rule, but size, Spider-Sense, Evasion and Integrity all move it: measured against
  // the book, that check flags 32 of its 128 characters and 165 of their Check values,
  // which is a report nobody would read twice.

  // Prerequisites, with the book's own convention honoured: Chapter 8 prints only the
  // TOP tier of a tiered power, so owning Mighty 3 is owning the chain. Without that
  // this flagged 95 of the book's 128 characters, which is noise rather than a report.
  const top = {}, known = {};
  (eff.powers || []).forEach(x => {
    const r = (typeof mmrPowerRule === 'function') ? mmrPowerRule(x.name) : null;
    if (!r || !r.rule) { say('Power', '"' + x.name + '" is not a power the Core Rulebook describes.'); return; }
    known[r.name] = r.rule;
    const t = mmrTierOf(r.name);
    top[t.base] = Math.max(top[t.base] || 0, t.n);
  });
  Object.keys(known).forEach(n => {
    (known[n].prereqs || []).forEach(q => {
      const t = mmrTierOf(q);
      if (top[t.base] === undefined || top[t.base] < t.n) say(n, 'needs ' + q + ', which is not on this sheet.');
    });
  });
  traits.forEach(n => {
    const r = (typeof mmrTraitRule === 'function') ? mmrTraitRule(n) : null;
    if (!r || !r.rule) say('Trait', '"' + n + '" is not a trait the Core Rulebook describes.');
  });
  tags.forEach(n => {
    const r = (typeof mmrTagRule === 'function') ? mmrTagRule(n) : null;
    if (!r || !r.rule) say('Tag', '"' + n + '" is not a tag the Core Rulebook describes.');
  });
  return out;
}

// The catalogue freezes as soon as it and this file are both loaded. Last, so that a
// mistake above cannot write to it first.
if (typeof MMR_PROFILES !== 'undefined') mmrDeepFreeze(MMR_PROFILES);

// One-shot: turn the OCR of Chapter 8 into structured profiles, and say what it doubts.
// Not a build step. It writes .book/profiles.json; the app never runs it.
//
// usage: node tools/parse-profiles.mjs <.book dir> [overrides.json]
//
// Numbers come from boxes.json (each stat box cropped and read alone). Text comes from
// the whole-page OCR, read by position. checkProfile() then re-derives what the rules say
// each number should be, so a misread shows up as a contradiction rather than a stat.
import fs from 'node:fs';
import path from 'node:path';

const [, , bookDir, overridesFile] = process.argv;
const boxes = JSON.parse(fs.readFileSync(path.join(bookDir, 'boxes.json'), 'utf8'));
const bullpen = JSON.parse(fs.readFileSync(path.join(bookDir, 'bullpen-all.json'), 'utf8'));
const overrides = overridesFile && fs.existsSync(overridesFile)
  ? JSON.parse(fs.readFileSync(overridesFile, 'utf8')) : {};

const squash = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const ABIL = ['melee', 'agility', 'resilience', 'vigilance', 'ego', 'logic'];

// ── names the labels may resolve to ──────────────────────────────────────────
const POWER_NAMES = Object.keys(bullpen.powersData);
const TRAIT_NAMES = Object.keys(bullpen.traitsData);
const TAG_NAMES = Object.keys(bullpen.tagsData);
const POWER_KEYS = new Map(POWER_NAMES.map(n => [squash(n), n]));
const LABEL_KEYS = new Map([...TRAIT_NAMES, ...TAG_NAMES].map(n => [squash(n), n]));

// Names the book prints differently from the catalogue. Each was read off the scan.
const POWER_ALIAS = {
  'Mist of Morpheus': 'Mists of Morpheus', 'Additional Limb': 'Additional Limbs',
  'Spin and Throw': 'Spin & Throw', 'Energy Blast': 'Elemental Blast', 'Energy Burst': 'Elemental Burst',
  // The book prints these without a number, so the first in the sequence is the reading.
  'Heightened Senses': 'Heightened Senses 1', 'Elemental Protection': 'Elemental Protection 1',
};
const LABEL_ALIAS = { 'Font of Knowledge': 'Font of Information', 'Tech-Reliance': 'Tech Reliance' };
// Printed on a profile and absent from the Bullpen's lists; kept as printed.
const PRINTED_LABELS = ['Prescription Pad'];
const CANON_POWER = new Map(POWER_NAMES.map(n => [squash(n), n]));
const CANON_LABEL = new Map([...TRAIT_NAMES, ...TAG_NAMES, ...PRINTED_LABELS].map(n => [squash(n), n]));
Object.keys(POWER_ALIAS).forEach(k => CANON_POWER.set(squash(k), POWER_ALIAS[k]));
Object.keys(LABEL_ALIAS).forEach(k => CANON_LABEL.set(squash(k), LABEL_ALIAS[k]));

function repair(t) {
  return String(t)
    .replace(/^(.*?)\s*(\d+ points to shatter\))$/, '$1 ($2')
    .replace(/\bBig\s*\(?\s*Reach\s*(\d)\)?/, 'Big (Reach $1)')
    .replace(/^Grow 1\s*permanently Huge size;\s*Reach 5\)$/, 'Grow 1 (permanently Huge size; Reach 5)')
    .replace(/^[.\s]+/, '').replace(/\s+/g, ' ').trim();
}
function resolveOne(t, canon) {
  const m = /^(.*?)\s*([:(\[].*)?$/.exec(t);
  const name = canon.get(squash(t)) || canon.get(squash(m[1]));
  if (!name) return null;
  const note = canon.get(squash(t)) ? '' : String(m[2] || '').replace(/^:\s*/, '').trim();
  return { name, note };
}
// One OCR line can hold two entries when the columns sat close together, so try each split.
function resolveAll(text, canon) {
  const t = repair(text), one = resolveOne(t, canon);
  if (one) return [one];
  const words = t.split(' ');
  for (let i = 1; i < words.length; i++) {
    const a = resolveAll(words.slice(0, i).join(' '), canon);
    const b = a && resolveAll(words.slice(i).join(' '), canon);
    if (a && b) return [...a, ...b];
  }
  return null;
}
function resolveList(list, canon, fix) {
  const out = [], bad = [];
  list.forEach(x => {
    const r = resolveAll(fix && fix[x] ? fix[x] : x, canon);
    if (r) out.push(...r); else bad.push(x);
  });
  return { out, bad };
}

// ── reading the numeric boxes ────────────────────────────────────────────────
function num(cell) {
  const t = String(cell && cell[0] || '').replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/S/g, '5');
  const m = /[-+–]?\d+/.exec(t);
  return m ? parseInt(m[0].replace('–', '-'), 10) : null;
}
const dash = cell => /^[-–—_.\s]*$/.test(String(cell && cell[0] || ''));

// ── reading the text by position ─────────────────────────────────────────────
function loadRows(pdf) {
  const f = path.join(bookDir, 'ocr', `p${String(pdf).padStart(3, '0')}.json`);
  return JSON.parse(fs.readFileSync(f, 'utf8')).rows;
}

const find = (rows, word) => rows.find(r => r.t.replace(/\s/g, '').toUpperCase() === word && r.t === r.t.toUpperCase());

// The biography column is to the right of the stats, above the Powers rule; Traits & Tags
// sit between. Column heads are upper case; entries hang under them.
const isHead = t => {
  const letters = t.replace(/[^A-Za-z]/g, '');
  const upper = letters.replace(/[^A-Z]/g, '');
  return /^[A-Za-z(]/.test(t) && letters.length > 2 && upper.length / letters.length >= 0.7;
};

function joinWraps(lines, known) {
  // Labels wrap. Read forward, deciding at each line whether the next one continues this
  // label or starts another. A fragment like "Scientific" cannot stand alone, so it is not
  // enough to ask whether a line is a known name: ask whether it STARTS one.
  const L = lines.map(r => ({ ...r, t: r.t.replace(/^[+*•◆.\s]+/, '') })).filter(r => r.t);
  const glue = (x, y) => (x.endsWith('-') ? x + y : x + ' ' + y);
  const startsKnown = i => {
    let t = '';
    for (let k = i; k < Math.min(L.length, i + 4); k++) {
      t = t ? glue(t, L[k].t) : L[k].t;
      if (known(t)) return true;
    }
    return false;
  };
  const out = [];
  let i = 0;
  while (i < L.length) {
    let t = L[i].t, j = i + 1;
    while (j < L.length) {
      const next = L[j].t;
      const openParen = (t.match(/\(/g) || []).length > (t.match(/\)/g) || []).length;
      const forced = openParen || /[:\-,]$/.test(t) || /^[a-z(]/.test(next) || (/\)$/.test(next) && !/\(/.test(next));
      // A label that is already whole only continues when the next line cannot begin one.
      if (forced || !startsKnown(j)) { t = glue(t, next); j++; continue; }
      break;
    }
    out.push(t);
    i = j;
  }
  return out.map(t => t.replace(/\s+/g, ' ').replace(/\s*:\s*/g, ': ').trim());
}

function columnLines(rows) {
  // Sort a region into lines per column, grouped by x start.
  return rows.slice().sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
}

// History and Personality: the prose in the biography column, in paragraphs. A section
// ends at the next heading, so Emma Frost's Alternate Form does not read as her personality.
function isSectionHead(t) {
  const letters = t.replace(/[^A-Za-z]/g, ''), upper = letters.replace(/[^A-Z]/g, '');
  return letters.length > 3 && letters.length < 24 && upper.length / letters.length >= 0.7 && !/[.,]$/.test(t.trim());
}
function bioSections(rows, bioX, bottom) {
  const col = rows.filter(r => r.x0 >= bioX && r.y0 < bottom).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const lines = [];
  col.forEach(r => {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y0 - r.y0) < 9) { last.t += ' ' + r.t.trim(); last.y1 = Math.max(last.y1, r.y1); }
    else lines.push({ y0: r.y0, y1: r.y1, x0: r.x0, t: r.t.trim() });
  });
  // The page's own line spacing, from the middle of each line: the tops jitter by a few pixels.
  const mid = l => (l.y0 + l.y1) / 2;
  const gaps = lines.slice(1).map((l, i) => mid(l) - mid(lines[i])).filter(g => g > 10 && g < 60).sort((a, b) => a - b);
  const pitch = gaps[gaps.length >> 1] || 22;
  const out = { history: [], personality: [] };
  let cur = null, prev = null, paras = null;
  lines.forEach(l => {
    const k = squash(l.t);
    if (k === 'HISTORY') { cur = 'history'; paras = out.history; prev = null; return; }
    if (k === 'PERSONALITY') { cur = 'personality'; paras = out.personality; prev = null; return; }
    if (isSectionHead(l.t)) { cur = null; return; }
    if (!cur) return;
    // A paragraph break leaves a visible gap, and only ever follows the end of a sentence.
    const ended = prev && /[.!?"”)]$/.test(prev.t);
    if (!paras.length || (ended && mid(l) - mid(prev) > pitch * 1.25)) paras.push([l.t]);
    else paras[paras.length - 1].push(l.t);
    prev = l;
  });
  return out;
}

function parseText(pdf, box) {
  const rows = loadRows(pdf);
  const dx = box.dx || 0;
  const res = { name: '', bio: {}, speeds: {}, traits: [], tags: [], powers: [] };

  const titleRow = rows.filter(r => r.y0 > 60 && r.y0 < 140 && r.x0 < 800 && /[A-Z]{2}/.test(r.t)
    && !/CHARACTERS|BIOGRAPHY/.test(r.t.toUpperCase())).sort((a, b) => (b.y1 - b.y0) - (a.y1 - a.y0))[0];
  res.name = titleRow ? titleRow.t.trim() : '';

  // Biography: labelled lines in the right-hand column.
  const bioHead = find(rows, 'BIOGRAPHY');
  const bioX = bioHead ? bioHead.x0 - 15 : 860 + dx;
  const hist = find(rows, 'HISTORY');
  const bioRows = rows.filter(r => r.x0 >= bioX && r.y0 > (bioHead ? bioHead.y1 - 4 : 140) && r.y0 < (hist ? hist.y0 : 420))
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const bioText = bioRows.map(r => r.t).join(' ').replace(/\s+/g, ' ');
  const FIELDS = ['Real Name', 'Height', 'Weight', 'Gender', 'Eyes', 'Hair', 'Size', 'Distinguishing Features', 'Occupation', 'Origin', 'Teams', 'Base'];
  FIELDS.forEach((f, i) => {
    const rest = FIELDS.filter(x => x !== f).map(x => x.replace(' ', '\\s*')).join('|');
    const m = new RegExp(f.replace(' ', '\\s*') + '\\s*:\\s*(.*?)(?=\\s*(?:' + rest + ')\\s*:|$)').exec(bioText);
    if (m) res.bio[f] = m[1].trim();
  });

  const powersHead = rows.filter(r => r.t.trim() === 'POWERS' && r.y0 > 700)[0];
  const secs = bioSections(rows, bioX, powersHead ? powersHead.y0 : 1830);
  res.history = secs.history; res.personality = secs.personality;

  // Speeds: "Run/Climb/Jump: 6" and the like, inside the Speed box.
  const speedHead = find(rows, 'SPEED');
  const speedRows = rows.filter(r => r.y0 >= (speedHead ? speedHead.y1 - 6 : 620) && r.y0 < 735
    && r.x0 >= 540 + dx - 10 && r.x0 < 730 + dx);
  speedRows.sort((a, b) => a.y0 - b.y0).forEach(r => {
    const m = /^([A-Za-z/ ]+?)\s*:\s*(\d+)/.exec(r.t);
    if (!m) return;
    m[1].split('/').forEach(k => { res.speeds[k.trim().toLowerCase()] = +m[2]; });
  });

  // Traits, Tags and Powers heads.
  const tHead = find(rows, 'TRAITS');
  const gHead = find(rows, 'TAGS');
  const pHead = find(rows, 'POWERS');
  const pY = pHead ? pHead.y0 : 1150;
  const known = t => LABEL_KEYS.has(squash(t)) || LABEL_KEYS.has(squash(String(t).split(/[:(]/)[0]));

  if (tHead) {
    const right = gHead ? gHead.x0 - 8 : tHead.x0 + 180;
    const col = columnLines(rows.filter(r => r.x0 >= tHead.x0 - 25 && r.x0 < right && (r.y0 + r.y1) / 2 > tHead.y1 && r.y0 < pY));
    res.traits = joinWraps(col, known);
  }
  if (gHead) {
    const right = bioHead ? bioX - 2 : gHead.x0 + 180;
    const col = columnLines(rows.filter(r => r.x0 >= gHead.x0 - 25 && r.x0 < right && (r.y0 + r.y1) / 2 > gHead.y1 && r.y0 < pY));
    res.tags = joinWraps(col, known);
  }

  // Powers: below the rule, everything right of the Damage panel. Column heads are upper
  // case, and a column may stack several sets.
  const pow = rows.filter(r => r.y0 > (pHead ? pHead.y1 - 4 : 1170) && r.y1 < 1815 && r.x0 > 470 + dx
    && r.x1 < 1400 + dx && !/^\d{1,3}$/.test(r.t.trim()) && !/CHARACTERS?|CTERS|ACTERS/.test(r.t));
  const heads = pow.filter(r => isHead(r.t.trim()) && !POWER_KEYS.has(squash(r.t)));
  const colX = [];
  heads.forEach(h => { if (!colX.some(x => Math.abs(x - h.x0) < 60)) colX.push(h.x0); });
  colX.sort((a, b) => a - b);
  const colOf = r => { let c = 0; colX.forEach((x, i) => { if (r.x0 >= x - 30) c = i; }); return c; };
  colX.forEach((x, ci) => {
    const inCol = pow.filter(r => colOf(r) === ci).sort((a, b) => a.y0 - b.y0);
    let cur = null, buf = [];
    const flush = () => {
      if (!cur) return;
      joinWraps(buf, t => POWER_KEYS.has(squash(t)) || POWER_KEYS.has(squash(String(t).split(':')[0]))
        || POWER_KEYS.has(squash(String(t).split('(')[0]))).forEach(t => res.powers.push({ set: cur, name: t }));
      buf = [];
    };
    inCol.forEach(r => {
      if (heads.includes(r)) {
        const t = r.t.trim();
        if (t.startsWith('(') && cur && !buf.length) { cur += ' ' + t; return; }
        flush(); cur = t; return;
      }
      buf.push(r);
    });
    flush();
  });
  return res;
}

// ── the rules check ──────────────────────────────────────────────────────────
function tierOf(p, family) {
  let t = 0;
  p.powers.forEach(x => {
    const m = new RegExp('^' + family + '\\s*(\\d)').exec(x.name);
    if (m) t = Math.max(t, +m[1]);
  });
  return t;
}

function checkProfile(p) {
  const w = [];
  const score = a => p.abilities[a].score;
  const has = n => p.powers.some(x => squash(x.name).startsWith(squash(n)));
  const trait = n => p.traits.some(x => squash(x).startsWith(squash(n)));
  const tag = n => p.tags.some(x => squash(x).startsWith(squash(n)));

  if (p.rank == null) w.push('no rank');
  ABIL.forEach(a => {
    const c = p.abilities[a];
    ['score', 'def', 'check'].forEach(k => { if (c[k] == null) w.push(`${a} ${k} unread`); });
  });
  if (w.length) return w;

  const hp = Math.max(10, score('resilience') * 30);
  const fo = Math.max(10, score('vigilance') * 30) + (trait('Battle Ready') ? 30 : 0);
  if (p.health !== hp) w.push(`health ${p.health}, rules say ${hp}`);
  if (p.focus !== fo) w.push(`focus ${p.focus}, rules say ${fo}`);
  if (p.init !== score('vigilance')) w.push(`init ${p.init}, vigilance ${score('vigilance')}`);

  const hasKarma = tag('Heroic');
  if (hasKarma && p.karma !== p.rank) w.push(`karma ${p.karma} on a Heroic rank ${p.rank}`);

  const bonus = { melee: Math.max(tierOf(p, 'Mighty')), agility: tierOf(p, 'Accuracy'), ego: tierOf(p, 'Discipline'), logic: tierOf(p, 'Brilliance') };
  const growExp = tierOf(p, 'Grow');
  Object.keys(p.damage).forEach(a => {
    const d = p.damage[a];
    if (d.mult == null || d.ability == null) { w.push(`${a} damage unread`); return; }
    if (d.ability !== score(a)) w.push(`${a} damage ability ${d.ability}, score ${score(a)}`);
    if (d.mult < p.rank) w.push(`${a} multiplier ${d.mult} below rank ${p.rank}`);
    const expect = p.rank + bonus[a];
    if (d.mult !== expect && !(a === 'melee' && growExp)) w.push(`${a} multiplier ${d.mult}, rank+tier says ${expect}`);
  });

  ABIL.forEach(a => {
    const c = p.abilities[a];
    // The defense can legitimately rest on another ability (Evasion, Brawling, Integrity,
    // Wisdom) or shift for size and Spider-Sense, so only a value no ability explains is a doubt.
    const candidates = ABIL.map(x => score(x) + 10);
    const near = candidates.some(v => Math.abs(c.def - v) <= 3);
    if (!near) w.push(`${a} defense ${c.def} unexplained`);
    if (c.check < score(a)) w.push(`${a} check ${c.check} below score ${score(a)}`);
  });

  const big = trait('Big') ? 1 : trait('Small') ? -1 : 0;
  const run = 5 + Math.floor(Math.max(0, score('agility')) / 5) + big;
  if (p.speeds.run !== undefined && p.speeds.run !== run && !has('Speed Run')) w.push(`run ${p.speeds.run}, rules say ${run}`);
  (p.witness || []).forEach(x => w.push(x));

  const sturdy = tierOf(p, 'Sturdy');
  if (sturdy && Math.abs(p.healthDR || 0) !== sturdy && !has('Reinforced Skeleton')) w.push(`health DR ${p.healthDR}, Sturdy ${sturdy}`);
  const uncanny = tierOf(p, 'Uncanny');
  if (uncanny && Math.abs(p.focusDR || 0) !== uncanny) w.push(`focus DR ${p.focusDR}, Uncanny ${uncanny}`);

  p.powers.forEach(x => {
    const n = squash(x.name), base = squash(String(x.name).split(/[:(]/)[0]);
    if (!POWER_KEYS.has(n) && !POWER_KEYS.has(base)) w.push(`power? "${x.name}" [${x.set}]`);
  });
  [...p.traits, ...p.tags].forEach(l => {
    const base = squash(String(l).split(/[:(]/)[0]);
    if (!LABEL_KEYS.has(squash(l)) && !LABEL_KEYS.has(base)) w.push(`label? "${l}"`);
  });
  if (!p.powers.length && !/CIVILIAN/i.test(p.name)) w.push('no powers read');
  if (!p.history.length) w.push('no history read');
  if (!p.personality.length) w.push('no personality read');
  return w;
}

// ── run ──────────────────────────────────────────────────────────────────────
const out = [];
for (const pdf of Object.keys(boxes).map(Number).sort((a, b) => a - b)) {
  const b = boxes[pdf];
  const t = parseText(pdf, b);
  const abilities = {};
  ABIL.forEach(a => {
    const c = b.abil[a];
    abilities[a] = { score: num(c.score), def: num(c.def), check: dash(c.check) ? null : num(c.check) };
  });
  const damage = {};
  ['melee', 'agility', 'ego', 'logic'].forEach(a => {
    damage[a] = { mult: num(b.dmg[a].mult), ability: num(b.dmg[a].ability) };
  });
  const dr = c => { if (dash(c)) return 0; const v = num(c); return v == null ? null : -Math.abs(v); };
  let p = {
    pdf, page: pdf - 1, name: t.name, rank: num(b.rank),
    karma: dash(b.karma) ? null : num(b.karma),
    health: num(b.health), healthDR: dr(b.healthDR),
    focus: num(b.focus), focusDR: dr(b.focusDR),
    init: num(b.init), initEdge: /E\s*$/i.test(String(b.init[0] || '')),
    abilities, damage, speeds: t.speeds, bio: t.bio,
    traits: t.traits, tags: t.tags, powers: t.powers,
    history: t.history, personality: t.personality,
  };
  p.witness = witnessCheck(pdf, b, p);
  const ov = overrides[pdf] || {};
  const { confirmed = [], powerFix, ...fields } = ov;
  p = mergeDeep(p, fields);

  const unresolved = [];
  const label = x => (x.note ? x.name + (x.note.startsWith('(') ? ' ' : ': ') + x.note : x.name);
  const tr = resolveList(p.traits, CANON_LABEL), tg = resolveList(p.tags, CANON_LABEL);
  p.traits = tr.out.map(label); p.tags = tg.out.map(label);
  [...tr.bad, ...tg.bad].forEach(x => unresolved.push(`label? "${x}"`));
  const powers = [];
  p.powers.forEach(x => {
    const r = resolveAll(powerFix && powerFix[x.name] ? powerFix[x.name] : x.name, CANON_POWER);
    if (r) r.forEach(o => powers.push({ set: x.set, name: o.name, note: o.note }));
    else { powers.push(x); unresolved.push(`power? "${x.name}" [${x.set}]`); }
  });
  p.powers = powers;

  const doubts = checkProfile(p).filter(d => !/^(power|label)\?/.test(d)).concat(unresolved);
  p.doubts = doubts.filter(d => !confirmed.includes(d));
  p.confirmed = doubts.filter(d => confirmed.includes(d));
  (confirmed).filter(c => !doubts.includes(c)).forEach(c => p.doubts.push('stale override: ' + c));
  out.push(p);
}
// Where the whole-page pass also read a number in a box, the two must agree.
function witnessCheck(pdf, b, p) {
  const rows = loadRows(pdf), dx = b.dx || 0, dy = b.dy || 0, w = [];
  const at = (x0, y0, x1, y1) => {
    const hit = rows.filter(r => /^[-+]?\d+$/.test(r.t.trim())).filter(r => {
      const cx = (r.x0 + r.x1) / 2 - dx, cy = (r.y0 + r.y1) / 2 - dy;
      return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
    });
    return hit.length ? parseInt(hit[0].t, 10) : null;
  };
  const cmp = (label, val, seen) => { if (seen !== null && val !== null && seen !== val) w.push(`${label} box ${val}, page pass ${seen}`); };
  const ROW = [[778, 842], [870, 934], [962, 1026], [1055, 1119], [1147, 1211], [1240, 1304]];
  const DEF = [[792, 852], [884, 944], [976, 1036], [1068, 1128], [1160, 1220], [1252, 1312]];
  const DMG = [[1393, 1448], [1487, 1542], [1581, 1636], [1675, 1730]];
  cmp('rank', p.rank, at(565, 197, 665, 280));
  cmp('health', p.health, at(575, 322, 722, 378));
  cmp('focus', p.focus, at(575, 472, 722, 528));
  cmp('init', p.init, at(738, 636, 840, 692));
  ABIL.forEach((a, i) => {
    cmp(a + ' score', p.abilities[a].score, at(118, ROW[i][0], 192, ROW[i][1]));
    cmp(a + ' defense', p.abilities[a].def, at(232, DEF[i][0], 320, DEF[i][1]));
    cmp(a + ' check', p.abilities[a].check, at(360, DEF[i][0], 448, DEF[i][1]));
  });
  ['melee', 'agility', 'ego', 'logic'].forEach((a, i) => {
    cmp(a + ' mult', p.damage[a].mult, at(198, DMG[i][0], 272, DMG[i][1]));
    cmp(a + ' dmg ability', p.damage[a].ability, at(355, DMG[i][0], 432, DMG[i][1]));
  });
  return w;
}
function mergeDeep(a, b) {
  const r = Array.isArray(a) ? b : { ...a };
  if (Array.isArray(a)) return r;
  Object.keys(b).forEach(k => {
    r[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k]) ? mergeDeep(a[k], b[k]) : b[k];
  });
  return r;
}

fs.writeFileSync(path.join(bookDir, 'profiles.json'), JSON.stringify(out, null, 1));
console.log('confirmed against the scan:', out.reduce((n, p) => n + p.confirmed.length, 0), 'oddities on', out.filter(p => p.confirmed.length).length, 'pages');
const clean = out.filter(p => !p.doubts.length);
console.log(`${out.length} profiles; ${clean.length} with no doubts; ${out.length - clean.length} to check`);
const kinds = {};
out.forEach(p => p.doubts.forEach(d => { const k = d.replace(/["\d].*$/, '').trim().split(' ').slice(0, 2).join(' '); kinds[k] = (kinds[k] || 0) + 1; }));
console.log(Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(' | '));
out.filter(p => p.doubts.length).forEach(p => console.log(`p${p.page} ${p.name}: ${p.doubts.join('; ')}`));

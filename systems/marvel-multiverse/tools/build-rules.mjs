// tools/build-rules.mjs — generates ../powers.js and ../traits.js: what every power,
// trait and tag DOES.
//
// usage: node tools/build-rules.mjs .book <pack dir>      (writes powers.js and traits.js)
//
// The pack shipped power, trait and tag NAMES and nothing else, which is exactly as much
// as the official sheets give you: you read "Spider-Sense" and then you go and find the
// book. This builds the text that goes beside the name.
//
// WHERE EACH FIELD COMES FROM — PLAN.md §3A settled this and it is not a free choice:
//
//   powers  the Bullpen (.book/bullpen-all.json), because it was built against later
//           books and errata, so a disagreement with our scan is an update and the
//           Bullpen wins it. Its wording is also cleaner than OCR. The book supplies
//           what the Bullpen leaves blank: the printed page number, and nothing else
//           it is silent on.
//   traits  the book's own Chapter 5 text, because "rules outside the power rows come
//   tags    from the book unless an update is in hand" — and because the book prints
//           three paragraphs on Berserker where the Bullpen prints one line, which is
//           the whole point of putting the text on the sheet.
//
// Nothing here is editorial: every string is the source's, with OCR line wrapping undone.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { buildVocab, cleanParagraph, suspects } from './prose.mjs';

const [bookDir, outDir] = process.argv.slice(2);
if (!bookDir || !outDir) {
  console.error('usage: node tools/build-rules.mjs .book <pack dir>');
  process.exit(2);
}
const read = f => fs.readFileSync(path.join(bookDir, f), 'utf8');
const BP = JSON.parse(read('bullpen-all.json'));
const PARSED = JSON.parse(read('powers-parsed.json'));
const BOOK = read('book.txt').split('\n');

const problems = [];
const squash = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// ─── prose out of OCR ──────────────────────────────────────────────
// The same cleaner the character prose goes through (tools/prose.mjs): it undoes the
// line-end hyphens, puts back the spaces the scan lost between words, and reads the
// book's em dashes as em dashes. Joining the lines by hand instead left "realidentity"
// in Secret Identity and a hyphen wherever the book had a dash.
const vocab = buildVocab(path.join(bookDir, 'book.txt'), path.join(bookDir, 'words.txt'));
const here = path.dirname(fileURLToPath(import.meta.url));
const rawFixes = JSON.parse(fs.readFileSync(path.join(here, 'prose-fixes.json'), 'utf8'));
const fixes = { keep: new Set(rawFixes.keep), fixes: rawFixes.fixes };
const splits = [];
// An entry is one or more paragraphs; "Restriction:" is its own, as the book sets it.
const prose = paras => paras.map(lines => cleanParagraph(lines, vocab, fixes, splits))
  .filter(Boolean).join('\n\n');

// ─── the book's trait and tag entries ────────────────────────────────────────
// Chapter 5 prints both as a name on its own line followed by its paragraphs. The
// only other things in the band are page folios, the PDF markers our OCR added and
// the running head.
// A heading, found by the sentence under it: TRAITS, TAGS and POWERS each appear a
// dozen times in the OCR — in the contents, in the set lists and as a label on all 128
// profiles — so the word alone finds the wrong one.
function headingAt(word, opener) {
  for (let i = 0; i < BOOK.length; i++) {
    if (BOOK[i].trim() !== word) continue;
    const next = BOOK.slice(i + 1, i + 4).map(l => l.trim()).filter(Boolean)[0] || '';
    if (next.indexOf(opener) === 0) return i;
  }
  return -1;
}
function sectionLines(fromHeading, toHeading) {
  const a = headingAt(fromHeading[0], fromHeading[1]), b = headingAt(toHeading[0], toHeading[1]);
  if (a < 0 || b < 0 || b <= a) throw new Error('cannot find ' + fromHeading[0] + '..' + toHeading[0]);
  const out = [];
  // The heading sits part-way down a printed page, so the page it is on is the last
  // marker BEFORE it. Starting at null left every entry up to the first page break
  // with no page at all.
  let page = null;
  for (let i = a; i >= 0; i--) {
    const m = /^=== PDF (\d+) \/ book (\d+)/.exec(BOOK[i]);
    if (m) { page = +m[2]; break; }
  }
  for (let i = a + 1; i < b; i++) {
    const raw = BOOK[i];
    const m = /^=== PDF (\d+) \/ book (\d+)/.exec(raw);
    if (m) { page = +m[2]; continue; }
    const t = raw.trim();
    if (/^\d{1,3}$/.test(t)) continue;                 // page folio
    // The running head: "TRAITS", "16/BACKSTORIES", "2/COREMECHANICS". It lands in the
    // middle of a paragraph wherever the page turns, and it is the one thing in the band
    // that is set in capitals — "A.I." is the only entry name that is, and it is shorter
    // than any chapter title.
    if (!/[a-z]/.test(t) && (t.indexOf('/') >= 0 || t.replace(/[^A-Z]/g, '').length >= 6)) continue;
    if (/^Art by /.test(t)) continue;
    out.push({ t, page, blank: !t });
  }
  return out;
}

// A heading, as against a line of the paragraph above it: short, starts with a capital,
// ends without sentence punctuation, and is followed by a sentence.
function looksLikeHeading(line, next) {
  const t = line.t;
  if (!t || t.length > 58) return false;
  if (!/^[A-Z(]/.test(t)) return false;
  if (/[.,;:!?]$/.test(t) && !/^[A-Z][a-z]*\.?$/.test(t)) return false;
  if (/^(Restriction|Example|Examples|Tags|Traits|Powers|Prerequisite|Prerequisites)\b/.test(t)) return false;
  // A heading is a label, not a clause: no verbs to speak of and few words.
  if (t.split(/\s+/).length > 7) return false;
  if (!next || !next.t) return false;
  return /^[A-Z"(]/.test(next.t);
}

function parseEntries(fromHeading, toHeading, known) {
  const lines = sectionLines(fromHeading, toHeading);
  const out = {};
  let cur = null, paras = [];
  const lastLine = () => {
    for (let i = paras.length - 1; i >= 0; i--) {
      const p = paras[i];
      if (p.length) return p[p.length - 1];
    }
    return '';
  };
  const add = t => {
    if (!paras.length) paras.push([]);
    paras[paras.length - 1].push(t);
  };
  const flush = () => {
    if (!cur) return;
    const effect = prose(paras.filter(p => p.length));
    if (effect) out[cur.name] = { effect, page: cur.page };
    cur = null; paras = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // A paragraph break, unless the line before it was plainly mid-sentence: the scan
    // leaves a blank line wherever a page turns, and Tech Reliance turns one mid-clause.
    if (l.blank) {
      if (cur && /[.!?)"]$/.test(lastLine()) && paras.length && paras[paras.length - 1].length) paras.push([]);
      continue;
    }
    const next = lines.slice(i + 1).find(x => !x.blank);
    // A name the source list already knows is a heading whatever it looks like;
    // that is what keeps "A.I." and "X-Gene" from being read as prose.
    const isKnown = known.has(squash(l.t));
    const started = paras.some(p => p.length);
    if (isKnown || (!cur && looksLikeHeading(l, next)) || (cur && started && looksLikeHeading(l, next))) {
      // ...unless the paragraph it would end is plainly mid-sentence.
      const prev = lastLine();
      if (!isKnown && prev && !/[.!?)"]$/.test(prev)) { add(l.t); continue; }
      flush();
      cur = { name: l.t, page: l.page };
      continue;
    }
    if (!cur) continue;
    // The book sets a restriction as its own paragraph, and it reads as one.
    if (/^Restriction:/.test(l.t) && paras.length && paras[paras.length - 1].length) paras.push([]);
    add(l.t);
  }
  flush();
  return out;
}

const bpTraits = new Set(Object.keys(BP.traitsData).map(squash));
const bpTags = new Set(Object.keys(BP.tagsData).map(squash));
// A trait like "Anathema: Lightning/Anti-Venom" is a Bullpen row for one character's
// version of the book's "Anathema", so the base name is what the book prints.
const baseOf = n => String(n).split(':')[0].trim();
[...Object.keys(BP.traitsData)].forEach(n => bpTraits.add(squash(baseOf(n))));
[...Object.keys(BP.tagsData)].forEach(n => bpTags.add(squash(baseOf(n))));

const TRAITS_HEAD = ['TRAITS', 'A trait is a label'];
const TAGS_HEAD = ['TAGS', 'A tag is a label'];
const POWERS_HEAD = ['POWERS', 'POWERS ARE WHAT MAKE'];
const traits = parseEntries(TRAITS_HEAD, TAGS_HEAD, bpTraits);
const tags = parseEntries(TAGS_HEAD, POWERS_HEAD, bpTags);

// ─── the note a name carries ─────────────────────────────────────────────────
// "Connections: Espionage" is the trait Connections with a note. The Bullpen's `map`
// table is where the suggestions for those notes live.
const HINT = {};
Object.keys(BP.map || {}).forEach(k => { HINT[k] = BP.map[k]; });

// ─── powers ──────────────────────────────────────────────────────────────────
// The printed page, from our own scan. Matched on the squashed name as well as the
// exact one: the parser recorded which Bullpen row each entry matched, but a handful
// differ in punctuation or spacing and those rows were being marked as expansions.
const pageOf = {};
PARSED.forEach(e => {
  if (!e.page) return;
  if (e.bullpen) pageOf[e.bullpen] = e.page;
  if (e.name) pageOf['~' + squash(e.name)] = e.page;
});
// A numbered power the Bullpen split from an unnumbered entry — the book prints
// "Mighty", the Bullpen calls it "Mighty 1" — is on the page of the entry it came from.
const powerPage = name => pageOf[name] || pageOf['~' + squash(name)]
  || pageOf['~' + squash(String(name).replace(/\s*\d+$/, ''))] || null;

// Whether the Core Rulebook prints this name at all, for the rows our Chapter 7 parse
// did not reach. Claiming "expansion?" for a power that is plainly in the book — the
// whole Luck set was being marked that way — is worse than admitting we lost the page.
const bookNames = new Set();
BOOK.forEach(l => { const t = l.trim(); if (t && t.length < 50) bookNames.add(squash(t)); });
const inTheBook = name => bookNames.has(squash(name))
  || bookNames.has(squash(String(name).replace(/\s*\d+$/, '')));

const powers = {};
Object.keys(BP.powersData).forEach(name => {
  const b = BP.powersData[name];
  const row = {};
  const set = String(b.set || '').trim();
  if (set) row.set = set;
  ['action', 'duration', 'cost', 'range', 'trigger'].forEach(k => {
    const v = String(b[k] === undefined || b[k] === null ? '' : b[k]).trim();
    if (v && !/^(none|n\/a|-|—)$/i.test(v)) row[k] = v;
  });
  const rank = BP.powerRankReqs ? BP.powerRankReqs[name] : null;
  if (rank && rank > 1) row.rank = rank;
  const pre = (BP.powerPrereqs && BP.powerPrereqs[name]) || [];
  if (pre.length) row.prereqs = pre.slice();
  row.effect = String(b.effect || '').replace(/\s+/g, ' ').trim();
  if (!row.effect) problems.push('power with no effect text: ' + name);
  const pg = powerPage(name);
  if (pg) row.page = pg;
  else if (!inTheBook(name)) row.source = 'expansion?';   // the Bullpen has it; this book does not
  powers[name] = row;
});

// ─── set names as the profiles print them ────────────────────────────────────
// Chapter 8 prints the set above each power list, and the OCR of those headings has
// its own spellings: MARTIALARTS, SUPER-STRENGTHS, "MAGIC (SORCERY SET)". The sheet
// groups powers by that string, so it needs the printed name of the set.
const SET_FIX = {
  'Martialarts': 'Martial Arts',
  'Omniversal Travels': 'Omniversal Travel',
  'Super-Strengths': 'Super-Strength',
  'Basic': 'Basic Powers',
};

// ─── writing it out ──────────────────────────────────────────────────────────
// One row per line: a 200KB object pretty-printed is unreadable either way, and one
// line per name is greppable and diffs cleanly when a row is corrected.
function emit(name, obj, comment) {
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  let s = comment + '\nconst ' + name + ' = {\n';
  s += keys.map(k => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(obj[k]) + ',').join('\n');
  return s + '\n};\n';
}

const counts = { powers: Object.keys(powers).length, traits: Object.keys(traits).length, tags: Object.keys(tags).length };
if (counts.powers < 380) problems.push('only ' + counts.powers + ' powers');
// Counted off the scan: Chapter 5 prints 57 traits and 48 tags. The Bullpen has more
// because it was built with later books; the extras are not in this book and are not
// invented here.
if (counts.traits !== 57) problems.push(counts.traits + ' traits, expected 57');
if (counts.tags !== 48) problems.push(counts.tags + ' tags, expected 48');
// Both lists are printed alphabetically, so a line of prose misread as a heading shows
// up as a name out of order — which is the one parser failure the counts can hide.
[['traits', traits], ['tags', tags]].forEach(([what, table]) => {
  const names = Object.keys(table);
  const sorted = names.slice().sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const bad = names.filter((n, i) => n !== sorted[i]);
  if (bad.length) problems.push(what + ' out of the book\'s alphabetical order: ' + JSON.stringify(bad.slice(0, 6)));
  names.forEach(n => {
    const e = table[n].effect;
    if (e.length < 40) problems.push(what + ' entry too short to be the whole rule: ' + n + ' -> ' + e);
    if (!/^[A-Z"(]/.test(e)) problems.push(what + ' entry starts mid-sentence: ' + n + ' -> ' + e.slice(0, 50));
    if (!table[n].page) problems.push(what + ' entry with no page: ' + n);
    // The OCR artefacts that were found by reading the generated text: a lost space
    // after a digit, a hyphen standing in for an em dash, a doubled full stop. Each one
    // is fixed in tools/prose-fixes.json or in prose.mjs, and this is what stops the
    // next regeneration from quietly putting them back.
    const art = /[a-z0-9]\.[A-Z][a-z]|\.\. |[a-z]{3,}- [a-z]|[a-z]{3,}-(?:is|are|was|were)\b|[a-z]{4,}-\d\b/.exec(e);
    if (art) problems.push(what + ' entry still reads as OCR: ' + n + ' -> ' + JSON.stringify(art[0]));
  });
});

// Every name a character out of the book actually carries has to resolve, or the sheet
// is back to showing a bare label. The resolver in sheet.js is the same shape as this.
const ours = fs.readFileSync(path.join(outDir, 'profiles.js'), 'utf8');
const PROFILES = JSON.parse(ours.slice(ours.indexOf('[', ours.indexOf('MMR_PROFILES')), ours.lastIndexOf(']') + 1)
  .replace(/,(\s*[\]}])/g, '$1'));
// The same peeling as mmrRuleFor() in sheet.js: bracket groups come off one at a time
// (Surprising Power (2) (Grand Illusion, Mirror Images) has two), then a colon comes off
// what is left, then a trailing number. If the two ever disagree this report lies.
function resolvable(name, table) {
  const cands = [];
  const push = k => { const t = String(k || '').trim().replace(/[([]+$/, '').trim(); if (t) cands.push(t); };
  let n = String(name).trim();
  push(n);
  let peeled = n;
  for (let i = 0; i < 4; i++) {
    const m = /^(.*?)\s*[([]\s*([^()[\]]*?)\s*[)\]]?\s*$/.exec(peeled);
    if (!m || !m[1] || m[1] === peeled) break;
    peeled = m[1].trim();
    push(peeled);
  }
  cands.slice().forEach(c => { if (c.indexOf(':') > 0) push(c.split(':')[0]); });
  push(n.replace(/\s*\d+$/, ''));
  return cands.some(c => table[c]);
}
const unresolved = { powers: new Set(), traits: new Set(), tags: new Set() };
PROFILES.forEach(p => {
  (p.powers || []).forEach(x => { if (!resolvable(x.name, powers)) unresolved.powers.add(x.name); });
  (p.traits || []).forEach(t => { if (!resolvable(t, traits)) unresolved.traits.add(t); });
  (p.tags || []).forEach(t => { if (!resolvable(t, tags)) unresolved.tags.add(t); });
});

const BANNER = `//
// GENERATED by tools/build-rules.mjs. Do not edit: regenerate with
//   node tools/build-rules.mjs .book .
// Corrections to the OCR go in tools/prose-fixes.json, never here.
//
// This is the READING half of PLAN.md M1: what each row does, in the words of the
// source, so the sheet can show a rule beside a name. The structured half — focus as
// a number, actions as flags, inferred rolls, reqTags — is still M1's to add, and it
// belongs beside these rows rather than in place of them.
//
// Powers are the Bullpen's, which PLAN.md §3A settles as newer than our scan, with the
// printed page added from it. Traits and tags are the Core Rulebook's own Chapter 5
// text, read off the OCR and rewrapped by tools/prose.mjs.
//
// A profile carries a name with the character's own particulars attached — "Animal
// Communication (Bugs)", "Connections: Military (Dora Milaje)" — so the lookup is
// mmrRuleFor() in sheet.js, never a bare index.
`;

const powersFile = `// systems/marvel-multiverse/powers.js - what a power DOES. ${counts.powers} of them.
${BANNER}`
  + emit('MMR_POWER_RULES', powers,
    '\n// set, action, duration, cost, range, trigger, rank, prereqs, effect, page.\n'
    + '// source:"expansion?" means the Bullpen has it and this book does not print it.')
  + '\n// The printed set headings in Chapter 8, as the OCR read them, mapped to the real\n'
  + '// name. mmrSetLabel() is what applies them.\n'
  + 'const MMR_SET_FIX = ' + JSON.stringify(SET_FIX, null, 2) + ';\n';

const traitsFile = `// systems/marvel-multiverse/traits.js - what a trait or tag DOES.
// ${counts.traits} traits and ${counts.tags} tags, which is all the Core Rulebook prints.
// The Bullpen knows more of both; those come from later books and are not invented here.
${BANNER}`
  + emit('MMR_TRAIT_RULES', traits, '')
  + emit('MMR_TAG_RULES', tags, '')
  + emit('MMR_NOTE_HINTS', HINT,
    '\n// What the particulars on a trait or tag tend to be, for the ones that take them.');

if (problems.length) {
  console.error('REFUSING TO WRITE:');
  problems.forEach(p => console.error('  - ' + p));
  if (process.env.MMR_DEBUG) {
    console.error('traits: ' + JSON.stringify(Object.keys(traits)));
    console.error('tags: ' + JSON.stringify(Object.keys(tags)));
    const miss = (bp, got) => Object.keys(bp).filter(n => !got[n] && !got[baseOf(n)]);
    console.error('bullpen traits not found: ' + JSON.stringify(miss(BP.traitsData, traits)));
    console.error('bullpen tags not found: ' + JSON.stringify(miss(BP.tagsData, tags)));
  }
  process.exit(1);
}
fs.writeFileSync(path.join(outDir, 'powers.js'), powersFile, 'utf8');
fs.writeFileSync(path.join(outDir, 'traits.js'), traitsFile, 'utf8');
console.log('wrote powers.js and traits.js: ' + JSON.stringify(counts));
['powers', 'traits', 'tags'].forEach(k => {
  const u = [...unresolved[k]];
  if (u.length) console.log('  ' + u.length + ' ' + k + ' on a profile that resolve to nothing: ' + JSON.stringify(u.slice(0, 12)));
  else console.log('  every ' + k + ' name on all 128 profiles resolves');
});

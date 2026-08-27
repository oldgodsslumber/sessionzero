// Realtime Database rules: structural invariants, and doc/file agreement.
//
// These rules are the only thing keeping GM secrets off players' machines, and
// they live in two places a human might edit — database.rules.json and the
// quoted block in MULTIPLAYER.md. This suite fails if they drift, and if the
// invariants that make the GM boundary work are ever relaxed.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const fails = [], ok = [];
function check(name, fn) {
  try {
    const r = fn();
    if (r === false) fails.push(name + ' -> false');
    else if (typeof r === 'string') fails.push(name + ' -> ' + r);
    else ok.push(name);
  } catch (e) { fails.push(name + ' -> ' + e.message); }
}

const raw = fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8');
const md = fs.readFileSync(path.join(ROOT, 'MULTIPLAYER.md'), 'utf8');

// Rules files are JSONC: strip whole-line // comments before parsing.
const strip = s => s.replace(/^\s*\/\/.*$/gm, '');
const rules = JSON.parse(strip(raw)).rules;
const code = rules.universes.$code;

// ── the doc must quote the file exactly ─────────────────────────────────────
check('MULTIPLAYER.md quotes the rules file verbatim', () => {
  const i = md.indexOf('```jsonc');
  if (i < 0) return 'no jsonc block in MULTIPLAYER.md';
  const body = md.slice(md.indexOf('\n', i) + 1);
  const quoted = body.slice(0, body.indexOf('```')).replace(/\n+$/, '');
  // the file adds a deploy-instructions header the doc does not carry
  const fileBody = strip(raw).trim().length ? raw.slice(raw.indexOf('{')).replace(/\n+$/, '') : '';
  return quoted === fileBody ||
    'the doc and database.rules.json have drifted — regenerate one from the other';
});

// ── the invariants that make the GM boundary real ───────────────────────────
check('no .read at the world node, or loreGM leaks to every player', () =>
  !('.read' in code) || 'a .read at $code cascades and exposes loreGM');
check('loreGM read is restricted to the GM', () =>
  /gmUid/.test(code.loreGM['.read']) || 'loreGM is readable by someone other than the GM');
check('loreGM write is restricted to the GM', () =>
  /gmUid/.test(code.loreGM['.write']));
check('every rule requires authentication', () => {
  const bad = [];
  (function walk(node, at) {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (k === '.read' || k === '.write') {
        if (!/auth\s*!=\s*null/.test(v)) bad.push(at + '/' + k);
      } else if (v && typeof v === 'object') walk(v, at + '/' + k);
    }
  })(rules, '');
  return bad.length ? 'unauthenticated access at: ' + bad.join(', ') : true;
});
check('meta is readable pre-join, so the join flow can find a world', () =>
  !!code.meta['.read']);
check('systemId is write-once', () => {
  const v = code.meta.systemId['.validate'];
  return /!data\.exists\(\)/.test(v) && /data\.val\(\)\s*===\s*newData\.val\(\)/.test(v);
});
check('collaborative subtrees are gated on membership', () => {
  const shared = ['roster', 'lore', 'conflict', 'regions', 'rolls', 'notes'];
  const bad = shared.filter(k => !code[k] ||
    !/members'\)\.child\(auth\.uid\)\.exists\(\)/.test(code[k]['.read'] || ''));
  return bad.length ? 'not membership-gated: ' + bad.join(', ') : true;
});
check('a hero sheet is writable only by its owner or the GM', () =>
  /auth\.uid === \$uid/.test(code.heroes.$uid['.write']) && /gmUid/.test(code.heroes.$uid['.write']));
check('a user can only read their own row under /users', () =>
  /auth\.uid === \$uid/.test(rules.users.$uid['.read']));

console.log('\nPASS ' + ok.length);
if (fails.length) { console.log('FAIL ' + fails.length); fails.forEach(f => console.log('  x ' + f)); process.exit(1); }
console.log('All database rules checks passed.');

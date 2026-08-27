// The focus bug, fenced off.
//
// Every version of this project has shipped the same defect at least once: an
// `oninput` handler repaints the markup containing the very <input> being typed
// into, so the browser destroys the focused element and the caret is lost after
// a single keystroke. It is invisible in code review and obvious the moment a
// player tries to type.
//
// This is a source-level check rather than a rendering one, because the rule is
// about how a handler is WRITTEN. There are exactly two acceptable shapes:
//
//   1. Repaint only the part that is not the input — a results list, a derived
//      total. The input is never replaced, so nothing needs restoring.
//   2. Repaint the lot and put the caret back, passing the offset read off the
//      old element: _refocus('the-id', this.selectionStart).
//
// Anything else fails here.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// Renderers that only ever rebuild a results list, never the search box above
// it. Splitting a renderer in two like this is the preferred fix; each entry is
// a deliberate exemption, so a new name may only be added alongside a reading
// of the function proving the input is outside what it touches.
const LIST_ONLY = ['renderStuntList', 'renderPBList'];

const fails = [], ok = [];
function check(name, fn) {
  try {
    const r = fn();
    if (r === false) fails.push(name + ' -> false');
    else if (typeof r === 'string') fails.push(name + ' -> ' + r);
    else ok.push(name);
  } catch (e) { fails.push(name + ' -> ' + e.message); }
}

function sources() {
  const out = [];
  for (const dir of ['core', 'systems']) {
    (function walk(d) {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) walk(p);
        else if (f.name.endsWith('.js')) out.push(p);
      }
    })(path.join(ROOT, dir));
  }
  return out;
}

const REPAINTS = /\b(render[A-Z]\w*|\w*[Rr]epaint\w*)\s*\(/g;
const handlers = [];
for (const file of sources()) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const re = /oninput="([^"]*)"/g;
    let m;
    while ((m = re.exec(line))) {
      handlers.push({ file: path.relative(ROOT, file).split(path.sep).join('/'), line: i + 1, body: m[1] });
    }
  });
}

check('there are oninput handlers to check at all', () =>
  handlers.length > 0 || 'found none — the scan is broken, not the code');

check('no oninput handler repaints its own input without restoring the caret', () => {
  const bad = [];
  for (const h of handlers) {
    REPAINTS.lastIndex = 0;
    const called = [];
    let m;
    while ((m = REPAINTS.exec(h.body))) called.push(m[1]);
    if (!called.length) continue;                       // stores only: always safe
    if (called.every(n => LIST_ONLY.includes(n))) continue;
    if (/_refocus\s*\(/.test(h.body)) continue;
    bad.push(h.file + ':' + h.line + ' calls ' + called.join(', '));
  }
  return bad.length ? bad.join(' | ') : true;
});

check('every _refocus passes the caret offset, so it does not jump to the end', () => {
  const bad = [];
  for (const h of handlers) {
    const re = /_refocus\s*\(([^)]*)\)/g;
    let m;
    while ((m = re.exec(h.body))) {
      if (!/this\.selectionStart/.test(m[1])) bad.push(h.file + ':' + h.line + ' -> _refocus(' + m[1] + ')');
    }
  }
  return bad.length ? bad.join(' | ') : true;
});

check('_refocus itself honours the offset it is given', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/creation.js'), 'utf8');
  const m = /function _refocus\(([^)]*)\)\{([\s\S]*?)\n/.exec(src);
  if (!m) return '_refocus not found';
  if (!/pos/.test(m[1])) return '_refocus takes no caret argument';
  return /setSelectionRange\(at,\s*at\)/.test(m[2]) || 'the offset is not applied';
});

// The other half of the same bug: a value handler must not rebuild its block.
check('traitSet updates the derived readouts in place rather than repainting', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core/blocks.js'), 'utf8');
  const m = /function traitSet\(([\s\S]*?)\n}/.exec(src);
  if (!m) return 'traitSet not found';
  return !/blockRepaint\(blockId\)/.test(m[0]) || 'traitSet repaints its own block';
});

if (fails.length) {
  console.log('FAIL ' + fails.length);
  fails.forEach(f => console.log('  x ' + f));
  process.exit(1);
}
console.log('PASS ' + ok.length);
console.log('All focus-discipline checks passed.');

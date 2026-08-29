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
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadAppHTML, waitReady } = require('./loadapp');

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

// ── the markup a player actually clicks ─────────────────────────────────────
// Everything above reads source. This part renders the real screens and asks
// the HTML parser what it made of them, because the worst bug this app has
// shipped was invisible to every source-level check: JSON.stringify('race')
// emits its own double quotes, so `onclick="f(' + JSON.stringify(kind) + ')"`
// terminated the attribute early. The markup still parsed, nothing threw, and
// the entire custom Race/Class feature was simply inert. Tests that called the
// handlers as functions all passed.
function sweep(win, label) {
  const bad = [];
  win.document.querySelectorAll('*').forEach(el => {
    for (const a of el.attributes) {
      // An attribute NAME containing a quote or bracket is parser wreckage: it
      // means a preceding attribute value was terminated where we did not mean
      // it to be.
      if (/["'()]/.test(a.name)) bad.push(label + ': junk attribute ' + JSON.stringify(a.name).slice(0, 48));
      // A handler body that is not parseable JavaScript is a dead button.
      else if (/^on/.test(a.name)) {
        try { new Function(a.value); }
        catch (e) { bad.push(label + ': <' + el.tagName.toLowerCase() + ' ' + a.name + '> is not valid JS: ' + JSON.stringify(a.value).slice(0, 48)); }
      }
    }
  });
  return bad;
}

(async () => {
  for (const entry of ['dcc/index.html', 'daring-comics/index.html']) {
    const vc = new VirtualConsole();
    const dom = new JSDOM(loadAppHTML(entry), {
      runScripts: 'dangerously', pretendToBeVisual: true,
      url: 'http://localhost/' + entry, virtualConsole: vc,
    });
    const w = dom.window;
    w.alert = () => {}; w.confirm = () => true;
    await waitReady(w);
    const game = entry.split('/')[0];

    // The first-run gate, which is the very first markup a new player meets.
    check('[' + game + '] the first-run universe gate is well formed', () => {
      const bad = sweep(w, 'gate');
      return bad.length ? bad.join(' | ') : true;
    });
    check('[' + game + '] a new player can get through the first-run gate', () => {
      const nm = w.document.getElementById('uni-name');
      if (!nm) return 'no name field in the gate';
      nm.value = 'Test World';
      // Satisfy whatever the pack asks for, by clicking what it actually drew.
      w.document.querySelectorAll('#universe-modal-body .game-opt').forEach(o => o.click());
      w.document.getElementById('uni-name').value = 'Test World';
      w.eval("submitUniverseSetup('')");
      return w.eval('loadUniverses().universes.length') === 1
        || 'the gate could not be satisfied — the app cannot be started';
    });

    // ── does the button actually WORK? ───────────────────────────────────
    // The two guards above ask whether a handler exists and whether its
    // attribute parses. Both pass for a handler that throws the moment it is
    // called, which is exactly how a dead "Full Builder" button shipped: the
    // function was defined, the markup was clean, and clicking it raised
    // "SKILLS is not defined" into the console and did nothing visible.
    //
    // So: press things. State is snapshotted and restored around each press,
    // and the tab is redrawn, so one handler cannot poison the next.
    const pressAll = (tabName) => {
      const broken = [];
      let seen;
      try { seen = w.eval('JSON.stringify(S)'); } catch (e) { return broken; }
      const exprs = w.eval(`(function(){
        var out=[], done={};
        document.querySelectorAll('#page-' + ${JSON.stringify(tabName)} + ' [onclick]').forEach(function(el){
          var h=(el.getAttribute('onclick')||'').trim();
          if(!h||done[h])return; done[h]=1; out.push(h);
        });
        return JSON.stringify(out);
      })()`);
      JSON.parse(exprs).forEach(expr => {
        // Skip anything that leaves the page or opens a print window.
        if (/print|export|location|open\s*\(/i.test(expr)) return;
        try {
          w.eval('S=JSON.parse(' + JSON.stringify(seen) + ');');
          w.eval('showTab(' + JSON.stringify(tabName) + ')');
          w.eval(expr);
        } catch (e) {
          broken.push(expr.slice(0, 46) + ' -> ' + e.message);
        }
      });
      try { w.eval('S=JSON.parse(' + JSON.stringify(seen) + ');'); } catch (e) {}
      return broken;
    };

    // Every creation screen, then the finished sheet, then every tab.
    // Only a block pack builds its character through SYS; Daring Comics has its
    // own creation flow and no newCharacter().
    const packMakesChars = w.eval('typeof SYS.newCharacter === "function"');
    if (packMakesChars) {
      w.eval('S.char = SYS.newCharacter(); S.char.creation = {step:0, complete:false}; renderHero();');
    }
    const screens = packMakesChars ? w.eval('SYS.creation ? SYS.creation.length : 0') : 0;
    for (let i = 0; i < screens; i++) {
      w.eval('S.char.creation.step=' + i + '; renderHero();');
      check('[' + game + '] creation screen ' + (i + 1) + ' is well formed', () => {
        const bad = sweep(w, 'screen ' + (i + 1));
        return bad.length ? bad.join(' | ') : true;
      });
    }
    if (packMakesChars) w.eval('S.char.creation = {step:0, complete:true}; renderHero();');
    // The nav buttons carry no data-tab: they are id="nb-<tab>" with an onclick.
    // Reading the wrong attribute made this list empty, so the sweep below has
    // only ever covered the fallback tab — which is how a dead button on the
    // NPC tab went unnoticed.
    // The nav buttons carry no data-tab: they are id="nb-<tab>" with an onclick.
    // Reading the wrong attribute made this list empty, so the sweep below has
    // only ever covered the fallback tab — which is how a dead button on the
    // NPC tab went unnoticed.
    const tabs = w.eval("[].slice.call(document.querySelectorAll('#nav .nb'))" +
      ".map(function(n){ return String(n.id||'').replace(/^nb-/,'') })" +
      // Not every nav button opens a page — the HUD pops out its own window.
      ".filter(function(id){ return id && document.getElementById('page-'+id) })");
    for (const tab of (tabs && tabs.length ? tabs : ['hero'])) {
      check('[' + game + '] the ' + tab + ' tab is well formed', () => {
        try { w.eval('showTab(' + JSON.stringify(tab) + ')'); } catch (e) { return 'showTab threw: ' + e.message; }
        const bad = sweep(w, tab);
        return bad.length ? bad.join(' | ') : true;
      });
      check('[' + game + '] every control on the ' + tab + ' tab does something', () => {
        const broken = pressAll(tab);
        return broken.length ? broken.join(' | ') : true;
      });
    }
  }

  if (fails.length) {
    console.log('FAIL ' + fails.length);
    fails.forEach(f => console.log('  x ' + f));
    process.exit(1);
  }
  console.log('PASS ' + ok.length);
  console.log('All focus and markup checks passed.');
})().catch(e => {
  console.log('FAIL 1');
  console.log('  x driver crashed: ' + e.message);
  console.log(e.stack);
  process.exit(1);
});


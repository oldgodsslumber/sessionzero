// Desktop layout: the phone stack comes apart into columns, and only there.
//
// Every column in this app is declared by bucketing cards into wrapper divs and
// letting CSS turn the wrappers into a grid above 1100px. Below that width the
// wrappers are display:contents, so they vanish and the cards flow in DOM
// order. That is the whole trick, and it has one failure mode worth fencing
// off: a bucket that reorders its cards silently changes the PHONE, where the
// wrappers do not exist to explain it. So this suite checks both halves — that
// the buckets are there, and that what is in them is still in the order a phone
// would print it.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadAppHTML, waitReady } = require('./loadapp');

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

// A minimal stylesheet reader: JSDOM ignores @media, so the widths are read
// here. Same reason as test/dice.js, kept small because all this suite asks of
// a rule is which media block it is in.
function rulesOf(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  (function walk(src, media) {
    let i = 0;
    while (i < src.length) {
      const brace = src.indexOf('{', i);
      if (brace < 0) break;
      const head = src.slice(i, brace).trim();
      let depth = 1, j = brace + 1;
      while (j < src.length && depth > 0) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        j++;
      }
      const body = src.slice(brace + 1, j - 1);
      if (head.startsWith('@media')) walk(body, head.slice(6).trim());
      else if (!head.startsWith('@')) out.push({ sel: head, decl: body, media: media || '' });
      i = j;
    }
  })(css, '');
  return out;
}
const RULES = rulesOf(fs.readFileSync(path.join(ROOT, 'core/shell.css'), 'utf8'));
const minWidth = r => Number((/min-width\s*:\s*(\d+)px/.exec(r.media) || [0, 0])[1]);
const declaring = (selPart, declPart) =>
  RULES.filter(r => r.sel.split(',').some(s => s.trim().includes(selPart))
                 && r.decl.includes(declPart));

async function boot(entry, setup) {
  const vc = new VirtualConsole();
  const dom = new JSDOM(loadAppHTML(entry), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'http://localhost/' + entry, virtualConsole: vc,
  });
  const w = dom.window;
  w.alert = () => {}; w.confirm = () => true; w.prompt = () => 'X';
  await waitReady(w);
  const ev = s => w.eval(s);
  // A universe has to be current, not merely to exist: the wiki belongs to one
  // and draws its "no universe yet" card otherwise.
  ev("loadUniverses();var _u=U.universes[0]||createUniverse('T');S.universeId=_u.id;save();renderHero();");
  ev(setup);
  return { w, ev, doc: w.document };
}

const DC_SETUP =
  "S.creation.costumedName='T';S.creation.aspects.concept='a';" +
  "S.creation.aspects.motivation='b';S.series.experience=(EXP_LEVELS[0]||{}).id;" +
  "S.creation.skills={Accuracy:3};finishCreation();renderHero();";
const DCC_SETUP =
  "S.char.creation=S.char.creation||{};dccFinishCreation(S.char);" +
  "S.char.creation.complete=true;save();renderHero();";

// The heading of every card in a container, in DOM order — which IS the phone,
// because DOM order is all display:contents leaves behind.
const labelsIn = (doc, sel) =>
  [].slice.call(doc.querySelectorAll(sel + ' .label, ' + sel + ' .blk-title'))
    .map(e => (e.textContent || '').trim().split(/\s{2,}|\n/)[0]);

(async () => {
  // ── the stylesheet: columns exist, and only above 1100px ──────────────────
  check('[css] the reader finds the desktop media block at all', () =>
    RULES.some(r => minWidth(r) === 1100)
    || 'no min-width:1100px rules — the reader is broken, not the app');

  ['.blk-sheet', '.sheet-grid', '.wiki-grid', '.map-split', '.conflict-grid', '.hud-grid'].forEach(sel => {
    check('[css] ' + sel + ' becomes a grid, and does so only on a desktop', () => {
      const grid = declaring(sel, 'display:grid');
      if (!grid.length) return 'nothing turns ' + sel + ' into a grid';
      const early = grid.filter(r => minWidth(r) < 1100);
      return early.length ? sel + ' is a grid below 1100px — that is the phone' : true;
    });
  });

  check('[css] the buckets are display:contents on a phone, so they leave no trace', () => {
    const r = RULES.find(x => !x.media && /\.sheet-col/.test(x.sel) && /display:contents/.test(x.decl));
    if (!r) return 'no unconditional display:contents rule for the column buckets';
    return ['.conflict-col', '.wiki-col'].every(s => r.sel.includes(s))
      || 'a bucket class is missing from the display:contents rule: ' + r.sel;
  });

  check('[css] the frame stops mirroring the phone above 1100px', () => {
    const r = RULES.filter(x => x.sel.trim() === 'body' && minWidth(x) >= 1100 && /max-width/.test(x.decl));
    return r.length ? true : 'body is still capped at its 700px width on a desktop';
  });

  check('[css] a declared span means something, and only above 1100px', () => {
    const spans = RULES.filter(r => /\[data-span/.test(r.sel));
    if (!spans.length) return 'no data-span rules — a declared span would do nothing';
    return spans.every(r => minWidth(r) >= 1100) || 'a span rule fires at phone width';
  });

  // ── Daring Comics: the hand-written sheet ────────────────────────────────
  {
    const { doc, ev, w } = await boot('daring-comics/index.html', DC_SETUP);
    const P = '[dc] ';

    check(P + 'the sheet is bucketed into exactly two columns', () => {
      const grids = doc.querySelectorAll('#hero-sheet .sheet-grid');
      if (grids.length !== 1) return 'expected 1 .sheet-grid, found ' + grids.length;
      const kids = [].slice.call(grids[0].children);
      if (kids.length !== 2) return 'expected 2 buckets, found ' + kids.length;
      return kids.every(k => k.classList.contains('sheet-col'))
        || 'a card is loose in the grid instead of inside a column';
    });

    check(P + 'the phone still reads Fate, Aspects, Stress, Consequences, Skills, then Forms', () => {
      const seen = labelsIn(doc, '#hero-sheet .sheet-grid');
      const want = ['Fate Points', 'Aspects', 'Stress', 'Consequences', 'Skills', 'Forms'];
      let at = -1;
      for (const label of want) {
        const i = seen.findIndex((s, n) => n > at && s.indexOf(label) === 0);
        if (i < 0) return 'the sheet no longer shows ' + label + ' in order — saw ' + seen.join(', ');
        at = i;
      }
      return true;
    });

    check(P + 'the right column is the working half: Forms, not Fate Points', () => {
      const cols = doc.querySelectorAll('#hero-sheet .sheet-col');
      return (/Forms/.test(cols[1].textContent) && !/Fate Points/.test(cols[1].textContent))
        || 'the buckets have drifted away from what they are for';
    });

    check(P + 'the wiki splits into a filter rail and a list of entries', () => {
      ev("showTab('wiki')");
      const grid = doc.querySelector('#wiki-content .wiki-grid');
      if (!grid) return 'no .wiki-grid on the wiki page';
      const kids = [].slice.call(grid.children);
      if (kids.length !== 2) return 'expected 2 buckets, found ' + kids.length;
      return (kids[0].classList.contains('wiki-side') && kids[1].classList.contains('wiki-list'))
        || 'the wiki buckets are not [side, list]';
    });

    check(P + 'a filed entry lands in the list, not in the rail', () => {
      ev("upsertLore({name:'Harrow Bay',type:'place',body:'A town.'});showTab('wiki');renderWiki();");
      const list = doc.querySelector('#wiki-content .wiki-list');
      const side = doc.querySelector('#wiki-content .wiki-side');
      if (!list || !side) return 'the wiki buckets are missing';
      return (/Harrow Bay/.test(list.textContent) && !/Harrow Bay/.test(side.textContent))
        || 'the entry is on the wrong side of the wiki';
    });

    check(P + 'the map keeps its grid and the clicked cell together', () => {
      ev("showTab('map')");
      const split = doc.querySelector('#map-content .map-split');
      if (!split) return 'no .map-split on the map page';
      return !!split.querySelector('#map-grid') || 'the map grid is outside the split';
    });

    check(P + 'the conflict tracker buckets turn order away from the zones', () => {
      ev("showTab('conflict');startConflict();");
      const grid = doc.querySelector('#conflict-content .conflict-grid');
      if (!grid) return 'no .conflict-grid while a conflict is running';
      const cols = grid.querySelectorAll(':scope > .conflict-col');
      if (cols.length !== 2) return 'expected 2 buckets, found ' + cols.length;
      return (/Turn Order/.test(cols[0].textContent) && /Zones/.test(cols[1].textContent))
        || 'turn order and zones are not in the columns they were bucketed into';
    });

    w.close();
  }

  // ── Dungeon Crawler Carl: the block sheet ────────────────────────────────
  {
    const { doc, ev, w } = await boot('dcc/index.html', DCC_SETUP);
    const P = '[dcc] ';

    check(P + 'the block container carries the layout', () => {
      const el = doc.getElementById('sys-blocks');
      if (!el) return 'no #sys-blocks — the sheet did not render';
      return el.classList.contains('blk-sheet')
        || 'renderBlockSheet() did not stamp .blk-sheet on its target';
    });

    check(P + 'every block is a direct child of the container, so the grid can place it', () => {
      const el = doc.getElementById('sys-blocks');
      const blocks = el.querySelectorAll('.blk');
      if (!blocks.length) return 'no blocks rendered';
      return [].slice.call(blocks).every(b => b.parentElement === el)
        || 'a block is nested inside another element and would not be a grid item';
    });

    check(P + 'the pack declares spans, and only ones the stylesheet knows', () => {
      const spans = [].slice.call(doc.querySelectorAll('#sys-blocks .blk[data-span]'))
        .map(b => b.getAttribute('data-span'));
      if (!spans.length) return 'no block declares a span — the sheet is one column on every screen';
      const known = ['1', '2', '3', 'full'];
      const bad = spans.filter(s => known.indexOf(s) < 0);
      return bad.length ? 'unknown span value(s): ' + bad.join(', ') : true;
    });

    check(P + 'the Stats and the Health Bar take the full width', () => {
      const got = ['stats', 'health'].map(id => {
        const el = doc.querySelector('#sys-blocks [data-blk="' + id + '"]');
        return el && el.getAttribute('data-span');
      });
      return got.every(v => v === 'full')
        || 'expected stats and health to span the sheet, got ' + got.join(', ');
    });

    check(P + 'a repaint does not wash the span off the wrapper', () => {
      ev("blockRepaint('health')");
      const el = doc.querySelector('#sys-blocks [data-blk="health"]');
      return (el && el.getAttribute('data-span') === 'full')
        || 'the span lives inside the block content, so a repaint drops it';
    });

    check(P + 'the HUD buckets the bars away from the actions', () => {
      ev("renderHUD()");
      const grid = doc.querySelector('#hud-content .hud-grid');
      if (!grid) return 'no .hud-grid on the HUD';
      const cols = grid.querySelectorAll(':scope > .hud-col');
      if (cols.length !== 2) return 'expected 2 buckets, found ' + cols.length;
      return !!cols[0].querySelector('[data-blk="health"]')
        || 'the Health Bar is not in the vitals column';
    });

    check(P + 'the HUD still shows one Health Bar, not two', () => {
      const onHud = doc.querySelectorAll('#hud-content [data-blk="health"]').length;
      return onHud === 1 || 'the HUD drew ' + onHud + ' health bars';
    });

    w.close();
  }

  if (fails.length) {
    console.log('FAIL ' + fails.length);
    fails.forEach(f => console.log('  x ' + f));
    process.exit(1);
  }
  console.log('PASS ' + ok.length);
})();

// Can the player actually roll?
//
// This suite exists because 868 other checks passed on a build of Dungeon
// Crawler Carl that had no way to roll a die at phone width. The two checks
// that were supposed to cover it called showTab('dice') — the *handler* — while
// the button that calls it was display:none below 700px and the sheet roller it
// was hidden in favour of was never rendered for a block pack. See DEBRIEF.md.
//
// So nothing here calls a render function to prove a feature exists. Every
// check starts from a control a player could actually press, at a width they
// could actually be at.
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

// ── a stylesheet reader, because JSDOM does not evaluate media queries ───────
// JSDOM parses CSS but getComputedStyle ignores @media entirely, so it reports
// #nb-dice as visible at every width. That blind spot is exactly the shape of
// the bug, so the widths are evaluated here instead: collect every declaration
// whose selector the element matches and whose media condition holds at the
// width under test, then apply them in cascade order.
function cssRules(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  let i = 0;
  while (i < css.length) {
    const brace = css.indexOf('{', i);
    if (brace < 0) break;
    const head = css.slice(i, brace).trim();
    if (head.startsWith('@media')) {
      let depth = 1, j = brace + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
        j++;
      }
      cssRules(css.slice(brace + 1, j - 1)).forEach(r => {
        out.push({ media: head.slice(6).trim(), sel: r.sel, decl: r.decl });
      });
      i = j;
    } else if (head.startsWith('@')) {
      // @keyframes and friends carry no rules we care about; skip the block.
      let depth = 1, j = brace + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
        j++;
      }
      i = j;
    } else {
      const close = css.indexOf('}', brace);
      if (close < 0) break;
      out.push({ media: null, sel: head, decl: css.slice(brace + 1, close) });
      i = close + 1;
    }
  }
  return out;
}

function mediaApplies(m, width) {
  if (!m) return true;
  const min = /min-width\s*:\s*(\d+)px/.exec(m);
  const max = /max-width\s*:\s*(\d+)px/.exec(m);
  if (min && width < Number(min[1])) return false;
  if (max && width > Number(max[1])) return false;
  return true;
}

// The final `display` for an element at a given viewport width. Selectors are
// matched with the element's own .matches(), so body classes and :empty are
// evaluated against the live DOM rather than guessed at.
function displayAt(rules, el, width) {
  if (!el) return 'none';                     // absent is as unreachable as hidden
  let val = null, valImportant = false;
  rules.forEach(r => {
    if (!mediaApplies(r.media, width)) return;
    const hit = r.sel.split(',').some(s => {
      try { return el.matches(s.trim()); } catch (e) { return false; }
    });
    if (!hit) return;
    const d = /(?:^|;)\s*display\s*:\s*([^;]+)/.exec(r.decl);
    if (!d) return;
    const important = /!important/.test(d[1]);
    if (valImportant && !important) return;
    val = d[1].replace(/!important/, '').trim();
    valImportant = important;
  });
  return val;
}

// Visible enough to press: neither the element nor any ancestor is display:none
// at this width, and an inline style:display:none counts too.
function reachableAt(rules, el, width) {
  let n = el;
  while (n && n.nodeType === 1 && n.tagName !== 'HTML') {
    if (n.style && n.style.display === 'none') return false;
    if (displayAt(rules, n, width) === 'none') return false;
    n = n.parentElement;
  }
  return !!el;
}

const PHONE = 400, DESKTOP = 1200;

async function boot(entry, setup) {
  const errs = [];
  const vc = new VirtualConsole().on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(loadAppHTML(entry), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'http://localhost/' + entry, virtualConsole: vc,
  });
  const w = dom.window;
  await waitReady(w);
  const ev = s => w.eval(s);
  // Boot returns early on a cold profile (the first-run universe gate), so the
  // character below is only reachable once a universe exists.
  ev("loadUniverses();if(!U.universes.length)createUniverse('T');renderHero();");
  ev(setup);
  return { w, ev, errs, doc: w.document };
}

const PACKS = [
  {
    id: 'dcc', label: 'Dungeon Crawler Carl', entry: 'dcc/index.html', blocks: true,
    setup: "S.char.creation=S.char.creation||{};dccFinishCreation(S.char);" +
           "S.char.creation.complete=true;save();renderHero();",
  },
  {
    id: 'dc', label: 'Daring Comics', entry: 'daring-comics/index.html', blocks: false,
    setup: "S.creation.costumedName='T';S.creation.aspects.concept='a';" +
           "S.creation.aspects.motivation='b';S.series.experience=(EXP_LEVELS[0]||{}).id;" +
           "S.creation.skills={Accuracy:3};finishCreation();renderHero();",
  },
];

(async () => {
  const rules = cssRules(fs.readFileSync(path.join(ROOT, 'core/shell.css'), 'utf8'));

  check('[css] the stylesheet reader finds the width-gated nav rules', () =>
    rules.some(r => r.media && /min-width\s*:\s*700px/.test(r.media) && /#nb-dice/.test(r.sel))
    || 'no width-gated #nb-dice rule found — the reader is broken, not the app');

  for (const pack of PACKS) {
    const P = '[' + pack.id + '] ';
    const app = await boot(pack.entry, pack.setup);
    const { ev, doc } = app;
    const $ = id => doc.getElementById(id);

    check(P + 'boots with a finished character and no errors', () =>
      (ev('!!S.char') && !app.errs.length) || 'errors: ' + JSON.stringify(app.errs));

    // ── THE CHECK THAT WAS MISSING ────────────────────────────────────────────
    // A player at phone width must be able to press something that rolls. Not
    // "renderDice() produces markup" — a control, reachable, at that width.
    // #hero-dice-mobile is the control, not #dice-bar-body: the body is
    // collapsed until you tap the toggle, so testing the body would call a
    // perfectly good roller unreachable.
    check(P + 'a roll control is reachable at phone width', () => {
      const tab = reachableAt(rules, $('nb-dice'), PHONE);
      const bar = reachableAt(rules, $('hero-dice-mobile'), PHONE);
      return tab || bar ||
        'no roll control at ' + PHONE + 'px: Dice tab ' +
        (($('nb-dice')) ? 'is hidden' : 'is absent') + ' and the sheet has no dice bar';
    });

    check(P + 'a roll control is reachable at desktop width', () => {
      const tab = reachableAt(rules, $('nb-dice'), DESKTOP);
      const side = $('hero-dice-sidebar');
      const sidebar = side && side.innerHTML.trim() && reachableAt(rules, side, DESKTOP);
      return tab || sidebar || 'no roll control at ' + DESKTOP + 'px';
    });

    // The rule that caused this. It is allowed to hide the Dice tab, but only
    // on the grounds it claims: that the sheet is carrying a roller instead.
    check(P + 'the Dice tab is hidden only when the sheet carries a roller', () => {
      if (reachableAt(rules, $('nb-dice'), PHONE)) return true;
      return reachableAt(rules, $('hero-dice-mobile'), PHONE) ||
        'the Dice tab is hidden at phone width and nothing replaces it';
    });

    check(P + 'the body class matches what the sheet actually drew', () => {
      const claimed = doc.body.classList.contains('has-sheet-roller');
      const actual = !!$('dice-bar-body');
      return claimed === actual ||
        'body says has-sheet-roller=' + claimed + ' but the bar is ' + (actual ? 'present' : 'absent');
    });

    check(P + 'the sheet carries a result toast for a mobile roll', () =>
      !!$('quick-roll-toast') || 'no #quick-roll-toast on the sheet');

    check(P + 'the desktop sidebar is filled, not an empty 280px column', () => {
      const side = $('hero-dice-sidebar');
      if (!side) return 'no #hero-dice-sidebar';
      if (side.innerHTML.trim()) return true;
      // Empty is only acceptable if it also stops reserving the column.
      return displayAt(rules, side, DESKTOP) === 'none' ||
        'the sidebar is empty and still reserves its width';
    });

    // ── a player can complete a roll, starting from a button ─────────────────
    check(P + 'pressing ROLL on the sheet produces a roll', () => {
      const mobile = $('hero-dice-mobile');
      if (!mobile) return 'no sheet roller to press';
      // The player's actual motion: tap the bar open, then press ROLL.
      const toggle = mobile.querySelector('.dice-bar-toggle');
      if (toggle) toggle.click();
      const bar = $('dice-bar-body');
      if (!bar || !bar.classList.contains('open')) return 'the bar did not open when tapped';
      const btn = [].slice.call(bar.querySelectorAll('button'))
        .find(x => /ROLL/i.test(x.textContent));
      if (!btn) return 'the sheet roller has no ROLL button';
      ev('S.dice=null');
      btn.click();
      const d = ev('S.dice');
      return !!(d && Array.isArray(d.dice) && d.dice.length > 0 && typeof d.total === 'number')
        || 'S.dice after pressing ROLL: ' + JSON.stringify(d);
    });

    check(P + 'the roll answers on the surface it was made from', () => {
      const toast = $('quick-roll-toast');
      return !!(toast && toast.innerHTML.trim().length > 0)
        || 'the mobile roll left the toast empty';
    });

    // The multiplayer feed reads S.dice.skill. A roll with no name on it reaches
    // the table as a bare number.
    check(P + 'a roll carries a name for the table feed', () => {
      const d = ev('S.dice');
      return (d && typeof d.skill === 'string')
        || 'S.dice.skill is ' + JSON.stringify(d && d.skill) + ' — the table feed reads that field';
    });

    // ── the HUD tab ──────────────────────────────────────────────────────────
    // A pack declares renderHUD() or has no HUD at all; the shell must not
    // leave a nav button pointing at an empty page either way.
    check(P + 'the HUD tab exists exactly when the pack declares one', () => {
      const declared = ev('typeof SYS.renderHUD === "function"');
      const btn = !!$('nb-hud');
      return declared === btn ||
        'pack declares renderHUD=' + declared + ' but the nav button is ' +
        (btn ? 'present' : 'absent');
    });

    if (ev('typeof SYS.renderHUD === "function"')) {
      check(P + 'the HUD is reachable at phone width', () =>
        reachableAt(rules, $('nb-hud'), PHONE) || 'the HUD tab is hidden at ' + PHONE + 'px');

      check(P + 'the HUD sits straight after Hero in the nav', () => {
        const ids = [].slice.call(doc.querySelectorAll('#nav .nb')).map(n => n.id);
        return ids[1] === 'nb-hud' || 'nav order is ' + ids.join(',');
      });

      check(P + 'the HUD carries the health bar and the quick slots', () => {
        ev("showTab('hud')");
        const host = $('hud-content');
        if (!host || !host.innerHTML.trim()) return 'the HUD rendered nothing';
        const health = host.querySelector('[data-blk="health"]');
        const slots = host.querySelectorAll('.inv-slotno').length;
        if (!health) return 'no health block on the HUD';
        return slots > 0 || 'no quick slots on the HUD';
      });

      // The reason blocks grew mounts. Damage taken on one screen has to move
      // the other, or a player reads their hit points off whichever tab they
      // happen to be on.
      check(P + 'the health bar stays in step across both screens', () => {
        ev("showTab('hud')");
        const hud = () => doc.querySelectorAll('#hud-content .trk-slot.is-spent').length;
        const sheet = () => doc.querySelectorAll('#sys-blocks .trk-slot.is-spent').length;
        ev("S.char.blocks.health={marked:0};blockRepaint('health');");
        if (hud() !== 0 || sheet() !== 0) return 'not clean to start';
        ev("S.char.blocks.health={marked:4};blockRepaint('health');");
        return (hud() === 4 && sheet() === 4) ||
          'HUD shows ' + hud() + ' spent, the sheet shows ' + sheet();
      });

      check(P + 'the two mounts of a block do not share a DOM id', () => {
        const ids = [].slice.call(doc.querySelectorAll('[data-blk="health"]')).map(e => e.id);
        return (ids.length === 2 && ids[0] !== ids[1]) ||
          'health mount ids: ' + JSON.stringify(ids);
      });

      check(P + 'an attack card rolls, and the roll carries its name', () => {
        ev("showTab('hud')");
        const btn = [].slice.call($('hud-content').querySelectorAll('button'))
          .find(x => /dccHudRoll|sysRollSkill/.test(x.getAttribute('onclick') || ''));
        if (!btn) return 'no roll control on any attack card';
        ev('S.dice=null');
        btn.click();
        const d = ev('S.dice');
        if (!d || !Array.isArray(d.dice)) return 'pressing it produced no roll';
        return !!d.skill || 'the roll reached the table with no name on it';
      });

      check(P + 'the roll answers on the HUD, not on another tab', () => {
        const el = $('hud-roll');
        return !!(el && el.innerHTML.trim()) || 'the HUD roll left #hud-roll empty';
      });
    }

    if (pack.blocks) {
      check(P + 'a Skill on the sheet loads itself into the roller', () => {
        const blk = doc.getElementById('blk-skills');
        if (!blk) return 'no skills block on the sheet';
        const btn = [].slice.call(blk.querySelectorAll('button'))
          .find(x => /sysLoadRoll/.test(x.getAttribute('onclick') || ''));
        if (!btn) return 'no roll control on any Skill row';
        btn.click();
        const sel = doc.getElementById('sm-skill') || doc.getElementById('ss-skill');
        return !!(sel && sel.value) || 'pressing it loaded nothing into the roller';
      });

      check(P + 'the loaded Skill is one the character actually has', () => {
        const names = ev('sysDiceSkills().map(function(s){return s.name})');
        const sel = doc.getElementById('sm-skill') || doc.getElementById('ss-skill');
        return names.indexOf(sel.value) >= 0 || 'loaded "' + sel.value + '", not in ' + JSON.stringify(names);
      });

      check(P + 'every roll surface offers the same Skills', () => {
        ev("showTab('dice')");
        const tab = [].slice.call(doc.getElementById('sd-skill').options).map(o => o.value).sort();
        const bar = [].slice.call(doc.getElementById('sm-skill').options).map(o => o.value).sort();
        const side = [].slice.call(doc.getElementById('ss-skill').options).map(o => o.value).sort();
        return (JSON.stringify(tab) === JSON.stringify(bar) &&
                JSON.stringify(bar) === JSON.stringify(side))
          || 'tab ' + JSON.stringify(tab) + ' vs bar ' + JSON.stringify(bar) +
             ' vs sidebar ' + JSON.stringify(side);
      });

      check(P + 'the rollable blocks are the pack’s to name', () => {
        const before = ev('sysRollBlocks().join(",")');
        ev("SYS.dice.skillBlocks=['spells'];");
        const after = ev('sysRollBlocks().join(",")');
        ev('delete SYS.dice.skillBlocks;');
        return (before === 'skills,spells' && after === 'spells')
          || 'default "' + before + '", declared "' + after + '"';
      });

      check(P + 'a block pack with no dice contract gets no roller, not another game’s', () => {
        // SYS is a const at script scope, so it is not reachable from the test
        // as a window property — park the contract on window and restore it
        // through eval, or every later check runs against a diceless pack.
        ev('window.__keepDice=SYS.dice;SYS.dice=null;');
        let mode = '', bar = '', tabText = '', threw = '';
        try {
          mode = ev('rollSurfaces()');
          bar = ev('rollBarHTML()');
          ev('renderDice()');
          tabText = doc.getElementById('dice-content').textContent;
        } catch (e) { threw = e.message; }
        ev('SYS.dice=window.__keepDice;delete window.__keepDice;renderDice();');
        if (threw) return 'the diceless path threw: ' + threw;
        return (mode === 'none' && bar === '' && /does not declare a dice engine/.test(tabText))
          || 'mode "' + mode + '", bar ' + JSON.stringify(bar.slice(0, 40)) +
             ', tab ' + JSON.stringify(tabText.slice(0, 60));
      });
    }

    // Parity: not a character count, which ages badly, but the two things the
    // tab has to carry — the character's own Skills and something to press.
    check(P + 'the Dice tab offers this character’s Skills and a ROLL button', () => {
      ev("showTab('dice')");
      const host = doc.getElementById('dice-content');
      const sel = host.querySelector('select');
      const btn = [].slice.call(host.querySelectorAll('button'))
        .find(x => /ROLL/i.test(x.textContent));
      if (!sel) return 'no Skill select on the Dice tab';
      if (!btn) return 'no ROLL button on the Dice tab';
      return sel.options.length > 1 ||
        'the Skill list offers nothing but the flat-roll placeholder';
    });
  }

  console.log('\nPASS ' + ok.length);
  if (fails.length) {
    console.log('FAIL ' + fails.length);
    fails.forEach(f => console.log('  x ' + f));
    process.exit(1);
  }
  console.log('All dice-reachability checks passed.');
})().catch(e => {
  console.log('\nPASS ' + ok.length);
  if (fails.length) { console.log('FAIL ' + fails.length); fails.forEach(f => console.log('  x ' + f)); }
  console.log('HARNESS ERROR after ' + (ok.length + fails.length) + ' checks: ' + e.stack);
  process.exit(1);
});

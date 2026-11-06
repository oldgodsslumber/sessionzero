// Marvel Multiverse: the pack's own checks. M0 only proves it boots as itself.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadAppHTML, waitReady } = require('./loadapp');

const ROOT = path.join(__dirname, '..');
const ENTRY = 'marvel/index.html';
const fails = [], ok = [];
function check(name, fn) {
  try {
    const r = fn();
    if (r === false) fails.push(name + ' -> false');
    else if (typeof r === 'string') fails.push(name + ' -> ' + r);
    else ok.push(name);
  } catch (e) { fails.push(name + ' -> ' + e.message); }
}

(async () => {
  const errs = [];
  const vc = new VirtualConsole().on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(loadAppHTML(ENTRY), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'http://localhost/' + ENTRY, virtualConsole: vc,
  });
  await waitReady(dom.window);
  const ev = s => dom.window.eval(s);

  check('the entry page activates this pack', () =>
    ev('SYS.id') === 'marvel-multiverse' || 'active pack is ' + ev('SYS.id'));
  check('it boots cold with no errors', () =>
    !errs.length || 'errors: ' + JSON.stringify(errs));

  // Through the first-run screen, as a player does. Calling createUniverse() here leaves
  // the save unattached to any universe, so the roster never persists and tests lie.
  const gateInput = dom.window.document.querySelector('input[placeholder*="Marvel"]');
  check('a cold start asks for a universe', () => !!gateInput || 'no gate');
  gateInput.value = 'Test Earth';
  gateInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  [...dom.window.document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Create Universe')[0]
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  check('the universe is real and the save belongs to it', () =>
    (ev('currentUniverse().name') === 'Test Earth' && ev('S.universeId') === ev('currentUniverse().id')) || 'unbound');
  check('a universe opens onto a sheet with no errors', () =>
    (ev('!!S.char') && !errs.length) || 'errors: ' + JSON.stringify(errs));

  check('the sheet shows the six abilities, in M.A.R.V.E.L. order', () => {
    const page = dom.window.document.getElementById('hero-sheet').textContent;
    const at = ['Melee', 'Agility', 'Resilience', 'Vigilance', 'Ego', 'Logic'].map(n => page.indexOf(n));
    return (at.every(i => i >= 0) && at.every((v, i) => !i || v > at[i - 1])) || 'found at ' + at.join(',');
  });

  check('it speaks its own words', () => {
    const want = { hero: 'Hero', team: 'Team', region: 'Location', logBreak: 'Adventure', gm: 'Narrator' };
    const bad = Object.keys(want).filter(k => ev('lex(' + JSON.stringify(k) + ')') !== want[k]);
    return !bad.length || 'wrong: ' + bad.join(', ');
  });

  // ── the official characters ────────────────────────────────────────────────
  const profiles = ev('MMR_PROFILES');
  const byName = n => profiles.filter(p => p.name === n)[0];

  check('all 128 profiles from Chapter 8 are present, once each', () => {
    const ids = new Set(profiles.map(p => p.id));
    return (profiles.length === 128 && ids.size === 128) || profiles.length + ' rows, ' + ids.size + ' ids';
  });
  check('every profile has every number, and a page in Chapter 8', () => {
    const bad = [];
    profiles.forEach(p => {
      const nums = [p.rank, p.health, p.focus, p.init, p.karma, p.healthDR, p.focusDR];
      ['melee', 'agility', 'resilience', 'vigilance', 'ego', 'logic'].forEach(a =>
        nums.push(p.abilities[a].score, p.abilities[a].def, p.abilities[a].check));
      ['melee', 'agility', 'ego', 'logic'].forEach(a => nums.push(p.damage[a].mult, p.damage[a].ability));
      if (nums.some(n => typeof n !== 'number')) bad.push(p.name);
      if (!(p.page >= 134 && p.page <= 261)) bad.push(p.name + ' page ' + p.page);
      if (!(p.rank >= 1 && p.rank <= 6)) bad.push(p.name + ' rank ' + p.rank);
    });
    return !bad.length || bad.join(', ');
  });
  // Read off the scans by eye. These are the book's numbers even where the book's own
  // arithmetic disagrees, as it does for Iron Man and Baron Zemo.
  check('known answers from the scans', () => {
    const want = [
      ['Hulk (Bruce Banner)', p => [p.rank, p.health, p.healthDR, p.focus, p.focusDR, p.abilities.melee.score, p.abilities.melee.check, p.damage.melee.mult].join(), '6,270,-3,150,-2,9,13,10'],
      ['Spider-Man (Peter Parker)', p => [p.rank, p.health, p.focus, p.init, p.initEdge, p.abilities.agility.def, p.abilities.logic.check, p.karma].join(), '4,90,90,3,true,19,5,4'],
      ['Iron Man (Tony Stark)', p => [p.health, p.focus, p.healthDR].join(), '75,75,-2'],
      ['Baron Zemo (Helmut Zemo)', p => [p.health, p.abilities.resilience.score].join(), '90,2'],
      ['Thanos', p => [p.rank, p.focus, p.focusDR, p.karma, p.kind].join(), '6,90,-3,0,villain'],
      ['Echo', p => String(p.abilities.vigilance.def), '12'],
      ['Doctor Strange', p => [p.damage.ego.mult, p.abilities.ego.check].join(), '10,13'],
    ];
    const bad = want.filter(([n, f, v]) => !byName(n) || f(byName(n)) !== v)
      .map(([n, f, v]) => n + ': ' + (byName(n) ? f(byName(n)) : 'missing') + ' wanted ' + v);
    return !bad.length || bad.join(' | ');
  });
  check('labels and powers came through whole', () => {
    const p = byName('Doctor Strange');
    const names = p.powers.map(x => x.name);
    const hulk = byName('Hulk (Bruce Banner)');
    if (!names.includes('Discipline 4') || !names.includes('Mists of Morpheus')) return names.join(', ');
    if (!hulk.traits.includes('Big (Reach 2)')) return hulk.traits.join(', ');
    return p.traits.includes('Combat Reflexes') || p.traits.join(', ');
  });
  check('every profile has a History and a Personality', () => {
    const bad = profiles.filter(p => p.history.length < 60 || p.personality.length < 30).map(p => p.name);
    return !bad.length || bad.join(', ');
  });
  check('the prose reads as prose', () => {
    const bad = [];
    profiles.forEach(p => {
      const t = p.history + ' ' + p.personality;
      // A lost space after a full stop, a word broken at a line end, a mis-cased OCR slip.
      const m = /[a-z]\.[A-Z][a-z]|[a-z]-\s[a-z]|\bNYc\b|\bTChalla\b|\.\.|"\s*"/.exec(t);
      if (m) bad.push(p.name + ': ' + t.slice(Math.max(0, m.index - 15), m.index + 15));
      if ((t.match(/"/g) || []).length % 2) bad.push(p.name + ': unbalanced quotes');
    });
    return !bad.length || bad.join(' | ');
  });
  check('known prose from the scans, including line-end hyphens and paragraphs', () => {
    const hulk = byName('Hulk (Bruce Banner)'), bull = byName('Bullseye');
    if (!/an unstoppable monster brought out by the scientist's own rage\./.test(hulk.history)) return 'Hulk history: ' + hulk.history.slice(0, 300);
    if (hulk.history.split('\n\n').length !== 2) return 'Hulk paragraphs: ' + hulk.history.split('\n\n').length;
    if (!/^Banner suffers from dissociative identity disorder\./.test(hulk.personality)) return 'Hulk: ' + hulk.personality.slice(0, 80);
    if (!/eventually resurfacing in New York as Bullseye/.test(bull.history)) return 'Bullseye: ' + bull.history.slice(0, 240);
    return /^Bullseye is a madman who enjoys killing above all else\./.test(bull.personality) || bull.personality.slice(0, 80);
  });
  check('a rules section stays out of the Personality above it', () => {
    const e = byName('Emma Frost').personality, n = byName('Sub-Mariner (Namor)').personality;
    return (!/crystalline|slash/i.test(e) && !/Atlantean\. This combination/.test(n)) || 'leaked';
  });
  check('a character can carry a second form, as printed', () =>
    /Crystalline/.test(byName('Emma Frost').formNote) || 'no note');

  const doc = dom.window.document;
  dom.window.confirm = () => true;
  ev("showTab('npcs');renderNPCs();");
  const press = el => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  const tab = t => [...doc.querySelectorAll('.npc-tab')].filter(x => x.textContent === t)[0];
  const list = () => doc.getElementById('mmr-official-list');

  check('the panel opens on the official characters, all listed', () =>
    (tab('Official') && tab('Official').classList.contains('active')
      && list() && list().querySelectorAll('.npc-card').length === 128) || 'list not drawn');

  check('searching filters the list and leaves the search box alone', () => {
    const input = doc.querySelector('#npcs-content input');
    input.focus();
    input.value = 'spider-man';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    const n = list().querySelectorAll('.npc-card').length;
    const same = doc.activeElement === input && doc.contains(input);
    return (n === 3 && same) || n + ' cards, input kept: ' + same;
  });

  const openCard = name => press([...list().querySelectorAll('.npc-card-head')]
    .filter(h => h.querySelector('.npc-card-name').textContent === name)[0]);
  const actBtn = label => [...list().querySelectorAll('.npc-card-acts button')].filter(b => b.textContent.indexOf(label) === 0)[0];

  check('a card opens onto the full stat block', () => {
    openCard('Spider-Man (Peter Parker)');
    const t = list().textContent;
    return (/Spider-Sense/.test(t) && /Combat Reflexes/.test(t) && /Book p\. 237/.test(t)
      && /History/.test(t) && /Personality/.test(t) && /wisecracking/.test(t)) || t.slice(0, 200);
  });

  const copies = () => ev('S.npcs.filter(n=>!n.fromHero).length');
  const before = copies();
  check('Add to table puts a copy on the roster', () => {
    press(actBtn('Add to table'));
    return copies() === before + 1 || 'copies on the roster: ' + copies();
  });
  const row = ev('S.npcs.filter(n=>!n.fromHero)[0]');
  check('the copy can sync: an id, and nothing undefined or nested', () => {
    if (!row.id) return 'no id';
    const bad = Object.keys(row).filter(k => row[k] === undefined || row[k] === null || typeof row[k] === 'object');
    return !bad.length || 'bad fields: ' + bad.join(', ');
  });
  check('the copy carries the story, so a Narrator can edit their own', () =>
    (/wisecracking/.test(row.personality) && row.history.length > 60) || 'no story on the row');
  check('it is filed under Heroes, and shows there', () => {
    press(tab('Heroes'));
    const t = doc.getElementById('npcs-content').textContent;
    return (/Spider-Man \(Peter Parker\)/.test(t) && /Rank 4/.test(t) && /Health 90/.test(t)) || t.slice(0, 200);
  });
  check('editing the copy leaves the book alone', () => {
    ev('S.npcs.filter(n=>!n.fromHero)[0].health=1;save();');
    return byName('Spider-Man (Peter Parker)').health === 90 || 'the book row changed';
  });
  check('a new entry made while on another tab is never filed under Official', () =>
    ev('npcFirstKind()') === 'hero' || ev('npcFirstKind()'));

  press(tab('Official'));
  const playFromOfficial = name => {
    press(tab('Official'));
    const input = doc.querySelector('#npcs-content input');
    input.value = name;
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    _openOnly(name);
    press(actBtn('Play as'));
  };
  const _openOnly = name => { if (!list().querySelector('.npc-card-acts')) openCard(name); };

  check('Play as Hero fills in the blank sheet a new table opens on', () => {
    const saves = ev('listSaves().length'), oldId = ev('currentSaveId');
    playFromOfficial('Spider-Man (Peter Parker)');
    if (ev('currentSaveId') !== oldId) return 'made a new save and stranded the blank one';
    if (ev('listSaves().length') !== saves) return 'saves ' + saves + ' -> ' + ev('listSaves().length');
    return ev('S.char.profile') === 'spider-man-peter-parker' || 'profile ' + ev('S.char.profile');
  });
  check('the sheet then shows them: abilities and the stat block', () => {
    const sheet = doc.getElementById('hero-sheet').textContent;
    const agi = ev('S.char.blocks.abilities.agility');
    return (agi === 7 && /Webslinging/.test(sheet) && /Health/.test(sheet)) || 'agility ' + agi + ' / ' + sheet.slice(0, 160);
  });
  check('playing a second one starts a new save and keeps the first', () => {
    const saves = ev('listSaves().length'), oldId = ev('currentSaveId');
    playFromOfficial('Storm');
    if (ev('currentSaveId') === oldId) return 'overwrote the first hero';
    if (ev('listSaves().length') !== saves + 1) return 'saves ' + saves + ' -> ' + ev('listSaves().length');
    return ev('S.char.profile') === 'storm' || 'profile ' + ev('S.char.profile');
  });
  check('a played hero reaches the roster by name, with their stats, and can sync', () => {
    const row = ev("S.npcs.filter(n=>n.fromHero&&n.profile==='spider-man-peter-parker')[0]");
    if (!row) return 'no mirror: ' + ev("JSON.stringify(S.npcs.map(n=>n.name))");
    if (row.name !== 'Spider-Man (Peter Parker)' || row.health !== 90) return row.name + ' health ' + row.health;
    const bad = Object.keys(row).filter(k => row[k] === undefined);
    return !bad.length || 'undefined: ' + bad.join(', ');
  });
  check('no unnamed row is left on the roster', () => {
    const names = ev('S.npcs.map(n=>n.name)');
    return !names.some(n => /^Unnamed/.test(n)) || names.join(', ');
  });
  check('nothing above threw', () => !errs.length || JSON.stringify(errs));

  check('the launcher links to it', () =>
    /href="marvel\/"/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));

  // The rulebook sits beside the pack for reference, in a public repo. A broadened
  // ignore rule or a rename must not be what publishes it.
  check('the rulebook and its OCR stay out of the repo', () => {
    const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    return (/marvel-multiverse\/Marvel-Multiverse-RPG-Core-Rulebook\.\*/.test(ignore)
      && /marvel-multiverse\/\.book\//.test(ignore)) || 'ignore rules are gone';
  });

  console.log('\nPASS ' + ok.length);
  if (fails.length) {
    console.log('FAIL ' + fails.length);
    fails.forEach(f => console.log('  x ' + f));
    process.exit(1);
  }
  console.log('All Marvel Multiverse checks passed.');
})().catch(e => {
  console.log('\nPASS ' + ok.length);
  if (fails.length) { console.log('FAIL ' + fails.length); fails.forEach(f => console.log('  x ' + f)); }
  console.log('HARNESS ERROR after ' + (ok.length + fails.length) + ' checks: ' + e.stack);
  process.exit(1);
});

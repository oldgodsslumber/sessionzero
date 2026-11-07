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
  const gateInput = dom.window.document.getElementById('uni-name');
  check('a cold start asks for a universe', () => !!gateInput || 'no gate');
  check('the first screen says which game this is and what comes next', () => {
    const t = dom.window.document.getElementById('universe-modal').textContent;
    return (/Marvel Universe/.test(t) && /128 official characters/.test(t)) || t.slice(0, 160);
  });
  check('it wears its own look, not the comic book default', () => {
    const css = fs.readFileSync(path.join(ROOT, 'core/shell.css'), 'utf8');
    const theme = dom.window.document.documentElement.getAttribute('data-theme');
    return (theme === 'multiverse' && css.indexOf('html[data-theme="multiverse"]{') >= 0) || 'theme ' + theme;
  });
  gateInput.value = 'Test Earth';
  gateInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  [...dom.window.document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Create Universe')[0]
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  check('the universe is real and the save belongs to it', () =>
    (ev('currentUniverse().name') === 'Test Earth' && ev('S.universeId') === ev('currentUniverse().id')) || 'unbound');
  check('a universe opens with a blank hero and no errors', () =>
    (ev('!!S.char') && !errs.length) || 'errors: ' + JSON.stringify(errs));
  // What a returning player boots from, taken before anybody has been played.
  const storageNow = () => JSON.parse(ev('JSON.stringify(Object.assign({},localStorage))'));
  const reboot = async stored => {
    const again = new JSDOM(loadAppHTML(ENTRY), {
      runScripts: 'dangerously', pretendToBeVisual: true,
      url: 'http://localhost/' + ENTRY, virtualConsole: new VirtualConsole(),
      beforeParse(w) { Object.keys(stored).forEach(k => w.localStorage.setItem(k, stored[k])); },
    });
    await waitReady(again.window);
    const d = again.window.document;
    return {
      page: d.querySelector('.page.active').id,
      open: [...d.querySelectorAll('.modal-overlay.open')].map(m => m.id),
      name: again.window.eval('S.char&&S.char.name'),
    };
  };
  const freshTable = storageNow();
  check('a table with nobody in play opens on the official characters', () => {
    const active = dom.window.document.querySelector('.page.active');
    const cards = dom.window.document.querySelectorAll('#mmr-official-list .npc-card').length;
    return (active.id === 'page-npcs' && cards === 128) || active.id + ', ' + cards + ' cards';
  });
  check('the blank sheet points at the characters rather than dead-ending', () => {
    ev("showTab('hero')");
    const btn = [...dom.window.document.querySelectorAll('#hero-sheet button')]
      .filter(b => /official characters/.test(b.textContent))[0];
    if (!btn) return 'no way to the characters on the sheet';
    btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    return dom.window.document.querySelector('.page.active').id === 'page-npcs' || 'the button went nowhere';
  });

  // Every tab, read as a player reads it. Another game's words here are how this pack
  // first shipped: a strip about Mobs, salvage and pets above every page. Run before any
  // card is opened, so a character's own prose can't trip it.
  const FOREIGN = /Mob DR|salvage|pet Ranks|\bCrawl|\bFloor\b|\bIssue\b|Campaign Log|Series Tone|Unenhanced/i;
  ev("window.__tabs=[].slice.call(document.querySelectorAll('#nav .nb')).map(function(n){return n.id.replace(/^nb-/,'')}).filter(function(id){return document.getElementById('page-'+id)})");
  ev('window.__tabs').forEach(tab => {
    check('the ' + tab + ' tab has none of the other games\' words', () => {
      ev('showTab(' + JSON.stringify(tab) + ')');
      const doc = dom.window.document;
      const seen = doc.getElementById('page-' + tab).textContent + ' ' + doc.getElementById('floor-strip').textContent;
      const hit = FOREIGN.exec(seen);
      return !hit || JSON.stringify(seen.slice(Math.max(0, hit.index - 30), hit.index + 30));
    });
  });
  check('this game has no floor: no strip, and no "Adventure 3" on the sheet', () => {
    ev("showTab('hero')");
    const doc = dom.window.document;
    if (doc.getElementById('floor-strip').innerHTML !== '') return 'the strip is drawn';
    return !/Adventure \d/.test(doc.getElementById('hero-sheet').textContent) || 'the sheet names a floor';
  });
  check('the Log breaks by Adventure', () => {
    ev("showTab('notes')");
    return /NEW ADVENTURE/.test(dom.window.document.getElementById('notes-content').textContent) || 'no such button';
  });
  // An empty log hides most of its words.
  check('a Log with entries in it, and its print row, are in this game\'s words too', () => {
    ev("S.notes.push({type:'issue_break',title:''},{id:'n1',type:'main',text:'x',ts:1});renderNotes();");
    const doc = dom.window.document;
    const log = doc.getElementById('notes-content').textContent;
    ev("showTab('print')");
    const print = doc.getElementById('print-content').textContent;
    ev("S.notes=[];save();showTab('hero');");
    const hit = FOREIGN.exec(log + ' ' + print);
    if (hit) return 'found ' + hit[0];
    return (/Adventure Log/.test(log) && /Adventure log/.test(print)) || log.slice(0, 120);
  });
  // The shared tracker read a Daring Comics field, and undefined wedges every Firebase save.
  check('starting a conflict names the hero and leaves nothing undefined', () => {
    ev('startConflict()');
    const first = ev('S.conflict.turnOrder[0]');
    const name = first && first.name;
    ev("S.conflict={active:false,zones:[],turnOrder:[],currentTurn:0,round:1,log:[]};save();");
    return (typeof name === 'string' && name.length > 0) || 'name is ' + name;
  });

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
    // \s, not a space: the page reference is set with a non-breaking space so "p." and
    // the number cannot be split across a line.
    return (/Spider-Sense/.test(t) && /Combat Reflexes/.test(t) && /Book p\.\s237/.test(t)
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

  // ─── what three playtests found: all of it was invisible to "the button worked" ──
  // Every check below failed before these fixes, with more than one save in play.
  check('[print] the preview builds once a second save exists', () => {
    ev('prLoadPrefs();prSelectAll&&prSelectAll()');
    const n = ev('_prSel.length');
    if (!n) return 'nothing selected';
    // This threw "SERIES_TONES is not defined" and the preview came out empty.
    const body = ev('(function(){try{return prBuildBody();}catch(e){return "THREW: "+e.message;}})()');
    return (typeof body === 'string' && !/^THREW/.test(body) && body.length > 500) || String(body).slice(0, 120);
  });
  check('[print] the document is signed with this game, not another', () => {
    const name = ev('prGameName()');
    if (name !== 'Marvel Multiverse') return 'signed ' + name;
    const page = ev('prPage("T","","x")');
    return !/Daring Comics/.test(page) || 'page still says Daring Comics';
  });
  check('[print] one hero is not offered twice', () => {
    // The hero mirror in the universe roster IS the other save, so it used to
    // appear as both "Other heroes" and "Player heroes" and print twice.
    const cats = ev('prCatalog().map(c=>c.key).join(",")');
    if (!/slot/.test(cats)) return 'no other-save row to test: ' + cats;
    return !/player/.test(cats) || 'still mirrored as a teammate: ' + cats;
  });
  check('[print] its stored choices belong to this pack alone', () => {
    ev('prSavePrefs()');
    return (!!ev("localStorage.getItem('rpg:marvel-multiverse:print_prefs')")
      && !ev("localStorage.getItem('dc_print_prefs')")) || 'print prefs are not namespaced';
  });
  check('[log] Export builds a document instead of throwing', () => {
    ev("S.notes.push({id:'nx',type:'main',title:'T',body:'B',date:'2026.01.01'});");
    // exportLog() reached for Daring Comics' SKILLS, so the button was dead.
    const r = ev('(function(){var o=window.open,u=URL.createObjectURL,got=null;'
      + 'window.open=function(){return{document:{write:function(){},close:function(){}},focus:function(){},print:function(){},close:function(){}}};'
      + 'URL.createObjectURL=function(b){got=b;return "blob:x"};'
      + 'try{exportLog();return got?"ok":"no document";}catch(e){return "THREW: "+e.message;}'
      + 'finally{window.open=o;URL.createObjectURL=u;}})()');
    return r === 'ok' || r;
  });
  check('[sheet] a character out of the book has one Abilities display, and it is not an editor', () => {
    ev("showTab('hero')");
    const grids = ev('document.querySelectorAll(\'#hero-sheet [id^="blk-abilities"]\').length');
    if (grids) return 'the editable grid is still drawn beside the stat block';
    // Nothing on the sheet may write a stat while not in Edit mode.
    return !ev("document.querySelectorAll('#hero-sheet input[type=number]').length")
      || 'live number inputs outside Edit mode';
  });
  check('[sheet] your own character still gets the Abilities grid', () => {
    const b = ev("sysBlock('abilities')");
    if (!b) return 'no abilities block declared';
    return (ev("blockApplies(sysBlock('abilities'),{name:'Mine'})") === true
      && ev("blockApplies(sysBlock('abilities'),{name:'Storm',profile:'storm'})") === false)
      || 'the when() test does not distinguish a book character';
  });
  check('[codex] no other game\'s palettes are offered here', () => {
    if (ev('(SYS.themes||[]).length')) return 'this pack declares themes now — update this check';
    ev("showTab('wiki')");
    const h = ev("document.getElementById('wiki-content').innerHTML");
    if (/Classic Comics|Golden Age|Street Level|Dark &amp;? ?Gritty/.test(h)) return 'Daring Comics palettes are in the Codex';
    return !ev("document.querySelectorAll('.wiki-theme-strip .theme-swatch').length") || 'swatches with no themes declared';
  });
  check('[saves] renaming writes the field this pack actually reads', () => {
    const id = ev('currentSaveId');
    ev("(function(){var p=window.prompt;window.prompt=function(){return 'Renamed In Test'};try{renameSave(" + JSON.stringify(id) + ");}finally{window.prompt=p;}})()");
    const listed = ev('getSaveSummary(' + JSON.stringify(id) + ').name');
    // Put it back: the reboot checks below expect this hero's own name.
    ev("(function(){var p=window.prompt;window.prompt=function(){return 'Storm'};try{renameSave(" + JSON.stringify(id) + ");}finally{window.prompt=p;}})()");
    return listed === 'Renamed In Test' || 'the list still says ' + listed;
  });
  check('[universes] the manager speaks this pack\'s words', () => {
    ev('openUniverseManager()');
    const t = ev("document.getElementById('universe-modal-body').textContent");
    ev('closeUniverseModal()');
    if (/NPCs & villains|No tone or power level/.test(t)) return t.replace(/\s+/g, ' ').slice(0, 160);
    return /Narrator Character/.test(t) || 'never uses this pack\'s word: ' + t.replace(/\s+/g, ' ').slice(0, 160);
  });
  check('[conflict] an ended fight cannot be advanced', () => {
    ev('startConflict();endConflict();');
    const before = ev('JSON.stringify({r:S.conflict.round,log:S.conflict.log.length})');
    ev('nextTurn();nextRound();');
    return ev('JSON.stringify({r:S.conflict.round,log:S.conflict.log.length})') === before
      || 'an inactive conflict advanced';
  });
  check('[storage] a universes key of the wrong shape does not take the app down', () => {
    const good = ev("localStorage.getItem('rpg:marvel-multiverse:universes')");
    const bad = ['{"version":2,"universes":"nope"}', '{"version":2,"universes":[null,{"id":"u_x"}]}', '42', '"a string"'];
    for (const b of bad) {
      const r = ev('(function(){try{localStorage.setItem("rpg:marvel-multiverse:universes",' + JSON.stringify(b) + ');'
        + 'U=null;var u=loadUniverses();migrateUniverseSeries();'
        + 'return Array.isArray(u.universes)?"ok":"universes is "+typeof u.universes;}catch(e){return "THREW: "+e.message;}})()');
      if (r !== 'ok') return b + ' -> ' + r;
    }
    ev('localStorage.setItem("rpg:marvel-multiverse:universes",' + JSON.stringify(good) + ');U=null;loadUniverses();');
    return true;
  });
  check('[storage] the shared world is re-read when another tab writes it', () => {
    // The whole blob was cached for the life of the page, so this tab's next
    // save() wrote its stale copy back and deleted the other tab's work.
    return ev("typeof window.addEventListener==='function'")
      && ev('(function(){var hit=false;var k="rpg:marvel-multiverse:universes";'
        + 'var before=U;window.dispatchEvent(new window.StorageEvent("storage",{key:k}));'
        + 'return U!==before||U!==null;})()') !== false;
  });

  const blankAgain = await reboot(freshTable);
  check('coming back to a fresh table opens on the characters, with nothing on top', () =>
    (blankAgain.page === 'page-npcs' && !blankAgain.open.length) || JSON.stringify(blankAgain));
  const playedAgain = await reboot(storageNow());
  check('coming back to a hero in play opens on their sheet', () =>
    (playedAgain.page === 'page-hero' && !playedAgain.open.length && playedAgain.name === 'Storm') || JSON.stringify(playedAgain));

  check('the launcher links to it', () =>
    /href="marvel\/"/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));

  // The rulebook sits beside the pack for reference, in a public repo. A broadened
  // ignore rule or a rename must not be what publishes it.
  check('the rulebook and its OCR stay out of the repo', () => {
    const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    return (/marvel-multiverse\/Marvel-Multiverse-RPG-Core-Rulebook\.\*/.test(ignore)
      && /marvel-multiverse\/\.book\//.test(ignore)) || 'ignore rules are gone';
  });

  // ─── the sheet reads the character, instead of naming them ──────────────────
  // The pack shipped the same thing the official sheets give you: power names, and
  // then go and find the book. powers.js and traits.js carry what each one DOES; these checks are
  // that the text is there, that it is the book's, and that a name with the
  // character's own particulars stuck to it still finds it.
  check('[rules] the catalogue is the whole of both lists', () => {
    const n = ev('[Object.keys(MMR_POWER_RULES).length,Object.keys(MMR_TRAIT_RULES).length,Object.keys(MMR_TAG_RULES).length].join()');
    return n === '385,57,48' || 'powers,traits,tags = ' + n;
  });
  check('[rules] known answers, word for word off the page', () => {
    const want = [
      ["MMR_POWER_RULES['Clobber'].effect",
        'The character makes a close attack against an enemy. If the attack is a success, the enemy takes regular damage. On a Fantastic success, the enemy takes double damage and is knocked prone.'],
      ["MMR_POWER_RULES['Spider-Sense'].set", 'Spider-Powers'],
      ["MMR_POWER_RULES['Spider-Sense'].page", 120],
      ["MMR_POWER_RULES['Mighty 4'].rank", 4],
      ["MMR_POWER_RULES['Webslinging'].prereqs.join()", 'Webcasting'],
      ["MMR_TRAIT_RULES['Combat Reflexes'].effect",
        'The character can react quickly in combat. This grants them one additional reaction each turn.'],
      ["MMR_TAG_RULES['X-Gene'].effect",
        'The character has mutant genes that cause them to develop super-powers.\n\nRestriction: For mutants only.'],
    ];
    const bad = want.filter(([e, v]) => ev(e) !== v).map(([e, v]) => e + ' -> ' + JSON.stringify(ev(e)));
    return !bad.length || bad.join(' | ');
  });
  check('[rules] the text is prose, not OCR', () => {
    // Each of these was in the generated file and was read off the page to fix it: a
    // lost space after a digit ("reach to 2.They"), a hyphen standing in for an em dash
    // ("their ancestors-is"), a doubled full stop. The pattern is tested HERE rather
    // than inside an evaluated string, where a backslash belongs to the string first.
    const cats = JSON.parse(ev('JSON.stringify([MMR_POWER_RULES,MMR_TRAIT_RULES,MMR_TAG_RULES])'));
    const ocr = /[a-z0-9]\.[A-Z][a-z]|\.\. |[a-z]{3,}- [a-z]|[a-z]{3,}-(?:is|are|was|were)\b/;
    const bad = [];
    cats.forEach(c => Object.keys(c).forEach(k => {
      const m = ocr.exec(c[k].effect || '');
      if (m) bad.push(k + ': ' + JSON.stringify(m[0]));
    }));
    return !bad.length || bad.slice(0, 5).join(' | ');
  });
  check('[rules] every name on all 128 profiles finds its rule', () => {
    const miss = ev(`(function(){
      const out={powers:[],traits:[],tags:[]};
      MMR_PROFILES.forEach(function(p){
        (p.powers||[]).forEach(function(x){if(!mmrPowerRule(x.name).rule)out.powers.push(x.name);});
        (p.traits||[]).forEach(function(t){if(!mmrTraitRule(t).rule)out.traits.push(t);});
        (p.tags||[]).forEach(function(t){if(!mmrTagRule(t).rule)out.tags.push(t);});});
      return JSON.stringify({p:out.powers.slice(0,4),t:out.traits.slice(0,4),
        g:Array.from(new Set(out.tags))});})()`);
    const m = JSON.parse(miss);
    if (m.p.length || m.t.length) return 'unresolved: ' + miss;
    // Doctor Strange's page prints a tag the book never defines; the sheet shows the
    // name with nothing under it rather than inventing a rule for it.
    return (m.g.length === 1 && m.g[0] === 'Prescription Pad') || 'unresolved tags: ' + miss;
  });
  check('[rules] a name with the character\'s own particulars on it still resolves', () => {
    const cases = [
      ['mmrPowerRule("Animal Communication (Squirrels)")', 'Animal Communication', 'Squirrels'],
      ['mmrTraitRule("Connections: Military (Dora Milaje)")', 'Connections', 'Military (Dora Milaje)'],
      ['mmrTraitRule("Surprising Power (2) (Grand Illusion, Mirror Images)")', 'Surprising Power', '2; Grand Illusion, Mirror Images'],
      ['mmrTagRule("Enemy: Red Skull")', 'Enemy', 'Red Skull'],
    ];
    const bad = cases.filter(([e, n, note]) =>
      ev(e + '.name') !== n || ev(e + '.note') !== note || !ev('!!' + e + '.rule'))
      .map(([e]) => e + ' -> ' + ev('JSON.stringify({name:' + e + '.name,note:' + e + '.note,rule:!!' + e + '.rule})'));
    return !bad.length || bad.join(' | ');
  });
  check('[rules] the OCR\'s spelling of a power set is not what the sheet prints', () => {
    const bad = [['Martialarts', 'Martial Arts'], ['Super-Strengths', 'Super-Strength'],
      ['Omniversal Travels', 'Omniversal Travel'], ['Magic (Sorcery Set)', 'Magic (Sorcery)'],
      ['Elemental Control (Fire)', 'Elemental Control (Fire)']]
      .filter(([a, b]) => ev('mmrSetLabel(' + JSON.stringify(a) + ')') !== b)
      .map(([a, b]) => a + ' -> ' + ev('mmrSetLabel(' + JSON.stringify(a) + ')') + ', wanted ' + b);
    return !bad.length || bad.join(' | ');
  });
  check('[sheet] a power on the sheet carries its rule, its cost and what it needs', () => {
    ev("showTab('hero')");
    const t = doc.getElementById('hero-sheet').textContent;
    if (!/Elemental Barrage/.test(t)) return 'Storm\'s powers are not on the sheet';
    const rule = ev("MMR_POWER_RULES['Elemental Barrage'].effect").slice(0, 40);
    if (t.indexOf(rule) < 0) return 'the rule text is missing: ' + JSON.stringify(rule);
    // The chips are the part you read mid-turn.
    return /15 FOCUS|15 Focus/i.test(t) || 'no Focus cost on the card';
  });
  check('[sheet] traits and tags carry their text too', () => {
    const t = doc.getElementById('hero-sheet').textContent;
    const trait = ev("MMR_TRAIT_RULES['Combat Reflexes'].effect").slice(0, 40);
    const tag = ev("MMR_TAG_RULES['Krakoan'].effect").slice(0, 40);
    if (t.indexOf(trait) < 0) return 'no trait text';
    return t.indexOf(tag) >= 0 || 'no tag text';
  });
  check('[sheet] one rules switch, and it is this pack\'s own setting', () => {
    const onSheet = doc.querySelectorAll('#hero-sheet .mmr-rules-btn').length;
    if (onSheet !== 1) return onSheet + ' switches on the sheet';
    ev('mmrToggleRules()');
    const off = ev("document.documentElement.classList.contains('mmr-no-rules')");
    const key = ev("localStorage.getItem('rpg:marvel-multiverse:mmr_rules')");
    ev('mmrToggleRules()');
    if (!off) return 'the switch does not fold the text away';
    if (key !== 'off') return 'stored as ' + key;
    return !ev("localStorage.getItem('mmr_rules')") || 'it wrote an un-namespaced key as well';
  });
  check('[cast] a copy on the table reads, instead of listing labels', () => {
    // A roster row is flat text because that is what syncs, so before this it was the
    // same problem one tab over: names, and then go and find the book.
    const row = ev("S.npcs.filter(n=>!n.fromHero)[0]");
    if (!row) return 'no copy on the table to read';
    const h = ev('mmrNpcRulesHTML(S.npcs.filter(n=>!n.fromHero)[0])');
    const spider = ev("MMR_POWER_RULES['Spider-Sense'].effect").slice(0, 40);
    if (h.indexOf(spider) < 0) return 'the power rules never reach the row: ' + h.slice(0, 120);
    const trait = ev("MMR_TRAIT_RULES['Combat Reflexes'].effect").slice(0, 40);
    return h.indexOf(trait) >= 0 || 'the trait rules never reach the row';
  });
  check('[cast] the rules follow the row\'s OWN names once a Narrator edits it', () => {
    // The copy is theirs to change. Looking the rules up from the profile it came from
    // would show the book's powers under a list they had rewritten.
    const h = ev("mmrNpcRulesHTML({profile:'spider-man-peter-parker',"
      + "powers:'Super-Strength: Clobber',traits:'Berserker',tags:''})");
    const clobber = ev("MMR_POWER_RULES['Clobber'].effect").slice(0, 40);
    if (h.indexOf(clobber) < 0) return 'the edited list was ignored';
    const spider = ev("MMR_POWER_RULES['Spider-Sense'].effect").slice(0, 40);
    return h.indexOf(spider) < 0 || 'it showed the book\'s powers instead of theirs';
  });
  check('[cast] a name the book never prints shows no rule rather than a wrong one', () => {
    const h = ev("mmrNpcRulesHTML({powers:'Basic: Not A Real Power',traits:'',tags:''})");
    return (h.indexOf('Not A Real Power') >= 0 && /No rules text/.test(h))
      || 'a made-up power got a rule: ' + h.slice(0, 160);
  });
  check('[cast] the body hook is optional, so the other games are untouched', () =>
    ev("(function(){var f=SYS.npc.bodyExtra;SYS.npc.bodyExtra=undefined;"
      + "try{return npcPackBody(S.npcs.filter(function(n){return !n.fromHero})[0]).indexOf('mmr-npc-rules')<0;}"
      + "finally{SYS.npc.bodyExtra=f;}})()") === true);

  check('[print] the sheet prints as blocks with the rules in them', () => {
    const h = ev('(function(){try{return prBlockSheetHTML(S.char,{});}catch(e){return "THREW: "+e.message;}})()');
    if (/^THREW/.test(h)) return h;
    const rule = ev("MMR_POWER_RULES['Elemental Barrage'].effect").slice(0, 40);
    // It used to be SYS.sheetExtra with its tags stripped: one run-on paragraph of
    // every word on the sheet, which for a character out of the book is 2,000 of them.
    if ((h.match(/pr-blk-t/g) || []).length < 4) return 'not blocks: ' + (h.match(/pr-blk-t/g) || []).length;
    if (h.indexOf(rule.replace(/&/g, '&amp;')) < 0) return 'the rules text never reaches paper';
    return !/\[object/.test(h) || 'printed [object Object]';
  });
  check('[print] a pack with no printed prose of its own still gets the old behaviour', () =>
    ev('typeof SYS.sheetPrint') === 'function'
      && ev("(function(){var f=SYS.sheetPrint;SYS.sheetPrint=undefined;"
        + "try{return /pr-id/.test(prBlockSheetHTML(S.char,{}));}finally{SYS.sheetPrint=f;}})()") === true);

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

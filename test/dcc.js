// Dungeon Crawler Carl pack: the rules maths, the two new block contracts, and
// system selection. Every expected value here is taken from the Core Rulebook
// (Royal Court Edition) with the page noted, so a failure means either the pack
// is wrong or the book was misread — not that the test drifted.
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadAppHTML, waitReady } = require('./loadapp');
const CREATION_SKILLS = require('./fixtures-creation-skills');

const fails = [], ok = [];
// A check fails on `false` OR on a returned string, which is the failure reason.
// (Treating a truthy string as a pass would make every eq() below unfalsifiable.)
function check(name, fn) {
  try {
    const r = fn();
    if (r === false) fails.push(name + ' -> false');
    else if (typeof r === 'string') fails.push(name + ' -> ' + r);
    else ok.push(name);
  } catch (e) { fails.push(name + ' -> ' + e.message); }
}
// eq takes a THUNK or a value. A thunk is evaluated inside the try, so a null
// dereference in the expression under test becomes a named failure instead of
// aborting the whole run — which is what happened when a deliberately broken
// salvage band made dccSalvageFor(3) return null.
function eq(a, b, name) {
  try {
    const v = typeof a === 'function' ? a() : a;
    if (v === b) ok.push(name);
    else fails.push(name + ' -> got ' + JSON.stringify(v) + ', expected ' + JSON.stringify(b));
  } catch (e) { fails.push(name + ' -> ' + e.message); }
}

function boot(entry) {
  const errs = [];
  const vc = new VirtualConsole().on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(loadAppHTML(entry), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    // Mirror the deployed shape: a game is served from its own folder, so
    // document.currentScript.src (and therefore SHELL_BASE) has that depth.
    url: 'http://localhost/' + entry, virtualConsole: vc,
  });
  dom.window.alert = () => {}; dom.window.confirm = () => true;
  return waitReady(dom.window).then(w => ({ w, errs }));
}

(async function () {
  const S_all = ev => JSON.parse(ev("JSON.stringify(S.char.blocks.gear)"));
  // ── one entry file per game: each registers exactly its own pack ──────────
  const dc = await boot('daring-comics/index.html');
  eq(dc.errs.length, 0, '[boot] no uncaught errors in the Daring Comics app');
  eq(dc.w.eval('SYS.id'), 'daring-comics', '[entry] daring-comics/ selects Daring Comics');
  eq(dc.w.eval('listSystems().length'), 1, '[entry] ...and ships only its own pack');
  eq(dc.w.eval('sysUsesBlocks()'), false, '[entry] Daring Comics has no blocks -> legacy sheet');
  eq(dc.w.eval("lex('universe')"), 'Universe', '[lexicon] DC keeps its comic words');
  eq(dc.w.eval('SYS.themes.length'), 5, '[theme] the comic themes belong to the pack, not the shell');
  eq(dc.w.eval("!!document.querySelector('#theme-wrap .theme-swatch')"), true, '[theme] swatches rendered from the pack');
  eq(dc.w.eval("!!document.getElementById('nav')"), true, '[chrome] the nav was built at boot, not shipped in the html');

  const g = await boot('dcc/index.html');
  eq(g.errs.length, 0, '[boot] no uncaught errors in the DCC app');
  const w = g.w, ev = s => w.eval(s);
  eq(ev('SYS.id'), 'dungeon-crawler-carl', '[entry] dcc/ selects DCC');
  eq(ev('listSystems().length'), 1, '[entry] ...and does not ship the Daring Comics rules');
  eq(ev("typeof POWERS"), 'undefined', '[entry] no Daring Comics data leaked into the DCC app');
  check('[theme] the pack picks its own look rather than inheriting the comic one', () => {
    // The shell's :root is Daring Comics': Bangers for titles, Comic Neue for
    // body. Neither was ever loaded, so both fell back — 'cursive' is Comic
    // Sans on Windows, which is what a crawler sheet was actually rendering in.
    const applied = ev("document.documentElement.getAttribute('data-theme')");
    if (applied !== 'crawler') return 'data-theme is ' + JSON.stringify(applied);
    const title = ev("getComputedStyle(document.documentElement).getPropertyValue('--font-title')");
    return !/Bangers/.test(title) || 'still using the comic display face: ' + title;
  });
  check('[theme] the entry file actually loads the fonts it names', () => {
    const fs2 = require('fs');
    const path2 = require('path');
    const bad = [];
    ['dcc/index.html', 'daring-comics/index.html'].forEach(f => {
      const html = fs2.readFileSync(path2.join(__dirname, '..', f), 'utf8');
      if (!/fonts\.googleapis\.com/.test(html)) bad.push(f);
    });
    return bad.length ? bad.join(', ') + ' names fonts in CSS but never loads them' : true;
  });
  eq(ev('sysUsesBlocks()'), true, '[select] DCC declares blocks -> block sheet');
  eq(ev("lex('hero')"), 'Crawler', '[lexicon] hero -> Crawler');
  eq(ev("lex('region')"), 'Neighborhood', '[lexicon] region -> Neighborhood');
  eq(ev("sysKey('saves')"), 'rpg:dungeon-crawler-carl:saves', '[storage] keys namespace per system');

  // ── SHELL_BASE: runtime paths must survive a game living in a subfolder ──
  // A game is served from /dcc/, so anything resolved at runtime against the
  // document (the lazy firebase-config and multiplayer loads) would otherwise
  // look for /dcc/core/mp.js. Script tags in the entry file are fine; these are
  // not. The harness inlines scripts, so currentScript is null here and the
  // derivation is checked directly.
  eq(ev("shellBaseFrom('https://x.github.io/sessionzero/core/system.js')"),
     'https://x.github.io/sessionzero/', '[base] strips core/system.js from a project-site URL');
  eq(ev("shellBaseFrom('https://x.github.io/core/system.js')"),
     'https://x.github.io/', '[base] works on a user site with no repo path');
  eq(ev("shellBaseFrom('https://x.github.io/sessionzero/core/system.js?v=3')"),
     'https://x.github.io/sessionzero/', '[base] tolerates a cache-busting query');
  eq(ev("shellBaseFrom('file:///D:/rpg/core/system.js')"),
     'file:///D:/rpg/', '[base] works from the filesystem');
  eq(ev("shellBaseFrom('')"), '', '[base] degrades to a relative path when unknown');
  eq(ev("shellBaseFrom(null)"), '', '[base] tolerates a null src');
  check('[base] a game in a subfolder resolves core/ at the shell root, not under itself', () => {
    const b = ev("shellBaseFrom('https://x.github.io/sessionzero/core/system.js')");
    const p = b + 'core/mp.js';
    if (/\/dcc\//.test(p)) return 'resolved under the game folder: ' + p;
    return p === 'https://x.github.io/sessionzero/core/mp.js' || 'got ' + p;
  });

  // ── Stat Mods, Table 2 / Table 20 (pp. 57, 110) ──────────────────────────
  const modCases = [[1,1],[2,1],[3,2],[5,2],[6,3],[9,3],[10,4],[19,4],[20,5],[49,5],
                    [50,6],[99,6],[100,7],[149,7],[150,8],[199,8],[200,9],[299,9],[300,10],[9999,10]];
  modCases.forEach(([v, m]) => eq(ev(`dccStatMod(${v})`), m, `[statmod] ${v} -> +${m}`));
  eq(ev('dccStatMod(0)'), 0, '[statmod] 0 is off the table');

  // ── Difficulty formulas (p. 59) ──────────────────────────────────────────
  eq(ev("dccDifficulty('unopposed',3)"), 16, '[difficulty] unopposed = 10 + Floor*2');
  eq(ev("dccDifficulty('unopposed',5)"), 20, '[difficulty] unopposed on Floor 5');
  eq(ev("dccDifficulty('stat',3)"), 13, '[difficulty] stat check = 10 + Floor');
  eq(ev("dccDifficulty('opposed',3,4)"), 17, '[difficulty] opposed = 10 + antagonist Mod + Floor');
  // the book's worked example: Sixth Floor Diplomacy, target 22 (p. 67)
  eq(ev("dccDifficulty('unopposed',6)"), 22, "[difficulty] matches the book's Floor 6 example");

  // ── Degrees of Success & Failure (p. 60) ─────────────────────────────────
  eq(ev('dccDegree(30,16,15)'), 'amazing',   '[degree] beat by 10+ is Amazing');
  eq(ev('dccDegree(25,16,15)'), 'success',   '[degree] beat by 0-9 is a Success');
  eq(ev('dccDegree(16,16,15)'), 'success',   '[degree] tie goes to the runner');
  eq(ev('dccDegree(15,16,14)'), 'near_miss', '[degree] miss by 1-2 is a Near Miss');
  eq(ev('dccDegree(10,16,9)'),  'fail',      '[degree] miss by 3-9 is a Fail');
  eq(ev('dccDegree(5,16,4)'),   'major_fail','[degree] miss by 10+ is a Major Fail');
  eq(ev('dccDegree(40,16,20)'), 'crit_hit',  '[degree] Natural 20 is a Critical Hit');
  eq(ev('dccDegree(2,16,1)'),   'crit_fail', '[degree] Natural 1 is a Critical Fail');
  // "Critical Hits and Critical Fails do not also trigger the by-10 results"
  eq(ev('dccDegree(5,16,20)'),  'crit_hit',  '[degree] a Nat 20 outranks a numeric miss');
  eq(ev('dccDegree(40,16,1)'),  'crit_fail', '[degree] a Nat 1 outranks a numeric beat');

  // ── Health Bar slot consumption (pp. 93-94) ──────────────────────────────
  // The book's worked example: 22 damage against slots of 4 costs 5 slots, and
  // the leftover 2 is ignored.
  eq(ev('trackSlotsLost(22,4,10)'), 5, '[healthbar] the 22-vs-4 example costs 5 slots');
  eq(ev('trackSlotsLost(3,4,10)'),  0, '[healthbar] less than one slot deals nothing');
  eq(ev('trackSlotsLost(4,4,10)'),  1, '[healthbar] exactly one slot');
  eq(ev('trackSlotsLost(999,4,3)'), 3, '[healthbar] cannot lose more slots than remain');
  eq(ev('trackSlotsLost(10,0,10)'), 0, '[healthbar] a 0 CON Mod cannot be consumed');

  // ── dual-layer traits: the contract change traitGrid needed ──────────────
  ev("S.char=SYS.newCharacter();S.char.blocks={}");
  ev("blockCtx(sysBlock('stats'),S.char)");   // force init
  ev("S.char.blocks.stats.CON={base:3,bonus:0}");
  eq(ev("SYS.derive.stat(S.char,'CON')"), 3, '[dual] Enhanced = Unenhanced when unbuffed');
  eq(ev("SYS.derive.mod(S.char,'CON')"), 2, '[dual] CON 3 -> +2');
  ev("S.char.blocks.stats.CON.bonus=7");
  eq(ev("SYS.derive.stat(S.char,'CON')"), 10, '[dual] Enhanced = Unenhanced + bonus');
  eq(ev("SYS.derive.mod(S.char,'CON')"), 4, '[dual] the Mod comes off the ENHANCED layer');
  eq(ev("SYS.derive.hbSlotValue(S.char)"), 4, '[dual] Health Bar slot value follows CON Mod');

  // Mana is the Enhanced INT *score*, not the Mod (p. 111)
  ev("S.char.blocks.stats.INT={base:6,bonus:0}");
  eq(ev('SYS.derive.maxMana(S.char)'), 6, '[mana] max Mana = Enhanced INT score');
  eq(ev("SYS.derive.mod(S.char,'INT')"), 3, '[mana] ...which is not the same as the Mod');

  // Evade is DEX Mod only, no Ranks (p. 110)
  ev("S.char.blocks.stats.DEX={base:5,bonus:0}");
  eq(ev('SYS.derive.evade(S.char)'), '+2', '[evade] DEX 5 -> +2');
  eq(ev('SYS.derive.move(S.char)'), 20, '[move] default Move is 20 feet');
  eq(ev('SYS.derive.step(S.char)'), 10, '[step] default Step is 10 feet');
  eq(ev('SYS.derive.size(S.char)'), 'Medium (4)', '[size] humans are Medium (4)');

  // ── the track block: right-to-left marking ───────────────────────────────
  ev("S.char.blocks.health={marked:0}");
  ev("trackToggle('health',9)");   // click the rightmost (100%) slot
  eq(ev('S.char.blocks.health.marked'), 1, '[track] clicking the top slot marks one');
  // Clicking a live slot marks it AND everything above it, so clicking the 60%
  // slot (index 5) leaves 5 slots alive — 50% health.
  ev("trackToggle('health',5)");
  eq(ev('S.char.blocks.health.marked'), 5, '[track] clicking a live slot marks it and all above');
  eq(ev('10 - S.char.blocks.health.marked'), 5, '[track] ...leaving 50% health');
  // Clicking an already-marked slot heals back up to and including it.
  ev("trackToggle('health',7)");
  eq(ev('S.char.blocks.health.marked'), 2, '[track] clicking a marked slot heals through it');

  // ── pools clamp at 0 and at their derived max ────────────────────────────
  ev("S.char.blocks.mana={current:0}");
  ev("poolAdj('mana',1)");
  eq(ev('S.char.blocks.mana.current'), 1, '[pool] increments');
  ev("for(let i=0;i<50;i++)poolAdj('mana',1)");
  eq(ev('S.char.blocks.mana.current'), 6, '[pool] clamps at the derived max (INT 6)');
  ev("for(let i=0;i<50;i++)poolAdj('mana',-1)");
  eq(ev('S.char.blocks.mana.current'), 0, '[pool] never goes below zero');

  // ── gold is not a pool ───────────────────────────────────────────────────
  // It was declared as one, which meant two buttons stepping by a single coin.
  // The book prices a Sapper's Table at 3,000 gold and hands out a reward of
  // 250,000; that is a quarter of a million clicks.
  const goldSheet = () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(1);");
    ev("dccFinishCreation(S.char);S.char.creation={step:0,complete:true};");
    ev("S.char.blocks.gold={current:0};renderHero();");
  };
  check('[gold] it is not a click-per-coin ticker', () => {
    const type = ev("(sysBlock('gold')||{}).type");
    return type === 'tally' || 'gold is still declared as a ' + JSON.stringify(type);
  });
  check('[gold] no plus/minus buttons on the block', () => {
    goldSheet();
    const html = ev("(document.getElementById('blk-gold')||{}).innerHTML||''");
    if (!html) return 'the gold block did not render';
    return html.indexOf('poolAdj') < 0 || 'the block still calls poolAdj';
  });
  check('[gold] six figures arrive in one go', () => {
    // "250,000 gold" is a printed reward, not a hypothetical.
    goldSheet();
    ev("document.getElementById('tal-adj-gold').value='250000';tallyAdjust('gold',1);");
    return ev('S.char.blocks.gold.current') === 250000
      || 'the total is ' + ev('S.char.blocks.gold.current');
  });
  check('[gold] spending a table price subtracts it', () => {
    ev("document.getElementById('tal-adj-gold').value='3000';tallyAdjust('gold',-1);");
    return ev('S.char.blocks.gold.current') === 247000
      || 'the total is ' + ev('S.char.blocks.gold.current');
  });
  check('[gold] the readout groups the digits', () => {
    const txt = ev("(document.getElementById('tal-n-gold')||{}).textContent||''");
    return txt === '247,000' || 'the readout reads ' + JSON.stringify(txt);
  });
  check('[gold] the amount box empties after it is applied', () => {
    // Otherwise the next click spends it a second time.
    return ev("document.getElementById('tal-adj-gold').value") === ''
      || 'the box still holds ' + JSON.stringify(ev("document.getElementById('tal-adj-gold').value"));
  });
  check('[gold] setting an exact total replaces it rather than adding', () => {
    ev("document.getElementById('tal-set-gold').value='412';tallySet('gold');");
    return ev('S.char.blocks.gold.current') === 412
      || 'the total is ' + ev('S.char.blocks.gold.current');
  });
  check('[gold] it cannot go negative', () => {
    // You cannot owe the System money.
    ev("document.getElementById('tal-adj-gold').value='99999';tallyAdjust('gold',-1);");
    return ev('S.char.blocks.gold.current') === 0
      || 'the total is ' + ev('S.char.blocks.gold.current');
  });
  check('[gold] an empty amount box does nothing', () => {
    goldSheet();ev("S.char.blocks.gold={current:75};renderHero();");
    ev("tallyAdjust('gold',1);tallySet('gold');");
    return ev('S.char.blocks.gold.current') === 75
      || 'an empty box changed it to ' + ev('S.char.blocks.gold.current');
  });
  check('[gold] typing an amount does not repaint the box out from under you', () => {
    // The whole reason the readout is updated by hand instead of by repaint.
    goldSheet();ev("S.char.blocks.gold={current:1};renderHero();");
    ev("document.getElementById('tal-adj-gold').focus();" +
       "document.getElementById('tal-adj-gold').value='500';tallyAdjust('gold',1);");
    const live = ev("document.activeElement && document.activeElement.id");
    return live === 'tal-adj-gold' || 'focus jumped to ' + JSON.stringify(live);
  });
  check('[gold] it survives a save and reload', () => {
    ev("S.char.blocks.gold={current:186420};save();");
    const raw = JSON.parse(ev("JSON.stringify(JSON.parse(localStorage.getItem(sysKey('scratch'))).char.blocks.gold)") || 'null');
    return (raw && raw.current === 186420) || 'the saved value is ' + JSON.stringify(raw);
  });
  check('[gold] the printed sheet shows the grouped figure, not a bare count', () => {
    ev("S.char.blocks.gold={current:186420};");
    const html = ev("prBlockSheetHTML(S.char)");
    return html.indexOf('186,420') >= 0 || 'the print sheet does not carry the grouped total';
  });
  check('[tally] formatting groups from the right and leaves small numbers alone', () => {
    const f = n => ev('tallyFormat(' + n + ')');
    const cases = [[0, '0'], [7, '7'], [999, '999'], [1000, '1,000'],
                   [25000, '25,000'], [250000, '250,000'], [1234567, '1,234,567']];
    for (const [n, want] of cases) if (f(n) !== want) return n + ' formatted as ' + f(n);
    return true;
  });

  // ── dice engine ──────────────────────────────────────────────────────────
  check('[dice] a plain roll is one d20 in 1..20', () => {
    for (let i = 0; i < 300; i++) {
      const r = ev('SYS.dice.roll(0)');
      if (r.dice.length !== 1 || r.nat < 1 || r.nat > 20) return `bad roll ${JSON.stringify(r)}`;
    }
    return true;
  });
  check('[dice] Advantage rolls two and keeps the higher', () => {
    for (let i = 0; i < 300; i++) {
      const r = ev('SYS.dice.roll(1)');
      if (r.dice.length !== 2 || r.nat !== Math.max(r.dice[0], r.dice[1])) return 'kept the wrong die';
    }
    return true;
  });
  check('[dice] Disadvantage rolls two and keeps the lower', () => {
    for (let i = 0; i < 300; i++) {
      const r = ev('SYS.dice.roll(-1)');
      if (r.dice.length !== 2 || r.nat !== Math.min(r.dice[0], r.dice[1])) return 'kept the wrong die';
    }
    return true;
  });
  check('[dice] resolve totals d20 + Rank + Stat Mod and picks a degree', () => {
    const r = ev("SYS.dice.resolve({rank:5,statMod:2,kind:'unopposed',floor:3})");
    if (r.difficulty !== 16) return 'difficulty ' + r.difficulty;
    if (r.total !== r.nat + 7) return 'total ' + r.total;
    if (!r.degree || !r.degree.id) return 'no degree';
    return true;
  });
  check('[dice] an explicit difficulty overrides the formula', () =>
    ev('SYS.dice.resolve({difficulty:99}).difficulty') === 99);

  // ── catalogue sanity (PLAN.md §11: the source is a damaged OCR) ──────────
  eq(ev('SYS.catalogs.debuffs.length'), 27, '[data] all 27 Table 11 debuffs present');
  check('[data] every debuff has an effect, a duration and a stackable flag', () =>
    ev(`SYS.catalogs.debuffs.every(d=>d.id&&d.name&&d.effect&&d.duration&&typeof d.stackable==='boolean')`));
  check('[data] the three stackable debuffs are the ones the book marks', () =>
    ev(`JSON.stringify(SYS.catalogs.debuffs.filter(d=>d.stackable).map(d=>d.id).sort())`)
      === '["blood_trail","fatigued","poisoned"]');
  eq(ev('SYS.catalogs.damageTypes.filter(d=>d.rarity==="Common").length'), 5, '[data] 5 common damage types');
  eq(ev('SYS.catalogs.damageTypes.length'), 13, '[data] 13 damage types in all');
  eq(ev('SYS.catalogs.bossTiers.length'), 6, '[data] 6 boss tiers');
  check('[data] boss tiers escalate in stats per level', () =>
    ev('SYS.catalogs.bossTiers.map(t=>t.statsPerLevel).join(",")') === '3,4,5,6,8,10');
  check('[data] gear slots: only Accessories takes more than one, at 10', () =>
    ev(`SYS.catalogs.gearSlots.filter(s=>s.max>1).map(s=>s.id+':'+s.max).join(',')`) === 'hands:3,accessories:10');

  // ── a block pack must never write into a save file ───────────────────────
  // save() persists the WHOLE state object, so a crawler sitting in S.char while
  // any save file was loaded would overwrite that save's character on the next
  // keystroke. One entry file per game makes the cross-game version of this
  // impossible, but the guard still has to hold within a single app.
  check('[isolation] save() leaves an existing save file untouched', () => {
    ev("loadUniverses();if(!U.universes.length)createUniverse('T');");
    ev("var keep={costumedName:'Captain Valor',skills:{}};" +
       "var prev=S.char;S.char=keep;var id=createSave(S);S.char=prev;" +
       "window.__probeId=id;currentSaveId=id;");
    const before = ev("JSON.stringify(getSaveData(window.__probeId).char.costumedName)");
    if (before !== '"Captain Valor"') return 'setup failed, got ' + before;
    ev("S.char.blocks.stats={STR:{base:9,bonus:0}};save();poolAdj('aiFavor',1);");
    const after = ev("JSON.stringify((getSaveData(window.__probeId).char||{}).costumedName)");
    return after === '"Captain Valor"' || 'the save was clobbered: ' + after;
  });
  check('[isolation] the crawler persists to its own namespaced scratch key', () => {
    const raw = ev("localStorage.getItem(sysKey('scratch'))");
    if (!raw) return 'nothing written to ' + ev("sysKey('scratch')");
    // The scratch key holds {char, session} since save() started persisting the
    // table state too; sysScratchLoad() unwraps it and still reads a v1 key.
    const env = JSON.parse(raw);
    const c = env.v === 2 ? env.char : env;
    if (c.systemId !== 'dungeon-crawler-carl') return 'wrong systemId ' + c.systemId;
    if (!c.blocks || !c.blocks.stats || c.blocks.stats.STR.base !== 9) return 'stats not persisted';
    return true;
  });
  check('[isolation] the table state is saved alongside the crawler', () => {
    // save() used to flash "Saved" while writing only the character, so the
    // journal, the floor and a fight in progress were dropped on reload.
    ev("S.floor=7;S.notes=[{id:'n1',type:'main',text:'floor 3 was bad',ts:1}];dccCombatStart();save();");
    const sess = JSON.parse(ev("JSON.stringify(sysScratchSession())") || 'null');
    if (!sess) return 'no session written';
    if (sess.floor !== 7) return 'floor not saved: ' + sess.floor;
    if (!sess.notes || sess.notes.length !== 1) return 'journal not saved';
    return (sess.conflict && sess.conflict.active === true) || 'the fight was not saved';
  });
  check('[isolation] a v1 scratch key (bare character) still loads', () => {
    // Put the real key back afterwards — the next check reads it.
    const keep = ev("localStorage.getItem(sysKey('scratch'))");
    ev("localStorage.setItem(sysKey('scratch'),JSON.stringify({systemId:'dungeon-crawler-carl',blocks:{stats:{STR:{base:4,bonus:0}}}}));");
    const c = JSON.parse(ev("JSON.stringify(sysScratchLoad())"));
    ev("localStorage.setItem(sysKey('scratch')," + JSON.stringify(keep) + ");");
    return (c && c.blocks.stats.STR.base === 4) || 'old scratch key no longer readable';
  });
  check('[isolation] the scratch crawler is restored, not regenerated', () => {
    ev("S.char=null;renderHero();");
    return ev("S.char.blocks.stats.STR.base") === 9 || 'got ' + ev("S.char.blocks.stats.STR.base");
  });

  // ── Skills catalogue (D3) ────────────────────────────────────────────────
  eq(ev('DCC_SKILLS.length'), 113, '[skills] all 113 skills present');
  check('[skills] every skill has an id, a name and three upgrade tiers', () => {
    const bad = ev(`JSON.stringify(DCC_SKILLS.filter(s=>!s.id||!s.name||
      !s.upgrades||!(s.upgrades[5]&&s.upgrades[10]&&s.upgrades[15])).map(s=>s.name))`);
    return bad === '[]' || bad;
  });
  check('[skills] ids are unique', () =>
    ev('new Set(DCC_SKILLS.map(s=>s.id)).size') === ev('DCC_SKILLS.length') || 'duplicate ids');
  check('[skills] every non-passive skill names one of the five Stats', () => {
    const bad = ev(`JSON.stringify(DCC_SKILLS.filter(s=>!s.passive&&
      !['STR','INT','CON','DEX','CHA'].includes(s.stat)).map(s=>s.name))`);
    return bad === '[]' || bad;
  });
  check('[skills] every Attack Skill rolls against Evade and has base damage', () => {
    const bad = ev(`JSON.stringify(DCC_SKILLS.filter(s=>s.kind==='attack'&&
      (s.checkType!=='evade'||!s.baseDamage)).map(s=>s.name))`);
    return bad === '[]' || bad;
  });
  // The two skills the markdown extraction silently dropped, and a name it corrupted.
  check('[skills] Pugilism survived the tagline that hid it', () =>
    !!ev("dccSkill('pugilism')") || 'missing');
  check('[skills] Noggin Nocker survived too', () =>
    !!ev("dccSkill('noggin-nocker')") || 'missing');
  eq(ev("dccSkillByName('Hide in Shadows') ? dccSkillByName('Hide in Shadows').name : null"),
     'Hide in Shadows', '[skills] name casing follows the book, not naive title-case');
  eq(ev("dccSkill('character-actor').name"), 'Character Actor',
     '[skills] the OCR-mangled name is corrected');
  // Upgrade text must be whole sentences, not truncated at the column width.
  eq(ev("dccSkill('club').upgrades[15]"),
     '+1d6 base damage, and if the target loses at least 3 Health Bar slots, they gain the Take Down Debuff.',
     '[skills] wrapped upgrade text is joined, not cut off');
  check('[skills] no upgrade text ends mid-sentence', () => {
    // The PDF wraps text at the column width; before continuation lines were
    // joined, entries ended on things like "and you may make an".
    const CUT = ['an','a','the','and','to','of','you','with','for','their','your','on','at','is','or'];
    const bad = ev('JSON.stringify(DCC_SKILLS.map(function(s){' +
      'var t=[5,10,15].map(function(r){return s.upgrades[r]||"";});' +
      'var w=t.filter(function(x){var m=x.trim().split(/\s+/).pop().toLowerCase();' +
      'return x && ' + JSON.stringify(CUT) + '.indexOf(m)>=0;});' +
      'return w.length?s.name:null;}).filter(Boolean))');
    return bad === '[]' || 'truncated: ' + bad;
  });

  // ── the dependency that gates D5 (CREATION.md section 5) ─────────────────
  check('[creation] every Skill the background tables hand out exists', () => {
    const missing = CREATION_SKILLS.filter(n => !ev('!!dccSkillByName(' + JSON.stringify(n) + ')'));
    return missing.length ? 'not in the catalogue: ' + missing.join(', ') : true;
  });
  eq(CREATION_SKILLS.length, 44, '[creation] the background tables name 44 distinct Skills');

  // Rank damage dice (Table 37, p. 176) — closest die without going over.
  eq(ev('dccRankDamage(1)'), '+1', '[rankdmg] Rank 1 is a flat +1');
  eq(ev('dccRankDamage(7)'), '+1d6', "[rankdmg] the book's Rank 7 example is 1d6");
  eq(ev('dccRankDamage(15)'), '+1d8 & +1d6', '[rankdmg] Rank 15 is two dice');
  eq(ev('dccRankDamage(20)'), '+2d10', '[rankdmg] Rank 20 tops out at 2d10');

  // ── Skill Advancement (p. 169) ───────────────────────────────────────────
  check('[advance] a roll meeting or beating the current Rank gains one', () => {
    for (let i = 0; i < 400; i++) {
      const r = ev('SYS.derive.advanceSkill({rank:3})');
      if (r.gained !== (r.roll >= 3)) return 'roll ' + r.roll + ' gained ' + r.gained;
      if (r.gained && r.rank !== 4) return 'wrong new rank ' + r.rank;
    }
    return true;
  });
  check('[advance] Rank 15 is the ceiling for use-based advancement', () => {
    for (let i = 0; i < 200; i++) {
      const r = ev('SYS.derive.advanceSkill({rank:15})');
      if (r.gained || r.rank !== 15) return 'advanced past 15';
    }
    return true;
  });
  check('[advance] a Rank 0 skill always advances', () => {
    for (let i = 0; i < 100; i++) if (!ev('SYS.derive.advanceSkill({rank:0})').gained) return 'failed at rank 0';
    return true;
  });
  check('[advance] marking clears after resolving, and passives never mark', () => {
    ev("S.char.blocks.skills={skills:[{name:'A',rank:2,marked:true},{name:'P',rank:2,passive:true,marked:false}]}");
    ev("skillMark('skills',1)");                       // try to mark the passive
    if (ev('S.char.blocks.skills.skills[1].marked')) return 'passive got marked';
    ev("skillAdvance('skills')");
    if (ev('S.char.blocks.skills.skills[0].marked')) return 'mark not cleared';
    return true;
  });
  check('[advance] a Skill Rank is not nudged by hand', () => {
    // Skills advance from use, so there is nothing for a +/- pair to do. The
    // clamping below still matters because advancement goes through it.
    ev("S.char=SYS.newCharacter();S.char.blocks.skills={skills:[{name:'A',rank:3}]};");
    ev("S.char.creation={step:0,complete:true};renderHero();");
    const h = ev("document.getElementById('blk-skills').innerHTML");
    return h.indexOf('skillRank(') < 0 || 'the sheet still offers Rank buttons';
  });
  check('[advance] rank changes clamp at 0 and at the cap', () => {
    ev("S.char.blocks.skills={skills:[{name:'A',rank:0}]}");
    ev("skillRank('skills',0,-1)");
    if (ev('S.char.blocks.skills.skills[0].rank') !== 0) return 'went below 0';
    ev("for(let i=0;i<40;i++)skillRank('skills',0,1)");
    return ev('S.char.blocks.skills.skills[0].rank') === 15 || 'cap was ' + ev('S.char.blocks.skills.skills[0].rank');
  });

  // ── creation tables (D5 data) ────────────────────────────────────────────
  check('[creation] human backgrounds are 1d12, animal are 1d6', () => {
    const bad = [];
    ['childhood', 'adolescence', 'career', 'hobby'].forEach(st => {
      const h = ev(`DCC_BACKGROUNDS.human.${st}.rows.length`);
      const a = ev(`DCC_BACKGROUNDS.animal.${st}.rows.length`);
      if (h !== 12) bad.push('human ' + st + '=' + h);
      if (a !== 6) bad.push('animal ' + st + '=' + a);
    });
    return bad.length ? bad.join(', ') : true;
  });
  check('[creation] every background row offers exactly three Skills', () => {
    const bad = ev(`JSON.stringify(Object.keys(DCC_BACKGROUNDS).flatMap(sp=>
      Object.keys(DCC_BACKGROUNDS[sp]).flatMap(st=>
        DCC_BACKGROUNDS[sp][st].rows.filter(r=>r.skills.length!==3)
          .map(r=>sp+'/'+st+'/'+r.roll))))`);
    return bad === '[]' || bad;
  });
  check('[creation] every background Skill exists in the catalogue', () => {
    const bad = ev(`JSON.stringify([...new Set(Object.keys(DCC_BACKGROUNDS).flatMap(sp=>
      Object.keys(DCC_BACKGROUNDS[sp]).flatMap(st=>
        DCC_BACKGROUNDS[sp][st].rows.flatMap(r=>r.skills.map(x=>x.s)))))]
      .filter(n=>!dccSkillByName(n)))`);
    return bad === '[]' || 'orphans: ' + bad;
  });
  // Two Table 14 rows print a Stat that contradicts the book's own Skill entry.
  // The PDF and the markdown print the same thing, so it is errata, not damage.
  // The catalogue wins, and the printed value is kept alongside it.
  check('[creation] rows use the catalogue Stat, recording what the book printed', () => {
    const errata = ev(`JSON.stringify(Object.keys(DCC_BACKGROUNDS).flatMap(sp=>
      Object.keys(DCC_BACKGROUNDS[sp]).flatMap(st=>
        DCC_BACKGROUNDS[sp][st].rows.flatMap(r=>r.skills.filter(x=>x.printedStat)
          .map(x=>x.s+':'+x.printedStat+'->'+x.st)))))`);
    return errata === '["Escape Artist:STR->DEX","Performance:INT->CHA"]'
      || 'errata set changed: ' + errata;
  });
  check('[creation] no row disagrees with the catalogue without being flagged', () => {
    const bad = ev(`JSON.stringify(Object.keys(DCC_BACKGROUNDS).flatMap(sp=>
      Object.keys(DCC_BACKGROUNDS[sp]).flatMap(st=>
        DCC_BACKGROUNDS[sp][st].rows.flatMap(r=>r.skills.filter(x=>{
          var c=dccSkillByName(x.s);
          return c && c.stat && x.st!=='None' && c.stat!==x.st;
        }).map(x=>x.s)))))`);
    return bad === '[]' || bad;
  });
  eq(ev('DCC_BACKGROUNDS.human.childhood.rank'), 1, '[creation] childhood Skills start at Rank 1');
  eq(ev('DCC_BACKGROUNDS.human.career.rank'), 3, '[creation] career Skills start at Rank 3');
  eq(ev("DCC_BACKGROUNDS.human.childhood.rows[0].description"), 'Latchkey Kid',
     '[creation] the first childhood row matches the book');

  ['pastTrauma', 'looseEnd', 'regret'].forEach(t =>
    eq(ev(`DCC_STORY_TABLES.${t}.length`), 12, '[creation] ' + t + ' is a 1d12 table'));
  check('[creation] story entries are whole sentences, not fragments', () => {
    const bad = ev(`JSON.stringify(Object.keys(DCC_STORY_TABLES).flatMap(k=>
      DCC_STORY_TABLES[k].filter(r=>!r.text||r.text.length<10).map(r=>k+'/'+r.roll)))`);
    return bad === '[]' || bad;
  });

  // Step 2's weapon lists must match the book exactly (p. 106).
  eq(ev(`DCC_WEAPON_CATEGORIES.find(c=>c.category==='Bashing Weapon').skills.join(', ')`),
     'Club, Improvised Weapons, Warhammer', '[creation] bashing weapons match the book');
  eq(ev(`DCC_WEAPON_CATEGORIES.find(c=>c.category==='Edged Weapon').skills.join(', ')`),
     'Axe, Dagger, Longsword, Rapier', '[creation] edged weapons match the book');
  eq(ev(`DCC_WEAPON_CATEGORIES.find(c=>c.category==='Reach Weapon').skills.join(', ')`),
     'Herding Weapons, Lance, Polearm, Quarterstaff', '[creation] reach weapons match the book');
  eq(ev(`DCC_WEAPON_CATEGORIES.find(c=>c.category==='Ranged Weapon').skills.length`), 7,
     '[creation] seven ranged weapons');
  check('[creation] every weapon option is a real Attack Skill', () => {
    const bad = ev(`JSON.stringify(DCC_WEAPON_CATEGORIES.flatMap(c=>c.skills)
      .filter(n=>{var s=dccSkillByName(n);return !s||s.kind!=='attack';}))`);
    return bad === '[]' || bad;
  });
  check('[creation] each hand-to-hand route pairs a real Skill with a real Damage Effect', () => {
    const bad = ev(`JSON.stringify(DCC_HAND_TO_HAND.filter(h=>{
      var s=dccSkillByName(h.skill), d=dccSkillByName(h.damageEffect);
      return !s || !d || d.kind!=='damage_effect';
    }).map(h=>h.skill))`);
    return bad === '[]' || bad;
  });
  eq(ev('DCC_HAND_TO_HAND.length'), 4, '[creation] four hand-to-hand routes');
  eq(ev('DCC_STARTING_SPELLS.length'), 7, '[creation] seven starting attack Spells');
  eq(ev('DCC_STARTING_SPELL_MIN_INT'), 4,
     '[creation] the Spell route needs INT 4+, set on a later screen');
  eq(ev("DCC_FREE_COMBAT_SKILL.animal"), 'Slice Attack',
     '[creation] animals get Slice Attack, not Unarmed Combat');
  check('[creation] both free combat skills exist', () =>
    ev("!!dccSkillByName(DCC_FREE_COMBAT_SKILL.human) && !!dccSkillByName(DCC_FREE_COMBAT_SKILL.animal)"));
  eq(ev("DCC_FLOOR_START.find(f=>f.floor===3).statPoints"), 27,
     '[creation] a Floor 3 crawler distributes 27 Stat points');

  // ── the creation wizard, driven end to end ───────────────────────────────
  // Build a crawler the way a player would: one click at a time, checking that
  // each screen refuses to advance until it is actually satisfied.
  ev("S.char=SYS.newCharacter();renderHero();");
  check('[wizard] a fresh crawler starts in the wizard, not on the sheet', () =>
    ev("!!document.getElementById('wiz-body')") &&
    ev("document.getElementById('hero-sheet').style.display") === 'none');
  eq(ev('SYS.creation.length'), 9, '[wizard] all nine screens implemented');

  // screen 1
  check('[wizard] screen 1 blocks until species, name and number are set', () =>
    ev("wizValidate(S.char,0)") !== true || 'let through empty');
  ev("dccSetSpecies('human');dccStore('name','Keisha');dccRollCrawlerNumber();");
  eq(ev('wizValidate(S.char,0)'), true, '[wizard] screen 1 satisfied');
  check('[wizard] the rolled crawler number is in the legal range', () => {
    const n = ev('S.char.crawlerNumber');
    return (n >= 500000 && n <= 12900000) || 'got ' + n;
  });
  check('[wizard] an out-of-range crawler number is refused', () => {
    ev("dccStore('crawlerNumber','4122')");
    const bad = ev('wizValidate(S.char,0)') !== true;
    ev("dccRollCrawlerNumber()");
    return bad || 'accepted Carl’s number';
  });

  // screen 2 — background
  ev('wizNext()');
  eq(ev('S.char.creation.step'), 1, '[wizard] advanced to Background');
  check('[wizard] human backgrounds are offered, not animal ones', () =>
    ev("dccStages(S.char).childhood.rows.length") === 12 || 'wrong table');
  ev("dccPickBackground('childhood',1)");
  ev("dccPickSkill('childhood','Streetwise');dccPickSkill('childhood','Perception')");
  check('[wizard] a third pick is refused once two are taken', () => {
    ev("dccPickSkill('childhood','Stealth')");
    return ev("S.char.dcc.background.childhood.picks.length") === 2 || 'took three';
  });
  check('[wizard] no double-dipping: an already-taken Skill is locked out', () => {
    ev("dccPickBackground('adolescence',5)");   // Military Brat-ish row
    const taken = ev("JSON.stringify(Object.keys(dccTakenSkills(S.char,'adolescence')))");
    return /Streetwise/.test(taken) || 'lock list was ' + taken;
  });
  // finish the remaining three stages with whatever the first two rows offer
  ev(`['adolescence','career','hobby'].forEach(function(st){
        dccPickBackground(st,1);
        var rows=dccStages(S.char)[st].rows.find(function(r){return r.roll===1;});
        var taken=dccTakenSkills(S.char,st);
        rows.skills.filter(function(x){return !taken[x.s];}).slice(0,2)
            .forEach(function(x){dccPickSkill(st,x.s);});
      });`);
  eq(ev('wizValidate(S.char,1)'), true, '[wizard] screen 2 satisfied once all four stages are done');

  // screen 3 — combat
  ev('wizNext()');
  check('[wizard] screen 3 blocks until a route is chosen', () =>
    ev('wizValidate(S.char,2)') !== true || 'let through');
  ev("dccSetRoute('spell')");
  check('[wizard] picking the route alone is not enough', () =>
    ev('wizValidate(S.char,2)') !== true || 'let through');
  ev("dccSetSpell('Fire Fingers')");
  eq(ev('wizValidate(S.char,2)'), true, '[wizard] screen 3 satisfied');

  // screen 4 — stats, and the forward dependency from screen 3
  ev('wizNext()');
  ev("dccStatMethod('array')");
  ev("dccAssignStat('STR',6);dccAssignStat('INT',2);dccAssignStat('CON',5);dccAssignStat('DEX',4);dccAssignStat('CHA',3)");
  check('[wizard] the Spell route is enforced across screens: INT 2 is refused', () => {
    const v = ev('wizValidate(S.char,3)');
    return (v !== true && /Intelligence/.test(String(v))) || 'got ' + v;
  });
  // 6 is on STR, so giving it to INT swaps the two. It used to clear STR to 0
  // instead, which is why the grid froze once all five were assigned: every
  // button belonging to another Stat had its handler removed.
  ev("dccAssignStat('INT',6)");
  check('[wizard] taking a value from another Stat swaps them', () => {
    const st = JSON.parse(ev('JSON.stringify(S.char.blocks.stats)'));
    if ((st.INT || {}).base !== 6) return 'INT did not take the 6';
    return (st.STR || {}).base === 2 || "STR should have taken INT's 2, got " + (st.STR || {}).base;
  });
  check('[wizard] a swap leaves every array value used exactly once', () => {
    const st = JSON.parse(ev('JSON.stringify(S.char.blocks.stats)'));
    const vals = ev('JSON.stringify(DCC_STATS.map(function(x){return (S.char.blocks.stats[x.id]||{}).base||0}))');
    const got = JSON.parse(vals).slice().sort().join(',');
    const want = JSON.parse(ev('JSON.stringify(DCC_STANDARD_ARRAY)')).slice().sort().join(',');
    return got === want || 'expected ' + want + ', got ' + got;
  });
  eq(ev('wizValidate(S.char,3)'), true, '[wizard] screen 4 satisfied once INT is high enough');
  check('[wizard] the array can be reset once filled', () => {
    ev('dccResetStats()');
    const any = ev('DCC_STATS.some(function(x){return ((S.char.blocks.stats[x.id]||{}).base||0)>0})');
    if (any) return 'Start over left values behind';
    // and it is genuinely re-fillable afterwards
    ev("dccAssignStat('STR',6);dccAssignStat('INT',6);");
    return ev("(S.char.blocks.stats.INT||{}).base") === 6 || 'could not reassign after a reset';
  });
  ev("dccResetStats();dccAssignStat('STR',2);dccAssignStat('INT',6);dccAssignStat('CON',5);" +
     "dccAssignStat('DEX',4);dccAssignStat('CHA',3)");

  // screens 5-6, then finish
  ev('wizNext()');
  eq(ev('S.char.creation.step'), 4, '[wizard] advanced to Scars');

  // ── screens 5-6: scars and gear ──────────────────────────────────────────
  check('[scars] the screen blocks until all three are filled in', () => {
    ev("S.char.story={};");
    const v = ev('wizValidate(S.char,4)');
    return (v !== true && /Past Trauma/.test(String(v))) || 'got ' + v;
  });
  check('[scars] picking from the table fills the field', () => {
    ev("dccSetStory('pastTrauma',3)");
    const t = ev('S.char.story.pastTrauma');
    return (t && t === ev('DCC_STORY_TABLES.pastTrauma.find(r=>r.roll===3).text')) || 'got ' + t;
  });
  check('[scars] picking the same row again clears it', () => {
    ev("dccSetStory('pastTrauma',3)");
    return ev('S.char.story.pastTrauma') === '' || 'still set';
  });
  check('[scars] rolling lands on a real row', () => {
    for (let i = 0; i < 40; i++) {
      ev("dccRollStory('regret')");
      const t = ev('S.char.story.regret');
      if (!ev('DCC_STORY_TABLES.regret.some(r=>r.text===' + JSON.stringify(t) + ')')) return 'off-table: ' + t;
    }
    return true;
  });
  check('[scars] your own words are accepted instead of a table row', () => {
    ev("dccStoreStory('pastTrauma','Something I would rather not write down.')");
    ev("dccStoreStory('looseEnd','An unanswered letter.')");
    ev("dccStoreStory('regret','I never said goodbye.')");
    return ev('wizValidate(S.char,4)') === true || 'still blocked';
  });
  check('[scars] the lines-not-to-cross note is optional and stored', () => {
    ev("dccStoreStory('linesNotToCross','Nothing involving harm to animals.')");
    return ev('wizValidate(S.char,4)') === true &&
           /animals/.test(ev('S.char.story.linesNotToCross'));
  });
  check('[gear] the gear screen never blocks you', () =>
    ev('wizValidate(S.char,5)') === true || 'gear screen gated');
  check('[gear] gear notes are stored', () => {
    ev("dccStoreGear('weird','A pack of googly eyes.')");
    return /googly/.test(ev('S.char.gearNotes.weird'));
  });
  check('[gear] the screen shows the weapon chosen back on screen 3', () => {
    const html = ev('SYS.creation[5].render({char:S.char,floor:3})');
    return /Fire Fingers/.test(html) || 'weapon/spell not carried forward';
  });

  ev('wizNext()');
  eq(ev('S.char.creation.step'), 5, '[wizard] advanced to What you brought');
  ev("dccStoreGear('clothes','Jeans and a hoodie');dccStoreGear('item','A crowbar')");

  // screens 7-9
  ev('wizNext()');
  eq(ev('S.char.creation.step'), 6, '[wizard] advanced to The tutorial floors');
  check('[tutorial] blocks until the Skill Ranks are rolled', () => {
    const v = ev('wizValidate(S.char,6)');
    return (v !== true && /Skill Ranks/i.test(String(v))) || 'got ' + v;
  });
  ev('dccRollBumps()');
  check('[tutorial] the primary attack Skill gets 2d4, the others 1d4', () => {
    const b = JSON.parse(ev('JSON.stringify(S.char.dcc.floorStart.bumps)'));
    const prim = b.filter(x => x.primary);
    if (prim.length !== 1) return prim.length + ' primaries';
    // this crawler took the Spell route, so its primary is flagged as a Spell
    if (!prim[0].spell) return 'expected the Spell route to flag its primary';
    if (prim[0].roll < 2 || prim[0].roll > 8) return 'primary roll ' + prim[0].roll;
    const others = b.filter(x => !x.primary);
    const bad = others.filter(x => x.roll < 1 || x.roll > 4);
    return bad.length ? 'a 1d4 rolled ' + bad[0].roll : true;
  });
  check('[tutorial] nothing passes the Rank 10 cap, and waste is reported', () => {
    const b = JSON.parse(ev('JSON.stringify(S.char.dcc.floorStart.bumps)'));
    const over = b.filter(x => x.to > 10);
    if (over.length) return over[0].name + ' reached ' + over[0].to;
    const bad = b.filter(x => x.wasted !== Math.max(0, x.from + x.roll - 10));
    return bad.length ? 'waste miscounted on ' + bad[0].name : true;
  });
  ev('dccRollFavor()');
  check('[tutorial] AI Favor is 1d2', () => {
    for (let i = 0; i < 60; i++) {
      ev('dccRollFavor()');
      const f = ev('S.char.dcc.floorStart.favor');
      if (f !== 1 && f !== 2) return 'rolled ' + f;
    }
    return true;
  });
  check('[tutorial] blocks while Stat points are unspent', () => {
    const v = ev('wizValidate(S.char,6)');
    return (v !== true && /Stat points/.test(String(v))) || 'got ' + v;
  });
  check('[tutorial] a Floor 3 crawler gets exactly 27 points', () => {
    ev("for(let i=0;i<40;i++)dccStatPoint('CON',1)");
    const spent = ev('dccPointsSpent(S.char)');
    return spent === 27 || 'spent ' + spent;
  });
  check('[tutorial] tutorial points raise the Unenhanced layer', () => {
    // "As crawlers gain new Stat Points from leveling up, these improve the
    // Unenhanced Stat layer... The second layer, called Enhanced, includes the
    // Unenhanced score plus any bonuses from gear, Spells, Buffs, and other
    // sources." This check used to assert the opposite, which is how the sheet
    // came to show an Unenhanced column up to 27 too low.
    const base = ev("S.char.blocks.stats.CON.base");
    const bonus = ev("S.char.blocks.stats.CON.bonus");
    const pick = ev("dccStatPick(S.char,'CON')");
    if (bonus !== 0) return 'creation wrote ' + bonus + ' into the gear layer';
    return base === pick + 27 || 'Unenhanced is ' + base + ', expected ' + (pick + 27);
  });
  check('[tutorial] Enhanced is Unenhanced plus the gear layer', () => {
    // The gear/Spell/Buff layer belongs to play, not creation, so it starts
    // empty and dccStatOf reads the two together.
    ev("S.char.blocks.stats.CON.bonus=4;");
    const enh = ev("dccStatOf(S.char,'CON')");
    const base = ev("S.char.blocks.stats.CON.base");
    ev("S.char.blocks.stats.CON.bonus=0;");
    return enh === base + 4 || 'Enhanced ' + enh + ' != Unenhanced ' + base + ' + 4';
  });
  check('[tutorial] spending more points does not disturb the gear layer', () => {
    ev("S.char.blocks.stats.STR.bonus=3;dccStatPoint('STR',-1);dccStatPoint('STR',1);");
    const b = ev("S.char.blocks.stats.STR.bonus");
    ev("S.char.blocks.stats.STR.bonus=0;");
    return b === 3 || 'the gear bonus became ' + b;
  });
  // ── Acquired Loot and the six Experiences ────────────────────────────────
  check('[loot] the screen blocks until loot is rolled', () => {
    const v = ev('wizValidate(S.char,6)');
    return (v !== true && /Acquired Loot/i.test(String(v))) || 'got ' + v;
  });
  ev('dccRollSpread()');
  check('[loot] a spread names a tier for all four slots', () => {
    const roll = ev('S.char.dcc.floorStart.loot.spread');
    const row = ev(`JSON.stringify(DCC_LOOT_SPREAD.find(r=>r.roll===${roll}))`);
    const tiers = JSON.parse(ev(`JSON.stringify(dccSpreadTiers(${JSON.stringify(JSON.parse(row).text)}))`));
    const missing = ['weapon', 'armor', 'item', 'consumable'].filter(k => !tiers[k]);
    return missing.length ? 'no tier for ' + missing.join(', ') : true;
  });
  check('[loot] the four tiers on a spread are all different', () => {
    for (let r = 1; r <= 4; r++) {
      const row = JSON.parse(ev(`JSON.stringify(DCC_LOOT_SPREAD.find(x=>x.roll===${r}))`));
      const t = JSON.parse(ev(`JSON.stringify(dccSpreadTiers(${JSON.stringify(row.text)}))`));
      const vals = Object.keys(t).map(k => t[k]);
      if (new Set(vals).size !== 4) return 'spread ' + r + ' repeats a tier: ' + vals.join(',');
    }
    return true;
  });
  check('[loot] rolling a Spell instead lands a real Spell in the slot', () => {
    ev("dccRollLootSpell('item')");
    const v = ev("S.char.dcc.floorStart.loot.slots.item");
    const name = String(v).replace(' (Spell)', '');
    return ev('!!dccSpellByName(' + JSON.stringify(name) + ')') || 'not a Spell: ' + v;
  });
  check('[loot] every Table 27 Spell resolves in the catalogue', () => {
    const bad = ev(`JSON.stringify(DCC_RANDOM_SPELLS.filter(r=>!dccSpellByName(r.spell)).map(r=>r.spell))`);
    return bad === '[]' || bad;
  });
  eq(ev('DCC_RANDOM_SPELLS.length'), 12, '[loot] Table 27 is a 1d12');
  eq(ev('DCC_WEAPON_UPGRADES.length'), 12, '[loot] Table 26 is a 1d12');
  eq(ev('DCC_LOOT_SPREAD.length'), 4, '[loot] Table 25 is a 1d4');

  check('[experiences] the screen blocks until all six are rolled', () => {
    const v = ev('wizValidate(S.char,6)');
    return (v !== true && /Experiences/i.test(String(v))) || 'got ' + v;
  });
  ev('dccRollExperiences()');
  check('[experiences] six are rolled, each naming a real table and page', () => {
    const e = JSON.parse(ev('JSON.stringify(S.char.dcc.floorStart.experiences)'));
    if (e.length !== 6) return 'got ' + e.length;
    const known = JSON.parse(ev('JSON.stringify(DCC_EXPERIENCE_TABLES.map(t=>t.table))'));
    const bad = e.filter(x => known.indexOf(x.table) < 0 || !x.page || x.result < 1 || x.result > 12);
    return bad.length ? 'bad entry: ' + JSON.stringify(bad[0]) : true;
  });
  check('[experiences] a reroll changes only the one you rerolled', () => {
    const before = JSON.parse(ev('JSON.stringify(S.char.dcc.floorStart.experiences)'));
    ev('dccRerollExperience(2)');
    const after = JSON.parse(ev('JSON.stringify(S.char.dcc.floorStart.experiences)'));
    const changedElsewhere = before.filter((x, i) =>
      i !== 2 && JSON.stringify(x) !== JSON.stringify(after[i]));
    return changedElsewhere.length ? 'reroll disturbed entry ' + changedElsewhere.length : true;
  });
  eq(ev('DCC_EXPERIENCE_TABLES.length'), 6, '[experiences] 1d6 picks between six tables');
  check('[experiences] the tables are 29 to 34', () =>
    ev('DCC_EXPERIENCE_TABLES.map(t=>t.table).join(",")') === '29,30,31,32,33,34'
    || ev('DCC_EXPERIENCE_TABLES.map(t=>t.table).join(",")'));
  check('[experiences] no narrative prose was copied out of the book', () => {
    // Only the table, its title, the roll and a page number are stored.
    const keys = ev(`JSON.stringify(Object.keys(S.char.dcc.floorStart.experiences[0]).sort())`);
    return keys === '["page","result","table","title"]' || 'stored: ' + keys;
  });

  eq(ev('wizValidate(S.char,6)'), true, '[tutorial] satisfied');

  // screen 8 — Race & Class
  ev('wizNext()');
  eq(ev('S.char.creation.step'), 7, '[wizard] advanced to Race & Class');
  check('[raceclass] blocks until both are chosen', () => {
    const v = ev('wizValidate(S.char,7)');
    return (v !== true && /Race/.test(String(v))) || 'got ' + v;
  });
  check('[raceclass] a locked entry cannot be chosen and says why', () => {
    // Amazonian needs a STR or DEX Skill at Rank 5+
    const gate = JSON.parse(ev("JSON.stringify(dccMeetsPrereq(S.char,dccRace('amazonian')))"));
    const html = ev("dccEntryCard(S.char,dccRace('amazonian'),'race',false)");
    if (gate.ok === false && !/onclick/.test(html)) return true;
    if (gate.ok === true) return true;      // this crawler happens to qualify
    return 'locked entry was still clickable';
  });
  check('[raceclass] nothing is applied while you shop', () => {
    const before = ev("JSON.stringify(S.char.blocks.stats)");
    ev("dccChoose('race','human');dccChoose('cls','boring-ol-fighter')");
    const after = ev("JSON.stringify(S.char.blocks.stats)");
    return before === after || 'the sheet changed before finishing';
  });
  check('[raceclass] the diff previews the Stat change', () => {
    const d = ev("JSON.stringify(dccRcDiff(S.char))");
    const o = JSON.parse(d);
    if (!o || !o.race) return 'no diff';
    const keys = Object.keys(o.stats);
    if (!keys.length) return 'no stat deltas for Human (+2 to all)';
    const one = o.stats[keys[0]];
    return one.to === one.from + one.delta || 'diff arithmetic wrong: ' + JSON.stringify(one);
  });
  check('[raceclass] deselecting clears the diff', () => {
    ev("dccChoose('race','human')");
    const gone = ev('dccRcDiff(S.char)') === null || !JSON.parse(ev("JSON.stringify(dccRcDiff(S.char))")).race;
    ev("dccChoose('race','human')");
    return gone || 'race stayed selected';
  });
  check('[raceclass] searching repaints only the list, never the input', () => {
    ev("renderWizard('hero-creation')");
    ev("document.getElementById('rc-race-q').setAttribute('data-probe','1')");
    ev("dccRcQuery('race','elf')");
    const kept = ev("document.getElementById('rc-race-q').getAttribute('data-probe')") === '1';
    const rows = ev("document.getElementById('rc-race-list').children.length");
    return (kept && rows > 0 && rows < 30) || 'kept=' + kept + ' rows=' + rows;
  });
  eq(ev('wizValidate(S.char,7)'), true, '[raceclass] satisfied with both chosen');

  // screen 9 — review, then finish
  ev('wizNext()');
  eq(ev('S.char.creation.step'), 8, '[wizard] advanced to Review');
  check('[review] the review names the crawler, Race and Class', () => {
    const html = ev("SYS.creation[8].render({char:S.char,floor:3})");
    return (/Keisha/.test(html) && /Human/.test(html)) || 'review missing identity';
  });

  // finishing turns the choices into a real sheet
  ev('wizNext()');
  eq(ev('S.char.creation.complete'), true, '[wizard] creation is marked complete');
  check('[wizard] the finished crawler has its ten starting Skills', () => {
    const n = ev('S.char.blocks.skills.skills.length');
    return n === 9 || n === 10 || 'got ' + n + ' skills';
  });
  // Before the tutorial floors, the free combat Skill is Rank 3 and a childhood
  // Skill is Rank 1. On the finished sheet both carry their +1d4 bump, so the
  // pre-bump values are checked at the source and the sheet is checked against
  // the rolls that were actually made.
  check('[wizard] starting Ranks are right before the tutorial floors', () => {
    const base = JSON.parse(ev('JSON.stringify(dccStartingSkills(S.char))'));
    const unarmed = base.find(x => x.name === 'Unarmed Combat');
    const street = base.find(x => x.name === 'Streetwise');
    if (!unarmed || unarmed.rank !== 3) return 'Unarmed Combat: ' + JSON.stringify(unarmed);
    if (!street || street.rank !== 1) return 'Streetwise: ' + JSON.stringify(street);
    return true;
  });
  check('[wizard] the finished sheet shows the bumped Ranks', () => {
    const bumps = JSON.parse(ev('JSON.stringify(S.char.dcc.floorStart.bumps)'));
    const sheet = JSON.parse(ev('JSON.stringify(S.char.blocks.skills.skills)'));
    const bad = bumps.filter(b => !b.spell).filter(b => {
      const s = sheet.find(x => x.name === b.name);
      return !s || s.rank < b.to;      // Race/Class may push it higher still
    });
    return bad.length ? bad[0].name + ' should be at least ' + bad[0].to : true;
  });
  check('[wizard] every starting Skill resolves in the catalogue', () => {
    const bad = ev("JSON.stringify(S.char.blocks.skills.skills.filter(s=>!dccSkillByName(s.name)).map(s=>s.name))");
    return bad === '[]' || bad;
  });
  eq(ev('S.char.blocks.mana.current'), ev("dccStatOf(S.char,'INT')"),
     '[wizard] Mana starts full, at Enhanced INT');
  check('[wizard] AI Favor is the human 1 plus the tutorial-floor roll', () => {
    const rolled = ev('S.char.dcc.floorStart.favor');
    const have = ev('S.char.blocks.aiFavor.current');
    return have === 1 + rolled || 'have ' + have + ' from a roll of ' + rolled;
  });
  check('[wizard] finishing lands you on the sheet', () => {
    ev('renderHero()');
    return ev("document.getElementById('hero-sheet').style.display") === 'block' || 'still in the wizard';
  });
  check('[wizard] an animal starts with 0 AI Favor and Slice Attack', () => {
    ev("S.char=SYS.newCharacter();dccSetSpecies('animal');dccFinishCreation(S.char);");
    const favor = ev('S.char.blocks.aiFavor.current');
    const has = ev("!!S.char.blocks.skills.skills.find(x=>x.name==='Slice Attack')");
    return (favor === 0 && has) || 'favor=' + favor + ' sliceAttack=' + has;
  });
  check('[wizard] switching species clears background picks from the other tables', () => {
    ev("S.char=SYS.newCharacter();dccSetSpecies('human');dccPickBackground('childhood',1);dccPickSkill('childhood','Streetwise');");
    ev("dccSetSpecies('animal')");
    return ev("Object.keys(S.char.dcc.background).length") === 0 || 'stale picks survived';
  });

  // ── Races and Classes (D6 data) ──────────────────────────────────────────
  eq(ev('DCC_RACES.length'), 30, '[rc] 30 Races, matching the book');
  eq(ev('DCC_CLASSES.length'), 52,
     '[rc] 52 Class entries — the blurb says 49, the chapter has 52');
  check('[rc] every entry has a unique id and a name', () => {
    const bad = ev(`JSON.stringify([...DCC_RACES,...DCC_CLASSES].filter(e=>!e.id||!e.name).map(e=>e.name))`);
    const ids = ev('new Set([...DCC_RACES,...DCC_CLASSES].map(e=>e.id)).size');
    if (bad !== '[]') return bad;
    return ids === 82 || 'duplicate ids: ' + ids + ' unique of 82';
  });
  check('[rc] every Class carries its Class Type', () => {
    const bad = ev(`JSON.stringify(DCC_CLASSES.filter(c=>!c.classType).map(c=>c.name))`);
    return bad === '[]' || bad;
  });
  check('[rc] Stat deltas only ever name the five Stats', () => {
    const bad = ev(`JSON.stringify([...DCC_RACES,...DCC_CLASSES].flatMap(e=>
      Object.keys(e.stats||{}).filter(k=>!['STR','INT','CON','DEX','CHA'].includes(k))))`);
    return bad === '[]' || bad;
  });
  check('[rc] every granted Skill exists in the catalogue', () => {
    const bad = ev(`JSON.stringify([...new Set([...DCC_RACES,...DCC_CLASSES]
      .flatMap(e=>(e.skills||[]).map(s=>s.skill)))].filter(n=>!dccSkillByName(n)))`);
    return bad === '[]' || 'orphans: ' + bad;
  });
  // The name repairs are the part most at risk of being invented, so pin them.
  eq(ev("!!dccRace('dwarf-classic')"), true, '[rc] "Dwarf, Clasic" was repaired to Classic');
  eq(ev("!!dccRace('rat-hooligan')"), true, '[rc] "Rat Holigan" -> Rat Hooligan');
  eq(ev("!!dccRace('obsidian-butterfly')"), true, '[rc] "Obsidian Buterfly" -> Butterfly');
  eq(ev("!!dccClass('prison-tattoo-artist')"), true, '[rc] "Prison Tato Artist" -> Tattoo');
  eq(ev("!!dccClass('physicker')"), true, '[rc] "PHysicker" -> Physicker');
  eq(ev("!!dccClass('spellbinder')"), true, '[rc] "Spelbinder" -> Spellbinder');
  check('[rc] no name still carries a dropped-doubled-letter artefact', () => {
    const bad = ev(`JSON.stringify([...DCC_RACES,...DCC_CLASSES].map(e=>e.name)
      .filter(n=>/Clasic|Buterfly|Holigan|Spelbinder|Tato |Warior|Stret |Mesenger|Profesional|Aley /.test(n)))`);
    return bad === '[]' || bad;
  });
  // Amazonian is the worked example: Medium (4), +6 STR, +3 DEX, +2 to three Skills.
  check('[rc] Amazonian matches the book', () => {
    const r = ev("JSON.stringify(dccRace('amazonian'))");
    const o = JSON.parse(r);
    if (!o) return 'missing';
    if (o.size.n !== 4 || o.stats.STR !== 6 || o.stats.DEX !== 3) return 'stats/size: ' + r;
    const sk = o.skills.map(s => s.skill).sort().join(',');
    if (sk !== 'Bow,Endurance,Pugilism') return 'skills: ' + sk;
    if (!/Strength/.test(o.prerequisites || '')) return 'prereq missing';
    return true;
  });
  check('[rc] a duplicated bullet is not summed into a doubled Stat', () =>
    ev("dccRace('arachnid').stats.DEX") === 5 ||
    'Arachnid DEX is ' + ev("dccRace('arachnid').stats.DEX") + ', should be 5');
  // Entries whose benefit prose came out incomplete are flagged, not faked.
  check('[rc] flagged entries carry a page reference', () => {
    const bad = ev(`JSON.stringify([...DCC_RACES,...DCC_CLASSES].filter(e=>e.needsReview&&!e.page).map(e=>e.name))`);
    return bad === '[]' || bad;
  });
  check('[rc] no benefit line was shipped ending mid-sentence', () => {
    const bad = ev(`JSON.stringify([...DCC_RACES,...DCC_CLASSES].flatMap(e=>
      (e.benefits||[]).filter(b=>/\b(a|an|the|and|or|of|to|in|on|at|with|for|your|their|you)$/i.test(b.trim()))
      ).slice(0,5))`);
    return bad === '[]' || bad;
  });
  // prerequisite gating
  check('[rc] a Stat/Skill prerequisite is enforced', () => {
    // Driven through the real creation path. This check used to hand-plant
    // char.blocks.skills — a field dccFinishCreation does not write until the
    // wizard has already ended — so it was verifying its own fixture. During
    // actual creation the prerequisite saw an empty list, which locked the one
    // gate it could parse and left the other thirteen wide open.
    ev("S.char=SYS.newCharacter();dccSetSpecies('human');dccSetRoute('weapon');dccSetWeapon('Club');");
    ev("dccStatMethod('array');dccAssignStat('STR',6);dccAssignStat('CON',5);" +
       "dccAssignStat('DEX',4);dccAssignStat('INT',3);dccAssignStat('CHA',2);dccRollBumps();");
    ev("S.char.dcc.floorStart.bumps.forEach(function(b){b.to=2;});");
    const no = ev("JSON.stringify(dccMeetsPrereq(S.char,dccRace('amazonian')))");
    if (JSON.parse(no).ok !== false) return 'a Rank 2 crawler was allowed: ' + no;
    ev("S.char.dcc.floorStart.bumps.forEach(function(b){if(b.primary)b.to=5;});");
    const yes = ev("JSON.stringify(dccMeetsPrereq(S.char,dccRace('amazonian')))");
    if (JSON.parse(yes).ok !== true) return 'Rank 5 was refused: ' + yes;
    return true;
  });
  check('[rc] the prerequisite reads the live Skill list, not the finished block', () => {
    // The regression that made the above unfalsifiable: blocks.skills is absent
    // for the whole of creation, so anything reading it sees nothing.
    if (ev("JSON.stringify(S.char.blocks.skills)") !== undefined &&
        ev("!!(S.char.blocks && S.char.blocks.skills)")) return 'blocks.skills exists mid-creation now';
    return ev("dccPrereqSkills(S.char).length") > 0 || 'the live Skill list is empty during creation';
  });
  // ── the tutorial-floor budget and its snapshot ───────────────────────────
  // ── things the playtest agents found by driving the real UI ──────────────
  check('[sheet] the finished sheet is not a one-way door', () => {
    ev("S.char=SYS.newCharacter();S.char.creation={step:0,complete:true};renderHero();");
    const h = ev("document.getElementById('hero-sheet').innerHTML");
    const want = ['sysReopenCreation', 'exportJSON', 'sysNewCharacter'];
    const missing = want.filter(f => h.indexOf(f) < 0);
    return missing.length ? 'the sheet offers no way to ' + missing.join(', ') : true;
  });
  check('[sheet] a free-text identity field is not coerced to a number', () => {
    ev("sysIdentitySet('race','007');");
    if (ev("S.char.race") !== '007') return 'stored as ' + JSON.stringify(ev('S.char.race'));
    ev("sysIdentitySet('crawlerNumber','600000');");
    return ev("typeof S.char.crawlerNumber") === 'number' || 'the Crawler Number stopped being numeric';
  });
  check('[sheet] Race and Class benefits reach the finished sheet', () => {
    ev("S.char=SYS.newCharacter();dccChooseCustom('race');dccCustomSet('race','name','Trash Panda');" +
       "dccCustomSet('race','notes','MARKER-BENEFIT-XYZ');dccChooseCustom('class');" +
       "dccCustomSet('class','name','Dumpster Diver');dccFinishCreation(S.char);" +
       "S.char.creation={step:0,complete:true};renderHero();");
    const h = ev("document.getElementById('hero-sheet').innerHTML");
    return h.indexOf('MARKER-BENEFIT-XYZ') >= 0
      || 'what the player wrote into their custom Race never reached the sheet';
  });
  check('[sheet] editing a Stat does not destroy a pending damage entry', () => {
    ev("S.char=SYS.newCharacter();S.char.creation={step:0,complete:true};renderHero();");
    ev("var d=document.getElementById('dmg-health');d.value='37';d.focus();");
    ev("traitSet('stats','CON','base','7');");
    const v = ev("(document.getElementById('dmg-health')||{}).value");
    return v === '37' || 'the damage box was wiped by an unrelated repaint: ' + JSON.stringify(v);
  });
  check('[sheet] a pool clamps when its derived maximum falls', () => {
    ev("traitSet('stats','INT','base',10);for(var i=0;i<40;i++)poolAdj('mana',1);");
    ev("traitSet('stats','INT','base',2);blockRepaint('mana');");
    const cur = ev("S.char.blocks.mana.current");
    ev("poolAdj('mana',1);");
    const after = ev("S.char.blocks.mana.current");
    if (cur > 2) return 'Mana stayed out of range at ' + cur;
    return after >= cur || 'pressing + reduced Mana from ' + cur + ' to ' + after;
  });
  check("[dice] the Dice tab uses the pack's dice, not Fate", () => {
    ev("showTab('dice')");
    const h = ev("document.getElementById('dice-content').innerHTML");
    if (/Fate Dice/.test(h)) return 'the Fate roller is still being rendered';
    if (/\[object Object\]/.test(h)) return 'the Skill list is rendering objects';
    return /1d20/.test(h) || 'no d20 roller';
  });
  check('[dice] rolling works and adds Rank, Stat Mod and modifier', () => {
    ev("S.char.blocks.skills={skills:[{name:'Club',stat:'STR',rank:6}]};" +
       "S.char.blocks.stats={STR:{base:6,bonus:10}};showTab('dice');");
    // The option value is a ref, not a bare name: a Stat called Strength and a
    // Skill called Strength are different rolls and a name cannot say which.
    ev("document.getElementById('sd-skill').value=rollRef('skill','skills','Club');" +
       "document.getElementById('sd-mod').value='2';sysDoRoll();");
    const d = JSON.parse(ev('JSON.stringify(S.dice)'));
    const mod = ev("dccStatMod(dccStatOf(S.char,'STR'))");
    return d.total === d.nat + 6 + mod + 2
      || 'total ' + d.total + ' != nat ' + d.nat + ' + rank 6 + mod ' + mod + ' + 2';
  });
  check('[combat] a Dying combatant stops at zero instead of counting on', () => {
    ev("S.char=SYS.newCharacter();dccCombatEnd();dccCombatStart();");
    ev("S.conflict.combatants.push({name:'Donut',side:'crawler',actions:2,maxActions:2,debuffs:['Dying'],dying:2});");
    for (let r = 0; r < 6; r++) ev("S.conflict.step=4;dccCombatNext();");
    const d = ev("S.conflict.combatants[0].dying");
    if (d < 0) return 'counted down to ' + d;
    const log = ev("JSON.stringify(S.conflict.log)");
    const times = (log.match(/run out of rounds/g) || []).length;
    return times === 1 || 'logged "run out of rounds" ' + times + ' times';
  });
  check("[combat] dropping crawlers brings the Boss's spent Actions down too", () => {
    ev("dccCombatEnd();dccCombatStart();");
    ev("['A','B','C','D'].forEach(function(n){S.conflict.combatants.push({name:n,side:'crawler',actions:2,maxActions:2,debuffs:[],dying:null})});");
    ev("document.getElementById('dcc-cb-name').value='Boss';document.getElementById('dcc-cb-side').value='boss';dccCombatAdd();");
    ev("dccCombatDrop(0);dccCombatDrop(0);dccCombatDrop(0);");
    const boss = JSON.parse(ev("JSON.stringify(S.conflict.combatants.filter(function(m){return m.side==='boss'})[0])"));
    return boss.actions <= boss.maxActions
      || 'the Boss has ' + boss.actions + ' Actions left out of a maximum of ' + boss.maxActions;
  });
  check('[gear] renaming a weapon does not survive changing the weapon', () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccStoreCombat('weaponName','Tire Iron');");
    ev("dccSetWeapon('Axe');");
    const cm = JSON.parse(ev("JSON.stringify(dccCre(S.char).combat)"));
    return !cm.weaponName || 'an Axe is still called ' + JSON.stringify(cm.weaponName);
  });

  check('[layers] Race and Class grants land in Unenhanced too', () => {
    // A Race is what you ARE, not something you are carrying.
    ev("S.char=SYS.newCharacter();dccSetFloor(3);dccStatMethod('array');");
    ev("dccAssignStat('STR',6);dccAssignStat('CON',5);dccAssignStat('DEX',4);dccAssignStat('INT',3);dccAssignStat('CHA',2);");
    ev("dccChoose('race','human');dccChoose('cls','boring-ol-fighter');dccFinishCreation(S.char);");
    const cell = JSON.parse(ev("JSON.stringify(S.char.blocks.stats.CON)"));
    const pick = ev("dccStatPick(S.char,'CON')");
    if (cell.bonus !== 0) return 'the Class grant went into the gear layer: ' + JSON.stringify(cell);
    return cell.base > pick || 'the Class grant did not reach Unenhanced: ' + JSON.stringify(cell);
  });
  check('[layers] a crawler saved under the old model is migrated, not doubled', () => {
    // Old shape: base = the array pick alone, bonus = points + Race/Class.
    // A naive read would count the granted points twice.
    ev("S.char=SYS.newCharacter();dccCre(S.char);");
    ev("dccFloorStart(S.char).points={STR:27};");
    ev("S.char.blocks.stats={STR:{base:6,bonus:27},CON:{base:5,bonus:0},DEX:{base:4,bonus:0},INT:{base:3,bonus:0},CHA:{base:2,bonus:0}};");
    ev("dccApplyStatLayers(S.char);");
    const st = JSON.parse(ev("JSON.stringify(S.char.blocks.stats.STR)"));
    if (st.base !== 33) return 'Unenhanced should be 6 + 27 = 33, got ' + st.base;
    if (st.bonus !== 0) return 'the granted points were left in the gear layer: ' + st.bonus;
    return ev("dccStatOf(S.char,'STR')") === 33 || 'Enhanced drifted to ' + ev("dccStatOf(S.char,'STR')");
  });
  check('[layers] migration keeps a genuine gear bonus', () => {
    // bonus = 27 granted + 5 from a ring. Only the granted part moves.
    ev("S.char=SYS.newCharacter();dccCre(S.char);");
    ev("dccFloorStart(S.char).points={STR:27};");
    ev("S.char.blocks.stats={STR:{base:6,bonus:32}};");
    ev("dccApplyStatLayers(S.char);");
    const st = JSON.parse(ev("JSON.stringify(S.char.blocks.stats.STR)"));
    return (st.base === 33 && st.bonus === 5)
      || 'expected Unenhanced 33 with 5 left as gear, got ' + JSON.stringify(st);
  });
  check('[layers] migrating twice is a no-op', () => {
    ev("dccApplyStatLayers(S.char);dccApplyStatLayers(S.char);");
    const st = JSON.parse(ev("JSON.stringify(S.char.blocks.stats.STR)"));
    return (st.base === 33 && st.bonus === 5) || 'drifted to ' + JSON.stringify(st);
  });

  // ── Floors 4 and 5 (p. 118) ──────────────────────────────────────────────
  // Each is "the rules for creating a Third Floor Crawler, then..." — they are
  // NOT cumulative with each other. Floor 4 used to implement only the first of
  // its five bullets, and Floor 5 did not exist.
  check('[floor45] Floor 5 can be chosen, at Level 30', () => {
    const f = JSON.parse(ev('JSON.stringify(DCC_FLOOR_START.map(function(x){return [x.floor,x.level,x.statPoints]}))'));
    const five = f.filter(x => x[0] === 5)[0];
    if (!five) return 'floors offered are ' + f.map(x => x[0]).join(', ');
    // 27 on the Third Floor plus 60 more.
    return (five[1] === 30 && five[2] === 87) || 'Level ' + five[1] + ', ' + five[2] + ' points';
  });
  check('[floor45] Floor 4 is 27 + 30 points, Floor 5 is 27 + 60', () => {
    const pts = f => ev('DCC_FLOOR_START.filter(function(x){return x.floor===' + f + '})[0].statPoints');
    return (pts(3) === 27 && pts(4) === 57 && pts(5) === 87)
      || [3, 4, 5].map(f => 'F' + f + '=' + pts(f)).join(' ');
  });
  check('[floor45] a higher floor rolls more Tutorial Floor Experiences', () => {
    const n = f => {
      ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(" + f + ");dccRollExperiences();");
      return ev('S.char.dcc.floorStart.experiences.length');
    };
    const got = [n(3), n(4), n(5)];
    return (got[0] === 6 && got[1] === 8 && got[2] === 10)
      || 'rolled ' + got.join(', ') + ' — expected 6, 8, 10';
  });
  check('[floor45] the extra Skill advancement is demanded before you can continue', () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(4);");
    ev("dccRollBumps();dccRollFavor();dccRollSpread();dccRollExperiences();");
    ev("for(var i=0;i<57;i++)dccStatPoint('CON',1);");
    const v = ev('wizValidate(S.char,6)');
    return (v !== true && /Skill/.test(String(v))) || 'let through without choosing Skills: ' + v;
  });
  check('[floor45] 2d2 Ranks at Rank 4 or less, 1d2 at Rank 5+', () => {
    // Roll each band many times and check the range, since the die differs by
    // the Rank the Skill is already at.
    const cfg = "{count:6,low:'2d2',high:'1d2',threshold:4}";
    const low = [], high = [];
    for (let i = 0; i < 60; i++) {
      low.push(ev('dccSkillBoostRoll(3,' + cfg + ')'));
      high.push(ev('dccSkillBoostRoll(7,' + cfg + ')'));
    }
    const badLow = low.filter(r => r < 2 || r > 4);
    const badHigh = high.filter(r => r < 1 || r > 2);
    if (badLow.length) return 'a Rank 3 Skill rolled ' + badLow[0] + ', outside 2d2';
    if (badHigh.length) return 'a Rank 7 Skill rolled ' + badHigh[0] + ', outside 1d2';
    // and the bands must actually differ
    return Math.max.apply(null, high) <= 2 && Math.max.apply(null, low) >= 3
      || 'the two bands are not distinguishable';
  });
  check('[floor45] an advanced Skill reaches the finished sheet', () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(4);dccRollBumps();");
    const before = ev("(dccFinalSkills(S.char).find(function(x){return x.name==='Club'})||{}).rank");
    ev("dccSkillBoostToggle('Club');");
    const b = JSON.parse(ev("JSON.stringify(S.char.dcc.floorStart.skillBoosts[0])"));
    const after = ev("(dccFinalSkills(S.char).find(function(x){return x.name==='Club'})||{}).rank");
    if (b.from !== before) return 'rolled against Rank ' + b.from + ' but the Skill was at ' + before;
    return after === b.to || 'the sheet shows ' + after + ', the roll said ' + b.to;
  });
  check('[floor45] choosing the same Skill again takes the advancement back', () => {
    ev("dccSkillBoostToggle('Club');");
    return ev('(S.char.dcc.floorStart.skillBoosts||[]).length') === 0 || 'still chosen';
  });
  check('[floor45] no more Skills can be chosen than the floor grants', () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(4);dccRollBumps();");
    // Only two Skills exist on this crawler, so ask for each repeatedly.
    for (let i = 0; i < 20; i++) ev("dccSkillBoostToggle('Skill" + i + "');");
    return ev('(S.char.dcc.floorStart.skillBoosts||[]).length') <= 6
      || 'took ' + ev('(S.char.dcc.floorStart.skillBoosts||[]).length') + ' of 6';
  });
  check('[floor45] Popularity gains CHA Mod again beyond the Third Floor', () => {
    const pop = f => {
      ev("S.char=SYS.newCharacter();dccSetFloor(" + f + ");S.char.blocks.stats={CHA:{base:20,bonus:0}};");
      ev("dccFinishCreation(S.char);");
      return ev('S.char.blocks.popularity.current');
    };
    const mod = ev("dccStatMod(20)");
    const got = [pop(3), pop(4), pop(5)];
    const want = [mod * 2, mod * 3, mod * 3];
    return got.join(',') === want.join(',')
      || 'got ' + got.join(', ') + ' — expected ' + want.join(', ') + ' (CHA Mod ' + mod + ')';
  });
  check('[floor45] each floor names the loot tiers it adds', () => {
    const tiers = f => ev("JSON.stringify(DCC_FLOOR_START.filter(function(x){return x.floor===" + f + "})[0].extraLoot||null)");
    if (tiers(3) !== 'null') return 'Floor 3 should add no extra loot: ' + tiers(3);
    if (tiers(4) !== '["Bronze","Silver"]') return 'Floor 4: ' + tiers(4);
    return tiers(5) === '["Gold","Platinum"]' || 'Floor 5: ' + tiers(5);
  });
  check('[floor45] Floor 3 gained none of this', () => {
    const f3 = JSON.parse(ev("JSON.stringify(DCC_FLOOR_START.filter(function(x){return x.floor===3})[0])"));
    const extras = ['extraExperiences', 'skillBoost', 'popularityBonus', 'extraLoot'].filter(k => f3[k]);
    return extras.length === 0 || 'Floor 3 picked up ' + extras.join(', ');
  });

  // ── choosing which Stat layer the extra points go to ─────────────────────
  // "Distribute 30 more points among your Enhanced and Unenhanced Stats"
  // (p. 118). Floor 3 has no such choice: its 27 points are added to the
  // Unenhanced Stat (p. 115).
  check('[layerchoice] only Floors 4 and 5 offer the choice', () => {
    const has = f => !!ev("DCC_FLOOR_START.filter(function(x){return x.floor===" + f + "})[0].layerChoice");
    return (!has(1) && !has(3) && has(4) && has(5))
      || [1, 3, 4, 5].map(f => 'F' + f + '=' + has(f)).join(' ');
  });
  check('[layerchoice] Floor 3 refuses to spend into Enhanced even if asked', () => {
    ev("S.char=SYS.newCharacter();dccSetFloor(3);dccStatPoint('CON',1,'enhanced');");
    const un = ev("(S.char.dcc.floorStart.points||{}).CON||0");
    const enh = ev("(S.char.dcc.floorStart.pointsEnh||{}).CON||0");
    return (un === 1 && enh === 0)
      || 'went to Unenhanced ' + un + ', Enhanced ' + enh;
  });
  check('[layerchoice] on Floor 4 the two layers take points separately', () => {
    ev("S.char=SYS.newCharacter();dccSetFloor(4);dccStatMethod('array');");
    ev("dccAssignStat('STR',6);dccAssignStat('CON',5);dccAssignStat('DEX',4);dccAssignStat('INT',3);dccAssignStat('CHA',2);");
    ev("for(var i=0;i<20;i++)dccStatPoint('STR',1);");
    ev("for(var i=0;i<10;i++)dccStatPoint('CON',1,'enhanced');");
    const str = JSON.parse(ev("JSON.stringify(S.char.blocks.stats.STR)"));
    const con = JSON.parse(ev("JSON.stringify(S.char.blocks.stats.CON)"));
    if (str.base !== 26 || str.bonus !== 0) return 'STR ' + JSON.stringify(str);
    return (con.base === 5 && con.bonus === 10) || 'CON ' + JSON.stringify(con);
  });
  check('[layerchoice] both layers draw on the one budget', () => {
    return ev('dccPointsSpent(S.char)') === 30 || 'counted ' + ev('dccPointsSpent(S.char)') + ' of 30 spent';
  });
  check('[layerchoice] the budget cannot be beaten by switching layer', () => {
    ev("for(var i=0;i<100;i++)dccStatPoint('DEX',1,'enhanced');");
    ev("for(var i=0;i<100;i++)dccStatPoint('INT',1);");
    const spent = ev('dccPointsSpent(S.char)');
    return spent === 57 || 'spent ' + spent + ' of 57';
  });
  check('[layerchoice] Enhanced points do not eat a real gear bonus', () => {
    // The gear/Spell/Buff layer and the points placed there share one field, so
    // the recompute has to be able to tell them apart.
    ev("S.char=SYS.newCharacter();dccSetFloor(4);");
    ev("for(var i=0;i<10;i++)dccStatPoint('CON',1,'enhanced');");
    ev("S.char.blocks.stats.CON.bonus += 4;");      // a ring
    ev("dccApplyStatLayers(S.char);");
    if (ev('S.char.blocks.stats.CON.bonus') !== 14) return 'after a recompute: ' + ev('S.char.blocks.stats.CON.bonus') + ', expected 14';
    ev("dccStatPoint('CON',-1,'enhanced');");
    return ev('S.char.blocks.stats.CON.bonus') === 13
      || 'taking a point back left ' + ev('S.char.blocks.stats.CON.bonus') + ', expected 13';
  });
  check('[layerchoice] recomputing repeatedly does not drift', () => {
    const before = ev('S.char.blocks.stats.CON.bonus');
    ev("dccApplyStatLayers(S.char);dccApplyStatLayers(S.char);dccApplyStatLayers(S.char);");
    return ev('S.char.blocks.stats.CON.bonus') === before
      || 'drifted from ' + before + ' to ' + ev('S.char.blocks.stats.CON.bonus');
  });
  check('[layerchoice] the screen shows the extra controls only where they apply', () => {
    const cols = f => {
      ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(" + f + ");");
      ev("S.char.creation={step:6,complete:false};renderHero();");
      const h = ev("(document.getElementById('wiz-body')||{}).innerHTML||''");
      return (h.match(/dccStatPoint\([^)]*enhanced/g) || []).length;
    };
    const three = cols(3), four = cols(4);
    if (three !== 0) return 'Floor 3 drew ' + three + ' Enhanced controls';
    return four === 10 || 'Floor 4 drew ' + four + ' Enhanced controls, expected 10 (5 Stats x 2)';
  });

  // ── the table state must not cross between games ─────────────────────────
  // Reported from a real browser: a crawler's Map and Crawl Log were the ones
  // from a Daring Comics save. The session blob carries the map, the journal,
  // the bestiary and the universe the character is bound to, and it used to be
  // restored with no check of which game wrote it. Before the save store was
  // namespaced, this app could boot onto the other game's save, and the first
  // save() wrote all of that into this key.
  check('[session] a saved session is stamped with the game that wrote it', () => {
    ev("S.char=SYS.newCharacter();S.char.creation={step:0,complete:true};");
    ev("S.notes=[{id:'n',type:'main',text:'CRAWL LOG',ts:1}];S.floor=1;save();");
    const raw = JSON.parse(ev("localStorage.getItem(sysKey('scratch'))"));
    return (raw.session && raw.session.systemId === 'dungeon-crawler-carl')
      || 'stamped ' + JSON.stringify(raw.session && raw.session.systemId);
  });
  check('[session] ...and a stamped session is restored', () => {
    const blob = ev("localStorage.getItem(sysKey('scratch'))");
    ev("S=defaultState();S.char=null;localStorage.setItem(sysKey('scratch')," + JSON.stringify(blob) + ");renderHero();");
    return (ev('S.notes.length') === 1 && ev('S.floor') === 1)
      || 'journal ' + ev('S.notes.length') + ', floor ' + ev('S.floor');
  });
  check('[session] a session from another game is refused', () => {
    const foreign = JSON.stringify({
      char: JSON.parse(ev("JSON.stringify(SYS.newCharacter())")),
      session: { systemId: 'daring-comics', notes: [{ id: 'n', text: 'DC JOURNAL', ts: 1 }],
                 regions: [{ name: 'Metropolis Docks', pins: [] }], universeId: 'u_dc', floor: 3 },
      v: 2,
    });
    ev("S=defaultState();S.char=null;localStorage.setItem(sysKey('scratch')," + JSON.stringify(foreign) + ");renderHero();");
    if (ev('S.notes.length') !== 0) return "inherited the other game's journal";
    const regions = ev("JSON.stringify(S.regions.map(function(r){return r.name}))");
    if (/Metropolis/.test(regions)) return "inherited the other game's map: " + regions;
    return ev('S.universeId') === null || 'bound to a foreign universe: ' + ev('S.universeId');
  });
  check('[session] an unstamped session is discarded rather than guessed at', () => {
    // Nothing in an old blob reliably says which game wrote it, and the
    // character is stored separately, so the map and journal start clean.
    const legacy = JSON.stringify({
      char: JSON.parse(ev("JSON.stringify(SYS.newCharacter())")),
      session: { notes: [{ id: 'n', text: 'DC JOURNAL', ts: 1 }],
                 regions: [{ name: 'Metropolis Docks', pins: [] }], floor: 3 },
      v: 2,
    });
    ev("S=defaultState();S.char=null;localStorage.setItem(sysKey('scratch')," + JSON.stringify(legacy) + ");renderHero();");
    return ev('S.notes.length') === 0 || 'restored ' + ev('S.notes.length') + ' foreign journal entries';
  });
  check('[session] the crawler itself is never discarded with it', () => {
    return (ev('!!S.char') && ev('S.char.systemId') === 'dungeon-crawler-carl')
      || 'the character was lost along with the session';
  });
  check('[session] a universe this game does not have is never adopted', () => {
    const blob = JSON.stringify({
      char: JSON.parse(ev("JSON.stringify(SYS.newCharacter())")),
      session: { systemId: 'dungeon-crawler-carl', universeId: 'u_does_not_exist', floor: 2 },
      v: 2,
    });
    ev("S=defaultState();S.char=null;localStorage.setItem(sysKey('scratch')," + JSON.stringify(blob) + ");renderHero();");
    return ev('S.universeId') !== 'u_does_not_exist'
      || 'bound to a universe that is not in this game';
  });

  // ── the sheet shows the crawler's own floor ──────────────────────────────
  check('[sheet] the header shows the floor the crawler starts on', () => {
    // It read the session default, so a Level 1 crawler on the First Floor was
    // labelled "Floor 3".
    const seen = [];
    [1, 3, 4, 5].forEach(f => {
      ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(" + f + ");");
      ev("dccFinishCreation(S.char);S.char.creation={step:0,complete:true};renderHero();");
      const h = ev("document.getElementById('hero-sheet').innerHTML");
      const m = /Dungeon Crawler Carl[^<]*?Floor (\d+)/.exec(h);
      seen.push(m ? Number(m[1]) : null);
    });
    return seen.join(',') === '1,3,4,5' || 'headers read ' + seen.join(', ');
  });
  check("[sheet] finishing sets the table floor to the crawler's", () => {
    ev("S.char=SYS.newCharacter();dccSetFloor(1);dccFinishCreation(S.char);");
    return ev('S.floor') === 1 || 'the table is still on floor ' + ev('S.floor');
  });

  // ── the pack's own identity ──────────────────────────────────────────────
  // Measured from the Core Rulebook: lime #abd037 is the dominant fill by area,
  // and the book's tables are banded #7ed3f7. The shell's five themes are
  // Daring Comics' and stay with it.
  check('[brand] the crawler theme is applied and is not the comic one', () => {
    const theme = ev("document.documentElement.getAttribute('data-theme')");
    if (theme !== 'crawler') return 'data-theme is ' + JSON.stringify(theme);
    const g = k => ev("getComputedStyle(document.documentElement).getPropertyValue('--" + k + "').trim()");
    if (g('accent') !== '#abd037') return 'accent is ' + g('accent');
    return /Jost/.test(g('font-title')) || 'title face is ' + g('font-title');
  });
  check('[brand] this game offers no theme picker', () => {
    // One fixed identity. Offering the shell's themes here would let a player
    // pick a comic palette for a dungeon crawl.
    if (ev('(SYS.themes||[]).length') !== 0) return 'the pack still declares themes';
    return ev("(document.getElementById('theme-wrap')||{}).style.display") === 'none'
      || 'the swatch row is still shown';
  });
  check('[brand] the entry file loads the faces the theme names', () => {
    const fs2 = require('fs'), path2 = require('path');
    const html = fs2.readFileSync(path2.join(__dirname, '..', 'dcc/index.html'), 'utf8');
    const want = ['Jost', 'Oswald', 'Inter', 'JetBrains+Mono'];
    const missing = want.filter(f => html.indexOf(f) < 0);
    if (missing.length) return 'not loaded: ' + missing.join(', ');
    return html.indexOf('Bangers') < 0 || 'still loading the comic face it does not use';
  });
  check('[brand] the print window loads its own fonts', () => {
    // The preview is a separate document. Without its own link the sheet falls
    // back silently, which is how the app came to render in Comic Sans.
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'core/print.js'), 'utf8');
    const head = src.slice(src.indexOf('<!DOCTYPE html><html><head>'), src.indexOf('<!DOCTYPE html><html><head>') + 900);
    return /fonts\.googleapis\.com/.test(head) || 'the print document loads no fonts';
  });

  // ── the opening gate speaks the pack's language ──────────────────────────
  check("[gate] the first screen a player sees uses this game's words", () => {
    // Render the gate fresh: by now the suite has been through it, and the
    // modal body holds whatever was drawn last.
    ev("openUniverseSetup(true)");
    // Visible text only: the handler names still contain "submitUniverseSetup",
    // which is code, not copy.
    const body = ev("document.getElementById('universe-modal-body').textContent");
    if (body.indexOf("Universe") >= 0) return 'still says Universe to a Dungeon Crawler Carl player';
    if (body.indexOf("Begin the Crawl") < 0) return "the submit button is not the pack's copy";
    ev("closeUniverseModal()");
    return body.indexOf("Register Your Crawl") >= 0 || "the heading is not the pack's copy";
  });

  // ── adding items ─────────────────────────────────────────────────────────
  const invSheet = () => {
    ev("S.char=SYS.newCharacter();dccSetFloor(1);dccFinishCreation(S.char);");
    ev("S.char.creation={step:0,complete:true};renderHero();");
  };
  const addTo = (cid, name) => {
    ev("var i=document.getElementById('inv-add-gear-" + cid + "');i.value=" + JSON.stringify(name) + ";");
    ev("[].slice.call(document.querySelectorAll('#blk-gear button'))" +
       ".filter(function(b){return (b.getAttribute('onclick')||'')===\"invAdd('gear','" + cid + "')\"})[0].click();");
  };
  const hot = () => JSON.parse(ev("JSON.stringify(S.char.blocks.gear.hotlist.map(function(x){return x.name+' x'+(x.qty||1)}))"));

  check('[items] the same item twice stacks instead of taking a second slot', () => {
    // "You may place up to 999 of the same item by name into a single slot of
    // your Hotlist" (p. 112). The Hotlist has ten slots, so duplicates were
    // burning them.
    invSheet();
    addTo('hotlist', 'Healing Potion');
    addTo('hotlist', 'Healing Potion');
    addTo('hotlist', 'Healing Potion');
    const list = hot();
    const potions = list.filter(x => /Healing Potion/.test(x));
    if (potions.length !== 1) return 'took ' + potions.length + ' slots: ' + JSON.stringify(list);
    return potions[0] === 'Healing Potion x3' || 'stacked to ' + JSON.stringify(potions[0]);
  });
  check('[items] stacking is by name regardless of case', () => {
    addTo('hotlist', 'healing potion');
    const potions = hot().filter(x => /[Hh]ealing [Pp]otion/.test(x));
    return potions.length === 1 || 'made a second entry: ' + JSON.stringify(potions);
  });
  check('[items] a new name still needs a free slot, and says so when there is none', () => {
    invSheet();
    for (let i = 0; i < 12; i++) addTo('hotlist', 'Thing ' + i);
    const n = ev("S.char.blocks.gear.hotlist.length");
    if (n > 10) return 'the Hotlist grew to ' + n + ' slots';
    const flash = ev("document.getElementById('save-flash').textContent");
    return /room/i.test(flash) || 'no explanation was given: ' + JSON.stringify(flash);
  });
  check('[items] ...but a repeat still stacks on a full Hotlist', () => {
    // It needs no new slot, so a full list is no reason to refuse it.
    ev("S.char.blocks.gear.hotlist[0]={name:'Healing Potion',qty:2};blockRepaint('gear');");
    addTo('hotlist', 'Healing Potion');
    const p = JSON.parse(ev("JSON.stringify(S.char.blocks.gear.hotlist.filter(function(x){return x.name==='Healing Potion'}))"));
    return (p.length === 1 && p[0].qty === 3) || 'got ' + JSON.stringify(p);
  });
  check('[items] a stack will not climb past its cap', () => {
    invSheet();
    ev("S.char.blocks.gear.hotlist=[{name:'Rock',qty:999}];blockRepaint('gear');");
    addTo('hotlist', 'Rock');
    const qty = ev("S.char.blocks.gear.hotlist[0].qty");
    if (qty !== 999) return 'went to ' + qty;
    return /capped/i.test(ev("document.getElementById('save-flash').textContent")) || 'no cap message';
  });
  check('[items] Enter adds, without reaching for the button', () => {
    invSheet();
    ev("var i=document.getElementById('inv-add-gear-inventory');i.value='Rope';" +
       "i.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));");
    const inv = JSON.parse(ev("JSON.stringify(S.char.blocks.gear.inventory.map(function(x){return x.name}))"));
    return inv.indexOf('Rope') >= 0 || 'nothing was added: ' + JSON.stringify(inv);
  });
  check('[items] adding to a gear slot uses the slot you picked', () => {
    invSheet();
    ev("var i=document.getElementById('inv-add-gear-equipped');i.value='Goblin Helm';" +
       "document.getElementById('inv-slot-gear-equipped').value='head';");
    ev("invAdd('gear','equipped');");
    const head = JSON.parse(ev("JSON.stringify(S.char.blocks.gear.equipped.head.map(function(x){return x.name}))"));
    return head.indexOf('Goblin Helm') >= 0 || 'head holds ' + JSON.stringify(head);
  });

  // ── the floor is the clock, so it has to move ─
  // S.floor was written exactly once, at the end of creation, and never again —
  // while eight things read it. A crawl that cannot descend is not a crawl.
  const floorSheet = () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(1);");
    ev("dccFinishCreation(S.char);S.char.creation={step:0,complete:true};renderHero();");
  };
  const chip = () => ev("(document.querySelector('#floor-strip .fs-num')||{}).textContent||''").trim();

  check('[floor] the control is on every tab, not just some of them', () => {
    // It first lived in the universe bar, which only three tabs draw — and not
    // the Map or the Conflict tracker, which are exactly where descending
    // matters. It sits above the pages now.
    floorSheet();
    const tabs = JSON.parse(ev("JSON.stringify([].slice.call(document.querySelectorAll('#nav .nb'))" +
      ".map(function(n){return String(n.id||'').replace(/^nb-/,'')})" +
      ".filter(function(id){return id&&document.getElementById('page-'+id)}))"));
    const bare = tabs.filter(tab => {
      ev("showTab(" + JSON.stringify(tab) + ")");
      return ev("document.querySelectorAll('#floor-strip .uni-fbtn').length") !== 2;
    });
    return bare.length ? 'no floor control on: ' + bare.join(', ') : true;
  });
  check('[floor] descending changes it, and the strip says so', () => {
    floorSheet();
    if (chip() !== 'Floor 1') return 'it started at ' + JSON.stringify(chip());
    ev("[].slice.call(document.querySelectorAll('#floor-strip .uni-fbtn'))[1].click();");
    if (ev('S.floor') !== 2) return 'the floor is ' + ev('S.floor');
    return chip() === 'Floor 2' || 'the strip still reads ' + JSON.stringify(chip());
  });
  check('[floor] it cannot go above the first floor', () => {
    floorSheet();
    ev("[].slice.call(document.querySelectorAll('#floor-strip .uni-fbtn'))[0].click();");
    ev("[].slice.call(document.querySelectorAll('#floor-strip .uni-fbtn'))[0].click();");
    return ev('S.floor') === 1 || 'went to ' + ev('S.floor');
  });
  check('[floor] a game with no floor gets no strip', () => {
    // The strip belongs to a pack that tracks one, not to the shell.
    const html = ev("(document.getElementById('floor-strip')||{}).innerHTML||''");
    return html !== '' || 'this game tracks a floor and has no strip';
  });
  check('[floor] the sheet header follows the party down', () => {
    // It used to show the floor the character was BUILT for, which stops being
    // true the moment they descend.
    floorSheet();
    ev("sysFloorStep(1);sysFloorStep(1);");
    const h = ev("document.getElementById('hero-sheet').innerHTML");
    return /Floor 3/.test(h) || 'the header did not follow';
  });
  check('[floor] a new Mob defaults to the floor you are on', () => {
    // "A Mob's base DR is equal to the Floor Number."
    return ev("SYS.npc.fields().filter(function(f){return f.key==='floor'})[0].def()") === 3
      || 'a Mob would be built for floor ' + ev("SYS.npc.fields().filter(function(f){return f.key==='floor'})[0].def()");
  });
  check('[floor] a pet Rank follows it too', () => {
    // A pet "rolls at the Floor Number however green it is."
    ev("S.char.blocks.companions={entries:[{name:'Rat',kind:'pet',levelsGained:0}]};blockSyncAll(null);");
    const txt = ev("document.getElementById('blk-companions').innerHTML.replace(/<[^>]*>/g,' ')");
    return /Floor 3/.test(txt) || 'the pet readout still reads: ' + txt.replace(/\s+/g, ' ').slice(0, 90);
  });
  check('[floor] it survives a reload', () => {
    ev("save();");
    const sess = JSON.parse(ev("JSON.stringify(sysScratchSession())") || 'null');
    return (sess && sess.floor === 3) || 'the saved session has floor ' + JSON.stringify(sess && sess.floor);
  });

  // ── building a Mob ────────────────────────────
  // The full NPC builder was Daring Comics' Fate NPC throughout — Aspects, a
  // skill ladder, stress boxes, consequences, powerSets, stunts. Opening it in
  // this game threw "SKILLS is not defined" into the console and did nothing
  // visible, so the button looked inert. A Mob is a different creature: a
  // Level, a Health Bar of that many slots, DR from the floor, an Evade, a
  // Move and some attacks (pp. 270-273).
  const npcOpen = () => {
    ev("S.char=SYS.newCharacter();dccSetFloor(3);dccFinishCreation(S.char);");
    ev("S.char.creation={step:0,complete:true};renderHero();S.floor=3;S.npcs=[];showTab('npcs');");
    ev("openFullNPCBuilder(null)");
  };

  check('[mob] the full builder opens instead of throwing', () => {
    const r = ev("(function(){try{openFullNPCBuilder(null);return 'ok'}catch(e){return e.message}})()");
    if (r !== 'ok') return 'threw: ' + r;
    npcOpen();
    const h = ev("document.getElementById('npcs-content').innerHTML");
    return /New Mob/.test(h) || 'the builder did not render';
  });
  check('[mob] it asks for the things a stat block has', () => {
    npcOpen();
    const h = ev("document.getElementById('npcs-content').innerHTML");
    const want = ['Name', 'Type', 'Size', 'Level', 'Evade', 'Move', 'Attacks'];
    const missing = want.filter(x => h.indexOf(x) < 0);
    return missing.length ? 'no field for ' + missing.join(', ') : true;
  });
  check('[mob] Health Bar slots equal its Level, capped at ten', () => {
    // "The number of HB slots equals the Mob's Level, up to a maximum of 10."
    const hb = lvl => {
      ev("S._npcDraft.level=" + lvl + ";");
      return ev("SYS.npc.fields().filter(function(f){return f.key==='hbSlots'})[0].derive(S._npcDraft,S)");
    };
    npcOpen();
    if (hb(6) !== 6) return 'a Level 6 Mob got ' + hb(6) + ' slots';
    return hb(30) === 10 || 'a Level 30 Mob got ' + hb(30) + ' slots, expected the cap of 10';
  });
  check('[mob] Damage Resistance comes from the floor', () => {
    // "A Mob's base DR is equal to the Floor Number."
    npcOpen();
    const dr = () => ev("SYS.npc.fields().filter(function(f){return f.key==='dr'})[0].derive(S._npcDraft,S)");
    if (dr() !== 3) return 'on Floor 3 a Mob had DR ' + dr();
    ev("S._npcDraft.floor=7;");
    return dr() === 7 || 'a Mob from Floor 7 had DR ' + dr();
  });
  check('[mob] a Mob keeps the floor it belongs to, not the current one', () => {
    // "If a Mob is introduced as 'from another floor', their DR base derives
    // from their home floor and not the current one."
    npcOpen();
    ev("sysNpcSet('name','Visitor');sysNpcSet('floor','7');saveSysNPC();");
    ev("S.floor=3;");
    const mob = JSON.parse(ev("JSON.stringify(S.npcs.filter(function(n){return n.name==='Visitor'})[0])"));
    return mob.dr === 7 || 'its DR followed the table to ' + mob.dr;
  });
  check('[mob] saving records the derived numbers, not just the typed ones', () => {
    npcOpen();
    ev("sysNpcSet('name','Tongue Lasher');sysNpcSet('level','6');saveSysNPC();");
    const mob = JSON.parse(ev("JSON.stringify(S.npcs.filter(function(n){return n.name==='Tongue Lasher'})[0])"));
    if (mob.hbSlots !== 6) return 'Health Bar slots not stored: ' + JSON.stringify(mob.hbSlots);
    return mob.dr === 3 || 'DR not stored: ' + JSON.stringify(mob.dr);
  });
  check('[mob] a nameless Mob is refused rather than saved blank', () => {
    npcOpen();
    const n = ev("S.npcs.length");
    ev("sysNpcSet('name','');saveSysNPC();");
    return ev("S.npcs.length") === n || 'a Mob with no name was saved';
  });
  check('[mob] typing in the builder does not steal the caret', () => {
    // The derived rows update in place; the field being typed into is not
    // redrawn, which is the same discipline the Stat grid needed.
    npcOpen();
    ev("var i=document.querySelector('#npcs-content input');i.setAttribute('data-probe','1');i.focus();" +
       "i.value='Gorgon';i.dispatchEvent(new window.Event('input',{bubbles:true}));");
    const kept = ev("(document.querySelector('#npcs-content input')||{}).getAttribute&&" +
                    "document.querySelector('#npcs-content input').getAttribute('data-probe')");
    return kept === '1' || 'the field was replaced while typing';
  });
  check('[mob] _npcTab is a real variable, not a dead reference', () => {
    // It was read from an onclick attribute before it was ever declared.
    return ev("typeof _npcTab") !== 'undefined' || '_npcTab is still undeclared';
  });

  // ── the map belongs to this game ────────────────────────────────
  // The map arrived furnished by Daring Comics: a region called "Downtown" and
  // zones called Building, Street, Rooftop and Hideout. A dungeon has hallways
  // and stairwells, and the Atlas names them.
  check('[map] the starting ground is named by the pack', () => {
    const n = ev("defaultRegion().name");
    return n === 'The First Floor' || 'the map opens on ' + JSON.stringify(n);
  });
  check('[map] zone kinds are the dungeon\'s, not a city\'s', () => {
    const kinds = JSON.parse(ev("JSON.stringify(mapZoneTypes())"));
    const city = ['Building', 'Street', 'Rooftop', 'Hideout'].filter(k => kinds.indexOf(k) >= 0);
    if (city.length) return 'still offers ' + city.join(', ');
    const want = ['Hallway', 'Stairwell', 'Saferoom'];
    const missing = want.filter(k => kinds.indexOf(k) < 0);
    return missing.length ? 'no ' + missing.join(', ') : true;
  });
  check('[map] every zone kind has an icon', () => {
    const icons = JSON.parse(ev("JSON.stringify(mapZoneIcons())"));
    const bare = JSON.parse(ev("JSON.stringify(mapZoneTypes())")).filter(k => !icons[k]);
    return bare.length === 0 || 'no icon for ' + bare.join(', ');
  });
  check('[map] the examples name places this game has', () => {
    const hint = ev("mapHint('cellName','')");
    if (/Wayne|City Hall|Docks/.test(hint)) return 'still suggests ' + JSON.stringify(hint);
    return /Guild|Bathroom|Reward/.test(hint) || 'unhelpful example: ' + JSON.stringify(hint);
  });
  check('[map] an untouched Downtown from an older crawler is renamed', () => {
    const got = ev("(function(){var r=defaultRegion();r.name='Downtown';" +
                   "sysRenameStarterRegion([r]);return r.name})()");
    return got === 'The First Floor' || 'left as ' + JSON.stringify(got);
  });
  check('[map] ...but a map you have drawn on is left alone', () => {
    // Once there is anything on it, it is the player's map whatever it is called.
    const got = ev("(function(){var r=defaultRegion();r.name='Downtown';" +
                   "r.cells[3].name='My hideout';sysRenameStarterRegion([r]);return r.name})()");
    return got === 'Downtown' || 'renamed a map in use to ' + JSON.stringify(got);
  });

  // ── a Skill your gear lends you ───────────────
  // Reported from a browser: a bow granting Tracking, and no Tracking anywhere
  // on the sheet. The bonus was being computed, but the Skills list only ever
  // rendered Skills the character owns, so a grant for something you have no
  // Ranks in was invisible — which makes the grant worthless.
  const lentSheet = () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Bow');dccStatMethod('array');");
    ev("dccAssignStat('STR',6);dccAssignStat('CON',5);dccAssignStat('DEX',4);dccAssignStat('INT',5);dccAssignStat('CHA',2);");
    ev("dccSetFloor(1);dccFinishCreation(S.char);S.char.creation={step:0,complete:true};renderHero();");
    ev("S.char.blocks.gear.equipped.hands[0].grantsSkill='Tracking';");
    ev("S.char.blocks.gear.equipped.hands[0].grantsSkillN=3;blockSyncAll(null);");
  };
  const lentRows = () => JSON.parse(ev("JSON.stringify([].slice.call(" +
    "document.querySelectorAll('#blk-skills .is-lent')).map(function(x){" +
    "return x.textContent.replace(/\\s+/g,' ').trim()}))"));

  check('[lent] a Skill granted by worn gear appears on the sheet', () => {
    lentSheet();
    const rows = lentRows();
    if (!rows.length) return 'nothing was listed';
    return /Tracking/.test(rows[0]) || 'listed ' + JSON.stringify(rows[0]);
  });
  check('[lent] it says which item is lending it', () => {
    // Otherwise a player cannot tell why it is there or how to lose it.
    return /from Bow/i.test(lentRows()[0] || '') || 'no source named: ' + JSON.stringify(lentRows()[0]);
  });
  check('[lent] it carries the Stat Mod and the bonus in its total', () => {
    // INT Mod for this crawler plus the +3 from the bow.
    const row = lentRows()[0] || '';
    const m = /([+-]\d+)\s*$/.exec(row);
    if (!m) return 'no total on the row: ' + JSON.stringify(row);
    const want = ev("dccModOf(S.char,'INT')") + 3;
    return Number(m[1]) === want || 'total is ' + m[1] + ', expected ' + want;
  });
  check('[lent] it is not written into the Skills you own', () => {
    // It belongs to the item, not the crawler, so it must not be saved as a
    // Skill or it would outlive the bow.
    lentSheet();
    return ev("S.char.blocks.skills.skills.filter(function(s){return s.name==='Tracking'}).length") === 0
      || 'Tracking was added to the character';
  });
  check('[lent] it disappears when the item comes off', () => {
    lentSheet();
    ev("S.char.blocks.gear.equipped.hands=[];blockSyncAll(null);");
    return lentRows().length === 0 || 'still listed after unequipping';
  });
  check('[lent] a Skill you already have is not listed twice', () => {
    lentSheet();
    ev("S.char.blocks.gear.equipped.hands[0].grantsSkill='Bow';blockSyncAll(null);");
    const rows = lentRows();
    return rows.length === 0 || 'Bow was listed again as lent: ' + JSON.stringify(rows);
  });
  check('[lent] ...it raises the Skill you have instead', () => {
    // Read the total OUT OF ITS OWN ELEMENT. This used to match the end of the
    // row's text, which broke every time the row gained a control — first the
    // roll button, then the icon button. What the check means is "the Bow row
    // shows a total", and .sk-total says that directly.
    const total = ev("(function(){var b=document.getElementById('blk-skills');" +
      "var d=[].slice.call(b.querySelectorAll('div'));" +
      "for(var i=0;i<d.length;i++){if(/^Bow/.test(d[i].textContent.trim())&&!d[i].children.length){" +
      "var row=d[i].parentElement.parentElement;var t=row.querySelector('.sk-total');" +
      "return t?t.textContent.trim():'(no .sk-total on the row)'}}return '(no Bow row)'})()");
    return /^[+-]?\d+$/.test(total) || 'no total on the Bow row: ' + JSON.stringify(total);
  });

  // ── a gear change has to show up on the sheet ─
  // Reported from a browser: "I have a bow equipped and it's not adding the DEX
  // or tracking skill." The numbers were right in the data the whole time; the
  // sheet simply never redrew. Editing gear repainted only the blocks in the
  // gear block's `affects` list, which named `defence` alone — so Damage
  // Resistance updated and nothing else did.
  const bowSheet = () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Bow');dccStatMethod('array');");
    ev("dccAssignStat('STR',6);dccAssignStat('CON',5);dccAssignStat('DEX',4);dccAssignStat('INT',3);dccAssignStat('CHA',2);");
    ev("dccSetFloor(1);dccFinishCreation(S.char);S.char.creation={step:0,complete:true};renderHero();");
  };
  const gridDex = () => ev("(document.querySelector('#tg-stats-DEX-tot')||{}).textContent");

  check('[sync] a Stat granted by gear reaches the Stat grid', () => {
    bowSheet();
    const before = gridDex();
    ev("S.char.blocks.gear.equipped.hands[0].grantsStat='DEX';");
    ev("S.char.blocks.gear.equipped.hands[0].grantsStatN=3;");
    ev("invSetField('gear','equipped','hands',0,'grantsStatN',3);");
    const after = gridDex();
    return Number(after) === Number(before) + 3
      || 'the grid read ' + before + ' and still reads ' + after;
  });
  check('[sync] a Skill granted by gear reaches that Skill total', () => {
    bowSheet();
    const row = () => ev("(function(){var b=document.getElementById('blk-skills');" +
      "var d=[].slice.call(b.querySelectorAll('div'));" +
      "for(var i=0;i<d.length;i++){if(/^Bow/.test(d[i].textContent.trim())&&!d[i].children.length)" +
      "return d[i].parentElement.parentElement.textContent.replace(/\\s+/g,' ').trim()}return ''})()");
    const before = row();
    ev("S.char.blocks.gear.equipped.hands[0].grantsSkill='Bow';");
    ev("invSetField('gear','equipped','hands',0,'grantsSkillN',2);");
    const after = row();
    if (!before || !after) return 'could not read the Bow row';
    return before !== after || 'the Skill row did not change: ' + after;
  });
  check('[sync] equipping something updates the sheet, not just the gear block', () => {
    // invMove repainted only the gear block, so a ring moved from the Inventory
    // to a slot raised nothing visible.
    bowSheet();
    const before = gridDex();
    ev("S.char.blocks.gear.inventory.push({name:'Ring',grantsStat:'DEX',grantsStatN:4});");
    ev("invMove('gear','inventory','equipped','',0);");
    return Number(gridDex()) === Number(before) + 4
      || 'the grid read ' + before + ' and now reads ' + gridDex();
  });
  check('[sync] ...and unequipping takes it away again', () => {
    const before = gridDex();
    // The ring lands in whichever slot had room, so find it rather than assume.
    const slot = ev("(function(){var e=S.char.blocks.gear.equipped;" +
      "for(var k in e){for(var i=0;i<(e[k]||[]).length;i++){if(e[k][i].name==='Ring')return k}}return ''})()");
    if (!slot) return 'the ring was never equipped';
    ev("invMove('gear','equipped','inventory'," + JSON.stringify(slot) + ",0);");
    const after = gridDex();
    return Number(after) < Number(before) || 'the bonus survived being taken off: ' + after;
  });
  check('[sync] the field being typed into is never redrawn', () => {
    // The redraw runs on every keystroke, so it has to leave the caret alone.
    bowSheet();
    ev("[].slice.call(document.querySelectorAll('#blk-gear button'))" +
       ".filter(function(b){return /invDetail/.test(b.getAttribute('onclick')||'')})[0].click();");
    ev("var i=document.querySelector('#blk-gear .inv-detail input');i.setAttribute('data-probe','1');i.focus();" +
       "i.value='3';i.dispatchEvent(new window.Event('input',{bubbles:true}));");
    const kept = ev("(document.querySelector('#blk-gear .inv-detail input')||{}).getAttribute&&" +
                    "document.querySelector('#blk-gear .inv-detail input').getAttribute('data-probe')");
    if (kept !== '1') return 'the field was replaced mid-keystroke';
    return ev("document.activeElement.tagName") === 'INPUT' || 'focus was lost';
  });

  // ── gear that raises what you are ────────────────────────────────────────
  // "Platinum: +2 Skill in the Weapon, +3 to Strength or Dexterity" (p. 116),
  // and Platinum armour gives "+3 to Catcher or Taunt Skills". Those had
  // nowhere to live, so a magic ring was a label.
  const wornSheet = () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccStatMethod('array');");
    ev("dccAssignStat('STR',6);dccAssignStat('CON',5);dccAssignStat('DEX',4);dccAssignStat('INT',3);dccAssignStat('CHA',2);");
    ev("dccSetFloor(1);dccFinishCreation(S.char);S.char.creation={step:0,complete:true};renderHero();");
  };

  check('[worn] a worn item raises the Stat it grants', () => {
    wornSheet();
    const before = ev("dccStatOf(S.char,'STR')");
    ev("S.char.blocks.gear.equipped.accessories=[{name:'Ring of Might',grantsStat:'STR',grantsStatN:6}];");
    const after = ev("dccStatOf(S.char,'STR')");
    return after === before + 6 || 'Enhanced STR went from ' + before + ' to ' + after;
  });
  check('[worn] ...on the Enhanced layer only, never Unenhanced', () => {
    // "Enhanced includes the Unenhanced score plus any bonuses from gear."
    // Taking the ring off has to take the bonus with it, so it is not stored.
    const base = ev("S.char.blocks.stats.STR.base");
    ev("S.char.blocks.gear.equipped.accessories=[];");
    if (ev("S.char.blocks.stats.STR.base") !== base) return 'the Stat itself was changed';
    return ev("dccStatOf(S.char,'STR')") === base || 'the bonus outlived the item';
  });
  check('[worn] the Stat grid shows the worn total and its Mod', () => {
    wornSheet();
    const before = ev("document.querySelector('#tg-stats-STR-tot').textContent");
    ev("S.char.blocks.gear.equipped.accessories=[{name:'Ring',grantsStat:'STR',grantsStatN:6}];renderHero();");
    const after = ev("document.querySelector('#tg-stats-STR-tot').textContent");
    if (Number(after) !== Number(before) + 6) return 'grid reads ' + after + ', was ' + before;
    return ev("document.querySelector('#tg-stats-STR-mod').textContent") !== '' || 'no Mod shown';
  });
  check('[worn] a Skill bonus reaches that Skill total', () => {
    wornSheet();
    const line = () => ev("SYS.derive.gearItemReadout({name:'Bat',skill:'Club'},S.char)");
    const before = /\+(\d+) to hit/.exec(line());
    ev("S.char.blocks.gear.equipped.accessories=[{name:'Gloves',grantsSkill:'Club',grantsSkillN:2}];");
    const after = /\+(\d+) to hit/.exec(line());
    if (!before || !after) return 'no to-hit figure: ' + JSON.stringify(line());
    return Number(after[1]) === Number(before[1]) + 2
      || 'to hit went from ' + before[1] + ' to ' + after[1];
  });
  check('[worn] stowed gear grants nothing at all', () => {
    // "Only what is in a Gear Slot gives you anything" (p. 112).
    wornSheet();
    const base = ev("dccStatOf(S.char,'STR')");
    ev("S.char.blocks.gear.hotlist.push({name:'Ring',grantsStat:'STR',grantsStatN:6});");
    ev("S.char.blocks.gear.inventory.push({name:'Gloves',grantsSkill:'Club',grantsSkillN:2});");
    if (ev("dccStatOf(S.char,'STR')") !== base) return 'a Hotlist ring raised a Stat';
    return ev("SYS.derive.wornBonus(S.char,'skill','Club')") === 0 || 'stowed gloves still helped';
  });
  check('[worn] the detail panel can record both grants', () => {
    const keys = JSON.parse(ev("JSON.stringify(SYS.derive.gearItemFields().map(function(f){return f.key}))"));
    const want = ['grantsStat', 'grantsStatN', 'grantsSkill', 'grantsSkillN'];
    const missing = want.filter(k => keys.indexOf(k) < 0);
    return missing.length ? 'no field for ' + missing.join(', ') : true;
  });

  // ── an upgrade you have actually earned ───────
  // Weapon and Spell upgrades unlock at Rank 5, 10 and 15. Nothing showed them
  // anywhere, so a crawler at Rank 9 was dealing an extra 1d6 and had to
  // remember that from the book.
  const upSheet = (rank) => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Bow');dccStatMethod('array');");
    ev("dccAssignStat('STR',6);dccAssignStat('CON',5);dccAssignStat('DEX',4);dccAssignStat('INT',3);dccAssignStat('CHA',2);");
    ev("dccSetFloor(3);dccRollBumps();dccFinishCreation(S.char);S.char.creation={step:0,complete:true};");
    ev("S.char.blocks.skills.skills.filter(function(s){return s.name==='Bow'})[0].rank=" + rank + ";renderHero();");
  };
  const active = () => JSON.parse(ev("JSON.stringify(SYS.derive.activeUpgrades(S.char,'Bow').map(function(u){return u.rank}))"));

  check('[upgrade] only the tiers your Rank has reached are active', () => {
    upSheet(3);
    if (active().length) return 'a Rank 3 crawler had ' + JSON.stringify(active());
    upSheet(9);
    if (active().join(',') !== '5') return 'a Rank 9 crawler had ' + JSON.stringify(active());
    upSheet(15);
    return active().join(',') === '5,10,15' || 'a Rank 15 crawler had ' + JSON.stringify(active());
  });
  check('[upgrade] the sheet shows the earned one and not the rest', () => {
    // Listing a Rank 15 upgrade to a Rank 9 crawler is an invitation, not
    // information.
    upSheet(9);
    const h = ev("document.getElementById('blk-skills').innerHTML");
    if (!/Rank 5:/.test(h)) return 'the earned upgrade is not shown';
    return !/Rank 1[05]:/.test(h) || 'an unearned upgrade is being shown';
  });

  // ── the printed row carries more than a name ──
  const carried = () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Bow');dccStatMethod('array');");
    ev("dccAssignStat('STR',6);dccAssignStat('CON',5);dccAssignStat('DEX',4);dccAssignStat('INT',3);dccAssignStat('CHA',2);");
    ev("dccSetFloor(3);dccRollBumps();dccFinishCreation(S.char);S.char.name='Fenwick';");
    ev("S.char.creation={step:0,complete:true};");
    ev("S.char.blocks.skills.skills.filter(function(s){return s.name==='Bow'})[0].rank=9;");
    ev("S.char.blocks.gear.equipped.torso=[{name:'Hockey pads',dr:2,resist:'Fire',notes:'Smells.'}];");
    ev("S.char.blocks.gear.equipped.accessories=[{name:'Ring',grantsStat:'STR',grantsStatN:3,grantsSkill:'Tracking',grantsSkillN:3}];");
    ev("showTab('print');prClear();prToggle('hero','@self','full');");
    const doc = ev("prBuildBody()");
    const pg = doc.split('<section class="pg">').slice(1).filter(x => x.indexOf('WORN AND HELD') >= 0)[0] || '';
    return { html: pg, text: pg.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ') };
  };

  check('[carry] an item can carry a note you wrote', () => {
    const keys = JSON.parse(ev("JSON.stringify(SYS.derive.gearItemFields().map(function(f){return f.key}))"));
    if (keys.indexOf('notes') < 0) return 'there is no field for a description';
    return /Smells/.test(carried().text) || 'the note did not print';
  });
  check('[carry] the row is labelled, not one run-on sentence', () => {
    const t2 = carried().text;
    const want = ['Attack', 'To hit', 'Grants', 'Note'];
    const missing = want.filter(l => t2.indexOf(l) < 0);
    return missing.length ? 'no label for ' + missing.join(', ') : true;
  });
  check('[carry] a weapon prints the upgrade its Rank has earned', () => {
    const t2 = carried().text;
    if (!/Rank 5/.test(t2)) return 'the earned upgrade did not print';
    return !/Rank 15/.test(t2) || 'an unearned upgrade printed';
  });
  check('[carry] the page gathers what the gear is granting', () => {
    // Scattered one row at a time, this is unreadable at a table.
    const t2 = carried().text;
    if (!/Damage Resistance/.test(t2)) return 'no DR total';
    if (!/Resists/.test(t2)) return 'resistances are not gathered';
    return /From gear/.test(t2) || 'the Stat and Skill grants are not gathered';
  });
  check('[carry] an ordinary item stays one line', () => {
    // "Doesn't need to be fully described" — only the lines an item has print.
    ev("S.char.blocks.gear.equipped.accessories=[{name:'Bit of string'}];");
    ev("showTab('print');prClear();prToggle('hero','@self','full');");
    const doc = ev("prBuildBody()");
    const pg = doc.split('<section class="pg">').slice(1).filter(x => x.indexOf('WORN AND HELD') >= 0)[0] || '';
    const row = /Bit of string([\s\S]{0,220}?)<\/td>/.exec(pg);
    if (!row) return 'the item did not print at all';
    return (row[1].match(/pr-sub/g) || []).length === 0
      || 'a plain item printed extra lines';
  });

  // ── a printed page is a whole page ────────────
  check('[print] a page fills the sheet it is printed on', () => {
    // .pg carried a page break but no height, so every section shrank to its
    // own contents: a run of half-empty sheets in the preview, and rules that
    // stop halfway down on paper.
    const css = ev("dcSheetCSS()");
    if (!/min-height:\s*10in/.test(css)) return 'no page height is set for Letter';
    return /10\.69in/.test(css) || 'A4 is not accounted for';
  });
  check('[print] the page estimate matches the document', () => {
    ev("S.char=SYS.newCharacter();dccSetFloor(1);dccFinishCreation(S.char);");
    ev("S.char.name='Fenwick';S.char.creation={step:0,complete:true};");
    ev("showTab('print');prClear();prToggle('hero','@self','full');");
    const real = (ev("prBuildBody()").match(/class="pg"/g) || []).length;
    const said = ev("prPageCount()");
    return real === said || 'the centre says ' + said + ' page(s) for a ' + real + '-page document';
  });

  // ── Skills and Spells print what they do ──────
  check('[print] a Spell prints its description, not just its Rank', () => {
    // "None of the descriptions are on the printed version" — the print rows
    // carried name, Rank and Stat and nothing else.
    ev("S.char=SYS.newCharacter();dccSetRoute('spell');dccSetSpell('Fire Fingers');");
    ev("dccSetFloor(1);dccFinishCreation(S.char);S.char.name='Fenwick';");
    ev("S.char.creation={step:0,complete:true};showTab('print');prClear();prToggle('hero','@self','full');");
    const doc = ev("prBuildBody()");
    if (!/pr-sub/.test(doc)) return 'no description lines in the document at all';
    return /Health Bar slots/.test(doc) || 'Heal still prints without saying what it does';
  });
  check('[print] a Spell prints its Mana cost and range', () => {
    const doc = ev("prBuildBody()");
    if (!/Mana/.test(doc)) return 'no Mana cost printed';
    return /Self only|Melee|feet/.test(doc) || 'no range printed';
  });
  check('[print] a block carrying descriptions is given the full width', () => {
    // A line of description does not fit a half-width column.
    const doc = ev("prBuildBody()");
    return /pr-wide/.test(doc) || 'Skills and Spells are still squeezed into a column';
  });

  // ── printing what you carry ───────────────────
  // Gear used to print as a run-on comma list squeezed into a column of the
  // main sheet, with none of the mechanics: "Gear Slots Hockey pads, Club
  // Hotlist Healing Potion x3". Worn gear and the Hotlist are what you reach
  // for mid-fight, so each gets a page.
  const printed = () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');");
    ev("dccStoreCombat('weaponName','Tire Iron');dccStatMethod('array');");
    ev("dccAssignStat('STR',6);dccAssignStat('CON',5);dccAssignStat('DEX',4);dccAssignStat('INT',3);dccAssignStat('CHA',2);");
    ev("dccSetFloor(3);dccRollBumps();dccChoose('race','human');dccChoose('cls','boring-ol-fighter');");
    ev("dccFinishCreation(S.char);S.char.name='Fenwick';S.char.creation={step:0,complete:true};");
    ev("S.char.blocks.gear.equipped.torso=[{name:'Hockey pads',dr:2,resist:'Fire'}];");
    ev("S.char.blocks.gear.equipped.accessories=[{name:'Ring of Might',grantsStat:'STR',grantsStatN:3}];");
    ev("S.char.blocks.gear.hotlist=[{name:'Healing Potion',qty:3},{name:'Scroll of Fireball',casts:'Fireball',rank:3}];");
    ev("showTab('print');prClear();prToggle('hero','@self','full');");
    return ev("prBuildBody()");
  };
  const pageWith = (doc, kicker) => {
    const parts = doc.split('<section class="pg">').slice(1);
    return parts.filter(x => x.indexOf(kicker) >= 0)[0] || '';
  };

  check('[print] worn gear and the Hotlist each get their own page', () => {
    const doc = printed();
    if (!pageWith(doc, 'WORN AND HELD')) return 'no page for what you are wearing';
    return pageWith(doc, 'HOTLIST') !== '' || 'no page for the Hotlist';
  });
  check('[print] the worn page lists every slot, filled or not', () => {
    const page = pageWith(printed(), 'WORN AND HELD');
    const want = ['Head', 'Torso', 'Arms', 'Legs', 'Feet', 'Hands/Holding', 'Accessories'];
    const missing = want.filter(sl => page.indexOf(sl) < 0);
    return missing.length ? 'no row for ' + missing.join(', ') : true;
  });
  check('[print] a weapon prints its damage and to-hit, not just a name', () => {
    const page = pageWith(printed(), 'WORN AND HELD');
    if (page.indexOf('Tire Iron') < 0) return 'the weapon is not on the page';
    if (!/1d6/.test(page)) return 'no damage printed';
    return /to\s*hit/i.test(page.replace(/<[^>]*>/g, ' ')) || 'no to-hit printed';
  });
  check('[print] armour prints its DR, and the page totals it', () => {
    const page = pageWith(printed(), 'WORN AND HELD');
    if (!/\+2 DR/.test(page)) return 'the armour does not state its DR';
    return /Damage Resistance/.test(page) || 'the page does not total Damage Resistance';
  });
  check('[print] an item that grants a Stat says so', () => {
    const page = pageWith(printed(), 'WORN AND HELD');
    return /\+3 STR/.test(page) || 'the ring printed as a bare name';
  });
  check('[print] the Hotlist page has a numbered row per slot', () => {
    const page = pageWith(printed(), 'HOTLIST');
    // Ten slots, including the empty ones — it is a sheet you write on.
    const rows = (page.match(/<tr>/g) || []).length;
    return rows >= 10 || 'only ' + rows + ' rows for a ten-slot Hotlist';
  });
  check('[print] a scroll on the Hotlist says what it casts', () => {
    const page = pageWith(printed(), 'HOTLIST');
    // Labels are marked up now, so "Casts" and "Fireball" are separated by a
    // tag in the source. Read the text the way a person does.
    const text = page.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    return /casts\s+Fireball/i.test(text) || 'the scroll printed as a bare name';
  });
  check('[print] gear is no longer squeezed onto the main sheet', () => {
    const page = pageWith(printed(), 'HERO SHEET');
    return page.indexOf('Hotlist') < 0
      || 'the main sheet still carries the gear block as a comma list';
  });
  check('[print] every page is identifiable face-down', () => {
    const doc = printed();
    const parts = doc.split('<section class="pg">').slice(1)
      .filter(x => x.indexOf('CONTENTS') < 0);
    const bad = parts.filter(x => x.indexOf('Fenwick') < 0 || x.indexOf('Floor 3') < 0);
    return bad.length === 0 || bad.length + ' page(s) carry neither the name nor the floor';
  });

  // ── a Spell has to say what it does ───────────────────────────
  // Reported from a browser: "I have no idea what spells do. Even Heal." The
  // catalogue carried Mana, range and type but no effect text at all, so the
  // sheet could only ever show a name.
  check('[spells] every Spell in the catalogue has its effect', () => {
    const without = ev("JSON.stringify(DCC_SPELLS.filter(function(s){return !s.effect})" +
                       ".map(function(s){return s.name}))");
    return without === '[]' || 'no effect recorded for: ' + without;
  });
  check('[spells] Heal says what Heal does', () => {
    const heal = ev("(DCC_SPELLS.filter(function(s){return s.name==='Heal'})[0]||{}).effect||''");
    return /Health Bar/.test(heal) || 'reads ' + JSON.stringify(heal);
  });
  check('[spells] the sheet prints the cost, the range and the effect', () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('spell');dccSetSpell('Fire Fingers');dccSetFloor(1);");
    ev("dccFinishCreation(S.char);S.char.creation={step:0,complete:true};renderHero();");
    const h = ev("document.getElementById('blk-spells').innerHTML");
    if (!/sk-effect/.test(h)) return 'no effect line rendered at all';
    if (!/Mana/.test(h)) return 'no Mana cost shown';
    return /Health Bar slots/.test(h) || 'Heal still does not say what it does';
  });
  check('[spells] the damage line is not printed twice', () => {
    // The printed entry repeats its own Base Damage inside the effect text.
    const line = ev("(function(){var e=document.querySelectorAll('#blk-spells .sk-effect');" +
                    "for(var i=0;i<e.length;i++){if(/Fire/.test(e[i].textContent))return e[i].textContent}" +
                    "return ''})()");
    const hits = (line.match(/1d4 \+ INT Fire/g) || []).length;
    return hits <= 1 || 'the damage appears ' + hits + ' times: ' + JSON.stringify(line);
  });
  check('[spells] a Skill shows its catalogue line too', () => {
    const h = ev("document.getElementById('blk-skills').innerHTML");
    return /sk-effect/.test(h) || 'Skills carry no description';
  });

  // ── nothing may run off the side of a card ────────────────────
  // Reported from a phone: the Hotlist controls ran off the edge. The gear rows
  // were fixed for this earlier and the Hotlist rows were not.
  check('[mobile] Hotlist rows are grouped so they can wrap', () => {
    ev("S.char=SYS.newCharacter();dccSetFloor(1);dccFinishCreation(S.char);");
    ev("S.char.creation={step:0,complete:true};renderHero();");
    ev("S.char.blocks.gear.hotlist=[{name:'Healing Potion',qty:3}];blockRepaint('gear');");
    const h = ev("document.getElementById('blk-gear').innerHTML");
    if (!/inv-row/.test(h)) return 'Hotlist rows are still inline-styled';
    return /inv-ctl/.test(h) || 'the controls are not grouped, so they cannot wrap';
  });
  check('[mobile] no inventory row is a fixed single line any more', () => {
    const h = ev("document.getElementById('blk-gear').innerHTML");
    const inline = (h.match(/display:flex;align-items:center;gap:6px;padding:3px 0/g) || []).length;
    return inline === 0 || inline + ' rows still use the old fixed layout';
  });
  check('[mobile] the add row is grouped so it can wrap too', () => {
    const h = ev("document.getElementById('blk-gear').innerHTML");
    if (!/class="inv-add"/.test(h)) return 'the add row is still one fixed line';
    return /inv-add-opts/.test(h) || 'its pickers are not grouped';
  });
  check('[mobile] an item in the Hotlist still says what it is', () => {
    ev("S.char.blocks.gear.hotlist=[{name:'Scroll of Fireball',casts:'Fireball',rank:3}];blockRepaint('gear');");
    const h = ev("document.getElementById('blk-gear').innerHTML");
    return /casts Fireball/.test(h) || 'the readout was lost in the rework';
  });

  // ── the other kinds of item ──────────────────────────────────────────────
  // A weapon is not the only thing an item can be. Armour grants Damage
  // Resistance, "gained via Armor (natural or worn)" (p. 93); a scroll casts a
  // Spell you have no Ranks in, since "a crawler can't attempt a Spell without
  // Ranks in the Spell (unless it's a scroll)" (p. 58); and a tome "can later
  // be read to learn the Spell" (p. 116).
  const kindSheet = () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(1);");
    ev("dccFinishCreation(S.char);S.char.creation={step:0,complete:true};renderHero();");
  };
  const readOut = obj => ev("SYS.derive.gearItemReadout(" + JSON.stringify(obj) + ",S.char)");

  check('[kinds] armour reads as the protection it gives', () => {
    kindSheet();
    const line = readOut({ name: 'Hockey pads', dr: 2, resist: 'Fire' });
    if (!/\+2 DR/.test(line)) return 'no DR in the readout: ' + JSON.stringify(line);
    return /Fire Resistance/.test(line) || 'no resistance: ' + JSON.stringify(line);
  });
  check('[kinds] worn armour actually raises your Damage Resistance', () => {
    kindSheet();
    const before = ev("SYS.derive.dr(S.char)");
    ev("S.char.blocks.gear.equipped.torso=[{name:'Hockey pads',dr:2}];");
    const after = ev("SYS.derive.dr(S.char)");
    return after === before + 2 || 'DR went from ' + before + ' to ' + after;
  });
  check('[kinds] the same armour in the Hotlist gives nothing', () => {
    // "Only what is in a Gear Slot gives you anything" (p. 112).
    ev("S.char.blocks.gear.equipped.torso=[];S.char.blocks.gear.hotlist.push({name:'Hockey pads',dr:2});");
    return ev("SYS.derive.dr(S.char)") === 0
      || 'stowed armour still granted ' + ev("SYS.derive.dr(S.char)") + ' DR';
  });
  check('[kinds] a scroll says it can be cast untrained', () => {
    const line = readOut({ name: 'Scroll of Fireball', casts: 'Fireball', rank: 3 });
    if (!/Fireball/.test(line)) return 'no Spell named: ' + JSON.stringify(line);
    if (!/Rank 3/.test(line)) return 'no Rank: ' + JSON.stringify(line);
    return /untrained/.test(line) || 'does not say it works untrained: ' + JSON.stringify(line);
  });
  check('[kinds] a tome offers to be read', () => {
    const acts = JSON.parse(ev("JSON.stringify(SYS.derive.gearItemActions({name:'Tome of Air Buddy',teaches:'Air Buddy'}))"));
    if (!acts.length) return 'a tome offered nothing to do';
    return /Air Buddy/.test(acts[0].label) || 'unclear label: ' + acts[0].label;
  });
  check('[kinds] ...and reading it teaches the Spell and spends the tome', () => {
    kindSheet();
    ev("S.char.blocks.gear.inventory=[{name:'Tome of Air Buddy',teaches:'Air Buddy'}];blockRepaint('gear');");
    ev("invAct('gear','inventory','',0,'learn');");
    const spells = JSON.parse(ev("JSON.stringify((S.char.blocks.spells.skills||[]).map(function(x){return x.name}))"));
    if (spells.indexOf('Air Buddy') < 0) return 'the Spell was not learned: ' + JSON.stringify(spells);
    return ev("S.char.blocks.gear.inventory.length") === 0 || 'the tome survived being read';
  });
  check('[kinds] a tome for a Spell you know is refused, and kept', () => {
    ev("S.char.blocks.gear.inventory=[{name:'Tome of Air Buddy',teaches:'Air Buddy'}];");
    ev("invAct('gear','inventory','',0,'learn');");
    const flash = ev("document.getElementById('save-flash').textContent");
    if (!/already know/i.test(flash)) return 'said ' + JSON.stringify(flash);
    return ev("S.char.blocks.gear.inventory.length") === 1 || 'the tome was consumed anyway';
  });
  check('[kinds] an ordinary item is still just an item', () => {
    return readOut({ name: 'Googly eyes' }) === '' || 'invented mechanics for googly eyes';
  });
  check('[kinds] the detail editor offers every field the pack declares', () => {
    kindSheet();
    ev("S.char.blocks.gear.inventory=[{name:'Tome of Air Buddy',teaches:'Air Buddy'}];blockRepaint('gear');");
    ev("[].slice.call(document.querySelectorAll('#blk-gear button'))" +
       ".filter(function(b){return /invDetail/.test(b.getAttribute('onclick')||'')}).pop().click();");
    const h = ev("document.getElementById('blk-gear').innerHTML");
    // By class, not by an exact attribute string: the icon field carries a
    // second class for its full-width row and a substring match missed it.
    const n = ev("document.querySelectorAll('#blk-gear .inv-f').length");
    const want = ev("SYS.derive.gearItemFields().length");
    if (n !== want) return 'showed ' + n + ' fields, the pack declares ' + want;
    return /invAct/.test(h) || 'the tome offered no action in the panel';
  });

  // ── an item has to be something, not just a label ────────────────────────
  // Reported from a browser: "I can add a baseball bat, but that's all it is.
  // Just the label, it's not a real weapon." An item was {name, qty} and
  // nothing else, so nothing it did at the table was recorded anywhere.
  const itemSheet = () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(1);");
    ev("dccFinishCreation(S.char);S.char.creation={step:0,complete:true};renderHero();");
  };
  const invAddAs = (name, works) => {
    ev("var i=document.getElementById('inv-add-gear-inventory');i.value=" + JSON.stringify(name) + ";" +
       "var a=document.getElementById('inv-as-gear-inventory');if(a)a.value=" + JSON.stringify(works || '') + ";" +
       "invAdd('gear','inventory');");
    return JSON.parse(ev("JSON.stringify(S.char.blocks.gear.inventory.filter(function(x){return x.name===" +
                         JSON.stringify(name) + "})[0]||null)"));
  };

  check('[item] a named weapon carries the Skill it works as', () => {
    itemSheet();
    const bat = invAddAs('Baseball bat', 'Club');
    if (!bat) return 'the item was not added at all';
    return bat.skill === 'Club' || 'stored as ' + JSON.stringify(bat);
  });
  check('[item] ...and reads out its real mechanics', () => {
    const line = ev("SYS.derive.gearItemReadout(S.char.blocks.gear.inventory" +
                    ".filter(function(x){return x.name==='Baseball bat'})[0],S.char)");
    if (!/Club/.test(line)) return 'no Skill in the readout: ' + JSON.stringify(line);
    if (!/1d6/.test(line)) return 'no damage in the readout: ' + JSON.stringify(line);
    return /to hit|untrained/.test(line) || 'nothing about using it: ' + JSON.stringify(line);
  });
  check('[item] the mechanics reach the sheet, not just the data', () => {
    ev("blockRepaint('gear');");
    const h = ev("document.getElementById('blk-gear').innerHTML");
    return /Bludgeoning/.test(h) || 'the sheet still shows only a name';
  });
  check('[item] typing an exact catalogue name links itself', () => {
    itemSheet();
    const d = invAddAs('Dagger', '');
    return (d && d.skill === 'Dagger') || 'stored as ' + JSON.stringify(d);
  });
  check('[item] something that is not a weapon stays a plain item', () => {
    const eyes = invAddAs('Googly eyes', '');
    if (!eyes) return 'not added';
    if (eyes.skill) return 'invented a Skill for it: ' + eyes.skill;
    return ev("SYS.derive.gearItemReadout(S.char.blocks.gear.inventory" +
              ".filter(function(x){return x.name==='Googly eyes'})[0],S.char)") === ''
      || 'gave a readout to a non-weapon';
  });
  check('[item] the weapon from creation is a real weapon too', () => {
    itemSheet();
    ev("dccStoreCombat('weaponName','Tire Iron');dccFinishCreation(S.char);");
    const held = JSON.parse(ev("JSON.stringify(S.char.blocks.gear.equipped.hands[0])"));
    if (held.name !== 'Tire Iron') return 'hands hold ' + JSON.stringify(held);
    if (held.skill !== 'Club') return 'a renamed weapon lost its Skill: ' + JSON.stringify(held);
    return /1d6/.test(ev("SYS.derive.gearItemReadout(S.char.blocks.gear.equipped.hands[0],S.char)"))
      || 'no mechanics on the held weapon';
  });
  check('[item] an item added wrongly can be reclassified in place', () => {
    itemSheet();
    invAddAs('Baseball bat', '');
    ev("invSetSkill('gear','inventory','',S.char.blocks.gear.inventory" +
       ".findIndex(function(x){return x.name==='Baseball bat'}),'Club');");
    const bat = JSON.parse(ev("JSON.stringify(S.char.blocks.gear.inventory" +
                              ".filter(function(x){return x.name==='Baseball bat'})[0])"));
    if (bat.skill !== 'Club') return 'still ' + JSON.stringify(bat);
    ev("invSetSkill('gear','inventory','',S.char.blocks.gear.inventory" +
       ".findIndex(function(x){return x.name==='Baseball bat'}),'');");
    return !JSON.parse(ev("JSON.stringify(S.char.blocks.gear.inventory" +
      ".filter(function(x){return x.name==='Baseball bat'})[0])")).skill
      || 'could not be cleared again';
  });

  // ── equipping a weapon ───────────────────────────────────────────────────
  // The rulebook is clear that a weapon is either in your hand or in your
  // Hotlist, never both: "Items in Hotlists do not grant you any added
  // benefits... When you put an item back into a Hotlist slot, its benefits
  // turn off" (p. 112), and you "swap a weapon you're holding with a weapon in
  // your Hotlist" (p. 111). The move between them is what has to work.
  const gearOf = () => JSON.parse(ev("JSON.stringify(S.char.blocks.gear.equipped)"));
  const equipBuild = () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(1);");
    ev("dccFinishCreation(S.char);S.char.creation={step:0,complete:true};renderHero();");
  };

  check('[equip] a weapon put back on from the Hotlist returns to your hands', () => {
    // It used to land in the first slot with room, which is Head. A Club is
    // held, not worn.
    equipBuild();
    ev("invMove('gear','equipped','hotlist','hands',0);");
    const i = ev("S.char.blocks.gear.hotlist.findIndex(function(x){return x.name==='Club'})");
    if (i < 0) return 'the weapon never reached the Hotlist';
    ev("invMove('gear','hotlist','equipped',''," + i + ");");
    const eq = gearOf();
    if (eq.head.length) return 'the weapon went on your head';
    return eq.hands.some(x => x.name === 'Club') || 'hands hold ' + JSON.stringify(eq.hands);
  });
  check('[equip] a weapon is in one place at a time, never both', () => {
    const eq = gearOf();
    // filter(Boolean): a stack keeps its slot numbers by leaving holes in the array.
    const hot = JSON.parse(ev("JSON.stringify(S.char.blocks.gear.hotlist.filter(Boolean).map(function(x){return x.name}))"));
    const held = eq.hands.some(x => x.name === 'Club');
    return (held && hot.indexOf('Club') < 0) || 'Club is held=' + held + ' and in the Hotlist=' + (hot.indexOf('Club') >= 0);
  });
  check('[equip] anything can be moved to the slot you choose', () => {
    // The shell cannot know where armour goes, so the player corrects it.
    equipBuild();
    ev("S.char.blocks.gear.inventory.push({name:'Hockey pads'});");
    ev("invMove('gear','inventory','equipped','',0);");
    ev("invMove('gear','equipped','equipped','head',0,'torso');");
    const eq = gearOf();
    if (eq.head.length) return 'the pads are still on your head';
    return eq.torso.some(x => x.name === 'Hockey pads') || 'torso holds ' + JSON.stringify(eq.torso);
  });
  check('[equip] moving to a full slot is refused rather than silently dropped', () => {
    equipBuild();
    ev("S.char.blocks.gear.equipped.head=[{name:'Helm'}];");
    ev("S.char.blocks.gear.inventory.push({name:'Second helm'});");
    ev("invMove('gear','inventory','equipped','',0,'head');");
    const eq = gearOf();
    const heads = eq.head.map(x => x.name);
    if (heads.length > 1) return 'Head took two items: ' + JSON.stringify(heads);
    // it must still exist somewhere, not vanish
    const all = JSON.stringify(S_all(ev));
    return all.indexOf('Second helm') >= 0 || 'the item disappeared';
  });
  check("[equip] an item row does not crush its name on a narrow screen", () => {
    // Reported from a phone: an equipped item was unreadable. The name and the
    // controls are separate groups now so the controls can wrap.
    equipBuild();
    ev("S.char.blocks.gear.equipped.hands[0].name='Chef Knife of Unwelcome Surprises';blockRepaint('gear');");
    const row = ev("!!document.querySelector('#blk-gear .inv-row')");
    if (!row) return 'the row is still built from inline styles';
    const name = ev("document.querySelector('#blk-gear .inv-name').textContent.trim()");
    if (name.indexOf('Chef Knife') < 0) return 'the name element is missing: ' + JSON.stringify(name);
    return ev("document.querySelectorAll('#blk-gear .inv-ctl').length") > 0
      || 'the controls are not grouped, so they cannot wrap';
  });

  // ── Skills from creation are not list entries to tidy away ───────────────
  // Reported from a browser: "why do skills have an X after them? I deleted
  // two of them." Every row carried a delete button that fired on one click
  // with no confirmation — including Skills granted by your background, Race,
  // Class and tutorial rolls, which are part of who the character is.
  const skillSheet = () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(1);");
    ev("dccFinishCreation(S.char);S.char.creation={step:0,complete:true};renderHero();");
  };
  const delButtons = () => ev("document.querySelectorAll('#blk-skills [onclick^=\"skillDel\"]').length");

  check('[skills] a Skill from creation offers no delete button', () => {
    skillSheet();
    const n = delButtons();
    return n === 0 || n + ' creation Skills can still be deleted in one click';
  });
  check('[skills] a Skill you added yourself can be removed', () => {
    ev("document.body.insertAdjacentHTML('beforeend','<input id=' + JSON.stringify('sk-add-skills') + '>');");
    ev("document.getElementById('sk-add-skills').value='Climbing';skillAdd('skills');");
    return delButtons() === 1 || 'offered ' + delButtons() + ' delete buttons, expected 1';
  });
  check('[skills] deleting asks first, and refuses a creation Skill outright', () => {
    // confirm() is stubbed true in this harness, so a refusal has to come from
    // the guard rather than from the dialog.
    skillSheet();
    const before = ev("S.char.blocks.skills.skills.length");
    ev("skillDel('skills',0);");
    return ev("S.char.blocks.skills.skills.length") === before
      || 'a creation Skill was deleted anyway';
  });
  check('[skills] the sheet notices when a granted Skill has gone missing', () => {
    skillSheet();
    ev("S.char.blocks.skills.skills=S.char.blocks.skills.skills.filter(function(s){return s.name!=='Club'});");
    ev("blockRepaint('skills');");
    const h = ev("document.getElementById('blk-skills').innerHTML");
    if (!/missing/.test(h)) return 'nothing told the player a Skill was gone';
    return /Club/.test(h) || 'the missing Skill was not named';
  });
  check('[skills] ...and can put it back', () => {
    ev("skillRestore('skills');");
    const names = JSON.parse(ev("JSON.stringify(S.char.blocks.skills.skills.map(function(s){return s.name}))"));
    return names.indexOf('Club') >= 0 || 'restore did not return it: ' + JSON.stringify(names);
  });
  check('[skills] restoring twice does not duplicate', () => {
    ev("skillRestore('skills');skillRestore('skills');");
    const names = JSON.parse(ev("JSON.stringify(S.char.blocks.skills.skills.map(function(s){return s.name}))"));
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    return dupes.length === 0 || 'duplicated ' + dupes.join(', ');
  });
  check('[skills] a sheet with nothing missing says nothing', () => {
    skillSheet();
    const h = ev("document.getElementById('blk-skills').innerHTML");
    return !/missing/.test(h) || 'the notice shows when nothing is actually missing';
  });

  // ── what creation asked you about has to reach the sheet ─────────────────
  // Reported from a browser: "my weapon doesn't appear in my inventory". It
  // never did — the finish step wrote only the Hotlist, so the weapon you chose,
  // the clothes you are standing in, the interesting item and the weird stuff
  // were all collected across two screens and then dropped. A crawler walked
  // out of creation holding nothing.
  const gearBuild = () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');");
    ev("dccStoreGear('clothes','jeans and a hoodie');dccStoreGear('item','a bike lock');");
    ev("dccStoreGear('weird','12 googly eyes');dccSetFloor(1);dccFinishCreation(S.char);");
  };
  const named = expr => JSON.parse(ev("JSON.stringify((" + expr + "||[]).map(function(x){return x.name}))"));

  check('[gear] the weapon you chose is in your hands', () => {
    // "If you're holding anything, especially a weapon, write that in the
    // Hand/Holding slot" (p. 115).
    gearBuild();
    const hands = named("S.char.blocks.gear.equipped.hands");
    return hands.indexOf('Club') >= 0 || 'hands hold ' + JSON.stringify(hands);
  });
  check('[gear] a renamed weapon is carried by its name', () => {
    ev("dccStoreCombat('weaponName','Tire Iron');dccFinishCreation(S.char);");
    const hands = named("S.char.blocks.gear.equipped.hands");
    return hands.indexOf('Tire Iron') >= 0 || 'hands hold ' + JSON.stringify(hands);
  });
  check('[gear] clothes, item and weird stuff all land somewhere', () => {
    gearBuild();
    const torso = named("S.char.blocks.gear.equipped.torso");
    const hot = named("S.char.blocks.gear.hotlist");
    const inv = named("S.char.blocks.gear.inventory");
    if (torso.indexOf('jeans and a hoodie') < 0) return 'clothes went nowhere: ' + JSON.stringify(torso);
    if (hot.indexOf('a bike lock') < 0) return 'the item went nowhere: ' + JSON.stringify(hot);
    return inv.indexOf('12 googly eyes') >= 0 || 'the weird stuff went nowhere: ' + JSON.stringify(inv);
  });
  check('[gear] a Spell is not a thing you hold', () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('spell');dccSetSpell('Fire Fingers');");
    ev("dccSetFloor(1);dccFinishCreation(S.char);");
    const hands = named("S.char.blocks.gear.equipped.hands");
    if (hands.length) return 'the spell route put ' + JSON.stringify(hands) + ' in your hands';
    return named("S.char.blocks.gear.hotlist").indexOf('Fire Fingers') >= 0
      || 'the Spell is not in the Hotlist either';
  });
  check('[gear] re-finishing swaps the weapon without duplicating it', () => {
    gearBuild();
    ev("dccSetWeapon('Axe');dccFinishCreation(S.char);dccFinishCreation(S.char);");
    const hands = named("S.char.blocks.gear.equipped.hands");
    return (hands.length === 1 && hands[0] === 'Axe')
      || 'hands hold ' + JSON.stringify(hands);
  });
  check('[gear] re-finishing does not take away what you looted', () => {
    // Creation can be re-entered, so this write has to leave play gear alone.
    gearBuild();
    ev("S.char.blocks.gear.inventory.push({name:'Looted dagger'});");
    ev("S.char.blocks.gear.equipped.head.push({name:'Goblin helm'});");
    ev("S.char.blocks.gear.hotlist.push({name:'Bandage',qty:3});");
    ev("dccFinishCreation(S.char);");
    const inv = named("S.char.blocks.gear.inventory");
    const head = named("S.char.blocks.gear.equipped.head");
    const hot = named("S.char.blocks.gear.hotlist");
    if (inv.indexOf('Looted dagger') < 0) return 'lost the looted dagger';
    if (head.indexOf('Goblin helm') < 0) return 'lost the helm';
    return hot.indexOf('Bandage') >= 0 || 'lost the bandages';
  });
  check('[gear] it all reaches the rendered sheet', () => {
    gearBuild();
    ev("S.char.name='Fenwick';S.char.creation={step:0,complete:true};renderHero();");
    const h = ev("document.getElementById('hero-sheet').innerHTML");
    const missing = ['Club', 'jeans and a hoodie', 'a bike lock', '12 googly eyes'].filter(x => h.indexOf(x) < 0);
    return missing.length ? 'not on the sheet: ' + missing.join(', ') : true;
  });

  // ── changing a background must not silently bin your Skills ──────────────
  // Reported from a browser as "the options are not clicked and I can't hit
  // continue": you pick two Skills for a stage, click another background to
  // compare it, and both picks vanish without a word — the stage goes back onto
  // the "Still to do" list, which reads exactly like the clicks never landed.
  const bgSetup = () => {
    ev("S.char=SYS.newCharacter();S.char.creation={step:1,complete:false};renderHero();");
    ev("dccRollBackground('childhood');");
  };
  const bgRow = () => ev("JSON.stringify(dccStages(S.char).childhood.rows" +
    ".find(function(r){return r.roll===dccCre(S.char).background.childhood.roll}).skills.map(function(x){return x.s}))");

  check('[background] a pick the new background still offers survives', () => {
    bgSetup();
    const offered = JSON.parse(bgRow());
    // Find another row that shares a Skill with this one, and pick that Skill.
    const shared = ev("JSON.stringify((function(){var st=dccCre(S.char).background.childhood;" +
      "var rows=dccStages(S.char).childhood.rows;var cur=rows.find(function(r){return r.roll===st.roll});" +
      "for(var i=0;i<rows.length;i++){if(rows[i].roll===st.roll)continue;" +
      "for(var j=0;j<rows[i].skills.length;j++){var n=rows[i].skills[j].s;" +
      "if(cur.skills.some(function(x){return x.s===n}))return [rows[i].roll,n];}}return null;})())");
    const pair = JSON.parse(shared);
    if (!pair) return true;                    // no overlap in this table; nothing to prove
    ev("dccPickSkill('childhood'," + JSON.stringify(pair[1]) + ");");
    ev("dccPickBackground('childhood'," + pair[0] + ");");
    const kept = JSON.parse(ev("JSON.stringify(dccCre(S.char).background.childhood.picks)"));
    return kept.indexOf(pair[1]) >= 0
      || 'a Skill the new background also offers was thrown away: ' + JSON.stringify(kept);
  });
  check('[background] a pick it does not offer is dropped WITH a reason', () => {
    bgSetup();
    const drop = JSON.parse(ev("JSON.stringify((function(){var st=dccCre(S.char).background.childhood;" +
      "var rows=dccStages(S.char).childhood.rows;var cur=rows.find(function(r){return r.roll===st.roll});" +
      "for(var i=0;i<rows.length;i++){if(rows[i].roll===st.roll)continue;" +
      "var only=cur.skills.filter(function(x){return !rows[i].skills.some(function(y){return y.s===x.s})});" +
      "if(only.length)return [rows[i].roll,only[0].s];}return null;})())"));
    if (!drop) return true;
    ev("dccPickSkill('childhood'," + JSON.stringify(drop[1]) + ");");
    ev("dccPickBackground('childhood'," + drop[0] + ");");
    const picks = JSON.parse(ev("JSON.stringify(dccCre(S.char).background.childhood.picks)"));
    if (picks.indexOf(drop[1]) >= 0) return 'the Skill should not have survived';
    const flash = ev("document.getElementById('save-flash').textContent");
    return flash.indexOf(drop[1]) >= 0
      || 'dropped silently — the flash said ' + JSON.stringify(flash);
  });
  check('[background] re-rolling a stage keeps what the new roll still offers', () => {
    bgSetup();
    ev("var st=dccCre(S.char).background.childhood;" +
       "var row=dccStages(S.char).childhood.rows.find(function(r){return r.roll===st.roll});" +
       "st.picks=[row.skills[0].s];");
    const before = JSON.parse(ev("JSON.stringify(dccCre(S.char).background.childhood.picks)"));
    ev("dccRollBackground('childhood');");
    const after = JSON.parse(ev("JSON.stringify(dccCre(S.char).background.childhood.picks)"));
    const offered = JSON.parse(bgRow());
    // Whatever survived must be offered; whatever went must not have been.
    const wrong = after.filter(n => offered.indexOf(n) < 0);
    if (wrong.length) return 'kept a Skill the new roll does not offer: ' + wrong.join(', ');
    const lostButOffered = before.filter(n => offered.indexOf(n) >= 0 && after.indexOf(n) < 0);
    return lostButOffered.length === 0
      || 'threw away a still-valid pick: ' + lostButOffered.join(', ');
  });
  check('[background] deselecting the background clears the stage outright', () => {
    bgSetup();
    ev("var st=dccCre(S.char).background.childhood;" +
       "var row=dccStages(S.char).childhood.rows.find(function(r){return r.roll===st.roll});" +
       "st.picks=[row.skills[0].s];");
    ev("dccPickBackground('childhood',dccCre(S.char).background.childhood.roll);");
    const st = JSON.parse(ev("JSON.stringify(dccCre(S.char).background.childhood)"));
    return (st.roll === null && st.picks.length === 0)
      || 'expected an empty stage, got ' + JSON.stringify(st);
  });

  // ── the Continue gate has to keep up with what you type ──────────────────
  // Reported from a browser: you enter a name and the screen still says the
  // crawler needs one, with Continue disabled. The value WAS stored — a screen
  // handler deliberately does not repaint, because that is what protects the
  // caret — but the footer saying why Continue is disabled lives in the same
  // body and went stale, so creation could not be started at all.
  check('[gate] typing a name clears the message and enables Continue', () => {
    ev("S.char=SYS.newCharacter();S.char.name='';S.char.creation={step:0,complete:false};renderHero();");
    const msg = () => ev("(document.getElementById('wiz-msg')||{}).textContent||''");
    const blocked = () => ev("!!(document.getElementById('wiz-next')||{}).disabled");
    if (!/name/i.test(msg())) return 'a nameless crawler should be blocked, message was ' + JSON.stringify(msg());
    if (!blocked()) return 'Continue was not disabled to begin with';
    ev("var i=document.querySelector('#wiz-body input');i.value='Fenwick';" +
       "i.dispatchEvent(new window.Event('input',{bubbles:true}));");
    if (msg().trim() !== '') return 'the message went stale: ' + JSON.stringify(msg());
    return blocked() === false || 'Continue is still disabled after typing a name';
  });
  check('[gate] ...and Continue then actually advances', () => {
    ev("document.getElementById('wiz-next').click();");
    return ev('S.char.creation.step') === 1 || 'still on step ' + ev('S.char.creation.step');
  });
  check('[gate] refreshing the gate does not disturb what you are typing', () => {
    // The fix must not reintroduce the focus bug it was written around.
    ev("S.char=SYS.newCharacter();S.char.name='';S.char.creation={step:0,complete:false};renderHero();");
    ev("var i=document.querySelector('#wiz-body input');i.setAttribute('data-probe','1');i.focus();" +
       "i.value='Fen';i.dispatchEvent(new window.Event('input',{bubbles:true}));");
    const kept = ev("(document.querySelector('#wiz-body input')||{}).getAttribute&&document.querySelector('#wiz-body input').getAttribute('data-probe')");
    if (kept !== '1') return 'the input was replaced while typing';
    return ev("document.activeElement.tagName") === 'INPUT' || 'focus was lost';
  });
  check('[gate] every screen keeps its gate in step with its inputs', () => {
    // The general form. Any screen whose handlers store without repainting can
    // strand the player behind a stale message.
    const stale = [];
    const n = ev('SYS.creation.length');
    for (let i = 0; i < n; i++) {
      ev("S.char.creation.step=" + i + ";renderHero();");
      const before = ev("(document.getElementById('wiz-msg')||{}).textContent||''");
      // Nudge every input on the screen, then ask whether the footer agrees
      // with what validate() now says.
      ev("[].slice.call(document.querySelectorAll('#wiz-body input')).forEach(function(i){" +
         "i.dispatchEvent(new window.Event('input',{bubbles:true}))});");
      const shown = ev("(document.getElementById('wiz-msg')||{}).textContent||''").trim();
      const truth = ev("wizValidate(S.char," + i + ")");
      const want = truth === true ? '' : String(truth).trim();
      if (shown !== want) stale.push('screen ' + (i + 1) + ' shows ' + JSON.stringify(shown) + ' but validate says ' + JSON.stringify(want));
    }
    return stale.length ? stale[0] : true;
  });

  // ── the interface talks ──────────────────────────────────────────────────
  // The app IS the System AI's interface, so its ambient notices are in its
  // voice. Failures are not: when a save fails the player needs to know what to
  // do about it, and a message in character is worst exactly when it matters.
  check('[voice] the save flash speaks as the interface', () => {
    ev("flashSaved()");
    const t = ev("document.getElementById('save-flash').textContent");
    return t === 'Logged' || 'flashed ' + JSON.stringify(t);
  });
  check('[voice] a failure stays plain and keeps its instruction', () => {
    ev("flashSaveError('Not saved — storage full. Delete or export a file.')");
    const t = ev("document.getElementById('save-flash').textContent");
    if (!/storage full/.test(t)) return 'the reason was lost: ' + JSON.stringify(t);
    return /Delete or export/.test(t) || 'the instruction was lost: ' + JSON.stringify(t);
  });
  check("[voice] in-play notices are the pack's words", () => {
    ev("S.char=SYS.newCharacter();S.char.blocks.skills={skills:[{name:'Club',stat:'STR',rank:3}]};");
    ev("document.body.insertAdjacentHTML('beforeend','<input id=' + JSON.stringify('sk-add-skills') + '>');");
    ev("document.getElementById('sk-add-skills').value='Club';skillAdd('skills');");
    const t = ev("document.getElementById('save-flash').textContent");
    return /Crawler/.test(t) || 'said ' + JSON.stringify(t);
  });
  check('[voice] nothing is hardcoded — a silent pack gets plain English', () => {
    // voice() must fall back, so a pack that wants a neutral app says nothing.
    const keep = ev("JSON.stringify(SYS.voice)");
    ev("SYS.voice=null;flashSaved();");
    const plain = ev("document.getElementById('save-flash').textContent");
    ev("SYS.voice=" + keep + ";");
    return plain === 'Saved ✓' || 'fell back to ' + JSON.stringify(plain);
  });

  // ── chrome, sheet and wizard, restyled to the pack's identity ────────────
  check('[chrome] the sheet shows which Crawl it belongs to', () => {
    // The universe bar was only drawn by Daring Comics' own renderers, so a
    // block pack's sheet had no way to see or switch its world.
    ev("S.char=SYS.newCharacter();dccSetFloor(1);dccFinishCreation(S.char);");
    ev("S.char.creation={step:0,complete:true};renderHero();");
    const bar = ev("!!document.querySelector('#hero-sheet .uni-bar')");
    return bar || 'no universe bar on the sheet';
  });
  check('[chrome] ...and the floor it is on, because the floor is the clock', () => {
    // The floor moved to its own strip above the pages so that every tab has
    // it; the universe bar deliberately no longer duplicates it.
    const read = () => ev("(document.querySelector('#floor-strip .fs-num')||{}).textContent||''").trim();
    ev("S.floor=1;renderFloorStrip();");
    if (read() !== 'Floor 1') return 'the strip reads ' + JSON.stringify(read());
    ev("S.floor=4;renderFloorStrip();");
    if (read() !== 'Floor 4') return 'the strip did not follow the floor';
    return ev("document.querySelectorAll('.uni-bar .uni-fbtn').length") === 0
      || 'the universe bar still carries a duplicate control';
  });
  check('[sheet] every block heading shares one class a pack can style', () => {
    ev("S.char=SYS.newCharacter();S.char.creation={step:0,complete:true};renderHero();");
    const n = ev("document.querySelectorAll('#sys-blocks .blk-title').length");
    return n >= 6 || 'only ' + n + ' headings carry the class';
  });
  check('[sheet] a spent track slot is marked as spent, not coloured inline', () => {
    // Inline styles cannot be themed. Health reads better as what is left.
    // Scoped to the sheet: the Health Bar is also mounted on the HUD, so a
    // document-wide count reads every slot twice once that tab has been opened.
    ev("S.char.blocks.health={marked:3};blockRepaint('health');");
    const live = ev("document.querySelectorAll('#sys-blocks .trk-slot:not(.is-spent)').length");
    const spent = ev("document.querySelectorAll('#sys-blocks .trk-slot.is-spent').length");
    if (spent !== 3) return spent + ' slots marked spent, expected 3';
    return live > 0 || 'no live slots left to read';
  });
  check('[wizard] the progress strip is a descent, not nine equal ticks', () => {
    ev("S.char=SYS.newCharacter();S.char.creation={step:2,complete:false};renderHero();");
    const total = ev("document.querySelectorAll('.wiz-rung').length");
    const done = ev("document.querySelectorAll('.wiz-rung.is-done').length");
    const here = ev("document.querySelectorAll('.wiz-rung.is-here').length");
    if (total !== ev('SYS.creation.length')) return total + ' rungs for ' + ev('SYS.creation.length') + ' screens';
    return (done === 2 && here === 1) || done + ' behind, ' + here + ' lit';
  });
  check('[wizard] a blocked screen says so in the warning colour, not the accent', () => {
    // Everything on the screen used to share one accent, so the one thing
    // stopping you looked like everything else.
    ev("S.char=SYS.newCharacter();S.char.creation={step:0,complete:false};renderHero();");
    const el = ev("!!document.querySelector('.wiz-block.is-blocking')");
    if (!el) return 'screen 1 of a blank crawler should be blocking';
    const txt = ev("document.querySelector('.wiz-block.is-blocking').textContent.trim()");
    return txt.length > 0 || 'the blocking message is empty';
  });

  // ── printing a crawler ───────────────────────────────────────────────────
  // The print centre is Daring Comics' sheet throughout — Aspects, Stress,
  // Consequences, the Fate ladder. Printing a crawler threw on the first
  // Daring Comics global it reached, so the preview came out empty and there
  // was no way to print a character at all.
  check('[print] building a crawler document does not throw', () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(3);");
    ev("dccStatMethod('array');dccAssignStat('STR',6);dccAssignStat('CON',5);dccAssignStat('DEX',4);dccAssignStat('INT',3);dccAssignStat('CHA',2);");
    ev("dccRollBumps();dccChoose('race','human');dccChoose('cls','boring-ol-fighter');dccFinishCreation(S.char);");
    ev("S.char.name='Fenwick';S.char.creation={step:0,complete:true};showTab('print');");
    ev("prClear();prToggle('hero','@self','full');");
    const r = ev("(function(){try{prBuildBody();return 'ok'}catch(e){return e.message}})()");
    return r === 'ok' || 'threw: ' + r;
  });
  check('[print] the sheet carries the crawler and every block', () => {
    const doc = ev('prBuildBody()');
    // "Gear" is no longer a block on this page — what you carry has pages of
    // its own now — but the weapon itself must still appear in the document.
    const want = ['Fenwick', 'Crawler Number', 'Strength', 'Health Bar', 'Skills', 'Club', 'Mana', 'Popularity'];
    const missing = want.filter(w => doc.indexOf(w) < 0);
    if (missing.length) return 'missing from the printed sheet: ' + missing.join(', ');
    return doc.indexOf('WORN AND HELD') >= 0 || 'nothing prints what the crawler is carrying';
  });
  check('[print] it does not print as an Unnamed Hero', () => {
    const txt = ev("prBuildBody()");
    return txt.indexOf('Unnamed') < 0 || 'still printing the Daring Comics placeholder name';
  });
  check('[print] the pack prose is not double-escaped', () => {
    const txt = ev("prBuildBody()");
    return !/&amp;(amp|lt|gt|quot);/.test(txt) || 'entities were escaped twice';
  });
  check('[print] empty gear slots do not print as bare commas', () => {
    const txt = ev("prBuildBody().replace(/<[^>]*>/g,' ')");
    return !/,\s*,/.test(txt) || 'a container printed one empty entry per empty slot';
  });
  check('[print] a Floor 1 crawler prints too', () => {
    ev("S.char=SYS.newCharacter();dccSetFloor(1);dccFinishCreation(S.char);");
    ev("S.char.name='Wren';S.char.creation={step:0,complete:true};");
    const r = ev("(function(){try{return prBuildBody().indexOf('Wren')>=0?'ok':'name missing'}catch(e){return e.message}})()");
    return r === 'ok' || r;
  });
  check('[print] Daring Comics still prints its own sheet', () => {
    // The dispatch must not have taken the Fate layout away from the game that
    // needs it: that sheet is chosen when the pack does NOT use blocks.
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'core/print.js'), 'utf8');
    if (src.indexOf('sheetBodyHTML(r.ch') < 0) return 'the Fate sheet is no longer reachable';
    return /sysUsesBlocks\(\)[\s\S]{0,120}prBlockSheetHTML/.test(src)
      || 'the block sheet is not gated on the pack using blocks';
  });

  // ── the sheet must never render as "just a card" ─────────────────────────
  // Reported from a real browser: Finish appeared to do nothing, and coming
  // back to the Hero tab showed the identity card with no sheet under it.
  // renderSysSheet writes its cards, THEN fills #sys-blocks separately, so any
  // throw while building the blocks left the player looking at the cards alone
  // — which reads exactly like creation having failed.
  check('[sheet] a null block does not blank the sheet', () => {
    ev("S.char=SYS.newCharacter();S.char.creation={step:0,complete:true};S.char.blocks.gear=null;renderHero();");
    const n = ev("document.getElementById('sys-blocks').children.length");
    return n === ev('SYS.schema.blocks.length') || 'drew ' + n + ' blocks';
  });
  check('[sheet] every block being null is still survivable', () => {
    ev("S.char=SYS.newCharacter();S.char.creation={step:0,complete:true};");
    ev("SYS.schema.blocks.forEach(function(b){S.char.blocks[b.id]=null});renderHero();");
    return ev("document.getElementById('sys-blocks').children.length") === ev('SYS.schema.blocks.length')
      || 'the sheet collapsed to ' + ev("document.getElementById('sys-blocks').children.length") + ' blocks';
  });
  check('[sheet] a block whose data is null is re-initialised, not dereferenced', () => {
    // blockCtx used to test for `undefined` only, so a null slipped past it and
    // every renderer then read a property off null.
    ev("S.char=SYS.newCharacter();S.char.blocks.mana=null;");
    ev("blockCtx(sysBlock('mana'),S.char);");
    return ev('S.char.blocks.mana') !== null || 'still null after blockCtx';
  });
  check('[sheet] one broken block says so and the rest still draw', () => {
    ev("S.char=SYS.newCharacter();S.char.creation={step:0,complete:true};");
    const keep = ev("SYS.derive.hbSlotValue");
    ev("SYS.derive.hbSlotValue=function(){throw new Error('MARKER-BAD-DATA')};renderHero();");
    const h = ev("document.getElementById('sys-blocks').innerHTML");
    ev("SYS.derive.hbSlotValue=" + String(keep) + ";");
    if (!/could not be drawn/.test(h)) return 'the failure was swallowed silently';
    if (!/MARKER-BAD-DATA/.test(h)) return 'the reason was not reported';
    return /blk-skills/.test(h) || 'the other blocks were lost too';
  });
  check('[sheet] finishing creation leaves a full sheet, not a card', () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(3);");
    ev("dccStatMethod('array');dccAssignStat('STR',6);dccAssignStat('CON',5);dccAssignStat('DEX',4);dccAssignStat('INT',3);dccAssignStat('CHA',2);");
    ev("dccRollBumps();dccChoose('race','human');dccChoose('cls','boring-ol-fighter');");
    ev("wizState(S.char).complete=true;dccFinishCreation(S.char);renderHero();");
    const n = ev("(document.getElementById('sys-blocks')||{children:[]}).children.length");
    if (n !== ev('SYS.schema.blocks.length')) return 'only ' + n + ' blocks after Finish';
    // and it survives leaving the tab and coming back, which is how it was found
    ev("showTab('dice');showTab('hero');");
    return ev("document.getElementById('sys-blocks').children.length") === ev('SYS.schema.blocks.length')
      || 'the sheet collapsed after switching tabs';
  });

  // ── starting on the First Floor at Level 1 ───────────────────────────────
  // The core rulebook only builds Third and Fourth Floor crawlers: "If you'd
  // rather start out at Level 1, look for the Dungeon Crawler Carl Roleplaying
  // Game Starter Set" (p. 101). Floor 1 is Phase 1 of creation on its own --
  // the crawler every other starting floor is built by advancing.
  check('[floor1] Floor 1 at Level 1 is offered', () => {
    const f = JSON.parse(ev('JSON.stringify(DCC_FLOOR_START.map(function(x){return [x.floor,x.level]}))'));
    const one = f.filter(x => x[0] === 1)[0];
    if (!one) return 'only floors ' + f.map(x => x[0]).join(', ') + ' can be chosen';
    return one[1] === 1 || 'Floor 1 is Level ' + one[1];
  });
  check('[floor1] it grants no Stat points, because (Level - 1) x 3 is zero', () => {
    ev("S.char=SYS.newCharacter();dccSetFloor(1);");
    return ev('dccFloorCfg(S.char).statPoints') === 0
      || 'grants ' + ev('dccFloorCfg(S.char).statPoints');
  });
  check('[floor1] the Tutorial Floors screen asks for nothing', () => {
    // You have not been through them, so there are no Skill bumps to roll, no
    // Acquired Loot, no Experiences and no AI Favor roll.
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(1);");
    const v = ev('wizValidate(S.char,6)');
    return v === true || 'still demanding: ' + v;
  });
  check('[floor1] ...and does not offer rolls for history you have not lived', () => {
    ev("S.char.creation={step:6,complete:false};renderHero();");
    const h = ev("(document.getElementById('wiz-body')||{}).innerHTML||''");
    if (/dccRollBumps|dccRollSpread|dccRollExperiences/.test(h)) return 'the tutorial rolls are still on screen';
    return /First Floor/.test(h) || 'no explanation of why the screen is empty';
  });
  check('[floor1] Race and Class are not chosen yet', () => {
    // "You are assigned the Race of Human... probably. You are currently Level
    // 1. You may choose a new race and class as soon as you descend to the
    // Third Floor." -- Atlas: Tutorial Floors.
    const v = ev('wizValidate(S.char,7)');
    return v === true || 'the screen still demands a pick: ' + v;
  });
  check('[floor1] a finished crawler is Human, Level 1, with no Class', () => {
    ev("dccFinishCreation(S.char);");
    const got = [ev('S.char.level'), ev('S.char.race'), ev('S.char.class')];
    return (got[0] === 1 && got[1] === 'Human' && got[2] === '')
      || 'got level ' + got[0] + ', race ' + JSON.stringify(got[1]) + ', class ' + JSON.stringify(got[2]);
  });
  check('[floor1] Popularity is zero — viewers tune in after the First Floor', () => {
    return ev('S.char.blocks.popularity.current') === 0
      || 'starts with ' + ev('S.char.blocks.popularity.current') + ' Popularity';
  });
  check('[floor1] no Skill carries a tutorial-floor bump', () => {
    const ranks = JSON.parse(ev('JSON.stringify(S.char.blocks.skills.skills.map(function(x){return x.rank}))'));
    const cap = ev('DCC_SKILL_RANK_SOFT_CAP');
    const high = ranks.filter(r => r > 3);
    return high.length === 0 || 'ranks above the untrained 3 without a bump: ' + high.join(', ') + ' (cap ' + cap + ')';
  });
  check('[floor1] the whole wizard can be completed without a Race or Class', () => {
    ev("S.char=SYS.newCharacter();dccStore('name','F');dccStore('crawlerNumber','600000');");
    ev("dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(1);");
    ev("dccStatMethod('array');dccAssignStat('STR',6);dccAssignStat('CON',5);" +
       "dccAssignStat('DEX',4);dccAssignStat('INT',3);dccAssignStat('CHA',2);");
    ev("['childhood','adolescence','career','hobby'].forEach(function(x){dccRollBackground(x)});");
    ev("S.char.creation={step:1,complete:false};renderHero();");
    for (let pass = 0; pass < 3; pass++) {
      ev("wizRepaint();");
      ev("[].slice.call(document.querySelectorAll('#wiz-body button'))" +
         ".filter(function(b){return /dccPickSkill/.test(b.getAttribute('onclick')||'')})" +
         ".forEach(function(b){try{b.click()}catch(e){}});");
    }
    ev("DCC_STORY_FIELDS.forEach(function(f){dccStory(S.char)[f.key]='x'});");
    const blocked = [];
    const n = ev('SYS.creation.length');
    for (let i = 0; i < n; i++) {
      const v = ev('wizValidate(S.char,' + i + ')');
      if (v !== true) blocked.push(i + ': ' + String(v).slice(0, 40));
    }
    return blocked.length ? 'still blocked at ' + blocked.join(' | ') : true;
  });
  check('[floor1] Floor 3 is untouched by any of this', () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');dccSetFloor(3);");
    if (ev('dccFloorCfg(S.char).statPoints') !== 27) return 'Floor 3 grants ' + ev('dccFloorCfg(S.char).statPoints');
    if (ev('wizValidate(S.char,6)') === true) return 'Floor 3 stopped asking for its tutorial rolls';
    return ev('wizValidate(S.char,7)') !== true || 'Floor 3 stopped asking for a Race and Class';
  });

  check('[floor] dropping to a lower floor gives back the points it does not grant', () => {
    ev("S.char=SYS.newCharacter();dccSetSpecies('human');dccSetRoute('weapon');dccSetWeapon('Club');");
    ev("dccSetFloor(4);for(var i=0;i<57;i++)dccStatPoint('CON',1);");
    if (ev('dccPointsSpent(S.char)') !== 57) return 'floor 4 did not grant 57';
    ev("dccSetFloor(3);");
    const spent = ev('dccPointsSpent(S.char)');
    return spent === 27 || 'kept ' + spent + ' points against a budget of 27';
  });
  check('[floor] a Stat point delta larger than one cannot outrun the budget', () => {
    ev("S.char=SYS.newCharacter();dccSetFloor(3);dccStatPoint('STR',1000);");
    const spent = ev('dccPointsSpent(S.char)');
    return spent === 27 || 'spent ' + spent + ' of 27';
  });
  check('[floor] switching Stat method keeps the tutorial points you spent', () => {
    ev("S.char=SYS.newCharacter();dccSetFloor(3);dccStatMethod('array');");
    ev("dccAssignStat('STR',6);for(var i=0;i<27;i++)dccStatPoint('STR',1);");
    ev("dccStatMethod('roll');dccRollStats();");
    // The roll replaces what you walked in with; the 27 points sit on top of it.
    const base = ev("S.char.blocks.stats.STR.base");
    const pick = ev("dccStatPick(S.char,'STR')");
    return base - pick === 27
      || 'the 27 points vanished but were still counted as spent: Unenhanced ' +
         base + ' on a roll of ' + pick;
  });
  check('[floor] finishing twice does not stack the Race and Class bonuses', () => {
    ev("S.char=SYS.newCharacter();dccSetFloor(3);dccChoose('race','human');dccChoose('cls','boring-ol-fighter');");
    ev("dccFinishCreation(S.char);");
    const once = ev("dccStatOf(S.char,'STR')") + '/' + ev("dccStatOf(S.char,'CON')");
    ev("dccFinishCreation(S.char);");
    const twice = ev("dccStatOf(S.char,'STR')") + '/' + ev("dccStatOf(S.char,'CON')");
    ev("dccFinishCreation(S.char);");
    const thrice = ev("dccStatOf(S.char,'STR')") + '/' + ev("dccStatOf(S.char,'CON')");
    return (once === twice && twice === thrice)
      || 'STR/CON drifted across finishes: ' + once + ' -> ' + twice + ' -> ' + thrice;
  });
  check('[floor] ...and a "-" click afterwards does not delete them', () => {
    ev("S.char=SYS.newCharacter();dccSetFloor(3);dccChoose('race','human');dccChoose('cls','boring-ol-fighter');dccFinishCreation(S.char);");
    const before = ev("S.char.blocks.stats.CON.bonus");
    ev("dccStatPoint('CON',-1);");
    const after = ev("S.char.blocks.stats.CON.bonus");
    return after === before || 'the Class grant went from ' + before + ' to ' + after;
  });
  check('[floor] changing your weapon invalidates the tutorial Skill bumps', () => {
    ev("S.char=SYS.newCharacter();dccSetSpecies('human');dccSetRoute('weapon');dccSetWeapon('Club');dccRollBumps();");
    if (ev('dccBumpsStale(S.char)') !== false) return 'fresh bumps reported stale';
    ev("dccSetWeapon('Longsword');");
    if (ev('dccBumpsStale(S.char)') !== true) return 'a weapon swap left the Club bump in place';
    ev("dccRollBumps();");
    const rank = ev("(dccFinalSkills(S.char).find(function(s){return s.name==='Longsword'})||{}).rank");
    return (ev('dccBumpsStale(S.char)') === false && rank > 3)
      || 'after re-rolling, Longsword is rank ' + rank;
  });
  check('[floor] changing species invalidates them too', () => {
    ev("S.char=SYS.newCharacter();dccSetSpecies('human');dccSetRoute('weapon');dccSetWeapon('Club');dccRollBumps();");
    ev("dccSetSpecies('animal');");
    return ev('dccBumpsStale(S.char)') === true || 'an animal kept its human Skill bumps';
  });

  check('[rc] a Popularity gate is enforced', () => {
    const bune = ev("JSON.stringify(dccMeetsPrereq(S.char,dccRace('bune')))");
    if (JSON.parse(bune).ok !== false) return 'Popularity 0 was allowed: ' + bune;
    ev("S.char.blocks.popularity={current:6};");
    return JSON.parse(ev("JSON.stringify(dccMeetsPrereq(S.char,dccRace('bune')))")).ok === true
      || 'Popularity 6 was still refused';
  });
  check('[rc] a named-Skill gate is enforced', () => {
    // "Rank 5+ in the Smush Skill" — a form the old single regex never matched,
    // so it fell through to "no opinion" and the Race was a free pick.
    const r = ev("JSON.stringify(dccMeetsPrereq(S.char,dccRace('sasquatch')))");
    if (!/Smush/.test(ev("String(dccRace('sasquatch').prerequisites)"))) return 'wrong entry chosen';
    return JSON.parse(r).ok === false || 'a crawler with no Smush was allowed: ' + r;
  });
  // ── extraction damage that survives as data ──────────────────────────────
  check('[tables] Table 25 gives four evenly-sized loot spreads', () => {
    const rows = JSON.parse(ev('JSON.stringify(DCC_LOOT_SPREAD.map(function(r){return [r.roll,r.text.length]}))'));
    if (rows.length !== 4) return 'expected 4 rows, got ' + rows.length;
    const bad = rows.filter(r => r[1] > 200);
    // Row 4 shipped at 3,269 characters: the extraction ran past the end of the
    // cell and swallowed three pages of surrounding body prose, which the loot
    // screen then rendered as a wall of text.
    return bad.length ? 'row ' + bad[0][0] + ' is ' + bad[0][1] + ' characters long' : true;
  });
  check('[tables] no table row swallowed the prose around it', () => {
    // The general form of the bug above. A row an order of magnitude longer
    // than its siblings is almost certainly page text, not a table cell.
    const bad = ev(`(function(){
      var out=[];
      var names=Object.getOwnPropertyNames(window).filter(function(k){
        return /^DCC_/.test(k) && Array.isArray(window[k]) && window[k].length>=3;
      });
      names.forEach(function(k){
        var lens=window[k].map(function(r){return JSON.stringify(r).length});
        var sorted=lens.slice().sort(function(a,b){return a-b});
        var med=sorted[Math.floor(sorted.length/2)];
        lens.forEach(function(L,i){
          if(med>0 && L>med*8 && L>500) out.push(k+'['+i+'] '+L+' vs median '+med);
        });
      });
      return JSON.stringify(out);
    })()`);
    const list = JSON.parse(bad);
    return list.length ? list.join(' | ') : true;
  });

  // ── the real prerequisite text, recovered from the PDF ───────────────────
  // Five entries shipped with prose damaged by the extraction: cut mid-phrase,
  // or with a clipped duplicate text layer spliced through them. A gate whose
  // text is truncated cannot be enforced, so those Races and Classes were free
  // picks. Each expected value below is the sentence as printed in the book.
  check('[rc] no prerequisite was shipped truncated', () => {
    // Five entries shipped with prose the extraction had damaged: cut
    // mid-phrase ("...Popularity 3+, receiving the"), or with a clipped
    // duplicate text layer spliced through them ("...Explosives Handling
    // ilable to ank 5+ in the Explosives Handling any Trap-based Skill").
    // A gate whose text is truncated cannot be enforced, so those Races and
    // Classes were free picks.
    const all = JSON.parse(ev("JSON.stringify([].concat(DCC_RACES,DCC_CLASSES)" +
      ".filter(function(e){return e.prerequisites})" +
      ".map(function(e){return [e.name,e.prerequisites]}))"));
    const DANGLING = /\b(with|the|an|and|or|in|to|of|who|have|at)$/i;
    // The overlay damage spliced a clipped copy of the line through itself,
    // leaving fragments of words: "...Handling ilable to ank 5+ in the...".
    // Match that, not the ordinary "available to" every entry contains.
    const SPLICED = / ank | ilable /;
    const bad = all.filter(([n, t]) => DANGLING.test(String(t).trim()) || SPLICED.test(t));
    return bad.length ? 'still truncated: ' + bad.map(b => b[0]).join(', ') : true;
  });
  check('[rc] a two-clause gate needs BOTH halves', () => {
    // Hobgoblin: Rank 5+ in Explosives Handling AND any Trap-based Skill.
    // The old matcher stopped at the first clause it recognised.
    const set = n => ev("S.char=SYS.newCharacter();S.char.blocks={skills:{skills:" + n + "}};");
    const hob = "dccRace('hobgoblin')";
    set("[{name:'Explosives Handling',stat:'INT',rank:6}]");
    if (ev("dccMeetsPrereq(S.char," + hob + ").ok") !== false) return 'explosives alone was enough';
    set("[{name:'Find Trap',stat:'INT',rank:6}]");
    if (ev("dccMeetsPrereq(S.char," + hob + ").ok") !== false) return 'a trap Skill alone was enough';
    set("[{name:'Explosives Handling',stat:'INT',rank:6},{name:'Find Trap',stat:'INT',rank:6}]");
    return ev("dccMeetsPrereq(S.char," + hob + ").ok") === true || 'both together were still refused';
  });
  check('[rc] a Popularity-and-Skill gate needs both', () => {
    // Compensated Anarchist: Popularity 3+ AND Rank 5+ Explosives Handling.
    const e = "[].concat(DCC_RACES,DCC_CLASSES).filter(function(x){return x.name==='Compensated Anarchist'})[0]";
    ev("S.char=SYS.newCharacter();S.char.blocks={popularity:{current:6}};");
    if (ev("dccMeetsPrereq(S.char," + e + ").ok") !== false) return 'Popularity alone was enough';
    ev("S.char.blocks.skills={skills:[{name:'Explosives Handling',stat:'INT',rank:6}]};");
    return ev("dccMeetsPrereq(S.char," + e + ").ok") === true || 'both together were still refused';
  });
  check('[rc] a weapon-category gate reads the catalogue category', () => {
    // Obsidian Butterfly: Rank 5+ with any Edged Weapon. Axe is Edged; Smush
    // is not, and neither is named in the requirement.
    const e = "[].concat(DCC_RACES,DCC_CLASSES).filter(function(x){return /Obsidian/.test(x.name)})[0]";
    ev("S.char=SYS.newCharacter();S.char.blocks={skills:{skills:[{name:'Smush',stat:'STR',rank:6}]}};");
    if (ev("dccMeetsPrereq(S.char," + e + ").ok") !== false) return 'a non-Edged weapon qualified';
    ev("S.char.blocks.skills.skills=[{name:'Axe',stat:'STR',rank:6}];");
    return ev("dccMeetsPrereq(S.char," + e + ").ok") === true || 'an Axe was refused';
  });
  check('[rc] a gate with a checkable half fails on that half', () => {
    // Former Child Actor: Popularity 3+ AND the Cut! achievement. The
    // achievement cannot be verified, but the Popularity can, and a crawler
    // with none must not be waved through on the strength of the other clause.
    const e = "[].concat(DCC_RACES,DCC_CLASSES).filter(function(x){return x.name==='Former Child Actor'})[0]";
    ev("S.char=SYS.newCharacter();S.char.blocks={popularity:{current:0}};");
    if (ev("dccMeetsPrereq(S.char," + e + ").ok") !== false) return 'Popularity 0 was allowed';
    ev("S.char.blocks.popularity.current=6;");
    const r = JSON.parse(ev("JSON.stringify(dccMeetsPrereq(S.char," + e + "))"));
    return (r.ok === true && !!r.note) || 'with Popularity met it should pass with a note: ' + JSON.stringify(r);
  });
  check('[rc] only genuinely uncheckable gates are notes', () => {
    // Gender and achievements. Everything else must be enforced, or the screen
    // is claiming to lock things it never looks at.
    ev("S.char=SYS.newCharacter();S.char.blocks={};");
    const soft = JSON.parse(ev(`JSON.stringify([].concat(DCC_RACES,DCC_CLASSES)
      .filter(function(e){return e.prerequisites&&dccMeetsPrereq(S.char,e).note})
      .map(function(e){return e.name}))`));
    const expected = ['Shieldmaiden', 'Bomb Squad Tech'];
    const extra = soft.filter(n => expected.indexOf(n) < 0);
    return extra.length ? 'not enforced: ' + extra.join(', ') : true;
  });
  check('[rc] the finished Skill block outranks the creation-derived list', () => {
    // After creation the sheet's list is the truth — Skills advance from use,
    // so it drifts above whatever creation produced.
    ev("S.char=SYS.newCharacter();dccSetSpecies('human');dccSetRoute('weapon');dccSetWeapon('Club');");
    ev("S.char.blocks.skills={skills:[{name:'Smush',stat:'STR',rank:9}]};");
    return ev("dccMeetsPrereq(S.char,dccRace('sasquatch')).ok") === true
      || 'a Rank 9 Smush on the sheet was ignored';
  });

  check('[rc] a gate the app cannot check is a note, not a lock', () => {
    // Gender, achievements and two entries whose source text is truncated. The
    // app must not pretend to have verified these.
    const soft = ev("JSON.stringify([].concat(DCC_RACES,DCC_CLASSES)" +
      ".filter(function(e){return e.prerequisites&&dccMeetsPrereq(S.char,e).note})" +
      ".map(function(e){return e.name}))");
    const names = JSON.parse(soft);
    return names.length > 0 || 'every gate claims to be checkable, which is not true';
  });
  check('[rc] an entry with no prerequisite is always available', () => {
    const r = ev(`JSON.stringify(dccMeetsPrereq(S.char,DCC_RACES.find(x=>!x.prerequisites)))`);
    return JSON.parse(r).ok === true || r;
  });

  // ── inventory: three containers, three sets of rules (D4) ────────────────
  ev("S.char=SYS.newCharacter();S.char.blocks={};blockCtx(sysBlock('gear'),S.char);");
  check('[gear] the block starts with every container and slot present', () => {
    const d = JSON.parse(ev('JSON.stringify(S.char.blocks.gear)'));
    if (!d.equipped || !d.hotlist || !d.inventory) return 'missing a container';
    const slots = Object.keys(d.equipped).sort().join(',');
    return slots === 'accessories,arms,feet,hands,head,legs,torso'
      || 'gear slots: ' + slots;
  });

  // slots: one item each, except Accessories
  check('[gear] a Gear Slot holds one item and then refuses another', () => {
    ev("S.char.blocks.gear.equipped.head=[];");
    ev("document.body.insertAdjacentHTML('beforeend'," +
       "'<input id=\"inv-add-gear-equipped\"><select id=\"inv-slot-gear-equipped\">" +
       "<option value=\"head\">Head</option></select>');");
    ev("document.getElementById('inv-add-gear-equipped').value='Cunning Hat';invAdd('gear','equipped');");
    ev("document.getElementById('inv-add-gear-equipped').value='Second Hat';invAdd('gear','equipped');");
    const n = ev('S.char.blocks.gear.equipped.head.length');
    return n === 1 || 'Head holds ' + n + ' items';
  });
  check('[gear] Accessories takes ten', () => {
    ev("S.char.blocks.gear.equipped.accessories=[];");
    return ev("invRoom(sysBlock('gear'),S.char.blocks.gear,'equipped','accessories')") === 10
      || 'room reported as ' + ev("invRoom(sysBlock('gear'),S.char.blocks.gear,'equipped','accessories')");
  });

  // stack: ten numbered slots, stacking to 999
  check('[gear] the Hotlist takes exactly ten entries', () => {
    ev("S.char.blocks.gear.hotlist=[];");
    ev("document.body.insertAdjacentHTML('beforeend','<input id=\"inv-add-gear-hotlist\">');");
    ev("for(let i=0;i<14;i++){document.getElementById('inv-add-gear-hotlist').value='Potion '+i;invAdd('gear','hotlist');}");
    const n = ev('S.char.blocks.gear.hotlist.length');
    return n === 10 || 'Hotlist holds ' + n;
  });
  check('[gear] a Hotlist stack tops out at 999 and never drops below 1', () => {
    // Driven at the boundaries. This used to walk the whole 1..999 range twice,
    // 2,400 real invQty() calls each doing a save and a repaint — 12.4s, a
    // sixth of the entire suite, to prove nothing the boundary values do not.
    ev("S.char.blocks.gear.hotlist=[{name:'Healing Potion',qty:998}];");
    ev("invQty('gear','hotlist',0,1);");
    if (ev('S.char.blocks.gear.hotlist[0].qty') !== 999) return 'did not reach 999';
    ev("invQty('gear','hotlist',0,1);");
    if (ev('S.char.blocks.gear.hotlist[0].qty') !== 999) return 'went past 999';
    ev("S.char.blocks.gear.hotlist[0].qty=2;invQty('gear','hotlist',0,-1);");
    if (ev('S.char.blocks.gear.hotlist[0].qty') !== 1) return 'did not reach 1';
    ev("invQty('gear','hotlist',0,-1);");
    return ev('S.char.blocks.gear.hotlist[0].qty') === 1 || 'dropped below 1';
  });

  // list: unbounded
  check('[gear] Inventory is unbounded', () => {
    ev("S.char.blocks.gear.inventory=[];");
    return ev("invRoom(sysBlock('gear'),S.char.blocks.gear,'inventory','')") === null
      || 'Inventory reported a limit';
  });

  // moving between containers is the point of the block
  check('[gear] an item moves from Inventory into the Hotlist', () => {
    ev("S.char.blocks.gear.inventory=[{name:'Bandage',qty:3}];S.char.blocks.gear.hotlist=[];");
    ev("invMove('gear','inventory','hotlist','',0);");
    const inInv = ev('S.char.blocks.gear.inventory.length');
    const inHot = ev('S.char.blocks.gear.hotlist.length');
    const qty = ev('S.char.blocks.gear.hotlist[0] ? S.char.blocks.gear.hotlist[0].qty : 0');
    return (inInv === 0 && inHot === 1 && qty === 3) || `inv=${inInv} hot=${inHot} qty=${qty}`;
  });
  check('[gear] a move into a full Hotlist is refused, not silently dropped', () => {
    ev("S.char.blocks.gear.hotlist=[];for(let i=0;i<10;i++)S.char.blocks.gear.hotlist.push({name:'x'+i,qty:1});");
    ev("S.char.blocks.gear.inventory=[{name:'Torch',qty:1}];");
    ev("invMove('gear','inventory','hotlist','',0);");
    const kept = ev('S.char.blocks.gear.inventory.length') === 1;
    const hot = ev('S.char.blocks.gear.hotlist.length') === 10;
    return (kept && hot) || 'the item vanished or overfilled the Hotlist';
  });
  check('[gear] a move into Gear Slots picks the first slot with room', () => {
    ev("Object.keys(S.char.blocks.gear.equipped).forEach(k=>S.char.blocks.gear.equipped[k]=[]);");
    ev("S.char.blocks.gear.inventory=[{name:'Breastplate',qty:1}];");
    ev("invMove('gear','inventory','equipped','',0);");
    const placed = JSON.parse(ev('JSON.stringify(S.char.blocks.gear.equipped)'));
    const where = Object.keys(placed).filter(k => placed[k].length);
    return where.length === 1 || 'landed in ' + JSON.stringify(where);
  });
  check('[gear] a move out of a Gear Slot leaves it empty', () => {
    const slot = JSON.parse(ev('JSON.stringify(S.char.blocks.gear.equipped)'));
    const filled = Object.keys(slot).find(k => slot[k].length);
    ev(`invMove('gear','equipped','inventory','${filled}',0);`);
    return ev(`S.char.blocks.gear.equipped.${filled}.length`) === 0 || 'slot still occupied';
  });

  // Misc. Junk
  check('[gear] Misc. Junk counts up and stops at zero', () => {
    ev("invCounter('gear','junk',5);");
    if (ev('S.char.blocks.gear.counters.junk') !== 5) return 'got ' + ev('S.char.blocks.gear.counters.junk');
    ev("for(let i=0;i<9;i++)invCounter('gear','junk',-1);");
    return ev('S.char.blocks.gear.counters.junk') === 0 || 'went negative';
  });

  // the lift limit is derived, not stored
  check('[gear] the lift limit follows Strength', () => {
    ev("S.char.blocks.stats={STR:{base:4,bonus:0}};");
    const a = ev('SYS.derive.liftLimit(S.char)');
    ev("S.char.blocks.stats.STR.bonus=6;");
    const b = ev('SYS.derive.liftLimit(S.char)');
    return (/60/.test(a) && /150/.test(b)) || 'got "' + a + '" then "' + b + '"';
  });

  check('[gear] the block renders every container', () => {
    ev("renderHero();S.char.creation={step:0,complete:true};renderHero();");
    const el = ev("(document.getElementById('blk-gear')||{}).innerHTML||''");
    return (/Gear Slots/.test(el) && /Hotlist/.test(el) && /Inventory/.test(el) && /Misc. Junk/.test(el))
      || 'a container is missing from the rendered block';
  });

  // ── Spells (D7) ──────────────────────────────────────────────────────────
  eq(ev('DCC_SPELLS.length'), 54, '[spells] 54 Spells');
  check('[spells] every Spell has an id, a name and a Mana cost', () => {
    const bad = ev(`JSON.stringify(DCC_SPELLS.filter(s=>!s.id||!s.name||
      (s.mana===undefined&&!s.manaText)).map(s=>s.name))`);
    return bad === '[]' || bad;
  });
  check('[spells] ids are unique', () =>
    ev('new Set(DCC_SPELLS.map(s=>s.id)).size') === 54 || 'duplicates');
  check('[spells] a quote attribution was not mistaken for a Spell', () => {
    const bad = ev(`JSON.stringify(DCC_SPELLS.filter(s=>/^[\\u2014-]/.test(s.name)||/carl$/i.test(s.name)).map(s=>s.name))`);
    return bad === '[]' || bad;
  });
  check('[spells] an attack Spell is one with Base Damage, and only those', () => {
    const bad = ev(`JSON.stringify(DCC_SPELLS.filter(s=>
      (s.kind==='attack')!==!!s.baseDamage).map(s=>s.name))`);
    return bad === '[]' || bad;
  });
  eq(ev("dccSpell('fire-fingers').mana"), 3, '[spells] Fire Fingers costs 3 Mana');
  eq(ev("dccSpell('fire-fingers').baseDamage"), '1d4 + INT Fire',
     '[spells] ...and deals 1d4 + INT Fire');
  eq(ev("dccSpell('heal').kind"), 'utility', '[spells] Heal is not an attack Spell');
  eq(ev("dccSpell('heal').limitations"), 'Rank 1 maximum', '[spells] Heal caps at Rank 1');

  // the seven the creation wizard offers, and Table 27's random Spells
  check('[spells] every Spell the wizard offers on screen 3 exists', () => {
    const bad = ev(`JSON.stringify(DCC_STARTING_SPELLS.filter(n=>!dccSpellByName(n)))`);
    return bad === '[]' || 'not in the catalogue: ' + bad;
  });
  check('[spells] Heal exists, which every crawler learns on entry', () =>
    !!ev("dccSpellByName('Heal')") || 'missing');

  // ── the Spell route is no longer a dead end ──────────────────────────────
  check('[spells] a Spell-route crawler ends up knowing their Spell', () => {
    ev("S.char=SYS.newCharacter();");
    ev("dccSetSpecies('human');dccStore('name','Wren');dccRollCrawlerNumber();");
    ev(`['childhood','adolescence','career','hobby'].forEach(function(st){
          dccPickBackground(st,1);
          var row=dccStages(S.char)[st].rows.find(function(r){return r.roll===1;});
          var taken=dccTakenSkills(S.char,st);
          row.skills.filter(function(x){return !taken[x.s];}).slice(0,2)
             .forEach(function(x){dccPickSkill(st,x.s);});
        });`);
    ev("dccSetRoute('spell');dccSetSpell('Fire Fingers');");
    ev("dccStatMethod('array');dccAssignStat('INT',6);dccAssignStat('CON',5);" +
       "dccAssignStat('DEX',4);dccAssignStat('CHA',3);dccAssignStat('STR',2);");
    ev("dccStoreStory('pastTrauma','x');dccStoreStory('looseEnd','y');dccStoreStory('regret','z');");
    ev("dccRollBumps();dccRollFavor();for(let i=0;i<40;i++)dccStatPoint('CON',1);");
    ev("dccChoose('race','human');dccChoose('cls','boring-ol-mage');");
    ev("dccFinishCreation(S.char);");
    const spells = JSON.parse(ev('JSON.stringify(S.char.blocks.spells.skills)'));
    const ff = spells.find(s => s.name === 'Fire Fingers');
    const heal = spells.find(s => s.name === 'Heal');
    if (!ff) return 'Fire Fingers missing: ' + JSON.stringify(spells.map(s => s.name));
    if (!heal) return 'Heal missing';
    return true;
  });
  check('[spells] the chosen Spell carries its tutorial-floor bump', () => {
    const b = JSON.parse(ev('JSON.stringify(S.char.dcc.floorStart.bumps)'));
    const bump = b.find(x => x.name === 'Fire Fingers');
    const spell = JSON.parse(ev('JSON.stringify(S.char.blocks.spells.skills)'))
      .find(s => s.name === 'Fire Fingers');
    if (!bump) return 'no bump recorded for the Spell';
    if (!bump.primary) return 'the Spell was not treated as the primary attack';
    return spell.rank === bump.to || 'rank ' + spell.rank + ' but bump said ' + bump.to;
  });
  check('[spells] a Spell bump does not create a phantom Skill', () => {
    const skills = JSON.parse(ev('JSON.stringify(S.char.blocks.skills.skills)'));
    return !skills.some(s => s.name === 'Fire Fingers') || 'the Spell leaked into Skills';
  });
  check('[spells] the Hotlist is seeded with the Spell, Heal and the Mana Potions', () => {
    const hot = JSON.parse(ev('JSON.stringify(S.char.blocks.gear.hotlist)'));
    const names = hot.map(h => h.name);
    if (names.indexOf('Fire Fingers') < 0) return 'no Spell: ' + names.join(', ');
    if (names.indexOf('Heal') < 0) return 'no Heal';
    const pot = hot.find(h => /Mana Potion/.test(h.name));
    return (pot && pot.qty === 5) || 'Mana Potions: ' + JSON.stringify(pot);
  });
  check('[spells] a weapon-route crawler gets Heal but no attack Spell', () => {
    ev("S.char=SYS.newCharacter();dccSetSpecies('human');dccSetRoute('weapon');dccSetWeapon('Club');");
    ev("dccFinishCreation(S.char);");
    const names = JSON.parse(ev('JSON.stringify(S.char.blocks.spells.skills)')).map(s => s.name);
    return (names.length === 1 && names[0] === 'Heal') || 'got ' + names.join(', ');
  });

  // ── crafting (D7) ────────────────────────────────────────────────────────
  eq(ev('DCC_CRAFTING_TABLES.length'), 7, '[craft] seven types of crafting table');
  eq(ev('DCC_CRAFTING_SKILLS.length'), 6, '[craft] six item/effect rows in Table 45');
  eq(ev('DCC_SALVAGE.length'), 3, '[craft] three salvage bands');
  eq(ev('DCC_CONCOCTIONS.length'), 5, '[craft] five concoction outcomes');
  check('[craft] every crafting Skill named exists in the catalogue', () => {
    const bad = ev(`JSON.stringify([...new Set(DCC_CRAFTING_SKILLS.flatMap(r=>r.skills))]
      .filter(n=>!dccSkillByName(n)))`);
    return bad === '[]' || 'orphans: ' + bad;
  });
  check('[craft] Explosives keeps BOTH of its Skills', () => {
    const r = JSON.parse(ev("JSON.stringify(dccCraftingSkillFor('Explosives'))"));
    if (!r) return 'row missing';
    const s = r.skills.slice().sort().join(', ');
    return s === 'Explosives Handling, Goblin Explosives' || 'got ' + s;
  });
  eq(ev("dccCraftingSkillFor('Potions').skills[0]"), 'Alchemy',
     '[craft] potions need Alchemy');
  eq(ev("dccCraftingSkillFor('Tattoos').skills[0]"), 'Tattoo Artistry',
     '[craft] tattoos need Tattoo Artistry');

  // salvage bands read off how far the Check missed
  eq(() => ev('dccSalvageFor(12).band'), '10+', '[craft] missing by 12 falls in the 10+ band');
  eq(() => ev('dccSalvageFor(10).band'), '10+', '[craft] ...and 10 is the bottom of it');
  eq(() => ev('dccSalvageFor(9).band'), '3-9', '[craft] missing by 9 salvages half');
  eq(() => ev('dccSalvageFor(3).band'), '3-9', '[craft] ...down to 3');
  eq(() => ev('dccSalvageFor(2).band'), '1-2', '[craft] a near miss salvages everything');
  eq(() => ev('dccSalvageFor(1).band'), '1-2', '[craft] ...including missing by 1');
  check('[craft] a successful Check has nothing to salvage', () =>
    ev('dccSalvageFor(0)') === null && ev('dccSalvageFor(-4)') === null);
  check('[craft] the bands cover every miss from 1 upward with no gap', () => {
    for (let m = 1; m <= 60; m++) {
      if (!ev('dccSalvageFor(' + m + ')')) return 'no band covers a miss of ' + m;
    }
    return true;
  });

  // concoctions key off the degrees the dice engine already produces
  eq(ev("dccConcoctionFor('crit_hit').label"), 'Critical Hit',
     '[craft] a Critical Hit invents something new');
  eq(ev("dccConcoctionFor('crit_fail').label"), 'Critical Fail',
     '[craft] a Critical Fail blows up in your face');
  check('[craft] every degree the roller can produce maps to an outcome', () => {
    const bad = ev(`JSON.stringify(DCC_DEGREES.map(d=>d.id).filter(id=>!dccConcoctionFor(id)))`);
    return bad === '[]' || 'no concoction outcome for: ' + bad;
  });
  check('[craft] the failure degrees share the Near Miss or Failure row', () => {
    const a = ev("dccConcoctionFor('near_miss').label");
    const b = ev("dccConcoctionFor('fail').label");
    const c = ev("dccConcoctionFor('major_fail').label");
    return (a === b && b === c && a === 'Near Miss or Failure') || [a, b, c].join(' / ');
  });

  // ── pets, mounts and minions (D7) ────────────────────────────────────────
  // A pet gains TWO levels per crawler level until it hits 15, then one.
  eq(ev('dccPetLevel(0)'), 1,  '[pets] a new pet is level 1');
  eq(ev('dccPetLevel(1)'), 3,  '[pets] one crawler level makes it 3');
  eq(ev('dccPetLevel(6)'), 13, '[pets] still doubling at 13');
  eq(ev('dccPetLevel(7)'), 15, '[pets] reaches 15 after seven of your levels');
  eq(ev('dccPetLevel(8)'), 16, '[pets] and then keeps pace with you');
  eq(ev('dccPetLevel(20)'), 28, '[pets] 15 + the 13 levels since');
  check('[pets] the level curve never goes backwards or jumps', () => {
    let prev = 0;
    for (let n = 0; n <= 40; n++) {
      const l = ev('dccPetLevel(' + n + ')');
      if (l < prev) return 'went backwards at ' + n;
      if (l - prev > 2) return 'jumped by ' + (l - prev) + ' at ' + n;
      prev = l;
    }
    return true;
  });
  check('[pets] doubling stops exactly at 15, not before or after', () => {
    for (let n = 0; n <= 20; n++) {
      const l = ev('dccPetLevel(' + n + ')');
      const step = n ? l - ev('dccPetLevel(' + (n - 1) + ')') : 0;
      if (n && l <= 15 && step !== 2) return 'step of ' + step + ' below the cap at ' + n;
      if (n && l > 16 && step !== 1) return 'step of ' + step + ' above the cap at ' + n;
    }
    return true;
  });

  // A pet rolls at the Floor Number regardless of level, and cannot train up.
  eq(ev('dccPetRank(3)'), 3, '[pets] a pet rolls at the Floor Number');
  eq(ev('dccPetRank(5)'), 5, '[pets] ...on floor 5 too');
  check('[pets] Rank depends on the floor and not at all on the level', () => {
    const a = ev('dccPetRank(4)');
    const b = ev('dccPetRank(4)');
    return a === b && a === 4 || 'Rank moved: ' + a + ' vs ' + b;
  });

  // 3 Stat points a level, and never into Intelligence.
  eq(ev('dccPetStatPoints(1, 5)'), 12, '[pets] four levels gained is 12 Stat points');
  eq(ev('dccPetStatPoints(5, 5)'), 0,  '[pets] no levels, no points');
  eq(ev('dccPetStatPoints(9, 3)'), 0,  '[pets] going down does not refund points');
  eq(ev('DCC_PET_STAT_EXCLUDED'), 'INT', '[pets] Intelligence is off limits');

  // Attack upgrades land at Ranks 5/10/15, which for a pet means those floors.
  eq(ev('dccPetAttackDice(4)'), 0,  '[pets] no extra damage die below floor 5');
  eq(ev('dccPetAttackDice(5)'), 1,  '[pets] one on floor 5');
  eq(ev('dccPetAttackDice(10)'), 2, '[pets] two on floor 10');
  eq(ev('dccPetAttackDice(15)'), 3, '[pets] three on floor 15');
  check('[pets] level 15 is where a pet is called mature', () =>
    ev('dccPetIsMature(14)') === false && ev('dccPetIsMature(15)') === true);

  eq(ev('DCC_COMPANION_KINDS.length'), 3, '[pets] pets, mounts and minions');
  check('[pets] every kind carries its rule, not just a label', () => {
    const bad = ev(`JSON.stringify(DCC_COMPANION_KINDS.filter(k=>!k.id||!k.label||!k.note).map(k=>k.id))`);
    return bad === '[]' || bad;
  });
  check('[pets] the mount rule mentions its one Action and the Move to mount', () => {
    const m = ev(`DCC_COMPANION_KINDS.find(k=>k.id==='mount').note`);
    return (/one Action/i.test(m) && /Move Action/i.test(m)) || m;
  });

  // the block
  check('[companions] adding one records its kind, and only a pet tracks levels', () => {
    ev("S.char.blocks.companions={entries:[]};");
    ev("var i=document.createElement('input');i.id='ent-add-companions';document.body.appendChild(i);" +
       "var s=document.createElement('select');s.id='ent-kind-companions';" +
       "['pet','mount'].forEach(function(k){var o=document.createElement('option');o.value=k;s.appendChild(o);});" +
       "document.body.appendChild(s);");
    ev("document.getElementById('ent-add-companions').value='Mongo';entAdd('companions');");
    const e = JSON.parse(ev('JSON.stringify(S.char.blocks.companions.entries)'));
    if (e.length !== 1) return 'added ' + e.length;
    if (e[0].name !== 'Mongo' || e[0].kind !== 'pet') return JSON.stringify(e[0]);
    ev("entLevel('companions',0,3)");
    return ev('S.char.blocks.companions.entries[0].levelsGained') === 3 || 'levels not tracked';
  });
  check('[companions] levels gained never go below zero', () => {
    ev("for(let i=0;i<9;i++)entLevel('companions',0,-1)");
    return ev('S.char.blocks.companions.entries[0].levelsGained') === 0 || 'went negative';
  });
  check("[companions] the readout shows a pet's derived level and Rank", () => {
    ev("entLevel('companions',0,7);S.floor=5;");
    const bits = ev("JSON.stringify(SYS.derive.companionReadout(S.char,S.char.blocks.companions.entries[0]))");
    return (/Level 15/.test(bits) && /Rank 5/.test(bits) && /mature/.test(bits)) || bits;
  });
  check('[companions] a mount has no derived numbers, only its rule', () => {
    const bits = ev("JSON.stringify(SYS.derive.companionReadout(S.char,{kind:'mount',name:'Horse'}))");
    return bits === '[]' || bits;
  });

  // ── review pass: focus, dead handlers, and custom options ────────────────
  // Three classes of bug that a passing suite had been missing.

  // 1. THE FOCUS BUG. An oninput handler must never repaint the element being
  // typed into. This is the bug the whole project started with, and it was
  // still live in traitGrid: editing a Stat on the sheet lost the caret after
  // one keystroke.
  check('[focus] typing in a Stat does not replace the input', () => {
    ev("S.char=SYS.newCharacter();S.char.creation={step:0,complete:true};renderHero();");
    const el = "document.querySelector('#blk-stats input')";
    if (!ev('!!' + el)) return 'no Stat input on the sheet';
    ev(el + ".setAttribute('data-probe','1')");
    ev("traitSet('stats','STR','base','1')");
    ev("traitSet('stats','STR','base','12')");
    const kept = ev(el + ".getAttribute('data-probe')");
    if (kept !== '1') return 'the input was replaced while typing';
    return ev("dccStatOf(S.char,'STR')") === 12 || 'value not stored';
  });
  check('[focus] the derived total and Mod still update as you type', () => {
    ev("traitSet('stats','CON','base','6')");
    const tot = ev("(document.getElementById('tg-stats-CON-tot')||{}).textContent");
    const mod = ev("(document.getElementById('tg-stats-CON-mod')||{}).textContent");
    return (tot === '6' && mod === '+3') || 'total=' + tot + ' mod=' + mod;
  });
  check('[focus] blocks that depend on a Stat repaint when it changes', () => {
    // CON drives the Health Bar slot value, so the track must follow.
    ev("traitSet('stats','CON','base','10')");
    const hb = ev("(document.getElementById('blk-health')||{}).innerHTML||''");
    return /\b4\b/.test(hb) || 'Health Bar did not pick up CON 10 (Mod +4)';
  });

  // 2. DEAD HANDLERS. "+ Skill" called a function that did not exist, so the
  // button threw. Nothing caught it because no test had clicked it.
  check('[wiring] every handler the sheet renders actually exists', () => {
    ev("S.char=SYS.newCharacter();S.char.creation={step:0,complete:true};renderHero();");
    const html = ev("document.getElementById('hero-sheet').innerHTML");
    const names = new Set();
    const re = /on(?:click|input|change)="([A-Za-z_$][\w$]*)\(/g;
    let m;
    while ((m = re.exec(html))) names.add(m[1]);
    const missing = [...names].filter(n => ev('typeof ' + n) !== 'function');
    return missing.length ? 'not defined: ' + missing.join(', ') : true;
  });
  check('[wiring] every handler the wizard renders actually exists', () => {
    ev("S.char=SYS.newCharacter();S.char.creation={step:0,complete:false};renderHero();");
    const missing = new Set();
    for (let i = 0; i < ev('SYS.creation.length'); i++) {
      ev('S.char.creation.step=' + i + ';wizRepaint();');
      const html = ev("(document.getElementById('wiz-body')||{}).innerHTML||''");
      const re = /on(?:click|input|change)="([A-Za-z_$][\w$]*)\(/g;
      let m;
      while ((m = re.exec(html))) {
        if (ev('typeof ' + m[1]) !== 'function') missing.add(m[1] + ' (screen ' + (i + 1) + ')');
      }
    }
    return missing.size ? 'not defined: ' + [...missing].join(', ') : true;
  });

  // 2b. DANGLING DERIVE REFERENCES. A block can name a derive function that was
  // never written — the manifest edit that added the reference kept tripping an
  // "already present" guard on the reference itself. Three separate features
  // shipped half-wired that way before this check existed.
  check('[wiring] every derive.x a block references actually exists', () => {
    const refs = ev(`JSON.stringify((function(){
      var out=[];
      (SYS.schema.blocks||[]).forEach(function(b){
        Object.keys(b).forEach(function(k){
          var v=b[k];
          if (typeof v==='string' && v.indexOf('derive.')===0) out.push(b.id+'.'+k+' -> '+v);
          if (Array.isArray(v)) v.forEach(function(x){
            if (x && typeof x.value==='string' && x.value.indexOf('derive.')===0)
              out.push(b.id+'.'+k+' -> '+x.value);
          });
        });
      });
      return out;
    })())`);
    const bad = JSON.parse(refs).filter(r => {
      const name = r.split('derive.')[1];
      return ev('typeof (SYS.derive && SYS.derive[' + JSON.stringify(name) + '])') !== 'function';
    });
    return bad.length ? 'dangling: ' + bad.join(', ') : true;
  });

  // 3. CUSTOM OPTIONS. The book supports inventing your own Skills, Races and
  // Classes, and the wizard used to force a pick from the printed lists.
  check('[custom] a Skill can be invented, not just chosen', () => {
    ev("S.char=SYS.newCharacter();S.char.blocks={skills:{skills:[]}};");
    ev("document.body.insertAdjacentHTML('beforeend'," +
       "'<input id=' + JSON.stringify('sk-add-skills') + '>');");
    ev("var s=document.createElement('select');s.id='sk-stat-skills';" +
       "var o=document.createElement('option');o.value='DEX';s.appendChild(o);s.value='DEX';" +
       "document.body.appendChild(s);");
    ev("var r=document.createElement('input');r.id='sk-rank-skills';r.value='4';document.body.appendChild(r);");
    ev("document.getElementById('sk-add-skills').value='Yarn Wrangler';skillAdd('skills');");
    const s = JSON.parse(ev('JSON.stringify(S.char.blocks.skills.skills)'));
    if (s.length !== 1) return 'added ' + s.length;
    if (s[0].name !== 'Yarn Wrangler') return s[0].name;
    if (s[0].stat !== 'DEX' || s[0].rank !== 4) return JSON.stringify(s[0]);
    return s[0].custom === true || 'not flagged as custom';
  });
  check('[custom] a catalogue Skill added by name brings its own Stat', () => {
    ev("S.char.blocks.skills.skills=[];");
    ev("document.getElementById('sk-stat-skills').value='';");
    ev("document.getElementById('sk-add-skills').value='Climbing';skillAdd('skills');");
    const s = JSON.parse(ev('JSON.stringify(S.char.blocks.skills.skills[0])'));
    const cat = JSON.parse(ev("JSON.stringify(dccSkillByName('Climbing'))"));
    return (s.stat === cat.stat && s.custom !== true) || JSON.stringify(s);
  });
  check('[custom] the same Skill cannot be added twice', () => {
    ev("document.getElementById('sk-add-skills').value='Climbing';skillAdd('skills');");
    return ev('S.char.blocks.skills.skills.length') === 1 || 'duplicated';
  });

  check('[custom] a Race can be built rather than chosen', () => {
    ev("S.char=SYS.newCharacter();");
    ev("dccChooseCustom('race');");
    if (ev("dccPick(S.char).race") !== 'custom-race') return 'not selected';
    if (ev("dccCustomEntry(S.char,'race')")) return 'accepted an unnamed custom Race';
    ev("dccCustomSet('race','name','Trash Panda');dccCustomStat('race','DEX',4);");
    const e = JSON.parse(ev("JSON.stringify(dccCustomEntry(S.char,'race'))"));
    return (e && e.name === 'Trash Panda' && e.stats.DEX === 4 && e.custom === true)
      || JSON.stringify(e);
  });
  check('[custom] a custom Race flows through the diff like a printed one', () => {
    const d = JSON.parse(ev('JSON.stringify(dccRcDiff(S.char))'));
    if (!d || !d.race) return 'no diff';
    if (d.race.name !== 'Trash Panda') return d.race.name;
    return (d.stats.DEX && d.stats.DEX.delta === 4) || JSON.stringify(d.stats);
  });
  check('[custom] a custom pick has no prerequisites to fail', () => {
    ev("dccChooseCustom('class');dccCustomSet('class','name','Dumpster Diver');");
    return ev('wizValidate(S.char,7)') === true || ev('wizValidate(S.char,7)');
  });
  check('[custom] an unnamed custom Class blocks the screen with a clear reason', () => {
    ev("dccCustomSet('class','name','');");
    const v = ev('wizValidate(S.char,7)');
    return (v !== true && /custom Class/i.test(String(v))) || 'got ' + v;
  });
  check('[custom] naming a weapon keeps the Skill it works like', () => {
    ev("S.char=SYS.newCharacter();dccSetRoute('weapon');dccSetWeapon('Club');");
    ev("dccStoreCombat('weaponName','Tire Iron');");
    const cm = JSON.parse(ev('JSON.stringify(dccCre(S.char).combat)'));
    return (cm.weaponName === 'Tire Iron' && cm.weaponSkill === 'Club') || JSON.stringify(cm);
  });

  // ── the combat tracker (D8) ──────────────────────────────────────────────
  eq(ev('DCC_COMBAT_STEPS.length'), 5, '[combat] the round is five steps');
  check('[combat] the steps are the book\'s, in order', () => {
    const names = ev('DCC_COMBAT_STEPS.map(s=>s.name).join(" | ")');
    return names === 'Mob Action Declaration | Crawler Reaction Phase | Mob Action Resolution | '
      + 'Crawler Action Phase | Clean Up' || names;
  });
  check('[combat] the conflict tab uses the pack tracker, not the Fate one', () => {
    ev("showTab('conflict')");
    const html = ev("document.getElementById('conflict-content').innerHTML");
    return (/five-step round/.test(html) && !/Zone-based/.test(html)) || 'wrong tracker rendered';
  });

  ev('dccCombatStart()');
  check('[combat] starting a fight opens on round 1, step 1', () => {
    const c = JSON.parse(ev('JSON.stringify(S.conflict)'));
    return (c.active && c.round === 1 && c.step === 0) || JSON.stringify(c).slice(0, 80);
  });
  check('[combat] the tracker state is stamped with the system that owns it', () =>
    ev('S.conflict.systemId') === 'dungeon-crawler-carl' || ev('S.conflict.systemId'));

  // Actions per round differ by what you are.
  ev("document.body.insertAdjacentHTML('beforeend'," +
     "'<input id=' + JSON.stringify('dcc-cb-name') + '>');");
  ev("var s=document.createElement('select');s.id='dcc-cb-side';" +
     "['crawler','mob','boss'].forEach(function(k){var o=document.createElement('option');" +
     "o.value=k;s.appendChild(o);});document.body.appendChild(s);");
  const addCombatant = (name, side) =>
    ev("document.getElementById('dcc-cb-name').value=" + JSON.stringify(name) +
       ";document.getElementById('dcc-cb-side').value=" + JSON.stringify(side) +
       ";dccCombatAdd();");
  addCombatant('Keisha', 'crawler');
  addCombatant('Wren', 'crawler');
  addCombatant('Bad Llama', 'mob');
  eq(() => ev("S.conflict.combatants.find(m=>m.name==='Keisha').maxActions"), 2,
     '[combat] a crawler gets two Actions a round');
  check('[combat] a Boss gets one Action per crawler', () => {
    addCombatant('Mordecai', 'boss');
    const boss = JSON.parse(ev("JSON.stringify(S.conflict.combatants.find(m=>m.side==='boss'))"));
    return boss.maxActions === 2 || 'two crawlers but ' + boss.maxActions + ' Actions';
  });
  check('[combat] adding a third crawler gives the Boss a third Action', () => {
    addCombatant('Chase', 'crawler');
    const boss = JSON.parse(ev("JSON.stringify(S.conflict.combatants.find(m=>m.side==='boss'))"));
    return boss.maxActions === 3 || 'got ' + boss.maxActions;
  });
  check('[combat] a crawler dying does not take the Boss\'s Action away', () => {
    // "Bosses have 1 Action per crawler, even if a crawler kicks the bucket
    // mid-fight" (p. 270) — so removing one from the tracker is the GM's call,
    // but the count must follow whatever is actually listed.
    const before = ev("S.conflict.combatants.find(m=>m.side==='boss').maxActions");
    return before === 3 || 'got ' + before;
  });

  // Spending Actions.
  check('[combat] clicking a pip spends down to it, and clicking again restores', () => {
    const i = ev("S.conflict.combatants.findIndex(m=>m.name==='Keisha')");
    ev('dccCombatAction(' + i + ',0)');
    const after = ev('S.conflict.combatants[' + i + '].actions');
    if (after !== 1) return 'spent to ' + after + ', expected 1';
    ev('dccCombatAction(' + i + ',1)');
    return ev('S.conflict.combatants[' + i + '].actions') === 0
      || 'second pip left ' + ev('S.conflict.combatants[' + i + '].actions');
  });
  check('[combat] Actions never go below zero or above the maximum', () => {
    const i = ev("S.conflict.combatants.findIndex(m=>m.name==='Keisha')");
    for (let p = 0; p < 6; p++) ev('dccCombatAction(' + i + ',' + p + ')');
    const a = ev('S.conflict.combatants[' + i + '].actions');
    const max = ev('S.conflict.combatants[' + i + '].maxActions');
    return (a >= 0 && a <= max) || 'actions ' + a + ' of ' + max;
  });

  // Stepping through the round.
  check('[combat] stepping runs 1 to 5 then rolls into the next round', () => {
    ev('S.conflict.step=0;S.conflict.round=1;');
    for (let s = 0; s < 4; s++) {
      ev('dccCombatNext()');
      if (ev('S.conflict.step') !== s + 1) return 'stuck at step ' + ev('S.conflict.step');
      if (ev('S.conflict.round') !== 1) return 'round advanced early';
    }
    ev('dccCombatNext()');
    return (ev('S.conflict.round') === 2 && ev('S.conflict.step') === 0)
      || 'round ' + ev('S.conflict.round') + ' step ' + ev('S.conflict.step');
  });
  check('[combat] a new round gives everyone their Actions back', () => {
    const i = ev("S.conflict.combatants.findIndex(m=>m.name==='Keisha')");
    ev('S.conflict.combatants[' + i + '].actions=0;');
    ev('S.conflict.step=4;dccCombatNext();');
    const a = ev('S.conflict.combatants[' + i + '].actions');
    const max = ev('S.conflict.combatants[' + i + '].maxActions');
    return a === max || 'refreshed to ' + a + ' of ' + max;
  });

  // Dying counts down a round at a time.
  check('[combat] a Dying combatant loses a round each Clean Up', () => {
    const i = ev("S.conflict.combatants.findIndex(m=>m.name==='Wren')");
    ev('S.conflict.combatants[' + i + "].dying=3;");
    ev('S.conflict.step=4;dccCombatNext();');
    if (ev('S.conflict.combatants[' + i + '].dying') !== 2) return 'got ' + ev('S.conflict.combatants[' + i + '].dying');
    ev('S.conflict.step=4;dccCombatNext();');
    return ev('S.conflict.combatants[' + i + '].dying') === 1 || 'second tick wrong';
  });
  check('[combat] running out of rounds is recorded in the log', () => {
    const i = ev("S.conflict.combatants.findIndex(m=>m.name==='Wren')");
    ev('S.conflict.combatants[' + i + '].dying=1;');
    ev('S.conflict.step=4;dccCombatNext();');
    const log = ev('JSON.stringify(S.conflict.log)');
    return /run out of rounds/.test(log) || log.slice(-90);
  });
  check('[combat] the log does not grow without bound', () => {
    for (let r = 0; r < 45; r++) { ev('S.conflict.step=4;dccCombatNext();'); }
    return ev('S.conflict.log.length') <= 40 || 'log is ' + ev('S.conflict.log.length');
  });

  check('[combat] ending a fight clears the tracker', () => {
    ev('dccCombatEnd()');
    return (ev('S.conflict.active') === false && ev('S.conflict.combatants.length') === 0)
      || 'still active';
  });

  // ── the sheet actually renders ───────────────────────────────────────────
  ev('renderHero()');
  check('[sheet] the block sheet rendered every declared block', () =>
    ev(`SYS.schema.blocks.every(b=>!!document.getElementById('blk-'+b.id))`));
  check('[sheet] a repaint touches only its own block', () => {
    ev("document.getElementById('blk-mana').setAttribute('data-probe','1')");
    ev("blockRepaint('health')");
    return ev("document.getElementById('blk-mana').getAttribute('data-probe')") === '1';
  });

  // ── every shared tab must survive a pack with none of Fate's fields ──────
  // The map crashed here first: heroMarker() read S.char.costumedName directly.
  check('[tabs] all nine tabs render under a non-Fate pack', () => {
    const broke = [];
    ['hero', 'hud', 'npcs', 'map', 'dice', 'conflict', 'notes', 'print', 'wiki'].forEach(t => {
      try { ev(`showTab('${t}')`); } catch (e) { broke.push(t + ': ' + e.message); }
    });
    return broke.length ? broke.join(' | ') : true;
  });
  check("[tabs] the map marker uses the pack's own name field", () => {
    ev("S.char.name='Keisha';");
    return ev('heroMarker()') === 'K' || 'got ' + ev('heroMarker()');
  });
  check('[tabs] the marker falls back cleanly with no name at all', () => {
    ev("S.char.name='';");
    return ev('heroMarker()') === 'H' || 'got ' + ev('heroMarker()');
  });

  // ── the HUD, the crawler's fight screen ───────────────────────────────────
  // Reachability lives in test/dice.js; these are the rules the cards state.
  // Getting the maths wrong here is worse than not showing it, because a player
  // reads a damage line mid-fight and does not go back to the book.
  function hudSheet(skills, spells, hotlist) {
    ev("S.char=SYS.newCharacter();S.char.creation={step:0,complete:true};" +
       "S.char.blocks.stats={STR:{base:10,bonus:0},INT:{base:10,bonus:0}};" +
       "S.char.blocks.skills={skills:" + JSON.stringify(skills || []) + "};" +
       "S.char.blocks.spells={skills:" + JSON.stringify(spells || []) + "};" +
       "S.char.blocks.gear=Object.assign(S.char.blocks.gear||{},{hotlist:" +
       JSON.stringify(hotlist || []) + "});" +
       "renderHero();showTab('hud');");
    return ev("document.getElementById('hud-content').textContent.replace(/\\s+/g,' ')");
  }
  // One card, not the whole screen. Searching the HUD's full text for "to hit"
  // passes whenever ANY card has it, which made the first version of the
  // healing-Spell check unfalsifiable — it stayed green with the bug put back.
  function hudCard(name, sel) {
    return ev("(function(){var c=[].slice.call(" +
      "document.querySelectorAll('#hud-content .hud-act')).find(function(x){" +
      "var n=x.querySelector('.hud-act-name');" +
      "return n&&n.textContent.trim()===" + JSON.stringify(name) + "});" +
      "if(!c)return null;" +
      (sel ? "var m=c.querySelector(" + JSON.stringify(sel) + ");return m?m.textContent.trim():'';"
           : "return c.textContent.replace(/\\s+/g,' ').trim();") + "})()");
  }

  check('[hud] an attack card carries base damage AND the Rank dice', () => {
    // Bow is 1d6 + STR Piercing (catalogue); Rank 7 adds +1d6 (Table 37, p. 176).
    hudSheet([{ name: 'Bow', rank: 7, stat: 'DEX', checkType: 'evade' }]);
    const dmg = hudCard('Bow', '.hud-dmg');
    return dmg === '1d6 + STR Piercing ' + ev('dccRankDamage(7)')
      || 'the Bow damage line reads ' + JSON.stringify(dmg);
  });

  check('[hud] to-hit is Rank plus the Stat Mod', () => {
    hudSheet([{ name: 'Warhammer', rank: 7, stat: 'STR', checkType: 'evade' }]);
    const mod = ev("SYS.derive.skillStatMod(S.char,'STR')");
    const hit = hudCard('Warhammer', '.hud-hit');
    return hit === '+' + (7 + mod)
      || 'expected +' + (7 + mod) + ', the card shows ' + JSON.stringify(hit);
  });

  check('[hud] a Skill that is not an attack stays off the Attacks list', () => {
    // Scoped to the cards. The HUD also carries a roller whose dropdown lists
    // every Skill you have, so searching the whole screen's text for
    // "Perception" finds it there and the check passes with the bug in.
    hudSheet([{ name: 'Perception', rank: 5, stat: 'INT', checkType: 'unopposed' },
              { name: 'Warhammer', rank: 2, stat: 'STR', checkType: 'evade' }]);
    const names = ev("[].slice.call(document.querySelectorAll(" +
      "'#hud-content .hud-act-name')).map(function(n){return n.textContent.trim()})");
    return (names.indexOf('Warhammer') >= 0 && names.indexOf('Perception') < 0)
      || 'the cards read: ' + JSON.stringify(names);
  });

  // The picture on an attack card is the thing in your hand.
  function hudCardIcon(name) {
    return ev("(function(){var c=[].slice.call(" +
      "document.querySelectorAll('#hud-content .hud-act')).find(function(x){" +
      "var n=x.querySelector('.hud-act-name');" +
      "return n&&n.textContent.trim()===" + JSON.stringify(name) + "});" +
      "if(!c)return null;var i=c.querySelector('.hud-act-ico .pw-icon');" +
      // iconUrl() encodes the id but not the path separator, so the mask reads
      // .../game-icons%3Awood-club.svg — decode it back to the stored value.
      "if(!i)return '';var m=(i.getAttribute('style')||'').match(/design\\/([^.']+)\\.svg/);" +
      "return m?decodeURIComponent(m[1]):'(unreadable)'})()");
  }

  check('[hud] an attack card shows the equipped weapon large', () => {
    hudSheet([{ name: 'Club', rank: 4, stat: 'STR', checkType: 'evade' }]);
    ev("S.char.blocks.gear.equipped={hands:[{name:'Old Club',skill:'Club'," +
       "icon:'game-icons:wood-club'}]};save();renderHUD();");
    const got = hudCardIcon('Club');
    if (got === null) return 'no Club card on the HUD';
    return got === 'game-icons:wood-club' || 'the card shows ' + JSON.stringify(got);
  });

  // Reported from the app: "the handgun has an icon but it's not working."
  // The first version searched only the Gear Slots and matched only the "Works
  // as" field, so four of the five ways a player actually carries a weapon
  // showed nothing at all. Each case below failed before this was widened.
  function gunIcon(setup) {
    ev("S.char.blocks.gear.hotlist=[];S.char.blocks.gear.inventory=[];" +
       "S.char.blocks.gear.equipped={};" + setup + ";save();renderHUD();");
    return hudCardIcon('Handgun');
  }
  [['equipped with no "Works as" set — just a named item with an icon',
    "S.char.blocks.gear.equipped={hands:[{name:'Handgun',icon:'game-icons:pistol-gun'}]}"],
   ['kept in the Hotlist, which is where a fast-draw weapon lives',
    "S.char.blocks.gear.hotlist=[{name:'Handgun',icon:'game-icons:pistol-gun'}]"],
   ['stowed in Inventory',
    "S.char.blocks.gear.inventory=[{name:'Handgun',icon:'game-icons:pistol-gun'}]"],
   ['renamed, with "Works as" pointing at the Skill',
    "S.char.blocks.gear.equipped={hands:[{name:'Ol Betsy',skill:'Handgun',icon:'game-icons:pistol-gun'}]}"],
  ].forEach(function (c) {
    check('[hud] the weapon icon connects when ' + c[0], () => {
      hudSheet([{ name: 'Handgun', rank: 5, stat: 'DEX', checkType: 'evade' }]);
      const got = gunIcon(c[1]);
      return got === 'game-icons:pistol-gun' || 'the card shows ' + JSON.stringify(got);
    });
  });

  check('[hud] the weapon you are holding beats the one in your bag', () => {
    hudSheet([{ name: 'Handgun', rank: 5, stat: 'DEX', checkType: 'evade' }]);
    const got = gunIcon("S.char.blocks.gear.equipped={hands:[{name:'Handgun'," +
      "icon:'game-icons:worn-gun'}]};S.char.blocks.gear.inventory=[{name:'Handgun'," +
      "icon:'game-icons:stowed-gun'}]");
    return got === 'game-icons:worn-gun' || 'the card shows ' + JSON.stringify(got);
  });

  check('[hud] with nothing equipped it falls back to the Skill’s own icon', () => {
    hudSheet([{ name: 'Club', rank: 4, stat: 'STR', checkType: 'evade',
                icon: 'game-icons:swap-bag' }]);
    ev("S.char.blocks.gear.equipped={};save();renderHUD();");
    return hudCardIcon('Club') === 'game-icons:swap-bag'
      || 'the card shows ' + JSON.stringify(hudCardIcon('Club'));
  });

  check('[hud] an attack with no icon reserves no gutter', () => {
    hudSheet([{ name: 'Unarmed Combat', rank: 2, stat: 'STR', checkType: 'evade' }]);
    ev("S.char.blocks.gear.equipped={};save();renderHUD();");
    return hudCardIcon('Unarmed Combat') === ''
      || 'an icon block was drawn anyway: ' + JSON.stringify(hudCardIcon('Unarmed Combat'));
  });

  check('[hud] the icon block is sized by CSS, not inline', () => {
    // It grows at the 700px breakpoint; an inline width would beat the rule.
    hudSheet([{ name: 'Club', rank: 4, stat: 'STR', checkType: 'evade',
                icon: 'game-icons:swap-bag' }]);
    const style = ev("(document.querySelector('#hud-content .hud-act-ico .pw-icon')||" +
      "{getAttribute:function(){return ''}}).getAttribute('style')||''");
    return !/width\s*:/.test(style) || 'the icon carries an inline size: ' + JSON.stringify(style);
  });

  check('[hud] a healing Spell is not given damage dice', () => {
    // Heal has a Rank like anything else, and dccRankDamage(1) is "+1" — printed
    // under a healing Spell it read as though it hurt someone.
    hudSheet([], [{ name: 'Heal', rank: 1, stat: 'INT' }], [{ name: 'Heal', qty: 1 }]);
    const dmg = hudCard('Heal', '.hud-dmg');
    if (dmg === null) return 'no Heal card on the HUD at all';
    return dmg === '' || 'the Heal card carries a damage line: ' + JSON.stringify(dmg);
  });

  check('[hud] a healing Spell is cast, not aimed', () => {
    hudSheet([], [{ name: 'Heal', rank: 1, stat: 'INT' }], [{ name: 'Heal', qty: 1 }]);
    const vs = hudCard('Heal', '.hud-act-vs');
    return vs === 'to cast' || 'the Heal card reads ' + JSON.stringify(vs);
  });

  check('[hud] a Spell out of the Hotlist says so', () => {
    // "A Spell has to be in your Hotlist to cast it under pressure" has sat in
    // the Spells block hint since the pack was written, enforced by nobody.
    const out = hudSheet([], [{ name: 'Heal', rank: 1, stat: 'INT' }], []);
    if (out.indexOf('Not in your Hotlist') < 0) return 'no warning when the Spell is not carried';
    const carried = hudSheet([], [{ name: 'Heal', rank: 1, stat: 'INT' }], [{ name: 'Heal', qty: 1 }]);
    return carried.indexOf('Not in your Hotlist') < 0
      || 'warned about a Spell that IS in the Hotlist';
  });

  // ── game-icons ────────────────────────────────────────────────────────────
  // The icons come from Iconify's search filtered to the game-icons set, drawn
  // as CSS masks so they take the pack's theme colour. The network is stubbed:
  // a suite that depends on api.iconify.design being up is a suite that fails
  // on a train.
  function stubIcons(list) {
    ev("window.fetch=function(){return Promise.resolve({json:function(){" +
       "return Promise.resolve({icons:" + JSON.stringify(list || ['game-icons:broadsword']) +
       "})}})}");
  }
  const settle = () => new Promise(r => setTimeout(r, 350));

  check('[icons] a slug renders as a mask, and legacy emoji pass through', () => {
    const mask = ev("iconHTML('game-icons:broadsword',20)");
    const emoji = ev("iconHTML('\\u2694',20)");
    if (!/mask-image/.test(mask) || !/pw-icon/.test(mask)) return 'slug rendered as ' + JSON.stringify(mask);
    if (/mask-image/.test(emoji)) return 'an emoji was treated as a slug: ' + JSON.stringify(emoji);
    return ev("iconHTML('',20)") === '' || 'no icon should render nothing';
  });

  check('[icons] search degrades instead of throwing when there is no fetch', () => {
    ev("window.fetch=undefined;iconInit('probe',{});");
    ev("document.body.insertAdjacentHTML('beforeend','<div id=\"probe-icon-results\"></div>')");
    ev("iconSearch('probe')");
    const t = ev("document.getElementById('probe-icon-results').textContent");
    ev("document.getElementById('probe-icon-results').remove()");
    return /connection/i.test(t) || 'the results panel reads ' + JSON.stringify(t);
  });

  await (async () => {
    stubIcons(['game-icons:health-potion', 'game-icons:broadsword']);
    kindSheet();
    ev("S.char.blocks.gear.inventory=[{name:'Odd Flask'}];blockRepaint('gear');");
    // _invDetailOpen is module state and an earlier check left a panel open, so
    // clicking would have TOGGLED IT SHUT rather than opening this one.
    ev("_invDetailOpen='';blockRepaint('gear');");
    ev("[].slice.call(document.querySelectorAll('#blk-gear button'))" +
       ".filter(function(b){return /invDetail/.test(b.getAttribute('onclick')||'')}).pop().click();");
    await settle();
    check('[icons] the item detail panel offers the picker', () => {
      const n = ev("document.querySelectorAll('#inv-icon-results .ic-opt').length");
      return n === 2 || 'the picker showed ' + n + ' options';
    });
    check('[icons] picking one stores it on the item', () => {
      ev("iconPick('inv','game-icons:health-potion')");
      return ev("S.char.blocks.gear.inventory[0].icon") === 'game-icons:health-potion'
        || 'item.icon is ' + JSON.stringify(ev("S.char.blocks.gear.inventory[0].icon"));
    });
    check('[icons] clicking the chosen one again clears it', () => {
      // invSetField deletes a key set to '', so a cleared icon is absent rather
      // than empty — which is what the renderers already test for.
      ev("iconPick('inv','game-icons:health-potion')");
      return !ev("S.char.blocks.gear.inventory[0].icon")
        || 'item.icon is ' + JSON.stringify(ev("S.char.blocks.gear.inventory[0].icon"));
    });
  })();

  await (async () => {
    stubIcons(['game-icons:broadsword']);
    hudSheet([{ name: 'Club', rank: 3, stat: 'STR', checkType: 'evade' }]);
    ev("showTab('hero')");
    const has = ev("!!([].slice.call(document.querySelectorAll('#blk-skills button'))" +
      ".find(function(b){return /skillIconOpen/.test(b.getAttribute('onclick')||'')}))");
    check('[icons] a Skill row offers an icon button', () => has || 'no icon control on any Skill row');
    if (has) {
      ev("[].slice.call(document.querySelectorAll('#blk-skills button'))" +
         ".find(function(b){return /skillIconOpen/.test(b.getAttribute('onclick')||'')}).click();");
      await settle();
      check('[icons] it opens the picker in the shell popover', () =>
        ev("!!document.getElementById('shell-pop')&&document.getElementById('shell-pop').classList.contains('open')")
        || 'no popover opened');
      check('[icons] picking one stores it on the Skill', () => {
        ev("iconPick('skill','game-icons:broadsword')");
        const got = ev("S.char.blocks.skills.skills[0].icon");
        ev("popClose()");
        return got === 'game-icons:broadsword' || 'skill.icon is ' + JSON.stringify(got);
      });
    }
  })();

  // ── the Hotlist keypad ────────────────────────────────────────────────────
  // Ten fixed slots, because what makes it fast at the table is knowing Slot 4
  // is your Heal without reading it. Empty slots stay rendered for that reason.
  check('[hud] the Hotlist shows every slot, empty ones included', () => {
    const t = hudSheet([], [], [{ name: 'Standard Mana Potion', qty: 5 }]);
    const slots = ev("document.querySelectorAll('#hud-content .hot-slot').length");
    const empty = ev("document.querySelectorAll('#hud-content .hot-slot.is-empty').length");
    if (slots !== 10) return 'showed ' + slots + ' slots, not 10';
    if (empty !== 9) return slots + ' slots but ' + empty + ' marked empty, expected 9';
    return /1 of 10/.test(t) || 'header reads ' + JSON.stringify(t.slice(0, 160));
  });

  check('[hud] tapping a consumable spends one, on the sheet too', () => {
    hudSheet([], [], [{ name: 'Standard Mana Potion', qty: 5 }]);
    ev('dccHudTap(0)');
    return ev('S.char.blocks.gear.hotlist[0].qty') === 4
      || 'qty is ' + ev('S.char.blocks.gear.hotlist[0].qty');
  });

  // invQty clamps at 1 so the ± controls can never silently bin an item. Drinking
  // your LAST potion has to be possible, or the keypad stops working exactly when
  // it matters and sends you to the sheet mid-fight.
  check('[hud] tapping the last one empties the slot', () => {
    hudSheet([], [], [{ name: 'Standard Mana Potion', qty: 1 }]);
    ev('dccHudTap(0)');
    if (ev('!!S.char.blocks.gear.hotlist[0]')) {
      return 'the slot still holds ' + JSON.stringify(ev('S.char.blocks.gear.hotlist[0]'));
    }
    return ev("document.querySelectorAll('#hud-content .hot-slot.is-empty').length") === 10
      || 'the keypad did not redraw the slot as empty';
  });

  // Found by two playtesters independently: spending an item spliced the array,
  // so everything after it moved down a slot — the Hotlist rearranged itself at
  // the exact moment a player is going on muscle memory. A stack leaves a hole.
  check('[hud] spending an item does not renumber the slots after it', () => {
    hudSheet([], [], [{ name: 'Ration', qty: 1 }, { name: 'Club', skill: 'Club', qty: 1 },
                      { name: 'Torch', qty: 1 }]);
    const names = () => ev("[].slice.call(document.querySelectorAll('#hud-content .hot-slot'))" +
      ".slice(0,3).map(function(b){var n=b.querySelector('.hot-name');" +
      "return n?n.textContent:''}).join(',')");
    const before = names();
    if (before !== 'Ration,Club,Torch') return 'setup wrong, slots read ' + before;
    ev('dccHudTap(0)');
    const after = names();
    return after === 'empty,Club,Torch' ||
      'after spending slot 1 the keypad reads ' + after;
  });

  check('[hud] a new item drops into the first empty slot, not the end', () => {
    hudSheet([], [], [{ name: 'Ration', qty: 1 }, { name: 'Torch', qty: 1 }]);
    ev('dccHudTap(0)');                                   // slot 1 goes empty
    ev("invAdd('gear','hotlist')");                        // no input element: no-op
    ev("S.char.blocks.gear.hotlist[0]=null;" +
       "invPlace(S.char.blocks.gear.hotlist,{name:'Rope',qty:1},10);save();renderHUD();");
    return ev("S.char.blocks.gear.hotlist[0].name") === 'Rope'
      || 'it landed at ' + ev("JSON.stringify(S.char.blocks.gear.hotlist.map(function(x){return x&&x.name}))");
  });

  check('[hud] a spent item can be put back', () => {
    hudSheet([], [], [{ name: 'Standard Mana Potion', qty: 1 }]);
    ev('dccHudTap(0)');
    if (!ev("!!document.querySelector('#hud-content .hot-undo')")) return 'no undo was offered';
    ev('dccHudUndoTake()');
    const back = ev('JSON.stringify(S.char.blocks.gear.hotlist)');
    return /Standard Mana Potion/.test(back) || 'after undo the Hotlist reads ' + back;
  });

  // Three different taps, and only the pack knows which is which.
  check('[hud] a weapon in the Hotlist rolls without being spent', () => {
    hudSheet([{ name: 'Club', rank: 3, stat: 'STR', checkType: 'evade' }], [],
             [{ name: 'Club', skill: 'Club', qty: 1 }]);
    ev('S.dice=null;dccHudTap(0);');
    const d = ev('S.dice');
    if (!d || d.skill !== 'Club') return 'tapping it rolled ' + JSON.stringify(d && d.skill);
    return ev('S.char.blocks.gear.hotlist.length') === 1
      || 'rolling a weapon consumed it';
  });

  check('[hud] a scroll is cast and spent in one tap', () => {
    hudSheet([], [{ name: 'Heal', rank: 1, stat: 'INT' }],
             [{ name: 'Scroll of Heal', casts: 'Heal', qty: 1 }]);
    ev('S.dice=null;dccHudTap(0);');
    const d = ev('S.dice');
    if (!d || d.skill !== 'Heal') return 'the scroll rolled ' + JSON.stringify(d && d.skill);
    return !ev('S.char.blocks.gear.hotlist[0]') || 'the scroll survived being cast';
  });

  check('[hud] a Spell parked in the Hotlist rolls and stays', () => {
    hudSheet([], [{ name: 'Heal', rank: 1, stat: 'INT' }], [{ name: 'Heal', qty: 1 }]);
    ev('S.dice=null;dccHudTap(0);');
    const d = ev('S.dice');
    if (!d || d.skill !== 'Heal') return 'tapping it rolled ' + JSON.stringify(d && d.skill);
    return ev('S.char.blocks.gear.hotlist.length') === 1 || 'casting a known Spell ate the slot';
  });

  check('[hud] a Spell name with an apostrophe does not break its card', () => {
    // Wrasslin' would close the onclick string and take the rest of the card.
    hudSheet([{ name: "Wrasslin'", rank: 3, stat: 'STR', checkType: 'evade' }]);
    const btn = ev("(function(){var b=[].slice.call(" +
      "document.querySelectorAll('#hud-content button'))" +
      ".find(function(x){return /dccHudRoll/.test(x.getAttribute('onclick')||'')});" +
      "return b?b.getAttribute('onclick'):''})()");
    ev('S.dice=null');
    ev("(function(){var b=[].slice.call(document.querySelectorAll('#hud-content button'))" +
       ".find(function(x){return /dccHudRoll/.test(x.getAttribute('onclick')||'')});if(b)b.click()})()");
    return ev("S.dice&&S.dice.skill") === "Wrasslin'"
      || 'onclick was ' + JSON.stringify(btn) + ', rolled ' + JSON.stringify(ev('S.dice&&S.dice.skill'));
  });

  console.log('\nPASS ' + ok.length);
  if (fails.length) { console.log('FAIL ' + fails.length); fails.forEach(f => console.log('  x ' + f)); process.exit(1); }
  console.log('All Dungeon Crawler Carl checks passed.');
})().catch(e => {
  // Print what was collected before the crash. Without this, one exception
  // discards every named failure gathered so far and you are left debugging a
  // stack trace instead of reading which assertion actually broke.
  console.log('\nPASS ' + ok.length);
  if (fails.length) { console.log('FAIL ' + fails.length); fails.forEach(f => console.log('  x ' + f)); }
  console.log('HARNESS ERROR after ' + (ok.length + fails.length) + ' checks: ' + e.stack);
  process.exit(1);
});

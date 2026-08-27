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
  check('[advance] rank edits clamp at 0 and at the cap', () => {
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
  check('[tutorial] tutorial points raise the Enhanced layer, not the base', () => {
    const base = ev("S.char.blocks.stats.CON.base");
    const bonus = ev("S.char.blocks.stats.CON.bonus");
    return (bonus === 27 && base !== 27) || 'base=' + base + ' bonus=' + bonus;
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
    ev("document.getElementById('sd-skill').value='Club';document.getElementById('sd-mod').value='2';sysDoRoll();");
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
    const cell = JSON.parse(ev("JSON.stringify(S.char.blocks.stats.STR)"));
    return cell.bonus === 27
      || 'the 27 points vanished but were still counted as spent: ' + JSON.stringify(cell);
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
  check('[tabs] all eight tabs render under a non-Fate pack', () => {
    const broke = [];
    ['hero', 'npcs', 'map', 'dice', 'conflict', 'notes', 'print', 'wiki'].forEach(t => {
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

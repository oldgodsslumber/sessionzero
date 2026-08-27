// Dungeon Crawler Carl pack: the rules maths, the two new block contracts, and
// system selection. Every expected value here is taken from the Core Rulebook
// (Royal Court Edition) with the page noted, so a failure means either the pack
// is wrong or the book was misread — not that the test drifted.
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadAppHTML } = require('./loadapp');
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
function eq(a, b, name) {
  if (a === b) ok.push(name);
  else fails.push(name + ' -> got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b));
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
  return new Promise(res => setTimeout(() => res({ w: dom.window, errs }), 500));
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
  eq(ev("document.getElementById('theme-wrap').style.display"), 'none', '[theme] a pack with no themes gets no swatch row');
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
    const c = JSON.parse(raw);
    if (c.systemId !== 'dungeon-crawler-carl') return 'wrong systemId ' + c.systemId;
    if (!c.blocks || !c.blocks.stats || c.blocks.stats.STR.base !== 9) return 'stats not persisted';
    return true;
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
})().catch(e => { console.log('HARNESS ERROR: ' + e.stack); process.exit(1); });

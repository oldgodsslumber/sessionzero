// Dungeon Crawler Carl pack: the rules maths, the two new block contracts, and
// system selection. Every expected value here is taken from the Core Rulebook
// (Royal Court Edition) with the page noted, so a failure means either the pack
// is wrong or the book was misread — not that the test drifted.
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadAppHTML } = require('./loadapp');

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

function boot(search) {
  const errs = [];
  const vc = new VirtualConsole().on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(loadAppHTML(), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'http://localhost/' + (search || ''), virtualConsole: vc,
  });
  dom.window.alert = () => {}; dom.window.confirm = () => true;
  return new Promise(res => setTimeout(() => res({ w: dom.window, errs }), 500));
}

(async function () {
  // ── selection defaults to Daring Comics; ?system= switches ────────────────
  const dc = await boot('');
  eq(dc.errs.length, 0, '[boot] no uncaught errors with the packs loaded');
  eq(dc.w.eval('SYS.id'), 'daring-comics', '[select] default stays Daring Comics');
  eq(dc.w.eval('sysUsesBlocks()'), false, '[select] Daring Comics has no blocks -> legacy sheet');
  eq(dc.w.eval("lex('universe')"), 'Universe', '[lexicon] DC keeps its comic words');

  const g = await boot('?system=dungeon-crawler-carl');
  eq(g.errs.length, 0, '[boot] no uncaught errors on the DCC pack');
  const w = g.w, ev = s => w.eval(s);
  eq(ev('SYS.id'), 'dungeon-crawler-carl', '[select] ?system= selects DCC');
  eq(ev('sysUsesBlocks()'), true, '[select] DCC declares blocks -> block sheet');
  eq(ev("lex('hero')"), 'Crawler', '[lexicon] hero -> Crawler');
  eq(ev("lex('region')"), 'Neighborhood', '[lexicon] region -> Neighborhood');
  eq(ev("sysKey('saves')"), 'rpg:dungeon-crawler-carl:saves', '[storage] keys namespace per system');

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

  // ── a block pack must never write into a Daring Comics save file ─────────
  // save() persists the whole state object, so if a DCC crawler sat in S.char
  // while a DC save was loaded, saving would overwrite that character.
  check('[isolation] a block pack does not touch the loaded save file', () => {
    ev("loadUniverses();var u=U.universes[0]||createUniverse('T');");
    ev("SYS=SYSTEMS['daring-comics'];");
    ev("S=defaultState();S.universeId=U.universes[0].id;S.char={costumedName:'Captain Valor',skills:{}};");
    ev("var id=createSave(S);currentSaveId=id;window.__probeId=id;save();");
    const before = ev("JSON.stringify(getSaveData(window.__probeId).char.costumedName)");
    if (before !== '"Captain Valor"') return 'setup failed, got ' + before;
    // switch to the block pack and mutate the crawler hard
    ev("SYS=SYSTEMS['dungeon-crawler-carl'];renderHero();");
    ev("S.char.blocks.stats={STR:{base:9,bonus:0}};save();");
    ev("poolAdj('aiFavor',1);");
    const after = ev("JSON.stringify(getSaveData(window.__probeId).char.costumedName)");
    if (after !== '"Captain Valor"') return 'the DC save was clobbered: ' + after;
    return true;
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

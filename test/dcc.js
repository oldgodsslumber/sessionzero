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
  ev("dccAssignStat('INT',6)");     // 6 was on STR, so STR should be cleared
  check('[wizard] an array value can only be held by one Stat', () =>
    ev("(S.char.blocks.stats.STR||{}).base") === 0 || 'STR still holds 6');
  ev("dccAssignStat('STR',2)");
  eq(ev('wizValidate(S.char,3)'), true, '[wizard] screen 4 satisfied once INT is high enough');

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
    ev("S.char=SYS.newCharacter();S.char.blocks={skills:{skills:[{name:'Bow',rank:2,stat:'DEX'}]}};");
    const no = ev("JSON.stringify(dccMeetsPrereq(S.char,dccRace('amazonian')))");
    ev("S.char.blocks.skills.skills[0].rank=5;");
    const yes = ev("JSON.stringify(dccMeetsPrereq(S.char,dccRace('amazonian')))");
    if (JSON.parse(no).ok !== false) return 'Rank 2 was allowed: ' + no;
    if (JSON.parse(yes).ok !== true) return 'Rank 5 was refused: ' + yes;
    return true;
  });
  check('[rc] an entry with no prerequisite is always available', () => {
    const r = ev(`JSON.stringify(dccMeetsPrereq(S.char,DCC_RACES.find(x=>!x.prerequisites)))`);
    return JSON.parse(r).ok === true || r;
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

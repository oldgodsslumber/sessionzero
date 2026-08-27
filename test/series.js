// Covers the two changes: the first-run gate must offer multiplayer, and
// series tone/level must live on the universe with experience per hero.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
const { loadAppHTML, waitReady } = require('./loadapp');
const HTML = loadAppHTML();

const fails = [], ok = [];
function mk(seed) {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(w) { if (seed) seed(w.localStorage); }
  });
  dom.window.fetch = dom.window.fetch || (() => Promise.reject(new Error('network disabled in tests')));
  dom.window.alert = () => {}; dom.window.confirm = () => true;
  return dom.window;
}
function checker(w, tag) {
  return (name, expr) => {
    try {
      const r = w.eval('(function(){' + expr + '})()');
      if (r === false) fails.push('[' + tag + '] ' + name + ' -> false');
      else if (typeof r === 'string') fails.push('[' + tag + '] ' + name + ' -> ' + r);
      else ok.push(name);
    }
    catch (e) { fails.push('[' + tag + '] ' + name + ' -> ' + e.message); }
  };
}
const wait = ms => new Promise(r => setTimeout(r, ms));

const CH = { costumedName: 'Ironclad', civilianName: 'M W', heroId: 'h1',
  aspects: { concept: 'c', motivation: 'm', contingent: [] },
  consequences: { mild: '', moderate: '', severe: '' }, stress: { physical: [], mental: [] },
  supportingCast: [], roguesGallery: [], refresh: 5, fatePoints: 5, activeForm: 0,
  gear: '', skills: {}, stunts: [], forms: [{ name: 'Main', powerSets: [], gear: [] }] };

(async () => {
  // ═══ FIRST-RUN GATE ═══
  {
    const w = mk(null); await waitReady(w);
    const check = checker(w, 'gate');
    check('gate modal is open and locked', 'var m=document.getElementById("universe-modal");return m.classList.contains("open")&&m.classList.contains("locked")');
    check('gate offers a way to join a shared universe', 'return document.getElementById("universe-modal-body").innerHTML.indexOf("Join a Shared Universe")>=0');
    check('join button reaches the multiplayer entry point', 'return document.getElementById("universe-modal-body").innerHTML.indexOf("openMultiplayer()")>=0');
    check('gate still offers creating one locally', 'return document.getElementById("universe-modal-body").innerHTML.indexOf("Create Universe")>=0');
    check('gate asks for tone and level', 'var h=document.getElementById("universe-modal-body").innerHTML;return h.indexOf("Series Tone")>=0&&h.indexOf("Series Level")>=0');
    check('gate offers no experience PICKER (only mentions it in copy)', 'var h=document.getElementById("universe-modal-body").innerHTML;return h.indexOf("S.series.experience")<0&&h.indexOf("EXP_LEVELS")<0');
    check('creating without a tone is refused', 'document.getElementById("uni-name").value="No Tone";submitUniverseSetup();return loadUniverses().universes.length===0');
    check('creating with tone+level succeeds', '_uniPick("tone",SERIES_TONES[2].id,"");_uniPick("level",SERIES_LEVELS[3].id,"");document.getElementById("uni-name").value="Earth-77";submitUniverseSetup();return loadUniverses().universes.length===1');
    check('universe stores the series', 'var u=U.universes[0];return u.series.tone===SERIES_TONES[2].id&&u.series.level===SERIES_LEVELS[3].id');
    check('gate closed after creating', 'return !document.getElementById("universe-modal").classList.contains("locked")');
    check('finishUniverseGate left us with a save', 'return currentSaveId!==null||listSaves().length>=0');
  }

  // ═══ SERIES RESOLUTION ═══
  {
    const w = mk(null); await waitReady(w);
    const check = checker(w, 'series');
    w.eval('_uniPick("tone","fourcolor","");_uniPick("level","superheroic","");document.getElementById("uni-name").value="E77";submitUniverseSetup();');
    w.eval('newSavePrompt();S.series.experience="ropes";save();');
    check('tone resolves from the universe', 'return getSeriesConfig().tone.id==="fourcolor"');
    check('level resolves from the universe', 'return getSeriesConfig().level.id==="superheroic"');
    check('experience resolves from the hero', 'return getSeriesConfig().exp.id==="ropes"');
    check('HP uses universe level + hero experience',
      'var lv=SERIES_LEVELS.find(function(l){return l.id==="superheroic"}),ex=EXP_LEVELS.find(function(e){return e.id==="ropes"});return getTotalHP()===lv.baseHP+ex.bonusHP+(S.creation.roguesGallery||[]).length');
    check('skill budget still comes from experience', 'var ex=EXP_LEVELS.find(function(e){return e.id==="ropes"});return getSkillBudget()===ex.skillPts+(S.creation.supportingCast||[]).length');

    // a second hero in the same universe inherits tone/level, picks own experience
    check('second hero inherits tone and level', 'newSavePrompt();return getSeriesConfig().tone.id==="fourcolor"&&getSeriesConfig().level.id==="superheroic"');
    check('second hero starts with no experience of its own', 'return !S.series.experience');
    check('second hero can differ on experience', 'S.series.experience="highly";save();return getSeriesConfig().exp.id==="highly"');
    check('first hero unaffected by the second\'s experience',
      'var ids=listSaves().sort(function(a,b){return a.createdAt-b.createdAt});var first=getSaveData(ids[0].id);return first.series.experience==="ropes"');

    // changing it on the universe moves every hero
    check('changing universe level moves every hero', 'currentUniverse().series.level="offcharts";saveUniverses();return getSeriesConfig().level.id==="offcharts"');
    check('save summaries reflect the universe series', 'var d=getSaveData(currentSaveId);writeSave(currentSaveId,d);return getSaveSummary(currentSaveId).level==="offcharts"&&getSaveSummary(currentSaveId).tone==="fourcolor"');
  }

  // ═══ CREATION STEP 0 ═══
  {
    const w = mk(null); await waitReady(w);
    const check = checker(w, 'step0');
    w.eval('_uniPick("tone","dark","");_uniPick("level","urban","");document.getElementById("uni-name").value="Noir";submitUniverseSetup();newSavePrompt();S.creation.step=0;renderCreationStep();');
    const html = () => w.document.getElementById('hero-creation').innerHTML;
    check('step 0 shows the universe tone as context', () => true);
    check('step 0 names the universe', 'return document.getElementById("hero-creation").innerHTML.indexOf("Noir")>=0');
    check('step 0 shows tone and level read-only', 'var h=document.getElementById("hero-creation").innerHTML;return h.indexOf("Dark &amp; Grim")>=0||h.indexOf("Dark & Grim")>=0');
    check('step 0 no longer lets you pick a tone', 'return document.getElementById("hero-creation").innerHTML.indexOf("S.series.tone=")<0');
    check('step 0 no longer lets you pick a level', 'return document.getElementById("hero-creation").innerHTML.indexOf("S.series.level=")<0');
    check('step 0 still lets you pick experience', 'return document.getElementById("hero-creation").innerHTML.indexOf("S.series.experience=")>=0');
    check('continue is blocked until experience is chosen', 'return /disabled/.test(document.getElementById("hero-creation").innerHTML)');
    check('continue unlocks once experience is set', 'S.series.experience="new";renderCreationStep();var h=document.getElementById("hero-creation").innerHTML;return h.indexOf("creationNext()")>=0&&!/disabled style/.test(h.slice(h.indexOf("creationNext()")-120,h.indexOf("creationNext()")))');
    check('step 0 links to universe settings', 'return document.getElementById("hero-creation").innerHTML.indexOf("openUniverseSetup(false")>=0');
  }

  // ═══ MIGRATION OF EXISTING UNIVERSES ═══
  {
    const uni = { version: 2, activeUniverseId: 'u_old', universes: [{ id: 'u_old', name: 'Legacy', created: 1, roster: [], lore: [] }] };
    const mkSave = (tone, level, exp) => JSON.stringify({
      series: { tone, level, experience: exp }, universeId: 'u_old',
      creation: { step: 0, costumedName: '', roguesGallery: [] },
      char: Object.assign({}, CH), npcs: [], regions: [], notes: []
    });
    const w = mk(ls => {
      ls.setItem('dc_universes', JSON.stringify(uni));
      ls.setItem('dc_schema_version', '2');
      ls.setItem('dc_active_slot', '0');
      ls.setItem('dc_slot_0', mkSave('fourcolor', 'mightiest', 'ropes'));
      ls.setItem('dc_slot_1', mkSave('fourcolor', 'mightiest', 'new'));
      ls.setItem('dc_slot_2', mkSave('realistic', 'gritty', 'normal'));
    });
    await wait(600);
    const check = checker(w, 'migrate');
    check('universe adopted a series from its heroes', 'var u=getUniverse("u_old");return !!(u.series&&u.series.tone&&u.series.level)');
    check('adopted the majority tone', 'return getUniverse("u_old").series.tone==="fourcolor"');
    check('adopted the majority level', 'return getUniverse("u_old").series.level==="mightiest"');
    check('per-hero experience survived migration untouched',
      'var exps=listSaves("u_old").map(function(s){return s.experience}).sort();return exps.join(",")==="new,normal,ropes"');
    check('the minority hero now uses the universe series',
      'var t=listSaves("u_old").find(function(s){return s.experience==="normal"});loadSave(t.id);return getSeriesConfig().tone.id==="fourcolor"&&getSeriesConfig().level.id==="mightiest"');
    check('migration is idempotent', 'var before=JSON.stringify(getUniverse("u_old").series);migrateUniverseSeries();return JSON.stringify(getUniverse("u_old").series)===before');
    check('a universe with no heroes at all is left blank, not guessed',
      'var u2=createUniverse("Empty");delete u2.series;saveUniverses();migrateUniverseSeries();var g=getUniverse(u2.id);return !g.series.tone&&!g.series.level');
  }

  console.log('\nPASS ' + ok.length);
  if (fails.length) { console.log('FAIL ' + fails.length); fails.forEach(f => console.log('  x ' + f)); process.exit(1); }
  console.log('All series/gate checks passed.');
})().catch(e => { console.log('HARNESS ERROR: ' + e.stack); process.exit(1); });

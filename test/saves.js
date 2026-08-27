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
  dom.window.confirm = () => true;
  dom.window.fetch = dom.window.fetch || (() => Promise.reject(new Error('network disabled in tests')));
  dom.window.alert = () => {};
  return dom.window;
}
function checker(w, tag) {
  return function (name, expr) {
    try {
      const r = w.eval('(function(){' + expr + '})()');
      if (r === false) fails.push('[' + tag + '] ' + name + ' -> false');
      else if (typeof r === 'string') fails.push('[' + tag + '] ' + name + ' -> ' + r);
      else ok.push(name);
    } catch (e) { fails.push('[' + tag + '] ' + name + ' -> ' + e.message); }
  };
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// A pre-update install: universes already exist (schema 2) with 3 slots used.
function legacySeed(ls) {
  const uni = { version: 2, activeUniverseId: 'u_test', universes: [{ id: 'u_test', name: 'Earth-77', created: 1, roster: [] }] };
  ls.setItem('dc_universes', JSON.stringify(uni));
  ls.setItem('dc_schema_version', '2');
  ls.setItem('dc_active_slot', '2');
  const mkSlot = nm => JSON.stringify({
    series: { tone: '', level: '', experience: '' }, universeId: 'u_test',
    creation: { step: 0, costumedName: '', roguesGallery: [] },
    char: { costumedName: nm, civilianName: nm + ' Civ', heroId: 'h_' + nm,
      aspects: { concept: 'A Hero', motivation: 'Do Good', contingent: [] }, consequences: { mild: '', moderate: '', severe: '' }, stress: { physical: [false,false], mental: [false,false] }, supportingCast: [], roguesGallery: [], refresh: 5, fatePoints: 5, activeForm: 0, gear: '', forms: [{ name: 'Main', powerSets: [{ powers: [{ powerId: 'flight', level: 1 }] }] }], skills: {}, stunts: [] },
    npcs: [], regions: [], notes: []
  });
  ls.setItem('dc_slot_0', mkSlot('Alpha'));
  ls.setItem('dc_slot_1', mkSlot('Beta'));
  ls.setItem('dc_slot_2', mkSlot('Gamma'));
}

(async () => {
  // ═══ MIGRATION ═══
  {
    const w = mk(legacySeed); await waitReady(w);
    const check = checker(w, 'migrate');
    check('all 3 legacy slots became save files', 'return listSaves().length===3');
    check('names survived', 'var n=listSaves().map(function(s){return s.name}).sort();return n.join(",")==="Alpha,Beta,Gamma"');
    check('universeId survived', 'return listSaves().every(function(s){return s.universeId==="u_test"})');
    check('dc_active_slot=2 became the active save', 'return getSaveSummary(currentSaveId).name==="Gamma"');
    check('character data intact, not just the summary', 'var d=getSaveData(currentSaveId);return d.char.civilianName==="Gamma Civ"&&d.char.forms[0].powerSets[0].powers.length===1');
    check('legacy keys kept as a safety net', 'return !!localStorage.getItem("dc_slot_0")&&!!localStorage.getItem("dc_slot_2")');
    check('schema version bumped to 3', 'return localStorage.getItem("dc_schema_version")==="3"');
    check('one localStorage key per save', 'var n=0;for(var i=0;i<localStorage.length;i++){if((localStorage.key(i)||"").indexOf("dc_save_")===0)n++}return n===3');
    check('migration is idempotent', 'var n=listSaves().length;migrateSlotsToSaves();return listSaves().length===n');
    check('re-migration after a manual version reset makes no duplicates', 'localStorage.setItem("dc_schema_version","2");migrateSlotsToSaves();return listSaves().length===3');
    check('cleanup removes legacy, keeps saves', 'cleanupLegacySlots();return legacySlotCount()===0&&listSaves().length===3&&!!getSaveData(currentSaveId)');
    check('cleanup drops dc_active_slot too', 'return localStorage.getItem("dc_active_slot")===null');
    check('universeHeroCount reads the manifest', 'return universeHeroCount("u_test")===3');
  }

  // ═══ FRESH INSTALL (no legacy data at all) ═══
  {
    const w = mk(null); await waitReady(w);
    const check = checker(w, 'fresh');
    check('universe gate shown, no saves yet', 'return listSaves().length===0');
    check('creating a universe boots cleanly', '_uniPick("tone","fourcolor","");_uniPick("level","superheroic","");document.getElementById("uni-name").value="New World";submitUniverseSetup();return loadUniverses().universes.length===1');
    check('no phantom save files invented', 'return listSaves().length===0&&currentSaveId===null');
    check('new character creates a save', 'newSavePrompt();return listSaves().length===1&&currentSaveId!==null');
  }

  // ═══ GROWING LIST + CRUD ═══
  {
    const w = mk(legacySeed); await waitReady(w);
    const check = checker(w, 'crud');
    check('past 10 saves without a cap', 'for(var i=0;i<25;i++){var st=defaultState();st.universeId="u_test";st.char={costumedName:"Hero "+i,aspects:{concept:"c",motivation:"m",contingent:[{cat:"",text:""},{cat:"",text:""},{cat:"",text:""}]},consequences:{mild:"",moderate:"",severe:""},stress:{physical:[],mental:[]},supportingCast:[],roguesGallery:[],refresh:5,fatePoints:5,activeForm:0,gear:"",forms:[],skills:{},stunts:[]};createSave(st)}return listSaves().length===28');
    check('order array matches save count', 'return SV.order.length===28&&Object.keys(SV.saves).length===28');
    check('list sorted newest-first in the modal', 'openSlotModal();var h=document.getElementById("slot-modal-body").innerHTML;return h.indexOf("Hero 24")<h.indexOf("Hero 0")');
    check('modal shows every save', 'var h=document.getElementById("slot-modal-body").innerHTML;return h.indexOf("Hero 12")>=0&&h.indexOf("Alpha")>=0');
    check('switching save loads its character', 'var t=listSaves().find(function(s){return s.name==="Hero 7"});selectSave(t.id);return S.char.costumedName==="Hero 7"&&currentSaveId===t.id');
    check('switching persists as active', 'return SV.activeId===currentSaveId');
    check('duplicate makes an independent copy', 'var n=listSaves().length;var t=listSaves().find(function(s){return s.name==="Hero 7"});var nid=duplicateSave(t.id);var a=getSaveData(t.id),b=getSaveData(nid);b.char.costumedName="Changed";writeSave(nid,b);return listSaves().length===n+1&&getSaveData(t.id).char.costumedName==="Hero 7"');
    check('duplicate gets a fresh heroId', 'var c=listSaves().find(function(s){return s.name==="Changed"});return getSaveData(c.id).char.heroId!==getSaveData(listSaves().find(function(s){return s.name==="Hero 7"}).id).char.heroId');
    check('rename updates the save and the summary', 'var t=listSaves().find(function(s){return s.name==="Changed"});var d=getSaveData(t.id);d.char.costumedName="Renamed";writeSave(t.id,d);return getSaveSummary(t.id).name==="Renamed"');
    check('delete removes blob and manifest row', 'var t=listSaves().find(function(s){return s.name==="Renamed"});var id=t.id;deleteSave(id);return !getSaveData(id)&&!getSaveSummary(id)&&SV.order.indexOf(id)<0');
    check('deleting the ACTIVE save falls back to another', 'var id=currentSaveId;deleteSavePrompt(id);return currentSaveId!==null&&currentSaveId!==id&&!!S');
    check('deleting the last save leaves a clean slate', 'listSaves().slice().forEach(function(s){deleteSave(s.id)});currentSaveId=null;S=defaultState();return listSaves().length===0');
  }

  // ═══ SUMMARY ACCURACY ═══
  {
    const w = mk(legacySeed); await waitReady(w);
    const check = checker(w, 'summary');
    check('in-creation save reports its step', 'var st=defaultState();st.universeId="u_test";st.creation.step=3;st.creation.costumedName="Halfway";var id=createSave(st);var s=getSaveSummary(id);return s.started===false&&s.step===3&&s.name==="Halfway"');
    check('creation step renders as a label', 'openSlotModal();return document.getElementById("slot-modal-body").innerHTML.indexOf("step 4 of 7 (Cast)")>=0');
    check('power and form counts computed', 'var st=defaultState();st.universeId="u_test";st.char={costumedName:"Counted",aspects:{concept:"c",motivation:"m",contingent:[{cat:"",text:""},{cat:"",text:""},{cat:"",text:""}]},consequences:{mild:"",moderate:"",severe:""},stress:{physical:[],mental:[]},supportingCast:[],roguesGallery:[],refresh:5,fatePoints:5,activeForm:0,gear:"",forms:[{powerSets:[{powers:[{powerId:"a"},{powerId:"b"}]}]},{powerSets:[{powers:[{powerId:"c"}]}]}],skills:{},stunts:[]};var id=createSave(st);var s=getSaveSummary(id);return s.forms===2&&s.powers===3');
    check('HP computed from series + rogues gallery', 'var st=defaultState();st.universeId="u_test";st.series={tone:"",level:SERIES_LEVELS[1].id,experience:EXP_LEVELS[0].id};st.creation.roguesGallery=[1,2];st.char={costumedName:"HPTest",aspects:{concept:"c",motivation:"m",contingent:[{cat:"",text:""},{cat:"",text:""},{cat:"",text:""}]},consequences:{mild:"",moderate:"",severe:""},stress:{physical:[],mental:[]},supportingCast:[],roguesGallery:[],refresh:5,fatePoints:5,activeForm:0,gear:"",forms:[],skills:{},stunts:[]};var id=createSave(st);return getSaveSummary(id).hp===(SERIES_LEVELS[1].baseHP||0)+(EXP_LEVELS[0].bonusHP||0)+2');
    check('updatedAt advances on write', 'var id=listSaves()[0].id;var t0=getSaveSummary(id).updatedAt;var d=getSaveData(id);d.notes=["x"];writeSave(id,d);return getSaveSummary(id).updatedAt>=t0');
    check('createdAt preserved across writes', 'var id=listSaves()[0].id;var c0=getSaveSummary(id).createdAt;var d=getSaveData(id);writeSave(id,d);return getSaveSummary(id).createdAt===c0');
  }

  // ═══ INDEX DRIFT REPAIR ═══
  {
    const w = mk(legacySeed); await waitReady(w);
    const check = checker(w, 'repair');
    check('orphan blob (import from another tab) is adopted', 'var st=defaultState();st.universeId="u_test";st.char={costumedName:"Orphan",aspects:{concept:"c",motivation:"m",contingent:[{cat:"",text:""},{cat:"",text:""},{cat:"",text:""}]},consequences:{mild:"",moderate:"",severe:""},stress:{physical:[],mental:[]},supportingCast:[],roguesGallery:[],refresh:5,fatePoints:5,activeForm:0,gear:"",forms:[],skills:{},stunts:[]};localStorage.setItem("dc_save_s_orphan",JSON.stringify(st));return saveIndexHealthy()===false');
    check('rebuild picks it up', 'rebuildSaveIndex();return listSaves().some(function(s){return s.name==="Orphan"})&&saveIndexHealthy()');
    check('manifest row with a missing blob is dropped', 'var id=listSaves()[0].id;localStorage.removeItem("dc_save_"+id);rebuildSaveIndex();return !getSaveSummary(id)&&SV.order.indexOf(id)<0');
    check('activeId cleared when its blob vanishes', 'localStorage.removeItem("dc_save_"+currentSaveId);rebuildSaveIndex();return SV.activeId===null');
    check('corrupt manifest JSON recovers to a usable state', 'localStorage.setItem("dc_saves","{{{not json");SV=null;loadSaves();return SV.version===3&&Array.isArray(SV.order)');
    check('rebuild restores everything after manifest loss', 'var n=rebuildSaveIndex();return n>0&&listSaves().length===n');
  }

  // ═══ QUOTA ═══
  {
    const w = mk(legacySeed); await waitReady(w);
    const check = checker(w, 'quota');
    w.eval('window._realSet=Storage.prototype.setItem;window._full=function(k,v){if(String(k).indexOf("dc_save_")===0){var e=new Error("full");e.name="QuotaExceededError";throw e}return window._realSet.call(this,k,v)};');
    check('write failure returns false, not a false success', 'Storage.prototype.setItem=window._full;var r=writeSave(currentSaveId,S);Storage.prototype.setItem=window._realSet;return r===false');
    check('failed save flashes a warning, not "Saved"', 'Storage.prototype.setItem=window._full;save();Storage.prototype.setItem=window._realSet;var el=document.getElementById("save-flash");return el&&el.textContent.indexOf("Saved")<0&&/storage full|Not saved/i.test(el.textContent)');
    check('successful save flashes Saved again', 'save();var el=document.getElementById("save-flash");return el.textContent.indexOf("Saved")>=0');
    check('createSave returns null when storage is full', 'Storage.prototype.setItem=window._full;var id=createSave(defaultState());Storage.prototype.setItem=window._realSet;return id===null');
    check('data unharmed after a failed write', 'return !!getSaveData(currentSaveId)&&getSaveData(currentSaveId).char.costumedName==="Gamma"');
  }

  // ═══ UNIVERSE INTERPLAY + NPC EXPORT + IMPORT ═══
  {
    const w = mk(legacySeed); await waitReady(w);
    const check = checker(w, 'universe');
    check('list scopes to the current universe', 'var u2=createUniverse("Other");var st=defaultState();st.universeId=u2.id;st.char={costumedName:"Elsewhere",aspects:{concept:"c",motivation:"m",contingent:[{cat:"",text:""},{cat:"",text:""},{cat:"",text:""}]},consequences:{mild:"",moderate:"",severe:""},stress:{physical:[],mental:[]},supportingCast:[],roguesGallery:[],refresh:5,fatePoints:5,activeForm:0,gear:"",forms:[],skills:{},stunts:[]};createSave(st);return listSaves("u_test").length===3&&listSaves(u2.id).length===1');
    check('modal footnote counts other universes', 'openSlotModal();return /1 more character/.test(document.getElementById("slot-modal-body").innerHTML)');
    check('deleting a universe unlinks its saves, keeps them', 'var u2=U.universes.find(function(u){return u.name==="Other"});var n=listSaves().length;deleteUniversePrompt(u2.id);return listSaves().length===n&&listSaves().some(function(s){return s.name==="Elsewhere"&&s.universeId===null})');
    check('NPC export creates a new playable save', 'S.npcs.push(ensureId({type:"rogue",name:"Doctor Malice",forms:[{name:"Main",powerSets:[],gear:[]}],activeForm:0,skills:{},aspects:[],stunts:[],stress:[],consequences:{mild:"",moderate:"",severe:""}}));var n=listSaves().length;exportNPCToSlot(S.npcs.length-1);confirmExportNPC(false);return listSaves().length===n+1&&listSaves().some(function(s){return s.name==="Doctor Malice"})');
    check('NPC export did not touch the open game', 'return S.char.costumedName==="Gamma"');
    check('export & switch loads the new save', 'exportNPCToSlot(S.npcs.length-1);confirmExportNPC(true);return S.char.costumedName==="Doctor Malice"&&getSaveSummary(currentSaveId).name==="Doctor Malice"');
    check('hero mirror records sourceSaveId, not a slot number', 'syncHeroToRoster();var m=currentUniverse().roster.find(function(r){return r.fromHero});return m&&m.sourceSaveId===currentSaveId&&m.sourceSlot===undefined');
  }

  console.log('\nPASS ' + ok.length);
  if (fails.length) { console.log('FAIL ' + fails.length); fails.forEach(f => console.log('  x ' + f)); process.exit(1); }
  console.log('All save-system checks passed.');
})().catch(e => { console.log('HARNESS ERROR: ' + e.stack); process.exit(1); });

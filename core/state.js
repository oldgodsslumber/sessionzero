let _heroEditMode=false,_npcEditMode=false;
function toggleHeroEdit(){_heroEditMode=!_heroEditMode;renderSheet();}
function toggleNPCEdit(){_npcEditMode=!_npcEditMode;if(_npcFullMode)renderFullNPCEditor();else renderNPCs();}
function editToggleBtn(on,handler){return `<button class="edit-toggle ${on?'on':''}" onclick="${handler}()" title="${on?'Sheet unlocked \u2014 tap to lock (view only)':'Sheet locked \u2014 tap to edit'}">${on?'\u{1F513} Editing \u2014 tap to lock':'\u{1F512} Locked \u2014 tap to edit'}</button>`;}
function noEditBanner(){return `<div class="no-edit-banner">View only — click <strong style="color:var(--accent)">Locked</strong> at the top to enable edits.</div>`;}
const LOG_TYPES=[
  {key:'main',get label(){return lexU('logBreak')+' Log';},emoji:'\ud83d\udcd6',get placeholder(){return lexU('logBreak')+' log entry...';},desc:'The primary session record \u2014 scene, stakes, and status.'},
  {key:'supplemental',label:'Supplemental',emoji:'\ud83d\udcdd',placeholder:'Additional details...',desc:'An update or addendum. What has changed?'},
  {key:'battle',label:'Battle Report',emoji:'\ud83d\udca5',placeholder:'Combat broke out...',desc:'Combat, crisis, or immediate threat.'},
  {key:'investigation',label:'Investigation',emoji:'\ud83d\udd0d',placeholder:'Clues point to...',desc:'Clues, evidence, detective work.'},
  {key:'personal',label:'Personal Log',emoji:'\ud83d\udcad',placeholder:'Been thinking about...',desc:'Private thoughts, doubts, inner conflict.'},
  {key:'villain',label:'Villain Intel',emoji:'\ud83e\uddb9',placeholder:'Intel on the target...',desc:'Information about an adversary.'},
  {key:'civilian',label:'Civilian Report',emoji:'\ud83d\udce2',placeholder:'Witnesses report...',desc:'Civilian encounters, public reaction, collateral.'},
  {key:'gm',label:'GM Note',emoji:'\ud83c\udfac',placeholder:'Behind the scenes...',desc:'Gamemaster notes and plans.'}
];

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
// Relocated from the map module during the Phase 0 split — defaultState()
// calls it at load time, so it must be declared in this file (per-file
// hoisting no longer reaches across the separate <script> tags).
function defaultRegion(name){
  const cells=Array.from({length:25},(_,i)=>({type:'unknown',isVoid:false,isCurrent:i===12,name:i===12?'':'',icon:'',notes:'',feature:'',subZone:null}));
  // "Downtown" is Daring Comics'. A pack names its own starting ground.
  const first=(typeof SYS!=='undefined'&&SYS&&SYS.map&&SYS.map.firstRegion)||'Downtown';
  return{name:name||first,cells,currentCell:12};
}

// A blank character for THIS game. The shell's own default is a Daring Comics
// hero in miniature — a creation object full of costumed names and aspects — so
// a pack that builds characters its own way says so here and gets its own.
function packNewState(){
  const st=defaultState();
  if(typeof SYS!=='undefined'&&SYS){
    if(typeof SYS.newState==='function'){
      try{return Object.assign(st,SYS.newState()||{});}catch(e){}
    }
    if(typeof SYS.newCharacter==='function'){
      // A pack that builds characters through its own wizard starts with the
      // character present and its creation flag down, which is what its
      // creation screens expect to find.
      try{st.char=SYS.newCharacter();st.creation={step:0,complete:false};}catch(e){}
    }
  }
  return st;
}

function defaultState(){
  return{series:{tone:null,level:null,experience:null},char:null,
    creation:{step:0,costumedName:'',civilianName:'',aspects:{concept:'',motivation:'',contingent:[{cat:'',text:''},{cat:'',text:''},{cat:'',text:''}]},supportingCast:[],roguesGallery:[],skills:{},powerSets:[],stunts:[]},
    team:null,universeId:null,floor:3,npcs:[],regions:[defaultRegion()],activeRegion:0,conflict:{active:false,zones:[],turnOrder:[],currentTurn:0,round:1,log:[]},dice:null,notes:[]};
}
let S=defaultState(),currentSaveId=null;

// ═══════════════════════════════════════════════════════════
// SAVE FILES
// ═══════════════════════════════════════════════════════════
// One localStorage key per save, keyed by id — save() fires on every keystroke
// from the sheet, so a single all-saves blob would re-serialize every character
// on every letter typed. dc_saves is a small manifest of summaries so the save
// list renders from one parse instead of one per character.
//   <ns>saves        {version, activeId, order:[id], saves:{id:summary}}
//   <ns>save_<id>    the full state blob — the source of truth
// where <ns> is dc_ for Daring Comics and rpg:<system>: for every other pack.
// Both games run from the same origin, so they share localStorage. Until now
// they also shared these keys, and Dungeon Crawler Carl would list, load and
// overwrite Daring Comics characters — a crawler booted onto a DC save, and a
// new crawler wrote a blank DC save over the active one.
//
// Daring Comics shipped first and owns the flat dc_* keys. Migrating a live
// browser's saves carries real risk and buys nothing, so it keeps them, and
// every other pack gets its own namespace. sysKey() already does this for the
// scratch key; the save store simply never got the same treatment.
function storeKey(name){
  return (typeof SYS!=='undefined'&&SYS&&SYS.id&&SYS.id!=='daring-comics')
    ? sysKey(name) : 'dc_'+name;
}
function savePrefix(){return storeKey('save_');}

let SV=null;
function loadSaves(){
  if(SV)return SV;
  try{SV=JSON.parse(localStorage.getItem(storeKey('saves')))||null;}catch(e){SV=null;}
  if(!SV||typeof SV!=='object')SV={version:3,activeId:null,order:[],saves:{}};
  if(!Array.isArray(SV.order))SV.order=[];
  if(!SV.saves||typeof SV.saves!=='object')SV.saves={};
  return SV;
}
function persistSaves(){try{localStorage.setItem(storeKey('saves'),JSON.stringify(SV));return true;}catch(e){reportQuota(e);return false;}}
function saveKey(id){return savePrefix()+id;}
function getSaveData(id){try{const d=localStorage.getItem(saveKey(id));return d?JSON.parse(d):null;}catch(e){return null;}}

function _stateHP(st){
  const ids=seriesIdsFor(st);
  const lv=sysList('SERIES_LEVELS').find(l=>l.id===ids.level),ex=sysList('EXP_LEVELS').find(e=>e.id===ids.experience);
  return (lv?.baseHP||0)+(ex?.bonusHP||0)+((st?.creation?.roguesGallery||[]).length);
}
function _statePowerCount(st){
  return ((st?.char?.forms)||[]).reduce((n,f)=>n+((f.powerSets||[]).reduce((m,ps)=>m+((ps.powers||[]).length),0)),0);
}
// Everything the save list needs to draw a row, so it never has to parse blobs.
// What a save row says about a character. The shell knows a save has a name, a
// line or two under it and a progress note; WHICH name and which lines is the
// pack's business — this used to read costumedName, form count and power count
// straight off the state, which is a comic-book hero and nothing else. A pack
// that says nothing gets a name from its own declared identity fields and a
// creation step counted against its own wizard.
function packSummary(state){
  const fn=(typeof SYS!=='undefined'&&SYS&&typeof SYS.saveSummary==='function')?SYS.saveSummary:null;
  if(fn){try{return fn(state)||{};}catch(e){return {};}}
  const ch=state&&state.char;
  const steps=(typeof SYS!=='undefined'&&SYS&&SYS.creation)?SYS.creation.length:0;
  const step=ch?null:((state&&state.creation&&state.creation.step)||0);
  return{
    name:(typeof sysCharName==='function'?sysCharName(ch):'')||'',
    sub:'',
    lines:[],
    icon:(ch&&ch.icon)||'',
    progress:ch?'':(steps?('In creation — step '+(step+1)+' of '+steps):'In creation'),
  };
}

function saveSummary(id,state,prev){
  const ch=state.char,cr=state.creation;
  const p=packSummary(state)||{};
  return{
    id:id,universeId:state.universeId||null,
    // Carried so a reader can tell this save's hero from the mirror of it in
    // the universe roster without parsing the whole save: Print listed the one
    // character twice because it could not.
    heroId:(ch&&ch.heroId)||null,
    name:(p.name||'').trim(),
    civilianName:(p.sub||'').trim(),
    lines:p.lines||[],progress:p.progress||'',
    tone:seriesIdsFor(state).tone,level:seriesIdsFor(state).level,experience:state.series?.experience||'',
    hp:_stateHP(state),forms:(ch?.forms||[]).length,powers:_statePowerCount(state),
    icon:p.icon||'',
    started:!!ch,step:ch?null:(cr?.step||0),
    createdAt:prev?.createdAt||state.createdAt||Date.now(),updatedAt:Date.now()
  };
}
function listSaves(universeId){
  loadSaves();
  let ids=SV.order.filter(id=>SV.saves[id]);
  if(universeId!==undefined&&universeId!==null)ids=ids.filter(id=>SV.saves[id].universeId===universeId);
  return ids.map(id=>SV.saves[id]);
}
function getSaveSummary(id){loadSaves();return SV.saves[id]||null;}

// Quota is the one storage error that actually loses work. It used to be
// swallowed by a bare catch, so a full disk showed "Saved ✓" and dropped the
// sheet. Throttled so a held-down key doesn't fire a hundred alerts.
let _quotaWarnedAt=0;
function reportQuota(e){
  const full=e&&(e.name==='QuotaExceededError'||e.code===22||e.code===1014||/quota/i.test(e.message||''));
  const msg=full?'Storage is full — this change was NOT saved. Delete or export a save file to free space.':('Save failed: '+(e&&e.message||e));
  flashSaveError(full?'Not saved — storage full':'Not saved');
  if(Date.now()-_quotaWarnedAt>30000){_quotaWarnedAt=Date.now();setTimeout(()=>alert(msg),0);}
}

function newSaveId(){return uid('s');}
function writeSave(id,state){
  loadSaves();
  const prev=SV.saves[id];
  try{localStorage.setItem(saveKey(id),JSON.stringify(state));}
  catch(e){reportQuota(e);return false;}
  SV.saves[id]=saveSummary(id,state,prev);
  if(SV.order.indexOf(id)<0)SV.order.push(id);
  return persistSaves();
}
function createSave(state){
  const id=newSaveId();
  const st=state||defaultState();
  st.createdAt=Date.now();
  if(!writeSave(id,st))return null;
  return id;
}
function deleteSave(id){
  loadSaves();
  try{localStorage.removeItem(saveKey(id));}catch(e){}
  delete SV.saves[id];
  SV.order=SV.order.filter(x=>x!==id);
  if(SV.activeId===id)SV.activeId=null;
  persistSaves();
}
function duplicateSave(id){
  const d=getSaveData(id);if(!d)return null;
  const copy=JSON.parse(JSON.stringify(d));
  const f=sysCharNameField();
  const base=((copy.char&&(sysCharName(copy.char)||copy.char[f]))||copy.creation?.[f]||copy.creation?.costumedName||'').trim();
  if(copy.char){copy.char[f]=(base||lexU('hero'))+' (copy)';copy.char.heroId=uid();}
  else if(copy.creation)copy.creation[f]=base?base+' (copy)':'';
  copy.createdAt=Date.now();
  return createSave(copy);
}
function renameSave(id){
  const s=getSaveSummary(id);if(!s)return;
  const n=prompt('Rename this save:',s.name||'');
  if(n===null)return;
  const d=getSaveData(id);if(!d)return;
  const f=sysCharNameField();
  if(d.char)d.char[f]=n.trim();
  else{d.creation=d.creation||{};d.creation[f]=n.trim();}
  writeSave(id,d);
  if(id===currentSaveId){S=d;bindUniverse();renderAll();}
  renderSaveModal();
}

// The blobs are truth; the manifest is a cache. Anything that can desync it —
// an import, a second tab, hand-edited storage — is repaired from the blobs.
function rebuildSaveIndex(){
  loadSaves();
  const pfx=savePrefix();
  const found=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&k.indexOf(pfx)===0)found.push(k.slice(pfx.length));
  }
  const kept=SV.order.filter(id=>found.indexOf(id)>=0);
  found.forEach(function(id){if(kept.indexOf(id)<0)kept.push(id);});
  SV.order=kept;
  const saves={};
  kept.forEach(function(id){
    const d=getSaveData(id);
    if(!d)return;
    saves[id]=saveSummary(id,d,SV.saves[id]);
    if(SV.saves[id]&&SV.saves[id].updatedAt)saves[id].updatedAt=SV.saves[id].updatedAt;
  });
  SV.saves=saves;
  SV.order=SV.order.filter(id=>saves[id]);
  if(SV.activeId&&!saves[SV.activeId])SV.activeId=null;
  persistSaves();
  return SV.order.length;
}
function saveIndexHealthy(){
  loadSaves();
  let n=0;
  const pfx=savePrefix();
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.indexOf(pfx)===0)n++;}
  return n===SV.order.length;
}

// ─── Migration from the old fixed 10 slots ────────────────
function legacySlotKey(n){return'dc_slot_'+n;}
function legacySlotData(n){try{const d=localStorage.getItem(legacySlotKey(n));return d?JSON.parse(d):null;}catch(e){return null;}}
function legacySlotCount(){let c=0;for(let i=0;i<10;i++)if(legacySlotData(i))c++;return c;}
// Copies rather than moves — the originals stay recoverable until the user
// presses "Clean up old slots" in the save manager.
function migrateSlotsToSaves(){
  loadSaves();
  let v=null;try{v=localStorage.getItem(storeKey('schema_version'));}catch(e){}
  if(v==='3')return 0;
  let moved=0;
  const legacyActive=(function(){try{const a=localStorage.getItem(storeKey('active_slot'));return a===null||a===''?null:parseInt(a);}catch(e){return null;}})();
  for(let i=0;i<10;i++){
    const d=legacySlotData(i);
    if(!d)continue;
    if(SV.order.some(id=>SV.saves[id]&&SV.saves[id].migratedFrom===i))continue;
    const id=newSaveId();
    d.createdAt=d.createdAt||Date.now();
    if(!writeSave(id,d))break;
    SV.saves[id].migratedFrom=i;
    if(legacyActive===i)SV.activeId=id;
    moved++;
  }
  try{localStorage.setItem(storeKey('schema_version'),'3');}catch(e){}
  persistSaves();
  return moved;
}
function cleanupLegacySlots(){
  const n=legacySlotCount();
  if(!n){alert('No old slot data left to clean up.');return;}
  if(!confirm('Delete the '+n+' original slot backup'+(n===1?'':'s')+' from before the save-file update?\n\nYour current save files are not touched. This only removes the old copies, and cannot be undone.'))return;
  for(let i=0;i<10;i++){try{localStorage.removeItem(legacySlotKey(i));}catch(e){}}
  try{localStorage.removeItem(storeKey('active_slot'));}catch(e){}
  renderSaveModal();
}

// The one-time promotion. A pack that used to live on a single scratch key has
// a character and a table state sitting there; both become a proper save file
// the first time the app boots after that stopped being how it works.
//
// The scratch key is READ and left alone. If this goes wrong, the crawler is
// still where it was, and a player who reverts the app finds them.
function migrateScratchToSave(){
  if(typeof sysUsesBlocks!=='function'||!sysUsesBlocks())return null;
  if(listSaves().length)return null;                       // already has files
  const char=(typeof sysScratchLoad==='function')?sysScratchLoad():null;
  if(!char)return null;
  const st=defaultState();
  st.char=char;
  const sess=(typeof sysScratchSession==='function')?sysScratchSession():null;
  if(sess)SYS_SESSION_KEYS.forEach(function(k){
    if(sess[k]===undefined||sess[k]===null)return;
    if(k==='universeId'&&!getUniverse(sess[k]))return;
    st[k]=sess[k];
  });
  if(!st.universeId){
    const u=getUniverse(U&&U.activeUniverseId)||(U&&U.universes&&U.universes[0]);
    if(u)st.universeId=u.id;
  }
  const id=createSave(st);
  if(id===null)return null;
  loadSave(id);
  return id;
}

function save(){
  // Every pack writes save files now. A block pack used to be diverted to a
  // single scratch key, because save() persists the whole of S and a half-built
  // pack would have clobbered whichever file was loaded. It is not half-built
  // any more, and one character per game was never the point.
  //
  // A pack with no save file yet — the first boot after this — gets one, so a
  // crawler somebody is in the middle of playing is promoted rather than lost.
  if(currentSaveId===null&&S&&(S.char||S.creation)){
    const id=createSave(S);
    if(id!==null){currentSaveId=id;loadSaves();SV.activeId=id;persistSaves();}
  }
  if(currentSaveId===null)return;
  const _bound=currentUniverse()&&S.npcs===currentUniverse().roster;
  if(_bound&&S.char)syncHeroToRoster();
  // The table's state goes to the world; the save file keeps the character.
  const _tableMoved=syncTableToUniverse();
  const _n=S.npcs;
  if(_bound)S.npcs=[];
  const okay=writeSave(currentSaveId,S);
  S.npcs=_n;
  if(_bound||_tableMoved)saveUniverses();
  if(okay)flashSaved();
  secondScreenPush();
}
function loadSave(id){
  currentSaveId=id;
  loadSaves();SV.activeId=id;persistSaves();
  const d=getSaveData(id);
  // A blob that parses to a string or a number is truthy, so it used to become
  // S — and because S was then a primitive, every assignment to it silently did
  // nothing and the sheet rendered from undefined. The page came up as a bare
  // nav strip. Only a plain object is a state.
  S=(d&&typeof d==='object'&&!Array.isArray(d))?d:defaultState();
  bindUniverse();
}

// ═══════════════════════════════════════════════════════════
// UNIVERSE STORE (shared, cross-slot, local)
// ═══════════════════════════════════════════════════════════
function uid(p){return (p||'e')+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function ensureId(e){if(e&&!e.id)e.id=uid();return e;}
let U=null;
// The same shape check loadSaves() has always done. Without it a universes key
// of the wrong shape — universes not an array, or a null entry in it — threw in
// migrateUniverseSeries() during boot, which killed every render after it: the
// app came up as a bare nav strip with no gate and no way back in, and a reload
// hit the same throw again. Anything unusable is dropped rather than trusted.
function _validUniverses(o){
  if(!o||typeof o!=='object'||Array.isArray(o))return null;
  if(!Array.isArray(o.universes))return null;
  o.universes=o.universes.filter(function(u){return u&&typeof u==='object'&&u.id;});
  o.universes.forEach(function(u){
    if(!Array.isArray(u.roster))u.roster=[];
    if(!Array.isArray(u.lore))u.lore=[];
    if(!u.series||typeof u.series!=='object')u.series={tone:'',level:''};
    if(u.table&&typeof u.table!=='object')u.table={};
  });
  if(typeof o.version!=='number')o.version=2;
  if(o.activeUniverseId===undefined)o.activeUniverseId=null;
  return o;
}
function loadUniverses(){
  if(U)return U;
  let raw=null;
  try{raw=JSON.parse(localStorage.getItem(storeKey('universes')));}catch(e){raw=null;}
  U=_validUniverses(raw)||{version:2,activeUniverseId:null,universes:[]};
  return U;
}
function saveUniverses(){try{localStorage.setItem(storeKey('universes'),JSON.stringify(U));}catch(e){}}
// Another tab of the same game, writing the world both tabs share. U was cached
// for the life of the page, so this tab held a stale copy and its very next
// save() wrote that whole copy back — silently deleting whatever the other tab
// had added to the roster, the codex, the map or the journal, with no warning
// and no way to get it back. The event fires only in the tabs that did not
// write, which is exactly the set that needs to catch up.
if(typeof window!=='undefined'&&window.addEventListener){
  window.addEventListener('storage',function(ev){
    if(typeof SYS==='undefined'||!SYS)return;
    // key is null when another tab calls localStorage.clear().
    if(ev&&ev.key&&ev.key!==storeKey('universes'))return;
    U=null;loadUniverses();
    if(typeof S!=='undefined'&&S&&typeof bindUniverse==='function')bindUniverse();
    if(typeof renderAll==='function')renderAll();
    if(typeof renderFloorStrip==='function')renderFloorStrip();
  });
}
function getUniverse(id){loadUniverses();return U.universes.find(u=>u.id===id)||null;}
function currentUniverse(){return (typeof S!=='undefined'&&S)?getUniverse(S.universeId):null;}
// Tone and level belong to the world, not the hero — every hero in a universe
// plays at the same power level. Experience stays per-hero.
function createUniverse(name,series){loadUniverses();const u={id:uid('u'),name:(name||'').trim()||'Untitled Universe',created:Date.now(),roster:[],lore:[],series:{tone:(series&&series.tone)||'',level:(series&&series.level)||''}};U.universes.push(u);U.activeUniverseId=u.id;saveUniverses();return u;}
function universeHeroCount(id){return listSaves(id).length;}
function deleteUniverse(id){loadUniverses();if(U.universes.length<=1)return false;U.universes=U.universes.filter(u=>u.id!==id);if(U.activeUniverseId===id)U.activeUniverseId=(U.universes[0]||{}).id||null;saveUniverses();return true;}
function upsertRosterEntity(uId,entity){const u=getUniverse(uId);if(!u)return;ensureId(entity);const i=u.roster.findIndex(e=>e.id===entity.id);if(i>=0)u.roster[i]=entity;else u.roster.push(entity);saveUniverses();}
function removeRosterEntity(uId,entityId){const u=getUniverse(uId);if(!u)return;u.roster=u.roster.filter(e=>e.id!==entityId);saveUniverses();}
// Universes created before tone/level moved up have no series. Adopt it from
// the heroes already living there — they all had to agree in practice anyway —
// so nobody has to re-pick, and nothing silently resets to Gritty Realism.
function migrateUniverseSeries(){
  loadUniverses();
  let changed=false;
  U.universes.forEach(function(u){
    if(u.series&&u.series.tone&&u.series.level)return;
    u.series=u.series||{tone:'',level:''};
    const votes={tone:{},level:{}};
    listSaves(u.id).forEach(function(sm){
      const st=getSaveData(sm.id);if(!st||!st.series)return;
      if(st.series.tone)votes.tone[st.series.tone]=(votes.tone[st.series.tone]||0)+1;
      if(st.series.level)votes.level[st.series.level]=(votes.level[st.series.level]||0)+1;
    });
    ['tone','level'].forEach(function(k){
      if(u.series[k])return;
      const best=Object.keys(votes[k]).sort(function(a,b){return votes[k][b]-votes[k][a];})[0];
      if(best){u.series[k]=best;changed=true;}
    });
  });
  if(changed)saveUniverses();
}

// ── the table's own state ───────────────────────────────────────────────────
// The floor you are on, the map you are drawing, the journal and the fight in
// progress belong to the WORLD, not to one character. Two crawlers in the same
// universe are on the same floor of the same dungeon; before this they each
// carried a private copy, so switching character switched maps.
//
// The roster has always worked this way — S.npcs is the universe's roster, not
// a copy of it — and multiplayer already syncs conflict, regions and notes at
// universe scope. This makes the local store agree with both.
const TABLE_KEYS = ['floor', 'regions', 'activeRegion', 'conflict', 'notes'];

function ensureTable(u){
  if(!u)return null;
  if(!u.table)u.table={};
  return u.table;
}

// Adopt whatever the character was carrying the first time a universe is bound,
// so nobody loses the map they drew before the table had one of its own.
function adoptTable(u){
  const t=ensureTable(u);
  TABLE_KEYS.forEach(function(k){
    if(t[k]===undefined&&S[k]!==undefined)t[k]=S[k];
  });
  return t;
}

// S keeps its own names for these, so every renderer and every handler is
// unchanged; the arrays are the SAME arrays the universe holds. Primitives
// cannot alias, so they are copied here and written back by save().
function bindTable(u){
  const t=adoptTable(u);
  TABLE_KEYS.forEach(function(k){
    if(t[k]!==undefined)S[k]=t[k];
    else t[k]=S[k];
  });
  saveUniverses();
}

function syncTableToUniverse(){
  const u=currentUniverse();if(!u)return false;
  const t=ensureTable(u);
  let moved=false;
  TABLE_KEYS.forEach(function(k){
    if(t[k]!==S[k]){t[k]=S[k];moved=true;}
  });
  return moved;
}

function bindUniverse(){loadUniverses();let u=getUniverse(S.universeId);if(!u){u=getUniverse(U.activeUniverseId)||U.universes[0];if(u)S.universeId=u.id;}if(u){(u.roster||[]).forEach(ensureId);S.npcs=u.roster;bindTable(u);}else{S.npcs=S.npcs||[];}}

// ═══════════════════════════════════════════════════════════
// SLOTS
// ═══════════════════════════════════════════════════════════
function openSlotModal(){document.getElementById('slot-modal').classList.add('open');renderSaveModal();}
function closeSlotModal(){document.getElementById('slot-modal').classList.remove('open');}

const CREATION_LABELS=['Series','Names','Aspects','Cast','Skills','Powers','Review'];
function relTime(ts){
  if(!ts)return'';
  const s=Math.floor((Date.now()-ts)/1000);
  if(s<60)return'just now';
  if(s<3600){const m=Math.floor(s/60);return m+' minute'+(m===1?'':'s')+' ago';}
  if(s<86400){const hr=Math.floor(s/3600);return hr+' hour'+(hr===1?'':'s')+' ago';}
  if(s<604800){const d=Math.floor(s/86400);return d+' day'+(d===1?'':'s')+' ago';}
  return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric'});
}
function saveEmblem(sm,active){
  const bg=active?'var(--accent)':'var(--surface3)',fg=active?'#fff':'var(--muted)';
  const inner=sm.icon
    ? `<span class="pw-icon" style="width:24px;height:24px;-webkit-mask-image:url('${pdIconUrl(sm.icon)}');mask-image:url('${pdIconUrl(sm.icon)}')"></span>`
    : (sm.started?esc((sm.name||'?').charAt(0).toUpperCase()):'?');
  return `<div style="width:42px;height:42px;flex:0 0 42px;border-radius:10px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;font-family:var(--font-title);color:${fg}">${inner}</div>`;
}
function saveStatLine(sm){
  const tn=sm.tone?sysList('SERIES_TONES').find(t=>t.id===sm.tone)?.name:'';
  const lv=sm.level?sysList('SERIES_LEVELS').find(l=>l.id===sm.level)?.name:'';
  const ex=sm.experience?sysList('EXP_LEVELS').find(e=>e.id===sm.experience)?.name:'';
  return [sm.civilianName,tn,lv||ex].filter(Boolean).join(' · ');
}
function saveCardHTML(sm,active){
  // Whatever the pack said about it, or — for a save written before packs
  // described themselves — the comic's own line.
  // Where they have got to comes first: a crawler halfway through creation has
  // a Level and a Floor already, and reading those as though they were finished
  // is how a half-built character looks like a playable one.
  const detail=sm.progress?sm.progress
    : (sm.lines&&sm.lines.length)?sm.lines.filter(Boolean).join(' · ')
    : (sm.started
        ? [sm.hp?sm.hp+' HP':'',sm.forms?sm.forms+' form'+(sm.forms===1?'':'s'):'',sm.powers?sm.powers+' power'+(sm.powers===1?'':'s'):''].filter(Boolean).join(' · ')
        : (sm.progress||('In creation — step '+((sm.step||0)+1)+' of 7 ('+(CREATION_LABELS[sm.step||0]||'')+')')));
  let h=`<div class="card-sm" style="display:flex;align-items:center;gap:10px;cursor:pointer${active?';border-color:var(--accent)':''}" onclick="selectSave('${sm.id}')">`;
  h+=saveEmblem(sm,active);
  h+=`<div style="flex:1;min-width:0">`;
  h+=`<div class="fw-700" style="font-size:14px">${esc(sm.name||('(unnamed '+lex('hero')+')'))}</div>`;
  const stat=saveStatLine(sm);
  if(stat)h+=`<div style="font-size:11px;color:var(--muted)">${esc(stat)}</div>`;
  h+=`<div style="font-size:11px;color:var(--muted)">${esc(detail)}</div>`;
  if(sm.updatedAt)h+=`<div style="font-size:10px;color:var(--muted);opacity:.8">Last played ${esc(relTime(sm.updatedAt))}</div>`;
  h+=`</div><div style="display:flex;flex-direction:column;gap:3px" onclick="event.stopPropagation()">`;
  h+=`<button class="btn btn-secondary btn-xs" title="Rename" onclick="renameSave('${sm.id}')">↻</button>`;
  h+=`<button class="btn btn-secondary btn-xs" title="Duplicate" onclick="duplicateSavePrompt('${sm.id}')">⧉</button>`;
  h+=`<button class="btn btn-danger btn-xs" title="Delete" onclick="deleteSavePrompt('${sm.id}')">✕</button>`;
  h+=`</div></div>`;
  return h;
}
function renderSaveModal(){
  loadSaves();
  const u=currentUniverse(),uid_=u?u.id:null;
  const mine=listSaves(uid_).slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  const others=listSaves().filter(s=>s.universeId!==uid_);
  const active=mine.find(s=>s.id===currentSaveId);

  // This modal was half translated: the header above it used the lexicon while
  // the title, the counts and the New button still said "Save Files" and
  // "character" — so a game that calls them Crawler Files and Crawlers said
  // both, inches apart.
  const _one=lex('hero'),_many=lex('heroes');
  let h=`<div class="pg-title" style="font-size:22px">${esc(lexU('saves'))}</div>`+universeChooserHTML();
  h+=`<div style="font-size:11px;color:var(--muted);margin:4px 0 10px">${mine.length} ${esc(mine.length===1?_one:_many)} in this ${esc(lex('universe'))}. Add as many as you like.</div>`;

  if(active){
    h+=`<div class="label mb-1" style="color:var(--accent)">▶ Continue</div>`;
    h+=saveCardHTML(active,true);
    const rest=mine.filter(s=>s.id!==currentSaveId);
    if(rest.length){h+=`<div class="label mb-1" style="margin-top:12px">Other ${esc(lexU('heroes'))}</div>`;rest.forEach(s=>{h+=saveCardHTML(s,false);});}
  }else if(mine.length){
    mine.forEach(s=>{h+=saveCardHTML(s,false);});
  }else{
    h+=`<div class="card tac"><div class="fw-700" style="margin-bottom:4px">No ${esc(_many)} yet</div><div style="font-size:12px;color:var(--muted)">Start one below — you can keep as many as you want in this ${esc(lex('universe'))}.</div></div>`;
  }

  h+=`<button class="btn btn-primary btn-full" style="margin-top:10px" onclick="newSavePrompt()">+ New ${esc(lexU('hero'))}</button>`;

  if(others.length)h+=`<div style="font-size:11px;color:var(--muted);margin-top:8px;text-align:center">${others.length} more ${esc(others.length===1?_one:_many)} in other ${esc(lex('universes'))} — switch ${esc(lex('universe'))} above to see ${others.length===1?'it':'them'}.</div>`;

  h+=`<div class="divider"></div><div style="display:flex;gap:8px"><button class="btn btn-gold btn-sm" style="flex:1" onclick="exportJSON()">Export Current</button><button class="btn btn-secondary btn-sm" style="flex:1" onclick="importJSON()">Import JSON</button></div>`;

  const legacy=legacySlotCount();
  const healthy=saveIndexHealthy();
  if(legacy||!healthy){
    h+=`<div class="card-sm" style="margin-top:10px"><div class="label mb-1">Maintenance</div>`;
    if(!healthy)h+=`<div style="font-size:11px;color:var(--accent);margin-bottom:6px">The save list looks out of sync with stored data.</div><button class="btn btn-secondary btn-sm btn-full" onclick="repairSaveIndex()" style="margin-bottom:6px">Repair save list</button>`;
    if(legacy)h+=`<div style="font-size:11px;color:var(--muted);margin-bottom:6px">${legacy} original slot backup${legacy===1?'':'s'} from before the save-file update ${legacy===1?'is':'are'} still stored. Your save files above are already independent of ${legacy===1?'it':'them'}.</div><button class="btn btn-secondary btn-sm btn-full" onclick="cleanupLegacySlots()">Clean up old slots</button>`;
    h+=`</div>`;
  }
  document.getElementById('slot-modal-body').innerHTML=h;
}
function selectSave(id){if(id===currentSaveId){closeSlotModal();return;}loadSave(id);closeSlotModal();renderAll();}
function newSavePrompt(){
  const u=currentUniverse();
  const st=packNewState();
  if(u)st.universeId=u.id;
  const id=createSave(st);
  if(!id)return;
  loadSave(id);closeSlotModal();renderAll();
}
function duplicateSavePrompt(id){
  const sm=getSaveSummary(id);if(!sm)return;
  if(!confirm('Make a copy of "'+(sm.name||'this character')+'"?'))return;
  const nid=duplicateSave(id);
  if(nid)renderSaveModal();
}
function deleteSavePrompt(id){
  const sm=getSaveSummary(id);if(!sm)return;
  if(!confirm('Delete "'+(sm.name||'this character')+'"? This cannot be undone.'))return;
  const wasCurrent=(id===currentSaveId);
  deleteSave(id);
  if(wasCurrent){
    const next=listSaves(currentUniverse()?.id).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))[0];
    if(next)loadSave(next.id);
    else{currentSaveId=null;S=defaultState();bindUniverse();}
  }
  renderSaveModal();renderAll();
}
function repairSaveIndex(){const n=rebuildSaveIndex();alert('Save list rebuilt from stored data — '+n+' save file'+(n===1?'':'s')+' found.');renderSaveModal();}

// ═══════════════════════════════════════════════════════════
// UNIVERSE UI (naming gate, manager, bar)
// ═══════════════════════════════════════════════════════════
let _uniRequired=false;
function refreshUniverseUI(){try{renderHero();}catch(e){}try{if(document.getElementById('npcs-content'))renderNPCs();}catch(e){}try{if(document.getElementById('wiki-content'))renderWiki();}catch(e){}}
function universeBarHTML(){const u=currentUniverse();const nm=u?u.name:('No '+lex('universe'));return `<div class="uni-bar" onclick="openUniverseManager()" title="Your game world — tap to manage ${esc(lex('universes'))}"><span class="uni-ico">\u{1F30C}</span><span class="uni-name">${esc(nm)}</span>${_uniFloorHTML()}<span class="uni-caret">▾</span></div>`;}
// A pack whose lexicon renames the log break to something the table tracks —
// Dungeon Crawler Carl's Floor — shows it here, because that is the clock.
// The floor lives in the strip above the pages, where it is visible on every
// tab. Two controls for one number is one too many, so the bar no longer
// carries its own.
function _uniFloorHTML(){ return ''; }

// Descending is the normal direction, so + goes down a floor. Everything that
// reads the floor is redrawn, which is most of the sheet.
function sysFloorStep(delta){
  if(!S)return;
  const next=Math.max(1,(Number(S.floor)||1)+delta);
  if(next===S.floor)return;
  S.floor=next;
  save();
  if(typeof renderFloorStrip==='function')renderFloorStrip();
  if(typeof renderAll==='function')renderAll();
  else{
    if(typeof renderHero==='function')try{renderHero();}catch(e){}
    if(typeof renderConflict==='function'&&document.getElementById('conflict-content'))try{renderConflict();}catch(e){}
    if(typeof renderNPCs==='function'&&document.getElementById('npcs-content'))try{renderNPCs();}catch(e){}
  }
}
function universeChooserHTML(){loadUniverses();const act=U.activeUniverseId;return `<div class="card-sm" style="display:flex;align-items:center;gap:8px;margin-top:8px"><span style="font-size:11px;color:var(--muted);white-space:nowrap">New ${esc(lex('heroes'))} join</span><select style="flex:1" onchange="U.activeUniverseId=this.value;saveUniverses();renderSaveModal()">${U.universes.map(u=>`<option value="${u.id}" ${u.id===act?'selected':''}>${esc(u.name)}</option>`).join('')}<\/select><button class="btn btn-secondary btn-xs" onclick="openUniverseManager()">Manage<\/button><\/div>`;}
function closeUniverseModal(){const m=document.getElementById('universe-modal');if(m)m.classList.remove('open','locked');}
function openUniverseSetup(required,editId,repaint){
  _uniRequired=!!required;
  const ed=editId?getUniverse(editId):null;
  // A new universe's picks live on the draft until it is created — highlight
  // from there, or a picked box shows no selection (only the hover outline on
  // the box last tapped, so one box looked lit across both sections). A fresh
  // open resets it, so a cancelled setup's picks don't carry over.
  if(!ed&&!repaint)_uniDraft={tone:'',level:''};
  const cur=ed?(ed.series||{}):_uniDraft;
  // Tone and level are Daring Comics' world settings, not the shell's. A pack
  // that has no series model (Dungeon Crawler Carl) supplies neither list, and
  // rendering the empty grids anyway left the first-run gate with nothing to
  // click and no way to satisfy it — the app could not be started at all.
  // `worldNext` is the pack's "what happens next" line, so it belongs on the
  // first run only: on Settings for a world you already play in it was telling
  // you to go and pick a character you picked hours ago.
  const tones=sysList('SERIES_TONES'),levels=sysList('SERIES_LEVELS');
  const hasSeries=tones.length>0&&levels.length>0;
  let h=`<div class="card"><div class="pg-title" style="font-size:22px">${ed?(lexU('universe')+' Settings'):(required?esc(lexOpt('registerWorld')||('Name Your '+lexU('universe'))):('New '+lexU('universe')))}</div>`;
  h+=`<div style="font-size:12px;color:var(--muted);margin:6px 0 12px">A ${lex('universe')} is your shared game world. Every ${lex('hero')}, ${lex('npc')} and wiki entry in it is shared.${hasSeries?' Its tone and power level apply to every '+lex('hero')+' here.':''}${(required&&lexOpt('worldNext'))?' '+esc(lexOpt('worldNext')):''}</div>`;
  h+=`<div class="form-group"><label>${esc(lexU('universe'))} Name</label><input id="uni-name" value="${esc(ed?ed.name:'')}" placeholder="${esc(lexOpt('universeHint')||'e.g. Marvel, My City, Earth-27')}" onkeydown="if(event.key==='Enter')submitUniverseSetup('${editId||''}')"><\/div>`;
  if(hasSeries){
  h+=`<div class="label">Series Tone</div><div class="grid-3 mb-3">`;
  sysList('SERIES_TONES').forEach(function(t){h+=`<div class="game-opt ${cur.tone===t.id?'selected':''}" onclick="_uniPick('tone','${t.id}','${editId||''}')"><div class="opt-title">${t.name}<\/div><div class="opt-desc">${t.desc}<\/div><div class="opt-stats">Refresh ${t.refresh} | ${2+t.stressBonus} Stress Boxes<\/div><\/div>`;});
  h+=`<\/div><div class="label">Series Level (Base Hero Points)</div><div class="grid-2 mb-3">`;
  sysList('SERIES_LEVELS').forEach(function(l){h+=`<div class="game-opt ${cur.level===l.id?'selected':''}" onclick="_uniPick('level','${l.id}','${editId||''}')"><div class="opt-title">${l.name}<\/div><div class="opt-desc">${l.desc}<\/div><div class="opt-stats">${l.baseHP} HP<\/div><\/div>`;});
  h+=`<\/div>`;
  h+=`<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Each hero still picks their own Experience Level during character creation.<\/div>`;
  }
  h+=`<div style="display:flex;gap:8px;margin-top:8px">`;
  if(!required)h+=`<button class="btn btn-secondary" style="flex:1" onclick="closeUniverseModal()">Cancel<\/button>`;
  h+=`<button class="btn btn-primary" style="flex:1" onclick="submitUniverseSetup('${editId||''}')">${ed?'Save Changes':esc(lexOpt('startWorld')||('Create '+lexU('universe')))}<\/button><\/div>`;
  // A brand-new browser has no universe, so this modal is locked — without a
  // way through it, a player invited to someone else's table could never reach
  // the sign-in screen at all.
  if(required)h+=`<div class="divider"><\/div><div style="text-align:center"><div style="font-size:11px;color:var(--muted);margin-bottom:6px">${esc(lexOpt('joinPrompt')||'Joining a game someone else is running?')}<\/div><button class="btn btn-gold btn-full" onclick="openMultiplayer()">${esc(lexOpt('joinWorld')||('\u{1F310} Join a Shared '+lexU('universe')))}<\/button><\/div>`;
  h+=`<\/div>`;
  document.getElementById('universe-modal-body').innerHTML=h;
  const m=document.getElementById('universe-modal');m.classList.toggle('locked',!!required);m.classList.add('open');
  setTimeout(function(){const i=document.getElementById('uni-name');if(i)i.focus();},60);
}
// Tone/level are picked before the universe exists, so park them on a draft.
let _uniDraft={tone:'',level:''};
function _uniPick(field,val,editId){
  if(editId){const u=getUniverse(editId);if(u){u.series=u.series||{};u.series[field]=val;saveUniverses();}}
  else _uniDraft[field]=val;
  const nm=(document.getElementById('uni-name')||{}).value||'';
  openUniverseSetup(_uniRequired,editId,true);
  const i=document.getElementById('uni-name');if(i)i.value=nm;
}
function submitUniverseSetup(editId){
  const name=(document.getElementById('uni-name').value||'').trim();
  if(!name)return alert('Please enter a '+lex('universe')+' name.');
  if(editId){
    const u=getUniverse(editId);if(!u)return;
    u.name=name;u.series=u.series||{};
    if(sysList('SERIES_TONES').length&&(!u.series.tone||!u.series.level))return alert('Pick a series tone and level.');
    saveUniverses();closeUniverseModal();
    if(typeof mpPushUniverseSeries==='function')mpPushUniverseSeries();
    openUniverseManager();refreshUniverseUI();
    return;
  }
  // Only demand a tone and level from a pack that actually offers them.
  const needSeries=sysList('SERIES_TONES').length>0&&sysList('SERIES_LEVELS').length>0;
  if(needSeries&&(!_uniDraft.tone||!_uniDraft.level))return alert('Pick a series tone and level — they apply to every hero in this universe.');
  const firstEver=loadUniverses().universes.length===0;
  const u=createUniverse(name,{tone:_uniDraft.tone,level:_uniDraft.level});
  _uniDraft={tone:'',level:''};
  // Fold pre-universe slot data into the roster BEFORE copying slots into save
  // files, so the migrated saves carry the universeId this step assigns.
  if(firstEver)foldLegacySlots(u);
  const wasRequired=_uniRequired;_uniRequired=false;
  closeUniverseModal();
  if(wasRequired)finishUniverseGate();
  else{
    U.activeUniverseId=u.id;saveUniverses();
    openUniverseManager();refreshUniverseUI();
  }
}
// Shared by both ways out of the first-run gate: creating a universe, or
// joining someone else's from the multiplayer lobby.
function finishUniverseGate(){
  if(typeof renderFloorStrip==='function')setTimeout(renderFloorStrip,0);
  _uniRequired=false;
  closeUniverseModal();
  migrateSlotsToSaves();
  loadSaves();
  if(!saveIndexHealthy())rebuildSaveIndex();
  migrateUniverseSeries();
  const first=listSaves().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))[0];
  if(SV.activeId&&getSaveData(SV.activeId))loadSave(SV.activeId);
  else if(first)loadSave(first.id);
  // Same reasoning as the boot path: a block pack never calls loadSave(), which
  // is the only other place the universe gets bound.
  const blocks=typeof sysUsesBlocks==='function'&&sysUsesBlocks();
  if(blocks)bindUniverse();
  try{renderHero();sysLand();}catch(e){}
  if(currentSaveId===null&&!blocks)openSlotModal();
}
function foldLegacySlots(u){
  for(let i=0;i<10;i++){const d=legacySlotData(i);if(!d)continue;if(d.universeId)continue;
    (d.npcs||[]).forEach(function(e){ensureId(e);
      if(!u.roster.some(r=>r.type===e.type&&(r.name||'').toLowerCase()===(e.name||'').toLowerCase()))u.roster.push(e);
    });
    if(d.char){if(!d.char.heroId)d.char.heroId=uid();const m=characterToNpc(d.char,d.char.heroId);
      if(!u.roster.some(r=>r.id===m.id))u.roster.push(m);}
    d.universeId=u.id;d.npcs=[];
    try{localStorage.setItem(legacySlotKey(i),JSON.stringify(d));}catch(e){}
  }
  saveUniverses();
}
function _uniSeriesLabel(u){
  const s=(u&&u.series)||{};
  const t=sysList('SERIES_TONES').find(x=>x.id===s.tone),l=sysList('SERIES_LEVELS').find(x=>x.id===s.level);
  // Tone and power level are Daring Comics' own. A game that has none was being
  // nagged in alert colour about something it cannot set.
  if(!sysList('SERIES_TONES').length&&!sysList('SERIES_LEVELS').length)return '';
  if(!t&&!l)return `<div style="font-size:10px;color:var(--accent)">No tone or power level set<\/div>`;
  return `<div style="font-size:10px;color:var(--gold)">${esc([t&&t.name,l&&l.name].filter(Boolean).join(' · '))}<\/div>`;
}
function openUniverseManager(){
  loadUniverses();
  // Every noun here was Daring Comics'. This modal is reached from a bar that
  // already speaks the pack's words, so "Heroes, NPCs & villains" read as a
  // different game breaking in.
  let h=`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div class="pg-title" style="font-size:20px">${esc(lexU('universes'))}<\/div><button class="btn btn-secondary btn-xs" onclick="closeUniverseModal()">Close<\/button><\/div>`;
  h+=`<div style="font-size:11px;color:var(--muted);margin:4px 0 10px">Your game worlds. Every ${esc(lex('hero'))}, ${esc(lex('npc'))} and wiki entry is shared within a ${esc(lex('universe'))}.<\/div>`;
  U.universes.forEach(function(u){
    const heroes=universeHeroCount(u.id);const isCur=(typeof S!=='undefined'&&S&&S.universeId===u.id);const rc=(u.roster||[]).length;
    h+=`<div class="card-sm" style="${isCur?'border-color:var(--accent)':''}"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><div style="flex:1;min-width:120px"><div class="fw-700">${esc(u.name)}${isCur?' <span style="font-size:10px;color:var(--accent)">(current)<\/span>':''}<\/div><div style="font-size:10px;color:var(--muted)">${heroes} ${esc(heroes===1?lex('hero'):lex('heroes'))} • ${rc} in ${esc(lex('roster'))}<\/div>${_uniSeriesLabel(u)}<\/div>`;
    h+=`<button class="btn btn-secondary btn-xs" onclick="openUniverseSetup(false,'${u.id}')" title="Name, tone and power level">Settings<\/button>`;
    if(typeof S!=='undefined'&&S&&S.char&&!isCur)h+=`<button class="btn btn-gold btn-xs" onclick="moveHeroToUniverse('${u.id}')" title="Move the ${esc(lex('hero'))} you are playing into this ${esc(lex('universe'))}">Move ${esc(lex('hero'))}<\/button>`;
    if(U.universes.length>1)h+=`<button class="btn btn-danger btn-xs" onclick="deleteUniversePrompt('${u.id}')">Del<\/button>`;
    h+=`<\/div><\/div>`;
  });
  h+=`<button class="btn btn-primary btn-full" style="margin-top:8px" onclick="openUniverseSetup(false)">+ New ${esc(lexU('universe'))}<\/button>`;
  h+=`<div class="divider"><\/div><button class="btn btn-gold btn-full" onclick="openMultiplayer()" title="Share a ${esc(lex('universe'))} with your table">\u{1F310} Play With Your Table<\/button>`;
  h+=`<div style="font-size:10px;color:var(--muted);margin-top:5px;text-align:center">Share a ${esc(lex('universe'))}'s ${esc(lex('roster'))} and ${esc(lex('wiki'))} with other players. Your ${esc(lex('heroes'))} and save files stay on this device.<\/div><\/div>`;
  document.getElementById('universe-modal-body').innerHTML=h;
  document.getElementById('universe-modal').classList.remove('locked');
  document.getElementById('universe-modal').classList.add('open');
}
function deleteUniversePrompt(id){
  loadUniverses();if(U.universes.length<=1)return alert('You must keep at least one '+lex('universe')+'.');
  const cnt=universeHeroCount(id);
  if(!confirm('Delete this '+lex('universe')+(cnt?' and unlink its '+cnt+' '+(cnt===1?lex('hero'):lex('heroes')):'')+'? Its shared '+lex('roster')+' will be removed. This cannot be undone.'))return;
  listSaves(id).slice().forEach(function(sm){
    const d=getSaveData(sm.id);
    if(!d)return;
    d.universeId=null;
    writeSave(sm.id,d);
  });
  deleteUniverse(id);
  if(typeof S!=='undefined'&&S&&S.universeId===id){S.universeId=null;if(currentSaveId!==null)bindUniverse();}
  openUniverseManager();refreshUniverseUI();
}
function moveHeroToUniverse(id){
  if(!S||!S.char)return;const u=getUniverse(id);if(!u)return;
  // sysCharName, so the confirm actually names the character: outside Daring
  // Comics it always read "this hero".
  if(!confirm('Move "'+(sysCharName(S.char)||'this '+lex('hero'))+'" into "'+u.name+'"? Its future '+lex('npcs')+' will be shared with that '+lex('universe')+'.'))return;
  S.universeId=id;bindUniverse();syncHeroToRoster();save();
  closeUniverseModal();refreshUniverseUI();
}


// ═══════════════════════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════════════════════
function showTab(id){
  // An id with no page behind it — a stale link, a tab a pack has stopped
  // declaring — used to throw here, AFTER every page had been hidden, so the
  // app went blank rather than staying where it was.
  const page=document.getElementById('page-'+id);
  if(!page)return;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b=>b.classList.remove('active'));
  page.classList.add('active');
  const nb=document.getElementById('nb-'+id);if(nb)nb.classList.add('active');
  if(id==='hero')renderHero();if(id==='hud')renderHUD();
  if(id==='npcs')renderNPCs();if(id==='map')renderMap();
  if(id==='dice')renderDice();if(id==='conflict')renderConflict();if(id==='notes')renderNotes();
  if(id==='wiki')renderWiki();if(id==='print')renderPrintCentre();
  // A tab the pack declared. The shell routes to it the same way it routes to
  // its own, which is the whole point of the contract: a surface a pack owns
  // must be one the shell can see. See DEBRIEF.md.
  if(typeof renderSysTab==='function')renderSysTab(id);
}
function renderAll(){renderHero();}
// A pack whose first useful page isn't the sheet says where to open instead.
function sysLand(){
  const t=(typeof SYS!=='undefined'&&SYS&&typeof SYS.landing==='function')?SYS.landing(S.char):'';
  if(t)showTab(t);
  return !!t;
}

// ═══════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════
// Swatches exist in two places — the static desktop sidebar and the Wiki page,
// which is re-rendered from a string — so this has to be callable, not a
// listener bound once at load.
function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  try{localStorage.setItem(storeKey('theme'),t);}catch(e){}
  document.querySelectorAll('.theme-swatch').forEach(s=>s.classList.toggle('active',s.dataset.theme===t));
}
document.querySelectorAll('#theme-wrap .theme-swatch').forEach(b=>{b.addEventListener('click',()=>setTheme(b.dataset.theme));});
// Applied at boot: the player's stored choice for THIS game, or the pack's own
// default. Without the default a pack inherited :root, which is Daring Comics'
// comic-book look.
function applyStoredTheme(){
  let t='';
  try{t=localStorage.getItem(storeKey('theme'))||'';}catch(e){}
  if(!t&&typeof SYS!=='undefined'&&SYS&&SYS.defaultTheme)t=SYS.defaultTheme;
  if(!t)return;
  document.documentElement.setAttribute('data-theme',t);
  document.querySelectorAll('.theme-swatch').forEach(b=>{b.classList.toggle('active',b.dataset.theme===t);});
}
applyStoredTheme();

// ═══════════════════════════════════════════════════════════
// HERO TAB
// ═══════════════════════════════════════════════════════════

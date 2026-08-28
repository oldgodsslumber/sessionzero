// A pack that declares schema.blocks renders through core/blocks.js; one that
// doesn't (Daring Comics, until Phase 3) keeps its hand-written renderer. This
// is the (a)-escape-hatch of SHELL-PLAN §2, used in the other direction.
function sysUsesBlocks(){return !!(SYS&&SYS.schema&&SYS.schema.blocks&&SYS.schema.blocks.length);}

function renderHero(){
  const creation=document.getElementById('hero-creation'),sheet=document.getElementById('hero-sheet');
  if(sysUsesBlocks()){
    // No block-based creation wizard yet (that is phase D5), so a pack with
    // blocks starts you straight on a blank sheet.
    if(!S.char||S.char.systemId!==SYS.id){
      const scratch=sysScratchLoad();
      S.char=(scratch&&scratch.systemId===SYS.id)?scratch
            :(SYS.newCharacter?SYS.newCharacter():{systemId:SYS.id,blocks:{}});
      // Restore the table state saved alongside the character — the journal,
      // the floor, the map and any fight that was in progress.
      const sess=(typeof sysScratchSession==='function')?sysScratchSession():null;
      if(sess)sysRenameStarterRegion(sess.regions);
      if(sess)SYS_SESSION_KEYS.forEach(function(k){
        if(sess[k]===undefined||sess[k]===null)return;
        // A universe id is only meaningful against this game's own list.
        if(k==='universeId'&&!getUniverse(sess[k]))return;
        S[k]=sess[k];
      });
    }
    // A pack with creation screens starts there and stays until it is finished.
    if((SYS.creation||[]).length&&!(S.char.creation&&S.char.creation.complete)){
      creation.style.display='block';sheet.style.display='none';
      renderWizard('hero-creation');
      return;
    }
    creation.style.display='none';sheet.style.display='block';
    renderSysSheet();
    return;
  }
  if(S.char){creation.style.display='none';sheet.style.display='block';renderSheet();}
  else{creation.style.display='block';sheet.style.display='none';renderCreationStep();}
}


// Reopening creation replays the finish step on the way back out, and that step
// is idempotent now, so nothing stacks. Confirm anyway: the wizard is a long
// way to walk by accident.
function sysReopenCreation(){
  if(!confirm('Go back into character creation?\n\nYour choices are kept \u2014 you can walk through and change them, then finish again.'))return;
  wizReopen();
}

function sysNewCharacter(){
  const nm=sysCharName(S.char);
  if(!confirm('Start a new '+lex('hero')+'?\n\n'+(nm?'"'+nm+'" will be replaced in this slot. Export it first if you want to keep it.':'The current sheet will be replaced.')))return;
  S.char=SYS.newCharacter?SYS.newCharacter():{systemId:SYS.id,blocks:{}};
  save();renderHero();
}

// A crawler whose map was created before this pack named its own starting
// ground is carrying Daring Comics' "Downtown". Rename it, but only while it is
// still untouched: once a player has drawn on it, it is their map whatever it
// is called.
function sysRenameStarterRegion(regions){
  const want=(SYS&&SYS.map&&SYS.map.firstRegion)||'';
  if(!want||!Array.isArray(regions))return;
  regions.forEach(function(r){
    if(!r||r.name!=='Downtown'||want==='Downtown')return;
    const touched=(r.cells||[]).some(function(c){
      return c&&(c.name||c.notes||c.feature||c.icon||c.subZone||c.type!=='unknown');
    });
    if(!touched)r.name=want;
  });
}

// The block-driven sheet: an identity header the pack declares, then its blocks.
function renderSysSheet(){
  const el=document.getElementById('hero-sheet');if(!el)return;
  const ch=S.char,ids=(SYS.schema&&SYS.schema.identity)||[];
  // The universe bar was only drawn by Daring Comics' own renderers, so a
  // block pack's sheet had no way to see or switch the world it belongs to.
  const LABELS={name:'Name',crawlerNumber:'Crawler Number',race:'Race',class:'Class',level:'Level'};
  let h=universeBarHTML();
  h+=`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">`;
  h+=`<div class="pg-title">${esc(lexU('sheet'))}</div>`;
  // The sheet used to be a one-way door: once creation finished there was no
  // control anywhere to export, start another character, or fix a choice —
  // wizReopen() existed and nothing called it.
  h+=`<div style="display:flex;gap:4px;align-items:center">`;
  if((SYS.creation||[]).length){
    h+=`<button class="btn btn-secondary btn-xs" onclick="sysReopenCreation()" title="Go back and change your creation choices">Edit creation</button>`;
  }
  h+=`<button class="btn btn-secondary btn-xs" onclick="exportJSON()" title="Download this ${esc(lex('hero'))} as JSON">Export</button>`;
  h+=`<button class="btn btn-secondary btn-xs" onclick="sysNewCharacter()" title="Start a new ${esc(lex('hero'))}">New</button>`;
  h+=`</div></div>`;
  // The character's own floor, not the table's. A Level 1 crawler starting on
  // the First Floor read "Floor 3" here, because this took the session default.
  const shownFloor=(ch&&ch.floor!==undefined&&ch.floor!==null)?ch.floor:(S.floor||3);
  h+=`<div style="font-size:11px;color:var(--muted);margin-bottom:8px">${esc(SYS.name)} · ${esc(lexU('logBreak'))} ${esc(String(shownFloor))}</div>`;
  h+=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">`;
  ids.forEach(f=>{
    h+=`<div class="form-group" style="margin:0"><label>${esc(LABELS[f]||f)}</label>`;
    h+=`<input value="${esc(String(ch[f]===undefined?'':ch[f]))}" oninput="sysIdentitySet('${esc(f)}',this.value)"></div>`;
  });
  h+=`</div></div>`;
  h+=`<div class="card-sm" style="border-color:var(--accent);font-size:11px;color:var(--muted);margin-bottom:8px">
      <strong style="color:var(--accent)">Preview.</strong> ${esc(SYS.name)} is not on the save-file system yet
      &mdash; this sheet autosaves to its own scratch slot and never touches your ${esc(lex('saves'))}.</div>`;
  // A pack may have prose that no block type covers.
  if(typeof SYS.sheetExtra==='function'){try{h+=SYS.sheetExtra(ch)||'';}catch(e){}}
  h+=`<div id="sys-blocks"></div>`;
  el.innerHTML=h;
  renderBlockSheet(ch,'sys-blocks');
}
function sysIdentitySet(field,v){
  if(!S.char)return;
  // Only coerce the fields the pack says are numbers. Coercing anything that
  // looked like digits turned a Race named "007" into the number 7 and redrew
  // the field with the leading zeros gone.
  const numeric=(SYS.schema&&SYS.schema.numericIdentity)||[];
  const n=Number(v);
  S.char[field]=(numeric.indexOf(field)>=0&&v!==''&&!isNaN(n))?n:v;
  save();
}

// ═══════════════════════════════════════════════════════════
// CHARACTER CREATION
// ═══════════════════════════════════════════════════════════
// Tone/level come from the universe; experience from the individual hero.
// Falls back to the save's own series so pre-migration saves still resolve.
function seriesIdsFor(st){
  const u=(st&&st.universeId)?getUniverse(st.universeId):currentUniverse();
  const us=(u&&u.series)||{};
  return{
    tone:us.tone||st?.series?.tone||'',
    level:us.level||st?.series?.level||'',
    experience:st?.series?.experience||''
  };
}
function getSeriesConfig(){
  const ids=seriesIdsFor(typeof S!=='undefined'?S:null);
  return{tone:sysList('SERIES_TONES').find(t=>t.id===ids.tone),level:sysList('SERIES_LEVELS').find(l=>l.id===ids.level),exp:sysList('EXP_LEVELS').find(e=>e.id===ids.experience)};
}
function getTotalHP(){const{level,exp}=getSeriesConfig();return(level?.baseHP||0)+(exp?.bonusHP||0)+(S.creation.roguesGallery?.length||0);}
function getSkillBudget(){const{exp}=getSeriesConfig();return(exp?.skillPts||0)+(S.creation.supportingCast?.length||0);}
function getSkillUsed(){let t=0;for(const v of Object.values(S.creation.skills))t+=v;return t;}
function getHPSpent(){let t=0;(S.creation.stunts||[]).forEach(s=>t+=s.cost);(S.creation.powerSets||[]).forEach(ps=>{(ps.powers||[]).forEach(p=>t+=p.totalCost);});return t;}

function renderCreationStep(){
  const c=S.creation,labels=['Series','Names','Aspects','Cast','Skills','Powers','Review'];
  let dots='';for(let i=0;i<7;i++){dots+=`<span class="${i<c.step?'step-dot done':i===c.step?'step-dot active':'step-dot'}" title="${labels[i]}"></span>`;}
  let h=universeBarHTML()+`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><div class="pg-title">Create Your Hero</div><button class="btn btn-secondary btn-xs" onclick="openSlotModal()">Saves</button></div>`;
  h+=c.step>0?`<button class="btn btn-secondary btn-xs" onclick="creationBack()" style="margin-bottom:8px">\u2190 Back</button>`:'';
  h+=`<div style="display:flex;gap:6px;margin-bottom:16px;justify-content:center;align-items:center">${dots}</div>`;
  if(c.step===0)h+=renderStepSeries();else if(c.step===1)h+=renderStepNames();else if(c.step===2)h+=renderStepAspects();
  else if(c.step===3)h+=renderStepCast();else if(c.step===4)h+=renderStepSkills();else if(c.step===5)h+=renderStepPowers();else if(c.step===6)h+=renderStepReview();
  document.getElementById('hero-creation').innerHTML=h;
  // The stunt browser draws its shell only; fill its list once it is in the DOM.
  if(document.getElementById('stunt-list'))renderStuntList();
}
function creationNext(){S.creation.step++;save();renderCreationStep();}
function creationBack(){if(S.creation.step>0){S.creation.step--;save();renderCreationStep();}}
function updateContinue(){const btn=document.getElementById('btn-continue');if(!btn)return;const c=S.creation;let ok=false;if(c.step===1)ok=c.costumedName.trim().length>0;else if(c.step===2)ok=c.aspects.concept.trim().length>0&&c.aspects.motivation.trim().length>0;if(ok){btn.disabled=false;btn.style.opacity='1';}else{btn.disabled=true;btn.style.opacity='.4';}}

// Step 0: Experience. Tone and level are set once for the whole universe and
// shown here as context, not as choices \u2014 every hero in a world plays at the
// same power level.
function renderStepSeries(){
  const u=currentUniverse(),{tone,level}=getSeriesConfig();
  let h=`<div class="card-sm"><div class="label mb-1">${esc(u?u.name:'This Universe')}</div>`;
  if(tone||level){
    h+=`<div style="font-size:12px">${tone?`<span class="fw-700">${esc(tone.name)}</span> <span style="color:var(--muted)">\u00b7 Refresh ${tone.refresh} \u00b7 ${2+tone.stressBonus} stress boxes</span>`:''}</div>`;
    if(level)h+=`<div style="font-size:12px;margin-top:2px"><span class="fw-700">${esc(level.name)}</span> <span style="color:var(--muted)">\u00b7 ${level.baseHP} base HP</span></div>`;
    h+=`<div style="font-size:11px;color:var(--muted);margin-top:5px">Tone and power level are set for the whole universe, so every hero here matches.</div>`;
  }else{
    h+=`<div style="font-size:12px;color:var(--accent)">This universe has no tone or power level set yet.</div>`;
  }
  h+=`<button class="btn btn-secondary btn-xs mt-2" onclick="openUniverseSetup(false,'${u?u.id:''}')">Change for the whole universe</button></div>`;
  h+='<div class="label">Your Experience Level</div><div style="font-size:11px;color:var(--muted);margin-bottom:6px">This one is yours alone \u2014 how seasoned this particular hero is.</div><div style="display:grid;gap:6px" class="mb-3">';
  EXP_LEVELS.forEach(e=>{h+=`<div class="game-opt ${S.series.experience===e.id?'selected':''}" onclick="S.series.experience='${e.id}';save();renderCreationStep()"><div style="display:flex;justify-content:space-between;align-items:center"><div class="opt-title">${e.name}</div><div class="opt-stats">${e.skillPts} Skills | +${e.bonusHP} HP</div></div></div>`;});
  h+='</div>';const ok=tone&&level&&S.series.experience;
  h+=`<button class="btn btn-primary btn-full" ${ok?'':`disabled style="opacity:.4"`} onclick="creationNext()">Continue \u2192</button>`;return h;
}
// Step 1: Names
function renderStepNames(){const c=S.creation;return`<div class="card"><div class="form-group"><label>Costumed Identity *</label><div style="display:flex;gap:6px"><input style="flex:1" value="${esc(c.costumedName)}" oninput="S.creation.costumedName=this.value;save();updateContinue()" placeholder="e.g. Captain Valor"><button class="btn btn-gold btn-xs" onclick="S.creation.costumedName=randHeroName();save();renderCreationStep()" title="Random name">Roll</button></div></div><div class="form-group"><label>Civilian Identity</label><input value="${esc(c.civilianName)}" oninput="S.creation.civilianName=this.value;save()" placeholder="e.g. James Reed"></div></div><button id="btn-continue" class="btn btn-primary btn-full" ${c.costumedName.trim()?'':`disabled style="opacity:.4"`} onclick="creationNext()">Continue \u2192</button>`;}
// Step 2: Aspects
function renderStepAspects(){
  const a=S.creation.aspects;
  let h=`<div class="card"><div class="form-group"><label>Concept * <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px">(What are you?)</span></label><div style="display:flex;gap:6px"><input style="flex:1" value="${esc(a.concept)}" oninput="S.creation.aspects.concept=this.value;save();updateContinue()" placeholder="e.g. Vigilante Detective"><button class="btn btn-gold btn-xs" onclick="S.creation.aspects.concept=randConcept();save();renderCreationStep()" title="Random">Roll</button></div></div><div class="form-group"><label>Motivation * <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px">(Why do you fight?)</span></label><div style="display:flex;gap:6px"><input style="flex:1" value="${esc(a.motivation)}" oninput="S.creation.aspects.motivation=this.value;save();updateContinue()" placeholder="e.g. Defend Those Who Cannot Defend Themselves"><button class="btn btn-gold btn-xs" onclick="S.creation.aspects.motivation=randMotivation();save();renderCreationStep()" title="Random">Roll</button></div></div><div class="divider"></div><div class="label mb-2">Contingent Aspects (pick 3)</div>`;
  for(let i=0;i<3;i++){const ct=a.contingent[i];h+=`<div style="margin-bottom:10px"><select style="margin-bottom:4px;font-size:13px" onchange="S.creation.aspects.contingent[${i}].cat=this.value;save();renderCreationStep()"><option value="">— Category —</option>${ASPECT_CATEGORIES.map(c=>`<option ${ct.cat===c?'selected':''}>${c}</option>`).join('')}</select><div style="display:flex;gap:6px"><input style="flex:1" value="${esc(ct.text)}" oninput="S.creation.aspects.contingent[${i}].text=this.value;save()" placeholder="Describe this aspect..."><button class="btn btn-gold btn-xs" onclick="S.creation.aspects.contingent[${i}].text=randContingent(S.creation.aspects.contingent[${i}].cat||'Core Value');save();renderCreationStep()" title="Random">Roll</button></div></div>`;}
  h+='</div>';const ok=a.concept.trim()&&a.motivation.trim();
  h+=`<button id="btn-continue" class="btn btn-primary btn-full" ${ok?'':`disabled style="opacity:.4"`} onclick="creationNext()">Continue \u2192</button>`;return h;
}
// Step 3: Cast & Rogues
function renderStepCast(){
  const c=S.creation;let h=`<div class="card"><div class="label">Supporting Cast <span class="text-green">(+1 skill pt each)</span></div><div class="opt-desc mb-2">2-3 allies, mentors, or contacts</div>`;
  c.supportingCast.forEach((sc,i)=>{h+=`<div class="card-sm" style="display:flex;gap:6px;align-items:start"><div style="flex:1"><input value="${esc(sc.name)}" oninput="S.creation.supportingCast[${i}].name=this.value;save()" placeholder="Name" style="margin-bottom:4px;font-size:13px"><input value="${esc(sc.desc)}" oninput="S.creation.supportingCast[${i}].desc=this.value;save()" placeholder="Description" style="font-size:12px"></div><button class="btn btn-danger btn-xs" onclick="S.creation.supportingCast.splice(${i},1);save();renderCreationStep()">X</button></div>`;});
  if(c.supportingCast.length<3)h+=`<button class="btn btn-secondary btn-sm" onclick="S.creation.supportingCast.push({name:'',desc:''});save();renderCreationStep()">+ Add</button>`;
  h+=`</div><div class="card"><div class="label">Rogues Gallery <span class="text-accent">(+1 Hero Point each)</span></div><div class="opt-desc mb-2">2-3 nemeses or recurring villains</div>`;
  c.roguesGallery.forEach((rg,i)=>{h+=`<div class="card-sm" style="display:flex;gap:6px;align-items:start"><div style="flex:1"><input value="${esc(rg.name)}" oninput="S.creation.roguesGallery[${i}].name=this.value;save()" placeholder="Name" style="margin-bottom:4px;font-size:13px"><input value="${esc(rg.desc)}" oninput="S.creation.roguesGallery[${i}].desc=this.value;save()" placeholder="Description" style="font-size:12px"></div><button class="btn btn-danger btn-xs" onclick="S.creation.roguesGallery.splice(${i},1);save();renderCreationStep()">X</button></div>`;});
  if(c.roguesGallery.length<3)h+=`<button class="btn btn-secondary btn-sm" onclick="S.creation.roguesGallery.push({name:'',desc:''});save();renderCreationStep()">+ Add</button>`;
  h+=`</div><div class="card-sm tac"><span class="text-green fw-700">${c.supportingCast.length} Cast</span> \u2192 +${c.supportingCast.length} Skill Pts &nbsp;|&nbsp; <span class="text-accent fw-700">${c.roguesGallery.length} Rogues</span> \u2192 +${c.roguesGallery.length} HP</div><button class="btn btn-primary btn-full mt-2" onclick="creationNext()">Continue \u2192</button>`;return h;
}
// Step 4: Skills
let _skillMode=null; // null=choose, 'template', 'advanced'
function renderStepSkills(){
  sbInit();
  const c=S.creation,budget=getSkillBudget(),used=getSkillUsed(),rem=budget-used,valid=validateColumn();
  // Auto-detect mode if skills already assigned
  if(_skillMode===null&&used>0)_skillMode='advanced';
  let h='';
  if(_skillMode===null){
    // MODE SELECTION
    h+=`<div class="card"><div class="label mb-2">Choose a Method</div>
      <div class="game-opt mb-2" onclick="_skillMode='template';renderCreationStep()" style="cursor:pointer"><div class="opt-title">Sample Columns</div><div class="opt-desc">Pick a pre-built column shape from the book, then assign skills to each tier.</div></div>
      <div class="game-opt" onclick="_skillMode='advanced';renderCreationStep()" style="cursor:pointer"><div class="opt-title">Advanced (Manual)</div><div class="opt-desc">Assign each skill's rating individually with +/- buttons.</div></div>
    </div>`;
    return h;
  }
  // Budget bar
  h+=`<div class="card-sm" style="display:flex;justify-content:space-between;align-items:center"><div><span class="label">Skill Points</span><br><span class="fw-700 ${rem<0?'text-red':rem===0?'text-green':'text-gold'}">${used}/${budget}</span> <span class="text-muted">(${rem} left)</span></div><div>${valid.ok?'<span class="text-green fw-700">\u2713 Valid</span>':'<span class="text-red fw-700">\u2717 '+valid.msg+'</span>'}</div></div>`;
  if(_skillMode==='template'){
    h+=renderSkillTemplate(budget,used,rem,valid);
  } else {
    h+=renderSkillAdvanced(rem,valid);
  }
  // Mode switch
  h+=`<div class="tac mt-2"><button class="btn btn-secondary btn-xs" onclick="_skillMode='${_skillMode==='template'?'advanced':'template'}';renderCreationStep()">Switch to ${_skillMode==='template'?'Advanced':'Sample Columns'}</button></div>`;
  const canNext=rem===0&&valid.ok;
  h+=`<button class="btn btn-primary btn-full mt-3" ${canNext?'':`disabled style="opacity:.4"`} onclick="creationNext()">Continue \u2192</button>`;
  if(!canNext&&rem===0&&!valid.ok)h+=`<div class="text-red mt-1" style="font-size:12px;text-align:center">${valid.msg}</div>`;
  if(!canNext&&rem>0)h+=`<div class="text-muted mt-1" style="font-size:12px;text-align:center">Spend all skill points to continue</div>`;
  return h;
}
function renderSkillTemplate(budget,used,rem,valid){
  const baseBudget=getSeriesConfig().exp?.skillPts||25;
  const columns=SAMPLE_COLUMNS[baseBudget]||SAMPLE_COLUMNS[25];
  const c=S.creation;
  let h='';
  if(budget>baseBudget){h+=`<div class="card-sm" style="background:rgba(241,196,15,.08);border-color:var(--gold)"><div style="font-size:11px;color:var(--gold)"><strong>Note:</strong> You have ${budget-baseBudget} bonus skill point${budget-baseBudget>1?'s':''} from Supporting Cast. Templates fit ${baseBudget} points \u2014 switch to Advanced to spend the bonus, or add them to skills after applying a template.</div></div>`;}
  h+='<div class="card"><div class="label mb-1">Quick Start — Archetypes</div><div style="font-size:11px;color:var(--muted);margin-bottom:8px">New to this? Pick a ready-made hero to auto-fill skills, then tweak by dragging below.</div><div class="arch-grid">';
  ARCHETYPES.forEach((a,ai)=>{h+=`<div class="game-opt arch-opt ${c._archetype===ai?'selected':''}" onclick="applyArchetype(${ai})"><div class="opt-title" style="font-size:13px">${a.name}</div><div class="opt-desc">${a.tag}</div></div>`;});
  h+='</div></div>';
  h+='<div class="card"><div class="label mb-2">Or pick a column shape</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">';
  columns.forEach((col,ci)=>{
    const sel=c._selectedColumn===ci;
    let preview='';
    for(let lv=6;lv>=1;lv--){const cnt=col.tiers[lv]||0;if(cnt)preview+=`<div style="font-size:10px;color:var(--muted)">${ladderName(lv)}(+${lv}): ${cnt}</div>`;}
    h+=`<div class="game-opt ${sel?'selected':''}" onclick="applyColumnTemplate(${ci})"><div class="opt-title" style="font-size:13px">${col.label}</div>${preview}</div>`;
  });
  h+='</div></div>';
  // Drag-to-assign board (replaces the tier dropdowns) — shown once a column is chosen.
  if(c._selectedColumn!==undefined&&c._selectedColumn!==null){
    h+=renderSkillBoard(columns[c._selectedColumn]);
  }
  return h;
}

// ===== Drag-to-assign skill board (touch + mouse) =====
var _skillDef=null,_sbDrag=null;
function renderSkillBoard(col){
  const c=S.creation;
  const lvls=[];for(let lv=6;lv>=1;lv--){if(col.tiers[lv])lvls.push(lv);}
  const totalSlots=lvls.reduce((a,lv)=>a+col.tiers[lv],0);
  const placed=SKILLS.filter(sk=>{const v=c.skills[sk]||0;return v>=1&&v<=6;}).length;
  let h='<div class="card sb-card"><div class="label" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px"><span>Assign Skills</span><span class="fw-700 '+(placed===totalSlots?'text-green':'text-gold')+'">'+placed+'/'+totalSlots+'</span></div>';
  h+='<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Drag a skill up into a bonus row to set its rating. Drag a placed skill back down to the list to clear it. Tap any skill to read what it does.</div>';
  h+='<div class="sb-rows">';
  lvls.forEach(lv=>{
    const cnt=col.tiers[lv];
    const atLv=SKILLS.filter(sk=>(c.skills[sk]||0)===lv);
    const full=atLv.length>=cnt;
    h+='<div class="sb-row'+(full?' full':'')+'" data-drop="tier" data-lv="'+lv+'">';
    h+='<div class="sb-rowlab">+'+lv+'<span class="sb-rowsub">'+ladderName(lv)+'</span></div>';
    h+='<div class="sb-slots">';
    for(let sIdx=0;sIdx<cnt;sIdx++){
      const sk=atLv[sIdx];
      if(sk){h+='<span class="dc-chip sb-chip placed'+(_skillDef===sk?' sel':'')+'" data-skill="'+sk+'" data-from="tier" data-lv="'+lv+'">'+sk+'</span>';}
      else{h+='<span class="sb-empty">+'+lv+'</span>';}
    }
    h+='</div>'+(full?'<span class="sb-lock" title="This row is full — drag a skill out to free a slot">\u{1F512}</span>':'')+'</div>';
  });
  h+='</div>';
  h+='<div class="sb-poolwrap"><div class="sb-poollab">Skills — drag one up to assign</div><div class="sb-pool" data-drop="pool">';
  let any=false;
  SKILLS.forEach(sk=>{const v=c.skills[sk]||0;if(v>=1&&v<=6)return;any=true;h+='<span class="dc-chip sb-chip'+(_skillDef===sk?' sel':'')+'" data-skill="'+sk+'" data-from="pool">'+sk+'</span>';});
  if(!any)h+='<span style="font-size:11px;color:var(--muted)">All skills placed. Drag one back here to clear it.</span>';
  h+='</div></div>';
  const def=_skillDef?('<strong style="color:var(--accent)">'+_skillDef+'</strong>'+(SKILL_DESC[_skillDef]?' — '+SKILL_DESC[_skillDef]:'')):'<span style="color:var(--muted)">Tap a skill to read its definition.</span>';
  h+='<div class="sb-def" id="sb-def">'+def+'</div></div>';
  return h;
}
function sbColumns(){return SAMPLE_COLUMNS[getSeriesConfig().exp?.skillPts||25]||SAMPLE_COLUMNS[25];}
function sbAssign(skill,lv){
  const c=S.creation,col=sbColumns()[c._selectedColumn];if(!col){renderCreationStep();return;}
  if((c.skills[skill]||0)===lv){_skillDef=skill;renderCreationStep();return;}
  const cnt=col.tiers[lv]||0;
  const atLv=SKILLS.filter(s=>(c.skills[s]||0)===lv).length;
  if(atLv>=cnt){_skillDef=skill;renderCreationStep();return;} // row locked/full
  if(c.skills[skill])delete c.skills[skill];
  c.skills[skill]=lv;_skillDef=skill;c._archetype=null;save();renderCreationStep();
}
function sbClear(skill){const c=S.creation;if(c.skills[skill])delete c.skills[skill];_skillDef=skill;c._archetype=null;save();renderCreationStep();}
function sbDropTarget(x,y){
  const els=document.elementsFromPoint?document.elementsFromPoint(x,y):[document.elementFromPoint(x,y)];
  for(let k=0;k<els.length;k++){const el=els[k];const d=el&&el.closest?el.closest('[data-drop]'):null;if(d)return d;}
  return null;
}
function sbInit(){
  if(window._sbBound)return;window._sbBound=true;
  document.addEventListener('pointerdown',function(e){
    const chip=e.target.closest&&e.target.closest('.dc-chip');
    if(!chip||!chip.closest('.sb-card'))return;
    _sbDrag={skill:chip.getAttribute('data-skill'),from:chip.getAttribute('data-from'),chip:chip,sx:e.clientX,sy:e.clientY,dragging:false,ghost:null};
  },true);
  document.addEventListener('pointermove',function(e){
    if(!_sbDrag)return;
    if(!_sbDrag.dragging){
      if(Math.abs(e.clientX-_sbDrag.sx)+Math.abs(e.clientY-_sbDrag.sy)<8)return;
      _sbDrag.dragging=true;
      const g=document.createElement('div');g.className='sb-ghost';g.textContent=_sbDrag.skill;document.body.appendChild(g);_sbDrag.ghost=g;
      _sbDrag.chip.classList.add('dragging');
    }
    e.preventDefault();
    _sbDrag.ghost.style.left=e.clientX+'px';_sbDrag.ghost.style.top=e.clientY+'px';
    document.querySelectorAll('.sb-row.over,.sb-pool.over').forEach(n=>n.classList.remove('over'));
    _sbDrag.ghost.style.display='none';
    const d=sbDropTarget(e.clientX,e.clientY);
    _sbDrag.ghost.style.display='';
    if(d)d.classList.add('over');
  },{passive:false});
  function end(e){
    if(!_sbDrag)return;const drag=_sbDrag;_sbDrag=null;
    document.querySelectorAll('.sb-row.over,.sb-pool.over').forEach(n=>n.classList.remove('over'));
    if(drag.ghost)drag.ghost.remove();
    if(drag.chip)drag.chip.classList.remove('dragging');
    if(!drag.dragging){_skillDef=drag.skill;renderCreationStep();return;} // tap
    const d=sbDropTarget(e.clientX,e.clientY);
    if(d&&d.getAttribute('data-drop')==='tier'){sbAssign(drag.skill,parseInt(d.getAttribute('data-lv')));}
    else if(d&&d.getAttribute('data-drop')==='pool'){sbClear(drag.skill);}
    else{renderCreationStep();}
  }
  document.addEventListener('pointerup',end);
  document.addEventListener('pointercancel',end);
}

function applyArchetype(ai){
  const c=S.creation,arch=ARCHETYPES[ai];if(!arch)return;
  const baseBudget=getSeriesConfig().exp?.skillPts||25;
  const columns=SAMPLE_COLUMNS[baseBudget]||SAMPLE_COLUMNS[25];
  let ci=columns.findIndex(col=>col.label===arch.shape);if(ci<0)ci=0;
  const col=columns[ci];
  const slots=[];for(let lv=6;lv>=1;lv--){const n=col.tiers[lv]||0;for(let k=0;k<n;k++)slots.push(lv);}
  c._selectedColumn=ci;c._archetype=ai;c.skills={};
  arch.skills.forEach((sk,idx)=>{if(idx<slots.length&&SKILLS.indexOf(sk)>=0&&!c.skills[sk])c.skills[sk]=slots[idx];});
  _skillDef=null;save();renderCreationStep();
}
function applyColumnTemplate(ci){
  const c=S.creation;
  const baseBudget=getSeriesConfig().exp?.skillPts||25;
  const columns=SAMPLE_COLUMNS[baseBudget]||SAMPLE_COLUMNS[25];
  c._selectedColumn=ci;c._archetype=null;
  // Clear existing skills
  c.skills={};
  save();renderCreationStep();
}
function assignSkillTier(lv,slotIdx,sk){
  const c=S.creation;
  // Remove any skill previously in this slot at this level
  const atLv=SKILLS.filter(s=>(c.skills[s]||0)===lv);
  if(atLv[slotIdx])delete c.skills[atLv[slotIdx]];
  // Assign new skill
  if(sk){
    // Clear it from any other level first
    if(c.skills[sk])delete c.skills[sk];
    c.skills[sk]=lv;
  }
  save();renderCreationStep();
}
function renderSkillAdvanced(rem,valid){
  const c=S.creation;
  let h='';
  // Pyramid
  h+='<div class="card-sm">';for(let lv=6;lv>=1;lv--){const cnt=SKILLS.filter(s=>(c.skills[s]||0)>=lv).length;if(cnt>0||lv<=3){h+=`<div class="pyramid-row"><div class="pyramid-label">${ladderName(lv)} +${lv}</div>`;for(let b=0;b<cnt;b++)h+='<div class="pyramid-block"></div>';if(!cnt)h+='<span style="font-size:10px;color:var(--muted)">\u2014</span>';h+='</div>';}}h+='</div><div style="margin-top:8px">';
  SKILLS.forEach(sk=>{const v=c.skills[sk]||0;h+=`<div class="skill-row"><div class="sk-name">${sk}<div style="font-size:9px;color:var(--muted);font-weight:400;font-family:var(--font-body);line-height:1.2">${SKILL_DESC[sk]||''}</div></div><div class="sk-label">${ladderName(v)}</div><button class="sk-btn" onclick="adjSkill('${sk}',-1)" ${v<=0?'disabled':''}>−</button><div class="sk-val">+${v}</div><button class="sk-btn" onclick="adjSkill('${sk}',1)" ${v>=6||rem<=0?'disabled':''}>+</button></div>`;});
  h+='</div>';
  return h;
}
function adjSkill(sk,d){const c=S.creation,cur=c.skills[sk]||0,nv=cur+d;if(nv<0||nv>6)return;if(d>0&&getSkillUsed()>=getSkillBudget())return;c.skills[sk]=nv;if(!nv)delete c.skills[sk];save();renderCreationStep();}
function validateColumn(){const counts={};SKILLS.forEach(sk=>{const v=S.creation.skills[sk]||0;if(v>0)counts[v]=(counts[v]||0)+1;});for(let lv=6;lv>=2;lv--){const above=counts[lv]||0,below=counts[lv-1]||0;if(above>0&&above>below)return{ok:false,msg:`Need more +${lv-1} skills (${below} < ${above})`};}return{ok:true,msg:''};}

// Step 5: Powers & Stunts
function renderStepPowers(){
  const c=S.creation,totalHP=getTotalHP(),spent=getHPSpent(),rem=totalHP-spent,{tone}=getSeriesConfig();
  const maxRefSpend=(tone?.refresh||5)-1,refUsed=rem<0?Math.min(Math.abs(rem),maxRefSpend):0,finalRef=Math.max(1,(tone?.refresh||5)-refUsed);
  let h=`<div class="card-sm"><div class="label">Hero Points Budget</div><div style="display:flex;justify-content:space-between;align-items:center"><span class="fw-700">${spent}/${totalHP} HP</span><span class="${rem<0?'text-red':'text-green'} fw-700">${rem>=0?rem+' left':'Using '+refUsed+' Refresh'}</span></div><div class="budget-bar"><div class="budget-fill ${rem<0?'over':rem<3?'warn':''}" style="width:${Math.min(100,(spent/Math.max(1,totalHP))*100)}%"></div></div>${finalRef<=0?'<div class="text-red" style="font-size:11px">Refresh cannot go below 1!</div>':''}<div style="font-size:11px;color:var(--muted)">Final Refresh: <span class="fw-700 ${finalRef<=1?'text-gold':'text-green'}">${finalRef}</span></div></div>`;
  // Stunts
  h+=`<div class="card"><div class="label mb-2">Stunts</div>`;
  (c.stunts||[]).forEach((st,i)=>{h+=`<div class="card-sm" style="display:flex;gap:6px;align-items:start"><div style="flex:1"><div class="fw-700" style="font-size:13px">${esc(st.name)} <span class="tag tag-cost">${st.cost} HP</span></div><div style="font-size:12px;color:var(--muted)">${esc(st.desc)}</div></div><button class="btn btn-danger btn-xs" onclick="S.creation.stunts.splice(${i},1);save();renderCreationStep()">X</button></div>`;});
  h+=`<button class="btn btn-secondary btn-sm" onclick="addStunt()">+ Browse Stunts</button></div>`;
  h+=renderStuntBrowser();
  // Power Sets
  h+=`<div class="card"><div class="label mb-2">Power Sets</div>`;
  (c.powerSets||[]).forEach((ps,psi)=>{
    h+=`<div class="powerset-card"><div style="display:flex;justify-content:space-between;align-items:start"><div><input value="${esc(ps.name)}" oninput="S.creation.powerSets[${psi}].name=this.value;save()" placeholder="Power Set Name" style="font-family:var(--font-title);font-size:18px;color:var(--purple);background:transparent;border:none;padding:0;width:200px"><input value="${esc(ps.aspect)}" oninput="S.creation.powerSets[${psi}].aspect=this.value;save()" placeholder="Power Set Aspect" style="font-size:12px;font-style:italic;color:var(--muted);background:transparent;border:none;padding:0;width:100%;margin-top:2px"></div><button class="btn btn-danger btn-xs" onclick="S.creation.powerSets.splice(${psi},1);save();renderCreationStep()">X</button></div>`;
    (ps.powers||[]).forEach((pw,pwi)=>{const pd=POWERS.find(p=>p.id===pw.powerId);h+=`<div class="card-sm mt-2" style="border-color:var(--purple)"><div style="display:flex;justify-content:space-between;align-items:center"><div><span class="fw-700">${powerIco(pw)}${esc(pw.customName||pd?.name||pw.powerId)}</span>${pw.level>1?` <span class="text-accent">Lv${pw.level}</span>`:''} <span class="tag tag-cost">${pw.totalCost} HP</span></div><div style="display:flex;gap:3px"><button class="btn btn-secondary btn-xs" onclick="editPD('creation',${psi},${pwi})" title="Edit power">Edit</button><button class="btn btn-danger btn-xs" onclick="S.creation.powerSets[${psi}].powers.splice(${pwi},1);save();renderCreationStep()">X</button></div></div>${pw.selectedSE.length?'<div style="margin-top:4px">'+pw.selectedSE.map(se=>`<span class="tag tag-se">${se}</span>`).join(' ')+'</div>':''}${pw.selectedLim.length?'<div style="margin-top:2px">'+pw.selectedLim.map(l=>`<span class="tag tag-lim">${l}</span>`).join(' ')+'</div>':''}${pw.flavor?'<div style="font-style:italic;font-size:11px;color:var(--blue);margin-top:6px;padding:5px 7px;background:rgba(52,152,219,.06);border-left:2px solid var(--blue);border-radius:3px">'+esc(pw.flavor)+'</div>':''}</div>`;});
    h+=`<button class="btn btn-secondary btn-xs mt-1" onclick="openPowerBrowser(${psi})">+ Add Power</button></div>`;
  });
  h+=`<button class="btn btn-gold btn-sm" onclick="S.creation.powerSets.push({name:'',aspect:'',powers:[]});save();renderCreationStep()">+ New Power Set</button></div>`;
  h+=`<button class="btn btn-primary btn-full mt-3" ${finalRef>=1?'':`disabled style="opacity:.4"`} onclick="creationNext()">Continue \u2192</button>`;return h;
}
let _stuntBrowseOpen=false,_stuntSearch='',_stuntSkillFilter='';
function addStunt(){_stuntBrowseOpen=true;_stuntSearch='';_stuntSkillFilter='';renderCreationStep();}
function addCustomStunt(){const n=prompt('Stunt Name:');if(!n)return;const d=prompt('Description:')||'',cs=prompt('HP Cost (1-3):','1'),c=Math.max(1,Math.min(3,parseInt(cs)||1));if(!S.creation.stunts)S.creation.stunts=[];S.creation.stunts.push({name:n,desc:d,cost:c});save();renderCreationStep();}
function renderStuntBrowser(){
  if(!_stuntBrowseOpen)return'';
  const sf=_stuntSkillFilter;
  const skillFilters=['All',...[...new Set(SAMPLE_STUNTS.map(s=>s.skill))].sort()];
  let h=`<div class="card" style="border-color:var(--accent)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div class="fw-700">Add a Stunt</div><button class="btn btn-secondary btn-xs" onclick="_stuntBrowseOpen=false;renderCreationStep()">Close</button></div>`;
  h+=`<input id="stunt-search" placeholder="Search stunts..." value="${esc(_stuntSearch)}" oninput="_stuntSearch=this.value;renderStuntList()" style="margin-bottom:6px;font-size:12px;padding:7px">`;
  h+=`<div id="stunt-filters" style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px">${skillFilters.map(f=>`<button class="btn btn-xs ${(f==='All'&&!sf)||sf===f?'btn-primary':'btn-secondary'}" data-sf="${esc(f)}" onclick="setStuntFilter('${f==='All'?'':f}')">${f}</button>`).join('')}</div>`;
  h+=`<div id="stunt-list" style="max-height:40vh;overflow-y:auto"></div>`;
  h+=`<div class="divider"></div><button class="btn btn-secondary btn-sm btn-full" onclick="addCustomStunt()">Create Custom Stunt</button></div>`;
  return h;
}

// Only the results repaint while you type, so the search box keeps its caret.
function renderStuntList(){
  const box=document.getElementById('stunt-list');if(!box)return;
  const q=_stuntSearch.toLowerCase(),sf=_stuntSkillFilter;
  const filtered=SAMPLE_STUNTS.filter(s=>{if(q&&!s.name.toLowerCase().includes(q)&&!s.desc.toLowerCase().includes(q))return false;if(sf&&s.skill!==sf)return false;return true;});
  const existing=(S.creation.stunts||[]).map(s=>s.name);
  let h='';
  filtered.forEach(s=>{
    const have=existing.includes(s.name);
    h+=`<div class="card-sm" style="display:flex;gap:8px;align-items:start;${have?'opacity:.5':''}"><div style="flex:1"><div class="fw-700" style="font-size:13px">${esc(s.name)}</div><div style="font-size:11px;color:var(--muted)">${esc(s.skill)} &middot; ${s.cost} HP</div><div style="font-size:12px">${esc(s.desc)}</div></div><button class="btn btn-xs ${have?'btn-secondary':'btn-primary'}" ${have?'disabled':''} onclick="pickSampleStunt('${esc(s.name).replace(/'/g,"\\'")}')">${have?'Taken':'Add'}</button></div>`;
  });
  if(!filtered.length)h='<div class="tac text-muted" style="padding:12px">No matches</div>';
  box.innerHTML=h;
}

function setStuntFilter(f){
  _stuntSkillFilter=f;
  const wrap=document.getElementById('stunt-filters');
  if(wrap)wrap.querySelectorAll('button[data-sf]').forEach(b=>{const v=b.dataset.sf==='All'?'':b.dataset.sf;b.className='btn btn-xs '+(v===f?'btn-primary':'btn-secondary');});
  renderStuntList();
}
function pickSampleStunt(name){
  const s=SAMPLE_STUNTS.find(x=>x.name===name);if(!s)return;
  if(!S.creation.stunts)S.creation.stunts=[];
  S.creation.stunts.push({name:s.name,desc:s.desc,cost:s.cost});
  save();renderCreationStep();
}

// Restore focus + caret to an input after a re-render replaced it. `pos` is the
// caret offset read off the OLD element by the handler, before the repaint;
// without it the caret used to snap to the end of the value, so editing a typo
// in the middle of a search box threw you to the end on the next keystroke.
function _refocus(id,pos){requestAnimationFrame(()=>{const el=document.getElementById(id);if(el&&el!==document.activeElement){el.focus();const at=typeof pos==='number'?Math.min(pos,el.value.length):el.value.length;try{el.setSelectionRange(at,at);}catch(e){}}});}

// Resolve which skill to roll for a power. Multi-skill controlling powers
// (e.g. "Magic/Mental/Power") use the player's chosen pw.controllingSkill,
// or fall back to the first option the character actually owns.
function getPowerRollSkill(pd,pw,charSkills){
  if(!pd||!pd.skill||pd.skill==='None')return null;
  if(pw&&pw.controllingSkill)return pw.controllingSkill;
  const opts=pd.skill.split('/');
  if(opts.every(o=>CONTROLLING_SKILLS.includes(o))){
    const s=charSkills||S.char?.skills||{};
    const owned=opts.find(o=>(s[o]||0)>0);
    return owned||opts[0];
  }
  return opts[0];
}

// Migrate legacy 'Controlling' skill on a skills object to 'Power' (closest default per book)
function migrateControllingSkill(skills){
  if(!skills||!skills.Controlling)return false;
  if(!skills.Power||skills.Power<skills.Controlling)skills.Power=skills.Controlling;
  delete skills.Controlling;
  return true;
}

// Power Browser
let _pbPSI=0,_pbSearch='',_pbSkill='',_pbTarget='hero',_pdEditCtx=null;
function openPowerBrowser(psi,target){_pbPSI=psi;_pbTarget=target||'hero';_pbSearch='';_pbSkill='';_pdEditCtx=null;document.getElementById('power-modal').classList.add('open');renderPB();}
function closePB(){_pdEditCtx=null;document.getElementById('power-modal').classList.remove('open');}
function _getEditPower(){
  if(!_pdEditCtx)return null;
  const{target,psi,pwi}=_pdEditCtx;
  if(target==='form')return S.char?.forms?.[S.char.activeForm]?.powerSets?.[psi]?.powers?.[pwi];
  if(target==='npc')return S._npcDraft?.forms?.[S._npcDraft.activeForm]?.powerSets?.[psi]?.powers?.[pwi];
  if(target==='team')return S.team?.expanded?.powers?.[pwi];
  if(target==='creation')return S.creation?.powerSets?.[psi]?.powers?.[pwi];
  return null;
}
function editPD(target,psi,pwi){
  let power;
  if(target==='form')power=S.char?.forms?.[S.char.activeForm]?.powerSets?.[psi]?.powers?.[pwi];
  else if(target==='npc')power=S._npcDraft?.forms?.[S._npcDraft.activeForm]?.powerSets?.[psi]?.powers?.[pwi];
  else if(target==='team')power=S.team?.expanded?.powers?.[pwi];
  else if(target==='creation')power=S.creation?.powerSets?.[psi]?.powers?.[pwi];
  if(!power||!power.powerId)return; // legacy team powers (no powerId) can't be edited via the browser
  _pbTarget=target;_pbPSI=psi;_pdEditCtx={target,psi,pwi};
  document.getElementById('power-modal').classList.add('open');
  showPD(power.powerId);
}
function cancelPDEdit(){_pdEditCtx=null;closePB();}
function savePD(){
  if(!_pdEditCtx)return;
  const{target,psi,pwi}=_pdEditCtx;
  const id=window._pdId;const p=POWERS.find(pw=>pw.id===id);if(!p)return;
  const lv=window._pdLv||1;let c=p.flat?parseInt(p.cost)||0:lv;const se=[],lm=[];
  document.querySelectorAll('#pw-se-list input:checked').forEach(i=>{c+=parseInt(i.dataset.cost)||0;se.push(i.dataset.se);});
  document.querySelectorAll('#pw-lim-list input:checked').forEach(i=>{c+=parseInt(i.dataset.cost)||0;lm.push(i.dataset.lim);});
  c=Math.max(1,c);
  const customName=(document.getElementById('pw-custom-name')?.value||'').trim()||p.name;
  const sp=document.getElementById('pw-skill-pick');const controllingSkill=sp?sp.value:undefined;
  const flavor=(document.getElementById('pw-flavor')?.value||'').trim();
  const updated={powerId:id,customName,level:lv,selectedSE:se,selectedLim:lm,totalCost:c};
  if(_pdIcon)updated.icon=_pdIcon;
  if(controllingSkill)updated.controllingSkill=controllingSkill;
  if(flavor)updated.flavor=flavor;
  let arr;
  if(target==='form')arr=S.char?.forms?.[S.char.activeForm]?.powerSets?.[psi]?.powers;
  else if(target==='npc')arr=S._npcDraft?.forms?.[S._npcDraft.activeForm]?.powerSets?.[psi]?.powers;
  else if(target==='team')arr=S.team?.expanded?.powers;
  else if(target==='creation')arr=S.creation?.powerSets?.[psi]?.powers;
  if(!arr||!arr[pwi])return;
  arr[pwi]=updated;
  _pdEditCtx=null;save();closePB();
  if(target==='form')renderSheet();
  else if(target==='npc')renderFullNPCEditor();
  else if(target==='team')renderNPCs();
  else if(target==='creation')renderCreationStep();
}
function renderPB(){
  const sf=_pbSkill;
  const filters=['All','Accuracy','Fight','Weapons','Athletics','Physique','Will','Arcanum','Magic/Mental/Power','None'];
  let h=`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div class="pg-title" style="font-size:20px">Powers</div><button class="btn btn-secondary btn-xs" onclick="closePB()">Close</button></div><input id="pb-search" placeholder="Search..." value="${esc(_pbSearch)}" oninput="_pbSearch=this.value;renderPBList()" style="margin-bottom:8px"><div id="pb-filters" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">${filters.map(f=>`<button class="btn btn-xs ${(f==='All'&&!sf)||sf===f?'btn-primary':'btn-secondary'}" data-pbf="${esc(f)}" onclick="setPBSkill('${f==='All'?'':f}')">${f}</button>`).join('')}</div><div id="pb-results" style="max-height:50vh;overflow-y:auto"></div></div>`;
  document.getElementById('power-modal-body').innerHTML=h;
  renderPBList();
}
// Only the results list is re-rendered while typing — rebuilding the whole
// modal replaced the <input> mid-keystroke, which dropped focus and ate letters.
function renderPBList(){
  const box=document.getElementById('pb-results');if(!box)return;
  const q=_pbSearch.toLowerCase(),sf=_pbSkill;
  const filtered=POWERS.filter(p=>{if(q&&!p.name.toLowerCase().includes(q)&&!p.desc.toLowerCase().includes(q))return false;if(sf&&!p.skill.toLowerCase().includes(sf.toLowerCase()))return false;return true;});
  let h='';
  filtered.forEach(p=>{h+=`<div class="power-card" onclick="showPD('${p.id}')"><div style="display:flex;justify-content:space-between"><div class="pw-name">${p.name}</div><div class="pw-cost">${p.cost}</div></div><div class="pw-desc">${p.desc}</div><div class="pw-skill">${p.skill}</div></div>`;});
  if(!filtered.length)h='<div class="tac text-muted" style="padding:20px">No matches</div>';
  box.innerHTML=h;
}
function setPBSkill(f){
  _pbSkill=f;
  const wrap=document.getElementById('pb-filters');
  if(wrap)wrap.querySelectorAll('button[data-pbf]').forEach(b=>{const v=b.dataset.pbf==='All'?'':b.dataset.pbf;b.className='btn btn-xs '+(v===f?'btn-primary':'btn-secondary');});
  renderPBList();
}
function showPD(id){
  const p=POWERS.find(pw=>pw.id===id);if(!p)return;
  const isVar=!p.flat,allSE=[...p.se,...GENERAL_SE],allLim=[...p.lim,...GENERAL_LIMITS];
  const skillOpts=p.skill.split('/').filter(s=>s&&s!=='None');
  const isMultiSkill=skillOpts.length>1;
  let h=`<div class="card"><button class="btn btn-secondary btn-xs" onclick="renderPB()" style="margin-bottom:8px">\u2190 Back</button><div class="pg-title" style="font-size:20px">${p.name}</div><div style="font-size:12px;color:var(--muted);margin-bottom:6px">Skill: ${p.skill} | Cost: ${p.cost}</div><div style="font-size:13px;margin-bottom:10px">${p.desc}</div><div class="form-group"><label>Display Name <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px">(rename if desired)</span></label><input id="pw-custom-name" value="${esc(p.name)}" placeholder="${esc(p.name)}"></div><div class="form-group"><label>Icon <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px">(from game-icons.net)</span></label><div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><div id="pw-icon-preview" style="width:42px;height:42px;flex-shrink:0;border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--surface2)"></div><input id="pw-icon-search" placeholder="Search icons — fire, sword, lightning…" oninput="pdIconSearch()"></div><div id="pw-icon-results" style="display:flex;flex-wrap:wrap;gap:5px;max-height:148px;overflow-y:auto"></div></div>`;
  if(isMultiSkill){
    h+=`<div class="form-group"><label>Roll With <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px">(pick the skill that fits this power\'s source)</span></label><select id="pw-skill-pick" style="width:100%">`;
    skillOpts.forEach(s=>{h+=`<option value="${esc(s)}">${esc(s)}</option>`;});
    h+=`</select></div>`;
  }
  h+=`<div class="form-group"><label>Flavor / Notes <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px">(your own description — italicized, not part of the rules)</span></label><textarea id="pw-flavor" rows="2" placeholder="e.g. His chrono-armor projects a translucent shimmer when active." style="font-style:italic;width:100%"></textarea></div>`;
  if(isVar){h+=`<div class="label mb-1">Power Level</div><div style="display:flex;gap:4px;margin-bottom:6px">`;p.levels.forEach(lv=>{h+=`<button class="btn btn-xs ${lv===1?'btn-primary':'btn-secondary'}" id="pw-lv-${lv}" onclick="setPDLv(${lv})">${lv}</button>`;});h+='</div>';
    if(p.levelDesc){h+=`<div class="card-sm" style="margin-bottom:10px;border-color:var(--accent)">`;p.levels.forEach(lv=>{if(p.levelDesc[lv])h+=`<div style="font-size:11px;padding:2px 0;display:flex;gap:6px;border-bottom:1px solid var(--border)"><span class="fw-700 text-accent" style="min-width:22px">Lv${lv}</span><span style="color:var(--text)">${esc(p.levelDesc[lv])}</span></div>`;});h+=`</div>`;}}
  const hasPowerSE=p.se.length>0,hasPowerLim=p.lim.length>0;
  h+=`<div class="label mb-1">Special Effects</div><div id="pw-se-list" style="margin-bottom:10px;max-height:220px;overflow-y:auto">`;
  if(hasPowerSE){h+=`<div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;padding:3px 0;border-bottom:1px solid var(--accent)">\u2605 Unique to ${esc(p.name)}</div>`;
    p.se.forEach(se=>{h+=`<label style="display:flex;gap:6px;align-items:start;margin-bottom:4px;cursor:pointer;font-size:12px;background:rgba(230,57,70,.06);padding:4px;border-radius:6px"><input type="checkbox" data-se="${esc(se.name)}" data-cost="${se.cost}"><div><span class="fw-700">${se.name} <span class="text-green">(+${se.cost})</span></span> <span class="text-muted">\u2014 ${se.desc}</span></div></label>`;});
    h+=`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin:6px 0 4px;padding:3px 0;border-bottom:1px solid var(--border)">General Effects</div>`;}
  GENERAL_SE.forEach(se=>{h+=`<label style="display:flex;gap:6px;align-items:start;margin-bottom:4px;cursor:pointer;font-size:12px"><input type="checkbox" data-se="${esc(se.name)}" data-cost="${se.cost}"><div><span>${se.name} <span class="text-green">(+${se.cost})</span></span> <span class="text-muted">\u2014 ${se.desc}</span></div></label>`;});
  h+=`</div><div class="label mb-1">Limits</div><div id="pw-lim-list" style="margin-bottom:10px;max-height:170px;overflow-y:auto">`;
  if(hasPowerLim){h+=`<div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;padding:3px 0;border-bottom:1px solid var(--accent)">\u2605 Unique to ${esc(p.name)}</div>`;
    p.lim.forEach(lm=>{h+=`<label style="display:flex;gap:6px;align-items:start;margin-bottom:4px;cursor:pointer;font-size:12px;background:rgba(231,76,60,.06);padding:4px;border-radius:6px"><input type="checkbox" data-lim="${esc(lm.name)}" data-cost="${lm.cost}"><div><span class="fw-700">${lm.name} <span class="text-red">(${lm.cost})</span></span> <span class="text-muted">\u2014 ${lm.desc}</span></div></label>`;});
    h+=`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin:6px 0 4px;padding:3px 0;border-bottom:1px solid var(--border)">General Limits</div>`;}
  GENERAL_LIMITS.forEach(lm=>{h+=`<label style="display:flex;gap:6px;align-items:start;margin-bottom:4px;cursor:pointer;font-size:12px"><input type="checkbox" data-lim="${esc(lm.name)}" data-cost="${lm.cost}"><div><span>${lm.name} <span class="text-red">(${lm.cost})</span></span> <span class="text-muted">\u2014 ${lm.desc}</span></div></label>`;});
  h+=`</div><div id="pw-cost-disp" class="card-sm tac fw-700" style="font-size:16px"></div><button class="btn btn-primary btn-full mt-2" onclick="addPD('${p.id}')">Add Power</button></div>`;
  document.getElementById('power-modal-body').innerHTML=h;
  window._pdId=p.id;window._pdLv=isVar?1:1;_pdIcon='';
  // EDIT MODE: pre-fill from existing power and swap action buttons
  if(_pdEditCtx){
    const ep=_getEditPower();
    if(ep){
      const cn=document.getElementById('pw-custom-name');if(cn)cn.value=ep.customName||p.name;
      if(ep.level>1)setPDLv(ep.level);
      document.querySelectorAll('#pw-se-list input').forEach(inp=>{if((ep.selectedSE||[]).includes(inp.dataset.se))inp.checked=true;});
      document.querySelectorAll('#pw-lim-list input').forEach(inp=>{if((ep.selectedLim||[]).includes(inp.dataset.lim))inp.checked=true;});
      const sp=document.getElementById('pw-skill-pick');if(sp&&ep.controllingSkill)sp.value=ep.controllingSkill;
      const fl=document.getElementById('pw-flavor');if(fl&&ep.flavor)fl.value=ep.flavor;_pdIcon=ep.icon||'';
    }
    document.querySelectorAll('#power-modal-body button').forEach(b=>{
      const t=b.textContent.trim();
      if(t==='Add Power'){b.textContent='Save Changes';b.setAttribute('onclick','savePD()');}
      else if(t.indexOf('Back')>=0){b.textContent='← Cancel';b.setAttribute('onclick','cancelPDEdit()');}
    });
  }
  updatePDCost();
  document.querySelectorAll('#pw-se-list input,#pw-lim-list input').forEach(inp=>inp.addEventListener('change',updatePDCost));pdIconPreview();pdIconSearch();
}
function setPDLv(lv){window._pdLv=lv;const p=POWERS.find(pw=>pw.id===window._pdId);if(p)p.levels.forEach(l=>{const b=document.getElementById('pw-lv-'+l);if(b)b.className='btn btn-xs'+(l===lv?' btn-primary':' btn-secondary');});updatePDCost();}
function updatePDCost(){const p=POWERS.find(pw=>pw.id===window._pdId);if(!p)return;let c=p.flat?parseInt(p.cost)||0:window._pdLv;document.querySelectorAll('#pw-se-list input:checked').forEach(i=>c+=parseInt(i.dataset.cost)||0);document.querySelectorAll('#pw-lim-list input:checked').forEach(i=>c+=parseInt(i.dataset.cost)||0);c=Math.max(1,c);const el=document.getElementById('pw-cost-disp');if(el)el.textContent='Total: '+c+' HP';}
function addPD(id){const p=POWERS.find(pw=>pw.id===id);if(!p)return;const lv=window._pdLv||1;let c=p.flat?parseInt(p.cost)||0:lv;const se=[],lm=[];document.querySelectorAll('#pw-se-list input:checked').forEach(i=>{c+=parseInt(i.dataset.cost)||0;se.push(i.dataset.se);});document.querySelectorAll('#pw-lim-list input:checked').forEach(i=>{c+=parseInt(i.dataset.cost)||0;lm.push(i.dataset.lim);});c=Math.max(1,c);const customName=(document.getElementById('pw-custom-name')?.value||'').trim()||p.name;
  const sp=document.getElementById('pw-skill-pick');const controllingSkill=sp?sp.value:undefined;
  const flavor=(document.getElementById('pw-flavor')?.value||'').trim();
  const powerObj={powerId:id,customName,level:lv,selectedSE:se,selectedLim:lm,totalCost:c};
  if(_pdIcon)powerObj.icon=_pdIcon;
  if(controllingSkill)powerObj.controllingSkill=controllingSkill;
  if(flavor)powerObj.flavor=flavor;
  if(_pbTarget==='npc'){const af=S._npcDraft?.activeForm||0;if(!S._npcDraft?.forms?.[af]?.powerSets?.[_pbPSI])return;S._npcDraft.forms[af].powerSets[_pbPSI].powers.push(powerObj);save();closePB();renderFullNPCEditor();}
  else if(_pbTarget==='form'){const af=S.char?.activeForm||0;if(!S.char?.forms?.[af]?.powerSets?.[_pbPSI])return;S.char.forms[af].powerSets[_pbPSI].powers.push(powerObj);save();closePB();renderSheet();}
  else if(_pbTarget==='team'){if(!S.team?.expanded)return;if(!S.team.expanded.powers)S.team.expanded.powers=[];S.team.expanded.powers.push(powerObj);save();closePB();renderNPCs();}
  else{if(!S.creation.powerSets[_pbPSI])return;S.creation.powerSets[_pbPSI].powers.push(powerObj);save();closePB();renderCreationStep();}}

// Step 6: Review
function renderStepReview(){
  const c=S.creation,{tone,level,exp}=getSeriesConfig();
  const phys=c.skills['Physique']||0,will=c.skills['Will']||0,tb=tone?.stressBonus||0;
  const pb=phys>=5?2:phys>=3?1:0,wb=will>=5?2:will>=3?1:0;
  const ps=2+tb+pb,ms=2+tb+wb,hpS=getHPSpent(),tHP=getTotalHP();
  const ru=hpS>tHP?Math.min(hpS-tHP,(tone?.refresh||5)-1):0,fr=Math.max(1,(tone?.refresh||5)-ru);
  let h=`<div class="card"><div style="font-family:var(--font-title);font-size:24px;color:var(--accent)">${esc(c.costumedName)}</div><div style="font-size:13px;color:var(--muted)">${esc(c.civilianName)}</div><div class="divider"></div><div class="label">Series</div><div style="font-size:12px">${tone?.name||''} | ${level?.name||''} | ${exp?.name||''}</div><div class="divider"></div><div class="label">Aspects</div><div style="font-size:13px"><strong>Concept:</strong> ${esc(c.aspects.concept)}</div><div style="font-size:13px"><strong>Motivation:</strong> ${esc(c.aspects.motivation)}</div>`;
  c.aspects.contingent.forEach(ct=>{if(ct.text)h+=`<div style="font-size:12px"><span class="text-muted">${ct.cat||'Aspect'}:</span> ${esc(ct.text)}</div>`;});
  h+=`<div class="divider"></div><div class="label">Skills</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">`;
  SKILLS.filter(sk=>(c.skills[sk]||0)>0).sort((a,b)=>(c.skills[b]||0)-(c.skills[a]||0)).forEach(sk=>{h+=`<span class="tag" style="background:var(--surface2);color:var(--text);border:1px solid var(--border)">${sk} +${c.skills[sk]}</span>`;});
  h+=`</div><div class="divider"></div><div class="label">Powers & Stunts</div>`;
  (c.stunts||[]).forEach(st=>{h+=`<div style="font-size:12px">\u2605 <strong>${esc(st.name)}</strong> (${st.cost} HP)</div>`;});
  (c.powerSets||[]).forEach(ps=>{h+=`<div style="margin-top:4px"><span class="text-purple fw-700">${esc(ps.name||'Power Set')}</span> <span class="text-muted" style="font-size:11px;font-style:italic">${esc(ps.aspect)}</span></div>`;(ps.powers||[]).forEach(pw=>{const pd=POWERS.find(p=>p.id===pw.powerId);h+=`<div style="font-size:12px;margin-left:12px">\u26A1 ${powerIco(pw)}${esc(pw.customName||pd?.name||pw.powerId)}${pw.level>1?' Lv'+pw.level:''} (${pw.totalCost} HP)</div>`;});});
  h+=`<div class="divider"></div><div class="grid-2"><div class="card-sm tac"><div class="label">Physical Stress</div><div class="fw-700 text-accent" style="font-size:18px">${ps} boxes</div></div><div class="card-sm tac"><div class="label">Mental Stress</div><div class="fw-700 text-accent" style="font-size:18px">${ms} boxes</div></div><div class="card-sm tac"><div class="label">Refresh</div><div class="fw-700 text-green" style="font-size:18px">${fr}</div></div><div class="card-sm tac"><div class="label">HP Spent</div><div class="fw-700 text-gold" style="font-size:18px">${hpS}/${tHP}</div></div></div><div class="label mt-2">Consequences</div><div style="font-size:12px">Mild | Moderate | Severe</div></div><button class="btn btn-primary btn-full mt-2" style="font-size:18px;padding:14px" onclick="finishCreation()">Create Hero!</button>`;return h;
}
function finishCreation(){
  const c=S.creation,{tone}=getSeriesConfig();
  const phys=c.skills['Physique']||0,will=c.skills['Will']||0,tb=tone?.stressBonus||0;
  const pb=phys>=5?2:phys>=3?1:0,wb=will>=5?2:will>=3?1:0;
  const ps=2+tb+pb,ms=2+tb+wb,hpS=getHPSpent(),tHP=getTotalHP();
  const ru=hpS>tHP?Math.min(hpS-tHP,(tone?.refresh||5)-1):0,fr=Math.max(1,(tone?.refresh||5)-ru);
  S.char={costumedName:c.costumedName,civilianName:c.civilianName,aspects:JSON.parse(JSON.stringify(c.aspects)),supportingCast:JSON.parse(JSON.stringify(c.supportingCast)),roguesGallery:JSON.parse(JSON.stringify(c.roguesGallery)),skills:JSON.parse(JSON.stringify(c.skills)),refresh:fr,fatePoints:fr,stress:{physical:Array(ps).fill(false),mental:Array(ms).fill(false)},consequences:{mild:'',moderate:'',severe:''},stunts:JSON.parse(JSON.stringify(c.stunts||[])),forms:[{name:'Main Form',powerSets:JSON.parse(JSON.stringify(c.powerSets||[]))}],activeForm:0,gear:'',hardStress:[],hardCons:{mild:[],moderate:[],severe:[]}};
  c.supportingCast.forEach(sc=>{if(sc.name)S.npcs.push({id:uid(),type:'supporting',name:sc.name,desc:sc.desc,skills:{},aspects:[]});});
  c.roguesGallery.forEach(rg=>{if(rg.name)S.npcs.push({id:uid(),type:'rogue',name:rg.name,desc:rg.desc,aspects:[],skills:{},powers:'',stress:Array(4).fill(false),consequences:{mild:'',moderate:'',severe:''}});});
  save();renderHero();
}

// ═══════════════════════════════════════════════════════════
// CHARACTER SHEET
// ═══════════════════════════════════════════════════════════

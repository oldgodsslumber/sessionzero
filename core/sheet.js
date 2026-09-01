function renderSheet(){
  const ch=S.char;if(!ch)return;
  // Migrate legacy characters: wrap existing powerSets into a single Main Form
  if(!ch.forms){ch.forms=[{name:'Main Form',powerSets:ch.powerSets||[]}];ch.activeForm=0;delete ch.powerSets;save();}
  // Migrate legacy 'Controlling' skill into 'Power'
  if(migrateControllingSkill(ch.skills))save();
  // Also migrate any NPCs in this slot
  let npcMig=false;(S.npcs||[]).forEach(n=>{if(migrateControllingSkill(n.skills))npcMig=true;});if(npcMig)save();
  if(ch.activeForm==null||ch.activeForm>=ch.forms.length)ch.activeForm=0;
  const _hb=syncHardiness(ch);
  const _af=ch.activeForm,_curForm=ch.forms[_af]||{name:'',powerSets:[]};
  let h=universeBarHTML()+`<div class="${_heroEditMode?'':'no-edit'}">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:start;gap:8px;margin-bottom:8px;flex-wrap:wrap"><div style="flex:1;min-width:160px"><div class="pg-title" style="font-size:28px">${esc(ch.costumedName)}</div><div style="font-size:13px;color:var(--muted)">${esc(ch.civilianName)}</div></div><div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${editToggleBtn(_heroEditMode,'toggleHeroEdit')}<button class="btn btn-gold btn-xs" onclick="exportJSON()">Export</button><button class="btn btn-secondary btn-xs" onclick="openSlotModal()">Saves</button><button class="btn btn-danger btn-xs edit-only" onclick="resetChar()">New</button></div></div>`;
  if(!_heroEditMode)h+=noEditBanner();
  // The sheet in two buckets: what you READ on the left — Fate, Aspects,
  // Stress, Consequences, Skills — and what you WORK IN on the right, which is
  // Forms and the power sets under them. On a phone .sheet-col is
  // display:contents, so both buckets collapse and the cards come out in the
  // order they always did; the split only exists where there is room for it.
  h+=`<div class="sheet-grid"><div class="sheet-col">`;
  // Fate Points
  h+=`<div class="card" style="display:flex;align-items:center;justify-content:space-between"><div><div class="label">Fate Points</div><div style="font-size:11px;color:var(--muted)">Refresh: ${ch.refresh}</div></div><div style="display:flex;align-items:center;gap:10px"><button class="sk-btn" onclick="adjFP(-1)">−</button><span style="font-size:28px;font-weight:900;font-family:var(--font-title);color:var(--gold)">${ch.fatePoints}</span><button class="sk-btn" onclick="adjFP(1)">+</button></div></div>`;
  // Aspects
  h+=`<div class="card"><div class="label mb-1">Aspects</div><div style="font-size:13px"><strong>Concept:</strong> ${esc(ch.aspects.concept)}</div><div style="font-size:13px"><strong>Motivation:</strong> ${esc(ch.aspects.motivation)}</div>`;
  ch.aspects.contingent.forEach(ct=>{if(ct.text)h+=`<div style="font-size:12px"><span class="text-muted">${ct.cat||'Aspect'}:</span> ${esc(ct.text)}</div>`;});h+='</div>';
  // Stress
  h+=`<div class="card"><div class="label mb-1">Stress</div><div style="margin-bottom:8px"><span style="font-size:12px;font-weight:700;color:var(--muted)">Physical</span><div style="display:flex;gap:6px;margin-top:4px">`;
  ch.stress.physical.forEach((v,i)=>{h+=`<div class="stress-box ${v?'filled':''}" onclick="toggleStress('physical',${i})">${i+1}</div>`;});(ch.hardStress||[]).forEach((v,i)=>{h+=`<div class="stress-box hard ${v?'filled':''}" onclick="toggleHardStress(${i})" title="Bonus stress box from Hardiness">${ch.stress.physical.length+i+1}</div>`;});
  h+=`</div></div><div><span style="font-size:12px;font-weight:700;color:var(--muted)">Mental</span><div style="display:flex;gap:6px;margin-top:4px">`;
  ch.stress.mental.forEach((v,i)=>{h+=`<div class="stress-box ${v?'filled':''}" onclick="toggleStress('mental',${i})">${i+1}</div>`;});h+='</div></div>'+((_hb&&(_hb.box||_hb.mild||_hb.moderate||_hb.severe))?'<div style="font-size:10px;color:var(--purple);margin-top:8px">\u2726 Purple boxes and consequence slots are bonuses from the Hardiness power.</div>':'')+'</div>';
  // Consequences
  h+=`<div class="card"><div class="label mb-1">Consequences</div><div class="conseq-row"><div class="conseq-label">Mild (2)</div><div class="conseq-input"><input value="${esc(ch.consequences.mild)}" oninput="S.char.consequences.mild=this.value;save()" placeholder="\u2014"></div></div><div class="conseq-row"><div class="conseq-label">Moderate (4)</div><div class="conseq-input"><input value="${esc(ch.consequences.moderate)}" oninput="S.char.consequences.moderate=this.value;save()" placeholder="\u2014"></div></div><div class="conseq-row"><div class="conseq-label">Severe (6)</div><div class="conseq-input"><input value="${esc(ch.consequences.severe)}" oninput="S.char.consequences.severe=this.value;save()" placeholder="\u2014"></div></div>${_hcExtra(ch)}</div>`;
  // Skills
  // Quick roll toast area
  h+=rollToastHTML();
  // Mobile dice bar
  h+=rollBarHTML();
  h+=`<div class="card"><div class="label mb-1">Skills <span class="text-muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:9px">tap to load into roller</span></div>`;
  SKILLS.filter(sk=>(ch.skills[sk]||0)>0).sort((a,b)=>(ch.skills[b]||0)-(ch.skills[a]||0)).forEach(sk=>{h+=`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid var(--border);cursor:pointer" onclick="loadRoll('${sk}',0)"><div><span class="fw-700">${sk}</span><div style="font-size:10px;color:var(--muted);line-height:1.2">${SKILL_DESC[sk]||''}</div></div><span class="fw-700 text-accent" style="white-space:nowrap;margin-left:8px">${ladderName(ch.skills[sk])} (+${ch.skills[sk]})</span></div>`;});h+='</div>';
  // ── right column: the working half of the sheet ──
  h+=`</div><div class="sheet-col">`;
  // Forms (tabs)
  h+=`<div class="card" style="padding:8px 10px"><div class="label mb-1">Forms</div><div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:6px">`;
  ch.forms.forEach((f,fi)=>{h+=`<button class="btn btn-xs ${fi===_af?'btn-primary':'btn-secondary'}" onclick="switchForm(${fi})" style="font-family:var(--font-label)">${esc(f.name||'Form '+(fi+1))}</button>`;});
  h+=`<button class="btn btn-gold btn-xs edit-only" onclick="addForm()">+ New Form</button></div>`;
  h+=`<div style="display:flex;gap:6px;align-items:center"><input class="editable-input" value="${esc(_curForm.name||'')}" oninput="S.char.forms[${_af}].name=this.value;save()" placeholder="Form name" style="flex:1;font-size:13px;font-family:var(--font-label);font-weight:700">`;
  if(ch.forms.length>1)h+=`<button class="btn btn-danger btn-xs edit-only" onclick="deleteForm(${_af})">Delete Form</button>`;
  h+=`</div><div class="edit-only" style="font-size:10px;color:var(--muted);margin-top:4px">Forms share base stats but have their own powers (e.g. werewolf transformation, armor variants).</div></div>`;
  // Power Sets (active form)
  (_curForm.powerSets||[]).forEach((ps,psi)=>{
    {const psFlav=ps.flavor||'';const flavRO=_heroEditMode?'':'readonly';const flavHide=!_heroEditMode&&!psFlav?' style="display:none"':'';
    h+=`<div class="powerset-card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px"><div style="flex:1"><input class="editable-input" value="${esc(ps.name||'')}" oninput="S.char.forms[${_af}].powerSets[${psi}].name=this.value;save()" placeholder="Power Set Name" style="font-family:var(--font-title);font-size:18px;color:var(--purple);background:transparent;border:none;padding:0;width:100%"><input class="editable-input" value="${esc(ps.aspect||'')}" oninput="S.char.forms[${_af}].powerSets[${psi}].aspect=this.value;save()" placeholder="Power Set Aspect" style="font-size:12px;font-style:italic;color:var(--muted);background:transparent;border:none;padding:0;width:100%;margin-top:2px"><textarea class="ps-flavor" ${flavRO}${flavHide} oninput="S.char.forms[${_af}].powerSets[${psi}].flavor=this.value;save()" placeholder="Optional flavor — what these powers feel like, where they came from, signature look or sensation...">${esc(psFlav)}</textarea></div><button class="btn btn-danger btn-xs edit-only" onclick="delFormPowerSet(${psi})">X</button></div>`;}
    (ps.powers||[]).forEach((pw,pwi)=>{const pd=POWERS.find(p=>p.id===pw.powerId);const rollSkill=getPowerRollSkill(pd,pw,ch.skills);const rollable=!!rollSkill;const pwName=esc(pw.customName||pd?.name||pw.powerId);h+=`<div style="padding:6px 4px;font-size:13px;border-bottom:1px solid var(--border);display:flex;gap:6px;align-items:flex-start"><div style="flex:1;${rollable?'cursor:pointer':''}" ${rollable?`onclick="loadRoll('${rollSkill}',${pw.level>1?pw.level:0},'${pwName.replace(/'/g,"\\'")}')"`:''}>${powerIco(pw)}<span class="fw-700">${pwName}</span>${rollable?' <span style="font-size:9px;color:var(--blue);vertical-align:middle">LOAD</span>':''}${pw.level>1?' <span class="text-accent">Lv'+pw.level+'</span>':''} <span class="text-muted">(${pw.totalCost} HP)</span>${pd?.desc?`<div style="font-size:11px;color:var(--muted);margin-top:1px">${esc(pd.desc)}</div>`:''}${pd?.levelDesc&&pd.levelDesc[pw.level]?`<div style="font-size:11px;color:var(--accent);margin-top:1px">${esc(pd.levelDesc[pw.level])}</div>`:''}${pw.selectedSE.length?'<div style="margin-top:3px">'+pw.selectedSE.map(se=>{const def=[...(pd?.se||[]),...GENERAL_SE].find(x=>x.name===se);return`<div style="font-size:11px;margin-bottom:2px"><span class="tag tag-se">${se}</span>${def?' <span style="color:var(--muted)">'+esc(def.desc)+'</span>':''}</div>`;}).join('')+'</div>':''}${pw.selectedLim.length?'<div style="margin-top:2px">'+pw.selectedLim.map(l=>{const def=[...(pd?.lim||[]),...GENERAL_LIMITS].find(x=>x.name===l);return`<div style="font-size:11px;margin-bottom:2px"><span class="tag tag-lim">${l}</span>${def?' <span style="color:var(--muted)">'+esc(def.desc)+'</span>':''}</div>`;}).join('')+'</div>':''}${pw.flavor?'<div style="font-style:italic;font-size:11px;color:var(--blue);margin-top:6px;padding:5px 7px;background:rgba(52,152,219,.06);border-left:2px solid var(--blue);border-radius:3px">'+esc(pw.flavor)+'</div>':''}</div><div class="edit-only" style="display:flex;flex-direction:column;gap:3px;align-self:center"><button class="btn btn-secondary btn-xs" onclick="editPD('form',${psi},${pwi})" title="Edit power">Edit</button><button class="btn btn-danger btn-xs" onclick="delFormPower(${psi},${pwi})">X</button></div></div>`;});
    h+=`<button class="btn btn-secondary btn-xs mt-1 edit-only" onclick="openPowerBrowser(${psi},'form')">+ Add Power</button></div>`;
  });
  h+=`<button class="btn btn-gold btn-sm edit-only" style="width:100%" onclick="addFormPowerSet()">+ New Power Set</button>`;
  // Gear (per form)
  h+=renderGearList(_curForm,'form');
  // Stunts
  if(ch.stunts?.length){h+=`<div class="card"><div class="label mb-1">Stunts</div>`;ch.stunts.forEach(st=>{h+=`<div style="padding:3px 0;font-size:13px">\u2605 <strong>${esc(st.name)}</strong> <span class="text-muted">(${st.cost} HP)</span><br><span style="font-size:12px;color:var(--muted)">${esc(st.desc)}</span></div>`;});h+='</div>';}
  // Gear
  h+=`<div class="card"><div class="label mb-1">Gear & Notes</div><textarea oninput="S.char.gear=this.value;save()" placeholder="Equipment, devices, notes...">${esc(ch.gear||'')}</textarea></div>`;
  // Super Team summary
  if(S.team){
    const t=S.team;
    h+=`<div class="card" style="border-color:var(--purple)"><div class="label mb-1" style="color:var(--purple)">Super Team: ${esc(t.name)}</div>`;
    h+=`<div style="font-size:12px;margin-bottom:4px"><strong>Charter:</strong> ${esc(t.charter)}</div>`;
    h+=`<div style="font-size:12px;margin-bottom:4px"><strong>Friction:</strong> ${esc(t.friction)}</div>`;
    if(t.stunts.length){h+=`<div style="font-size:11px;color:var(--muted);margin-top:4px">Stunts: ${t.stunts.map(id=>TEAM_STUNTS.find(ts=>ts.id===id)?.name||id).join(', ')}</div>`;}
    if(t.expanded){
      const ex=t.expanded;
      h+=`<div class="divider"></div><div class="label mb-1" style="font-size:10px">Expanded Roster</div>`;
      const exSkills=['Combat','Expertise','Social','Undercover'];
      h+=`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px">${exSkills.filter(sk=>(ex.skills[sk]||0)>0).map(sk=>`<span class="tag" style="background:var(--surface3);color:var(--text);border:1px solid var(--border)">${sk} +${ex.skills[sk]}</span>`).join('')}</div>`;
      if(ex.stunts?.length||ex.powers?.length){h+=`<div style="font-size:11px;color:var(--muted)">${[...(ex.stunts||[]).map(s=>s.name),...(ex.powers||[]).map(p=>p.name)].join(', ')}</div>`;}
    }
    h+=`</div>`;
  }
  h+=`<button onclick="printCharSheet()" style="width:100%;padding:11px;border-radius:var(--radius-btn);border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;margin-top:6px;display:flex;align-items:center;justify-content:center;gap:8px;font-family:var(--font-label)">Print Character Sheet</button>`;
  h+=`</div></div>`;   // close the right column and the grid
  h+=`</div>`;
  document.getElementById('hero-sheet').innerHTML=h;
  // The sidebar lives outside #hero-sheet (#page-hero is a flex row), so it is
  // filled once the sheet is in the DOM. Both sheet renderers reach it through
  // the same shell call now.
  renderRollSidebar();
}
function buildDicePanel(){
  const ch=S.char;
  const ex=S.team?.expanded;const exSkills=ex?['Combat','Expertise','Social','Undercover']:[];
  let h=`<div class="card"><div class="pg-title" style="font-size:18px;margin-bottom:4px">Dice Roller</div>`;
  h+=`<div id="ds-loaded" style="font-size:12px;color:var(--purple);font-weight:700;font-family:var(--font-title);margin-bottom:6px">${_loadedPower||''}</div>`;
  h+=`<div style="display:flex;gap:6px;margin-bottom:6px"><div style="flex:1"><div class="label" style="margin-bottom:2px">Skill</div><select id="ds-sk" style="font-size:12px;padding:7px" onchange="_loadedPower='';updateLoadedInfo('s')"><option value="">— None —</option>${SKILLS.map(sk=>`<option value="${sk}"${_loadedSkill===sk?' selected':''}>${sk} (+${ch?.skills?.[sk]||0})</option>`).join('')}${exSkills.length?`<optgroup label="Team">${exSkills.map(sk=>`<option value="team:${sk}">${sk} (+${ex.skills[sk]||0})</option>`).join('')}</optgroup>`:''}</select></div><div style="width:50px"><div class="label" style="margin-bottom:2px">Mod</div><input type="number" id="ds-mod" value="${_loadedMod}" style="font-size:12px;padding:7px"></div><div style="width:50px"><div class="label" style="margin-bottom:2px">TN</div><input type="number" id="ds-tn" value="0" style="font-size:12px;padding:7px" placeholder="0"></div></div>`;
  h+=`<div class="tac"><button class="roll-btn" style="width:60px;height:60px;font-size:18px" onclick="doSidebarRoll()">ROLL</button></div>`;
  h+=`<div id="ds-result" style="margin-top:8px"></div>`;
  if(ch){h+=`<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)"><div class="label" style="margin:0">Fate Points</div><div style="display:flex;align-items:center;gap:8px"><button class="sk-btn" style="width:22px;height:22px;font-size:14px" onclick="adjFP(-1);renderSheet()">−</button><span style="font-size:20px;font-weight:900;color:var(--gold)">${ch.fatePoints}</span><button class="sk-btn" style="width:22px;height:22px;font-size:14px" onclick="adjFP(1);renderSheet()">+</button></div></div>`;}
  h+=`</div>`;
  return h;
}
function toggleStress(t,i){S.char.stress[t][i]=!S.char.stress[t][i];save();renderSheet();}
function adjFP(d){S.char.fatePoints=Math.max(0,S.char.fatePoints+d);save();renderSheet();}
function resetChar(){if(!confirm('Delete character and start over?'))return;S.char=null;S.creation={step:0,costumedName:'',civilianName:'',aspects:{concept:'',motivation:'',contingent:[{cat:'',text:''},{cat:'',text:''},{cat:'',text:''}]},supportingCast:[],roguesGallery:[],skills:{},powerSets:[],stunts:[]};save();renderHero();}
function switchForm(i){if(!S.char?.forms?.[i])return;S.char.activeForm=i;save();renderSheet();}
function addForm(){if(!S.char)return;const name=(prompt('New form name:','New Form')||'').trim();if(!name)return;if(!S.char.forms)S.char.forms=[];const basePS=S.char.forms[0]?.powerSets?JSON.parse(JSON.stringify(S.char.forms[0].powerSets)):[];S.char.forms.push({name,powerSets:basePS});S.char.activeForm=S.char.forms.length-1;save();renderSheet();}
function deleteForm(i){if(!S.char?.forms||S.char.forms.length<=1)return;if(!confirm('Delete "'+(S.char.forms[i].name||'this form')+'"? Its powers will be lost.'))return;S.char.forms.splice(i,1);if(S.char.activeForm>=S.char.forms.length)S.char.activeForm=S.char.forms.length-1;save();renderSheet();}
function addFormPowerSet(){const af=S.char.activeForm||0;if(!S.char.forms[af])return;S.char.forms[af].powerSets.push({name:'',aspect:'',powers:[]});save();renderSheet();}
function delFormPowerSet(psi){if(!confirm('Remove this power set?'))return;const af=S.char.activeForm||0;S.char.forms[af].powerSets.splice(psi,1);save();renderSheet();}
function delFormPower(psi,pwi){const af=S.char.activeForm||0;S.char.forms[af].powerSets[psi].powers.splice(pwi,1);save();renderSheet();}

// Gear (per-form). Browser modal can target hero forms or NPC draft forms.
let _gbTarget='form',_gbSearch='',_gbCat='';
function _ensureFormGear(form){if(form&&!Array.isArray(form.gear))form.gear=[];}
function openGearBrowser(target){_gbTarget=target||'form';_gbSearch='';_gbCat='';document.getElementById('gear-modal').classList.add('open');renderGB();}
function closeGB(){document.getElementById('gear-modal').classList.remove('open');}
function renderGB(){
  const q=_gbSearch.toLowerCase(),cf=_gbCat;
  const cats=['All','Melee','Ranged','Thrown','Armor','Utility'];
  const filtered=GEAR.filter(g=>{if(cf&&g.cat!==cf)return false;if(q&&!g.name.toLowerCase().includes(q)&&!(g.desc||'').toLowerCase().includes(q))return false;return true;});
  let h=`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div class="pg-title" style="font-size:20px">Gear</div><button class="btn btn-secondary btn-xs" onclick="closeGB()">Close</button></div>`;
  h+=`<input id="gb-search" placeholder="Search gear..." value="${esc(_gbSearch)}" oninput="_gbSearch=this.value;renderGB();_refocus('gb-search',this.selectionStart)" style="margin-bottom:8px">`;
  h+=`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">${cats.map(c=>`<button class="btn btn-xs ${(c==='All'&&!cf)||cf===c?'btn-primary':'btn-secondary'}" onclick="_gbCat='${c==='All'?'':c}';renderGB()">${c}</button>`).join('')}</div>`;
  h+=`<div style="max-height:55vh;overflow-y:auto">`;
  filtered.forEach(g=>{
    const stat=g.cat==='Armor'?`Armor ${g.armor}`:(g.rating!==undefined?`Weapon ${g.rating}${g.range!==undefined?' · Range '+g.range:''}`:'');
    h+=`<div class="card-sm" style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1"><div class="fw-700" style="font-size:13px">${esc(g.name)} <span class="text-muted" style="font-weight:400;font-size:10px">[${g.cat}]</span></div>${stat?`<div style="font-size:11px;color:var(--accent)">${stat}</div>`:''}${g.desc?`<div style="font-size:11px;color:var(--muted)">${esc(g.desc)}</div>`:''}${g.special&&g.special.length?`<div style="margin-top:3px">${g.special.map(s=>`<span class="tag tag-se">${esc(s)}</span>`).join(' ')}</div>`:''}</div><button class="btn btn-primary btn-xs" onclick="pickGear('${g.id}')">Add</button></div>`;
  });
  if(!filtered.length)h+='<div class="tac text-muted" style="padding:20px">No matches</div>';
  h+=`</div><div class="divider"></div><button class="btn btn-secondary btn-sm btn-full" onclick="addCustomGear()">Create Custom Gear</button></div>`;
  document.getElementById('gear-modal-body').innerHTML=h;
}
function pickGear(gearId){
  const g=GEAR.find(x=>x.id===gearId);if(!g)return;
  _addGearToTarget({gearId,customName:''});
}
function addCustomGear(){
  const n=(prompt('Gear name:')||'').trim();if(!n)return;
  const d=prompt('Description (optional):')||'';
  _addGearToTarget({custom:true,name:n,desc:d,cat:'Utility',special:[]});
}
function _addGearToTarget(item){
  if(_gbTarget==='form'){
    const af=S.char.activeForm||0,form=S.char.forms[af];
    _ensureFormGear(form);form.gear.push(item);save();closeGB();renderSheet();
  } else if(_gbTarget==='npc'){
    const af=S._npcDraft.activeForm||0,form=S._npcDraft.forms[af];
    _ensureFormGear(form);form.gear.push(item);save();closeGB();renderFullNPCEditor();
  }
}
function delFormGear(gi){const af=S.char.activeForm||0,form=S.char.forms[af];_ensureFormGear(form);form.gear.splice(gi,1);save();renderSheet();}
function delNPCGear(gi){const af=S._npcDraft.activeForm||0,form=S._npcDraft.forms[af];_ensureFormGear(form);form.gear.splice(gi,1);save();renderFullNPCEditor();}
function renderGearList(form,target){
  _ensureFormGear(form);
  let h=`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div class="label" style="margin:0">Items</div><button class="btn btn-gold btn-xs edit-only" onclick="openGearBrowser('${target}')">+ Add Item</button></div>`;
  if(!form.gear.length){h+=`<div style="font-size:11px;color:var(--muted);margin-top:6px">No items yet. Add weapons, armor, and utility gear appropriate for this form.</div>`;}
  form.gear.forEach((it,gi)=>{
    const g=it.custom?null:GEAR.find(x=>x.id===it.gearId);
    const name=it.customName||(g?g.name:(it.name||'Item'));
    const cat=g?g.cat:(it.cat||'Item');
    const stat=g?(g.cat==='Armor'?`Armor ${g.armor}`:(g.rating!==undefined?`Weapon ${g.rating}${g.range!==undefined?' · Range '+g.range:''}`:'')):'';
    const desc=g?g.desc:(it.desc||'');
    const special=g?g.special:(it.special||[]);
    const delFn=target==='form'?`delFormGear(${gi})`:`delNPCGear(${gi})`;
    h+=`<div class="card-sm mt-2" style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1"><div class="fw-700" style="font-size:13px">${esc(name)} <span class="text-muted" style="font-weight:400;font-size:10px">[${esc(cat)}]</span></div>${stat?`<div style="font-size:11px;color:var(--accent)">${stat}</div>`:''}${desc?`<div style="font-size:11px;color:var(--muted)">${esc(desc)}</div>`:''}${special&&special.length?`<div style="margin-top:3px">${special.map(s=>`<span class="tag tag-se">${esc(s)}</span>`).join(' ')}</div>`:''}</div><button class="btn btn-danger btn-xs edit-only" onclick="${delFn}">X</button></div>`;
  });
  h+=`</div>`;
  return h;
}
// NPC form helpers (mirror of hero form helpers, operating on _npcDraft)
function switchNPCForm(i){if(!S._npcDraft?.forms?.[i])return;S._npcDraft.activeForm=i;save();renderFullNPCEditor();}
function addNPCForm(){if(!S._npcDraft)return;const name=(prompt('New form name:','New Form')||'').trim();if(!name)return;if(!S._npcDraft.forms)S._npcDraft.forms=[];const basePS=S._npcDraft.forms[0]?.powerSets?JSON.parse(JSON.stringify(S._npcDraft.forms[0].powerSets)):[];S._npcDraft.forms.push({name,powerSets:basePS});S._npcDraft.activeForm=S._npcDraft.forms.length-1;save();renderFullNPCEditor();}
function deleteNPCForm(i){if(!S._npcDraft?.forms||S._npcDraft.forms.length<=1)return;if(!confirm('Delete "'+(S._npcDraft.forms[i].name||'this form')+'"? Its powers will be lost.'))return;S._npcDraft.forms.splice(i,1);if(S._npcDraft.activeForm>=S._npcDraft.forms.length)S._npcDraft.activeForm=S._npcDraft.forms.length-1;save();renderFullNPCEditor();}
function addNPCPowerSet(){const af=S._npcDraft.activeForm||0;if(!S._npcDraft.forms[af])return;S._npcDraft.forms[af].powerSets.push({name:'',aspect:'',powers:[]});save();renderFullNPCEditor();}
function delNPCPowerSet(psi){if(!confirm('Remove this power set?'))return;const af=S._npcDraft.activeForm||0;S._npcDraft.forms[af].powerSets.splice(psi,1);save();renderFullNPCEditor();}
function delNPCPower(psi,pwi){const af=S._npcDraft.activeForm||0;S._npcDraft.forms[af].powerSets[psi].powers.splice(pwi,1);save();renderFullNPCEditor();}

// Export an NPC (Main or Rogue) into a save slot as a playable character
function npcToCharacter(npc){
  const tone=getSeriesConfig().tone;
  const refresh=tone?.refresh||5;
  const phys=npc.skills?.['Physique']||0,will=npc.skills?.['Will']||0;
  const tb=tone?.stressBonus||0;
  const pb=phys>=5?2:phys>=3?1:0,wb=will>=5?2:will>=3?1:0;
  const ps=2+tb+pb,ms=2+tb+wb;
  const aspects=npc.aspects||[];
  const forms=npc.forms?JSON.parse(JSON.stringify(npc.forms))
    :[{name:'Main Form',powerSets:JSON.parse(JSON.stringify(npc.powerSets||[]))}];
  return{
    costumedName:npc.name,civilianName:'',
    aspects:{
      concept:aspects[0]||npc.desc||'',
      motivation:aspects[1]||'',
      contingent:[
        {cat:aspects[2]?'Aspect':'',text:aspects[2]||''},
        {cat:aspects[3]?'Aspect':'',text:aspects[3]||''},
        {cat:aspects[4]?'Aspect':'',text:aspects[4]||''}
      ]
    },
    supportingCast:[],roguesGallery:[],
    skills:JSON.parse(JSON.stringify(npc.skills||{})),
    refresh,fatePoints:refresh,
    stress:{physical:Array(ps).fill(false),mental:Array(ms).fill(false)},
    consequences:JSON.parse(JSON.stringify(npc.consequences||{mild:'',moderate:'',severe:''})),
    stunts:JSON.parse(JSON.stringify(npc.stunts||[])),
    forms,activeForm:0,
    gear:npc.gear||''
  };
}
function characterToNpc(char, existingId){
  const asp=[char.aspects&&char.aspects.concept,char.aspects&&char.aspects.motivation].concat(((char.aspects&&char.aspects.contingent)||[]).map(c=>c&&c.text)).filter(Boolean);
  const _hid=existingId||uid();
  return {id:_hid,heroId:_hid,type:'main',fromHero:true,sourceSaveId:currentSaveId,
    name:char.costumedName||'Unnamed Hero',desc:char.civilianName||'',
    aspects:asp,skills:JSON.parse(JSON.stringify(char.skills||{})),
    forms:JSON.parse(JSON.stringify(char.forms||[])),activeForm:char.activeForm||0,
    stunts:JSON.parse(JSON.stringify(char.stunts||[])),stress:[],
    consequences:JSON.parse(JSON.stringify(char.consequences||{mild:'',moderate:'',severe:''})),gear:char.gear||''};
}
function syncHeroToRoster(){
  if(!S||!S.char)return;const u=currentUniverse();if(!u)return;
  if(!S.char.heroId)S.char.heroId=uid();
  const ent=characterToNpc(S.char,S.char.heroId);
  const i=u.roster.findIndex(e=>e.id===ent.id);
  if(i>=0)u.roster[i]=ent;else u.roster.push(ent);
}
// With no slot cap there is nothing to overwrite, so the old numeric prompt
// becomes a straight "make this NPC playable" — it always creates a new save.
let _exportNpcIdx=null;
function exportNPCToSlot(npcIdx){
  const npc=S.npcs[npcIdx];if(!npc)return;
  _exportNpcIdx=npcIdx;
  let h=`<div class="pg-title" style="font-size:20px">Play as ${esc(npc.name)}</div>`;
  h+=`<div style="font-size:12px;color:var(--muted);margin:6px 0 12px">Creates a new save file with ${esc(npc.name)} as a playable character. Your current game is untouched.</div>`;
  const mine=listSaves(S.universeId).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  if(mine.length)h+=`<div class="card-sm"><div class="label mb-1">Already in this universe</div>${mine.map(s=>`<div style="font-size:12px;color:var(--muted)">• ${esc(s.name||'(unnamed hero)')}</div>`).join('')}</div>`;
  h+=`<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-secondary" style="flex:1" onclick="closeExportNPC()">Cancel</button><button class="btn btn-primary" style="flex:1" onclick="confirmExportNPC(false)">Create Save</button></div>`;
  h+=`<div class="tac mt-2"><button class="btn btn-gold btn-xs" onclick="confirmExportNPC(true)">Create & switch to it →</button></div>`;
  document.getElementById('npc-export-modal-body').innerHTML=h;
  document.getElementById('npc-export-modal').classList.add('open');
}
function closeExportNPC(){document.getElementById('npc-export-modal').classList.remove('open');_exportNpcIdx=null;}
function confirmExportNPC(switchTo){
  const npc=S.npcs[_exportNpcIdx];if(!npc)return closeExportNPC();
  const newState=defaultState();
  newState.series=JSON.parse(JSON.stringify(S.series));
  newState.universeId=S.universeId;
  newState.char=npcToCharacter(npc);
  const id=createSave(newState);
  if(!id)return;
  const nm=npc.name;
  closeExportNPC();
  if(switchTo){loadSave(id);renderAll();showTab('hero');}
  else alert('"'+nm+'" is now a save file you can switch to from Save Files.');
}

// ═══ PRINT SHEET RENDERER ═══
// The letter-portrait stylesheet every printed page shares. Lifted verbatim out of
// printCharSheet so NPCs, teams, region maps and the issue log can all print on the
// same paper, with the print-centre-only rules appended after it.

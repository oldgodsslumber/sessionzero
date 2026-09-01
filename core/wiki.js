const LORE_TYPES=[
  {id:'character',label:'Character',ico:'\u{1F464}'},
  {id:'location',label:'Location',ico:'\u{1F3D9}'},
  {id:'organization',label:'Organization',ico:'\u{1F6E1}'},
  {id:'item',label:'Item',ico:'\u{1F4E6}'},
  {id:'event',label:'Event',ico:'⚡'},
  {id:'lore',label:'Lore',ico:'\u{1F4D6}'},
  {id:'plot',label:'Plot Thread',ico:'\u{1F5DD}'}
];
function loreTypeDef(t){return LORE_TYPES.find(x=>x.id===t)||LORE_TYPES[5];}

// Lore lives on the universe next to the NPC roster, so every save slot bound
// to that universe sees the same wiki — same mechanism S.npcs already uses.
function ensureLore(u){if(u&&!Array.isArray(u.lore))u.lore=[];return u;}
function listLore(){const u=currentUniverse();if(!u)return[];ensureLore(u);u.lore.forEach(ensureId);return u.lore;}
function saveLoreEntry(entry){const u=currentUniverse();if(!u)return null;ensureLore(u);ensureId(entry);entry.updatedAt=Date.now();
  const i=u.lore.findIndex(e=>e.id===entry.id);if(i>=0)u.lore[i]=entry;else{entry.createdAt=Date.now();u.lore.push(entry);}
  saveUniverses();return entry;}
function deleteLoreEntry(id){const u=currentUniverse();if(!u)return;ensureLore(u);u.lore=u.lore.filter(e=>e.id!==id);saveUniverses();}
function blankLoreEntry(type){return{type:type||'character',name:'',aliases:[],tags:[],body:'',secret:'',hidden:false,npcId:null,createdBy:'user'};}

// ─── Parsing model output ─────────────────────────────────
// Never trust the model's formatting. Try strict JSON, then a repaired parse,
// then an [...] substring, then a brace scan that digs objects out of prose.
// Everything that survives goes through sanitizeLore, which is what actually
// makes the data safe — anything without a usable name is dropped, not shown.
function _loreRelaxedParse(s){
  try{return JSON.parse(s);}catch(e){}
  try{return JSON.parse(String(s).replace(/,\s*([}\]])/g,'$1'));}catch(e){return undefined;}
}
function _loreScanObjects(s){
  const out=[];let depth=0,start=-1,inStr=false,esc=false,q='';
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(inStr){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===q)inStr=false;continue;}
    if(c==='"'||c==="'"){inStr=true;q=c;}
    else if(c==='{'){if(depth===0)start=i;depth++;}
    else if(c==='}'){if(depth>0){depth--;if(depth===0&&start>=0){out.push(s.slice(start,i+1));start=-1;}}}
  }
  return out;
}
function _loreArr(v){
  let list=[];
  if(Array.isArray(v))list=v;else if(typeof v==='string')list=v.split(',');
  return list.map(x=>String(x==null?'':x).replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,12);
}
function sanitizeLore(o){
  if(!o||typeof o!=='object'||Array.isArray(o))return null;
  const name=String(o.name==null?'':o.name).replace(/\s+/g,' ').trim();
  if(!name||name.length>100)return null; // a sentence, not an entry name
  let type=String(o.type==null?'':o.type).toLowerCase().trim();
  if(!LORE_TYPES.some(t=>t.id===type))type='lore';
  const clean=function(val,cap){
    let s=String(val==null?'':val).replace(/```[\s\S]*?```/g,' ').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
    if(s.length>cap)s=s.slice(0,cap).trim()+'…';
    return s;
  };
  const out={type:type,name:name,aliases:_loreArr(o.aliases),tags:_loreArr(o.tags),body:clean(o.body,6000)};
  if(o.hidden===true||o.hidden==='true')out.hidden=true;
  const secret=clean(o.secret,2000);if(secret)out.secret=secret;
  return out;
}
function parseLoreBlocks(text){
  const candidates=[];
  const addFrom=function(v){
    if(Array.isArray(v))v.forEach(addFrom);
    else if(v&&typeof v==='object'){
      if(Array.isArray(v.entries))v.entries.forEach(addFrom);
      else candidates.push(v);
    }
  };
  let t=String(text||'').trim();
  // Parse the raw reply BEFORE unwrapping any fence. A body that itself
  // contains a ``` block would otherwise get mistaken for the wrapper and
  // shred the whole payload; sanitizeLore strips stray fences from bodies.
  const whole=_loreRelaxedParse(t);
  if(whole!==undefined)addFrom(whole);
  if(!candidates.length){
    const fence=t.match(/```(?:json)?[ \t]*\r?\n?([\s\S]*?)```/i);
    if(fence){t=fence[1].trim();const inner=_loreRelaxedParse(t);if(inner!==undefined)addFrom(inner);}
  }
  if(!candidates.length){
    const open=t.indexOf('['),close=t.lastIndexOf(']');
    if(open>=0&&close>open){const arr=_loreRelaxedParse(t.slice(open,close+1));if(arr!==undefined)addFrom(arr);}
  }
  if(!candidates.length)_loreScanObjects(t).forEach(function(chunk){const o=_loreRelaxedParse(chunk);if(o!==undefined)addFrom(o);});
  const cleaned=[];
  candidates.forEach(function(o){const s=sanitizeLore(o);if(s)cleaned.push(s);});
  return cleaned;
}

// A name like "the masked woman" is a placeholder; "Selina Vane" is a real
// name. Used to retitle an entry in place once a figure is properly named.
function isDescriptiveHandle(n){
  const s=String(n||'').trim();
  if(!s)return true;
  if(/^(the|a|an) /i.test(s))return true;
  return !/[A-Z]/.test(s.slice(1))&&s.split(/\s+/).length>1;
}

// Match on incoming name OR any incoming alias against existing name-or-alias,
// so a record carrying a newly-learned name plus the old handle updates the
// entry instead of duplicating it. Bodies APPEND rather than overwrite.
function upsertLore(data){
  const name=String(data.name||'').trim();if(!name)return null;
  const list=listLore();
  const incoming=[name].concat(data.aliases||[]).map(n=>String(n||'').trim().toLowerCase()).filter(Boolean);
  const found=list.find(function(e){
    const names=[e.name].concat(e.aliases||[]).map(n=>String(n||'').toLowerCase());
    return names.some(n=>incoming.indexOf(n)>=0);
  });
  if(found){
    found.aliases=found.aliases||[];found.tags=found.tags||[];
    if(name.toLowerCase()!==found.name.toLowerCase()&&isDescriptiveHandle(found.name)&&!isDescriptiveHandle(name)){
      if(found.aliases.indexOf(found.name)<0)found.aliases.push(found.name);
      found.name=name;
    }
    const oldBody=String(found.body||'').trim(),newBody=String(data.body||'').trim();
    if(newBody){
      if(!oldBody)found.body=newBody;
      else if(newBody.indexOf(oldBody)>=0)found.body=newBody;                     // new supersedes
      else if(oldBody.indexOf(newBody)<0)found.body=oldBody+'\n\n'+newBody;       // genuinely new
      // else: already covered — leave it alone so re-runs don't bloat the entry
    }
    if(data.type)found.type=data.type;
    if(data.hidden===true)found.hidden=true;
    if(data.secret&&String(data.secret).trim())found.secret=String(data.secret).trim();
    (data.aliases||[]).forEach(function(a){if(a&&found.aliases.indexOf(a)<0&&a.toLowerCase()!==found.name.toLowerCase())found.aliases.push(a);});
    (data.tags||[]).forEach(function(t){if(t&&found.tags.indexOf(t)<0)found.tags.push(t);});
    saveLoreEntry(found);
    return{updated:true,entry:found};
  }
  const entry=Object.assign(blankLoreEntry(data.type),{
    type:data.type||'lore',name:name,aliases:data.aliases||[],tags:data.tags||[],
    body:data.body||'',secret:data.secret||'',hidden:data.hidden===true,createdBy:'llm'
  });
  saveLoreEntry(entry);
  return{updated:false,entry:entry};
}

// ─── Intake prompt ────────────────────────────────────────
// A filing clerk, not a GM: no narration, no invented plot, no commentary.
function loreIntakePrompt(existingNames){
  const lines=[
    'You are an archivist for a superhero comic-book RPG universe. The user has given you freeform notes about their world.',
    'Your ONLY job is to file the facts in those notes into wiki entries. Do NOT narrate, do NOT address the user, do NOT write commentary, and do NOT invent plot developments. Record only what the notes state or clearly imply.',
    'Be thorough: capture every person, place, team, significant object, and incident described. Keep distinct things in SEPARATE entries — never lump several subjects into one entry. Put each fact in the entry it belongs to.',
    '',
    'Entry types — pick the best fit for each:',
    '- "character": any individual person — heroes, villains, supporting cast, civilians.',
    '- "location": cities, neighborhoods, bases, headquarters, landmarks, other dimensions.',
    '- "organization": teams, agencies, corporations, criminal syndicates, cults.',
    '- "item": artifacts, signature equipment, vehicles, macguffins.',
    '- "event": incidents that happened — origins, disasters, battles, crimes.',
    '- "lore": background concepts, history, rules of the setting, power sources.',
    '- "plot": ongoing threads, unresolved mysteries, schemes in motion.',
    '',
    'Return ONLY a JSON array. No prose before or after it. Each element:',
    '{"type":"character","name":"Doctor Malice","aliases":["Elias Kane"],"tags":["villain","gotham"],"body":"What is known about them.","secret":"GM-only twist, optional.","hidden":false}',
    '',
    '"name" is the common name — short, under 100 characters, never a sentence.',
    '"aliases" holds other names the same subject goes by (real name, codename, nicknames). This is how entries get matched later, so include them.',
    '"body" is plain prose. No markdown headers, no bullet syntax, no code fences.',
    'Set "hidden": true only when the notes mark something as a secret the players should not see. Use "secret" for a GM-only detail attached to an otherwise public entry.'
  ];
  if(existingNames&&existingNames.length){
    lines.push('','Already in the wiki. To ADD to one of these, reuse its EXACT name — that updates the entry instead of creating a duplicate:');
    lines.push(existingNames.slice(0,200).map(n=>'- '+n).join('\n'));
  }
  return lines.join('\n');
}

// ─── Wiki page ────────────────────────────────────────────
let _wikiEditMode=false,_wikiType='',_wikiQuery='',_wikiShowHidden=false,_wikiOpenId=null,_wikiBusy=false,_wikiStatus='',_wikiIntakeText='';
function toggleWikiEdit(){_wikiEditMode=!_wikiEditMode;renderWiki();}
function wikiVisible(){
  const q=_wikiQuery.toLowerCase();
  return listLore().filter(function(e){
    if(e.hidden&&!_wikiShowHidden)return false;
    if(_wikiType&&e.type!==_wikiType)return false;
    if(q){
      const hay=([e.name].concat(e.aliases||[],e.tags||[]).join(' ')+' '+(e.body||'')).toLowerCase();
      if(hay.indexOf(q)<0)return false;
    }
    return true;
  }).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
}
function renderWiki(){
  const el=document.getElementById('wiki-content');if(!el)return;
  if(!currentUniverse()){el.innerHTML=universeBarHTML()+`<div class="card tac"><div class="pg-title" style="font-size:18px">No universe yet</div><div class="pg-sub">The wiki belongs to a universe. Create one first.</div></div>`;return;}
  const all=listLore();
  let h=universeBarHTML()+`<div class="${_wikiEditMode?'':'no-edit'}">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:start;gap:8px;flex-wrap:wrap;margin-bottom:4px"><div><div class="pg-title">Wiki</div><div class="pg-sub">Shared across every hero in this universe</div></div>${editToggleBtn(_wikiEditMode,'toggleWikiEdit')}</div>`;
  if(!_wikiEditMode)h+=noEditBanner();

  // Two buckets. The half that ASKS — intake, search, the type filters — and
  // the half that ANSWERS. On a desktop the asking half is a sticky rail, so a
  // filter no longer scrolls away from the entries it is filtering; on a phone
  // .wiki-col is display:contents and this is the same page it always was.
  h+=`<div class="wiki-grid"><div class="wiki-col wiki-side">`;

  // Intake — the headline feature, so it leads the page
  h+=`<div class="card edit-only" style="border-color:var(--gold)">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px"><div class="label" style="margin:0">Add in plain language</div><button class="btn btn-secondary btn-xs" onclick="openAISetup()" title="Choose and configure the AI backend">${llmReady()?'⚙ '+esc(llmBackendLabel()):'⚙ AI Setup'}</button></div>`;
  h+=`<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Describe anything about your universe — people, places, teams, artifacts, incidents. It gets filed into entries below. This never touches your hero sheet or the story.</div>`;
  h+=`<textarea id="wiki-intake" rows="4" oninput="_wikiIntakeText=this.value" placeholder="e.g. Doctor Malice, real name Elias Kane, runs the Ninth Circle out of a converted cathedral in Harrow Bay. He blames Ironclad for the lab accident that scarred him.">${esc(_wikiIntakeText)}</textarea>`;
  h+=`<div style="display:flex;gap:6px;align-items:center;margin-top:6px"><button class="btn btn-primary btn-sm" onclick="runWikiIntake()" ${_wikiBusy?'disabled':''}>${_wikiBusy?'Reading…':'Add to Wiki'}</button><button class="btn btn-secondary btn-sm" onclick="openLoreEditor(null)">+ Manual Entry</button><span style="flex:1"></span><span style="font-size:11px;color:var(--muted)">${esc(_wikiStatus)}</span></div>`;
  h+=`</div>`;

  // Browse controls
  h+=`<input id="wiki-search" type="search" placeholder="Search names, aliases, tags, text…" value="${esc(_wikiQuery)}" oninput="_wikiQuery=this.value;renderWiki();_refocus('wiki-search',this.selectionStart)" style="margin-bottom:6px">`;
  h+=`<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px">`;
  h+=`<button class="btn btn-xs ${_wikiType?'btn-secondary':'btn-primary'}" onclick="_wikiType='';renderWiki()" style="font-size:10px;padding:3px 7px">All (${all.filter(e=>e.hidden?_wikiShowHidden:true).length})</button>`;
  LORE_TYPES.forEach(function(t){
    const n=all.filter(e=>e.type===t.id&&(e.hidden?_wikiShowHidden:true)).length;
    if(!n&&_wikiType!==t.id)return;
    h+=`<button class="btn btn-xs ${_wikiType===t.id?'btn-primary':'btn-secondary'}" onclick="_wikiType='${t.id}';renderWiki()" style="font-size:10px;padding:3px 7px">${t.ico} ${t.label} (${n})</button>`;
  });
  if(all.some(e=>e.hidden)||_wikiShowHidden)h+=`<button class="btn btn-xs ${_wikiShowHidden?'btn-gold':'btn-secondary'}" onclick="_wikiShowHidden=!_wikiShowHidden;renderWiki()" style="font-size:10px;padding:3px 7px" title="Reveal GM-only entries">${_wikiShowHidden?'\u{1F513} Hiding shown':'\u{1F512} Show hidden'}</button>`;
  h+=`</div>`;

  h+=`</div><div class="wiki-col wiki-list">`;

  const v=wikiVisible();
  if(!v.length){
    h+=`<div class="card tac" style="grid-column:1/-1"><div class="fw-700" style="margin-bottom:4px">${all.length?'Nothing matches that.':'The wiki is empty.'}</div><div style="font-size:12px;color:var(--muted)">${all.length?'Try a different search or type filter.':'Type some notes about your world above and let the AI file them, or add an entry by hand.'}</div></div>`;
  }else{
    v.forEach(function(e){
      const td=loreTypeDef(e.type);
      h+=`<div class="card-sm" style="cursor:pointer${e.hidden?';border-color:var(--gold)':''}" onclick="openLoreEditor('${e.id}')">`;
      h+=`<div style="display:flex;justify-content:space-between;align-items:start;gap:8px"><div style="flex:1;min-width:0">`;
      h+=`<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap"><span class="tag" style="background:var(--surface3);color:var(--muted);border:1px solid var(--border);font-size:9px">${td.ico} ${td.label}</span>`;
      if(e.hidden)h+=`<span class="tag" style="background:rgba(212,160,32,.15);color:var(--gold);border:1px solid var(--gold);font-size:9px" title="GM only — hidden from players">\u{1F512} hidden</span>`;
      else if(_wikiShowHidden&&e.secret&&e.secret.trim())h+=`<span class="tag" style="background:rgba(212,160,32,.15);color:var(--gold);border:1px solid var(--gold);font-size:9px" title="Public entry with a GM-only secret">\u{1F512} secret</span>`;
      if(e.createdBy==='llm')h+=`<span class="tag" style="background:var(--surface3);color:var(--blue);border:1px solid var(--border);font-size:9px" title="Filed by the AI from your notes">AI</span>`;
      if(e.npcId)h+=`<span class="tag" style="background:var(--surface3);color:var(--purple);border:1px solid var(--border);font-size:9px" title="Linked to an NPC on the roster">\u2299 NPC</span>`;
      h+=`</div>`;
      h+=`<div class="fw-700" style="margin-top:3px">${esc(e.name)}</div>`;
      if(e.aliases&&e.aliases.length)h+=`<div style="font-size:11px;color:var(--muted)">aka ${esc(e.aliases.join(', '))}</div>`;
      if(e.body)h+=`<div style="font-size:12px;color:var(--muted);margin-top:3px">${esc(e.body.slice(0,170))}${e.body.length>170?'…':''}</div>`;
      if(_wikiShowHidden&&!e.hidden&&e.secret&&e.secret.trim())h+=`<div style="font-size:11px;color:var(--gold);margin-top:3px">\u{1F512} ${esc(e.secret.trim().slice(0,140))}${e.secret.trim().length>140?'…':''}</div>`;
      if(e.tags&&e.tags.length)h+=`<div style="font-size:10px;color:var(--muted);margin-top:3px">${e.tags.map(t=>'#'+esc(t)).join('  ')}</div>`;
      h+=`</div><div class="edit-only" style="display:flex;flex-direction:column;gap:4px" onclick="event.stopPropagation()">`;
      h+=`<button class="btn btn-secondary btn-xs" onclick="openLoreEditor('${e.id}')">Edit</button>`;
      h+=`<button class="btn btn-danger btn-xs" onclick="delLore('${e.id}')">X</button>`;
      h+=`</div></div></div>`;
    });
  }

  h+=`</div></div>`;   // close the entry list and the grid

  // Theme swatches — the Wiki replaced the Theme button in the mobile nav, so
  // the swatches move here. Hidden on desktop, where the sidebar still has them.
  h+=`<div class="wiki-theme-strip"><div class="label mb-1" style="text-align:center">Theme</div><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">`;
  [['','Classic Comics','#0a0e1a,#e63946'],['dark','Dark & Gritty','#0c0c0c,#d4a020'],['cosmic','Cosmic','#0a0020,#ff2d78'],['street','Street Level','#111510,#e8a020'],['golden','Golden Age','#1a140e,#cc3333']].forEach(function(t){
    const on=(localStorage.getItem('dc_theme')||'')===t[0];
    h+=`<button class="theme-swatch${on?' active':''}" data-theme="${t[0]}" title="${esc(t[1])}" onclick="setTheme('${t[0]}')" style="width:32px;height:32px;background:linear-gradient(135deg,${t[2]})"></button>`;
  });
  h+=`</div></div>`;

  h+=`</div>`;
  el.innerHTML=h;
}
// Two-way links found by scanning text for other entries' names and aliases.
// Word-boundary matched so "Kane" doesn't light up inside "Kanetown", and
// short names are skipped because they produce nothing but false positives.
function _loreMentions(text,entry){
  const hay=String(text||'');
  if(!hay)return[];
  return listLore().filter(function(o){
    if(o.id===entry.id)return false;
    return [o.name].concat(o.aliases||[]).some(function(n){
      n=String(n||'').trim();
      if(n.length<4)return false;
      return new RegExp('\\b'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(hay);
    });
  });
}
function loreRelated(entry){
  const out=_loreMentions((entry.body||'')+'\n'+(entry.secret||''),entry);
  const outIds=out.map(o=>o.id);
  const inc=listLore().filter(function(o){
    if(o.id===entry.id||outIds.indexOf(o.id)>=0)return false;
    if(o.hidden&&!_wikiShowHidden)return false;
    return _loreMentions((o.body||'')+'\n'+(o.secret||''),o).some(m=>m.id===entry.id);
  });
  return{out:out.filter(o=>!o.hidden||_wikiShowHidden),in:inc};
}

function delLore(id){
  const e=listLore().find(x=>x.id===id);if(!e)return;
  if(!confirm('Delete "'+e.name+'"? This removes it for every hero in this universe.'))return;
  deleteLoreEntry(id);renderWiki();
}

async function runWikiIntake(){
  const ta=document.getElementById('wiki-intake');
  const text=(ta?ta.value:'').trim();
  if(!text||_wikiBusy)return;
  if(!currentUniverse()){alert('Create a universe first.');return;}
  if(!llmReady()){_wikiStatus='';openAISetup();return;}
  _wikiIntakeText=text;_wikiBusy=true;_wikiStatus='';renderWiki();
  try{
    const existing=listLore().map(e=>e.name);
    const reply=await llmChat({system:loreIntakePrompt(existing),user:text,jsonMode:true,maxTokens:8192,temperature:0.2});
    const datas=parseLoreBlocks(reply);
    console.log('[wiki] parsed '+datas.length+' entries from '+(reply||'').length+' chars',datas.length?'':reply);
    let created=0,updated=0;
    datas.forEach(function(d){const r=upsertLore(d);if(!r)return;if(r.updated)updated++;else created++;});
    if(!datas.length){
      _wikiStatus='Nothing filed — try naming specific people, places or teams.';
    }else{
      _wikiIntakeText='';
      _wikiStatus=created+' added, '+updated+' updated.';
      flashSaved();
    }
  }catch(err){
    console.error(err);
    _wikiStatus=err.message;
  }
  _wikiBusy=false;renderWiki();
}

function openLoreEditor(id){
  _wikiOpenId=id;
  if(!_wikiEditMode&&id===null)return;
  document.getElementById('lore-modal').classList.add('open');
  renderLoreEditor();
}
function closeLoreEditor(){document.getElementById('lore-modal').classList.remove('open');_wikiOpenId=null;renderWiki();}
function renderLoreEditor(){
  const e=_wikiOpenId?listLore().find(x=>x.id===_wikiOpenId):blankLoreEntry(_wikiType||'character');
  if(!e){closeLoreEditor();return;}
  window._loreDraft=e;
  const ro=_wikiEditMode?'':'readonly',dis=_wikiEditMode?'':'disabled';
  // Modal body sits outside the page wrapper, so it carries its own no-edit
  // class — otherwise .edit-only controls stay live while the sheet is locked.
  let h=`<div class="${_wikiEditMode?'':'no-edit'}"><div class="pg-title" style="font-size:20px;margin-bottom:10px">${_wikiOpenId?'Edit Entry':'New Entry'}</div>`;
  h+=`<div class="form-group"><label>Type</label><select id="lore-type" ${dis}>${LORE_TYPES.map(t=>`<option value="${t.id}" ${e.type===t.id?'selected':''}>${t.ico} ${t.label}</option>`).join('')}</select></div>`;
  h+=`<div class="form-group"><label>Name</label><input id="lore-name" value="${esc(e.name)}" ${ro} placeholder="Doctor Malice"></div>`;
  h+=`<div class="form-group"><label>Aliases <span style="font-weight:400;text-transform:none;color:var(--muted)">(comma-separated — these are how the AI matches updates)</span></label><input id="lore-aliases" value="${esc((e.aliases||[]).join(', '))}" ${ro} placeholder="Elias Kane, The Surgeon"></div>`;
  h+=`<div class="form-group"><label>Tags</label><input id="lore-tags" value="${esc((e.tags||[]).join(', '))}" ${ro} placeholder="villain, harrow bay"></div>`;
  h+=`<div class="form-group"><label>Body</label><textarea id="lore-body" rows="7" ${ro} placeholder="What's known about this.">${esc(e.body)}</textarea></div>`;
  h+=`<div class="form-group"><label>Secret <span style="font-weight:400;text-transform:none;color:var(--muted)">(GM only — the body above stays public)</span></label><textarea id="lore-secret" rows="3" ${ro} placeholder="The twist the players don't know yet.">${esc(e.secret||'')}</textarea></div>`;
  h+=`<label class="edit-only" style="display:flex;gap:8px;align-items:flex-start;font-size:12px;margin-bottom:10px"><input type="checkbox" id="lore-hidden" ${e.hidden?'checked':''} style="width:auto;margin-top:2px"><span>Hide the whole entry — it won't appear in the wiki unless "Show hidden" is on.</span></label>`;

  // NPC link — lore and stats stay in their own homes, joined by id
  if(e.type==='character'){
    const roster=(currentUniverse()?.roster||[]).filter(n=>!n.fromHero);
    const linked=e.npcId?roster.find(n=>n.id===e.npcId):null;
    h+=`<div class="card-sm" style="border-color:var(--purple)"><div class="label mb-1">Roster Link</div>`;
    if(linked){
      h+=`<div style="font-size:12px;margin-bottom:6px">Linked to <span class="fw-700">${esc(linked.name)}</span> on the NPC roster. Stats live there; lore lives here.</div>`;
      h+=`<div class="edit-only" style="display:flex;gap:4px;flex-wrap:wrap"><button class="btn btn-gold btn-xs" onclick="gotoLinkedNPC('${e.npcId}')">Open in NPC Builder</button><button class="btn btn-secondary btn-xs" onclick="setLoreNPC('')">Unlink</button></div>`;
    }else{
      h+=`<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Link this entry to an NPC to give it stats, powers and skills — without copying the lore over.</div>`;
      h+=`<div class="edit-only" style="display:flex;gap:4px;flex-wrap:wrap"><select id="lore-npc" style="flex:1;font-size:12px"><option value="">— Link existing NPC —</option>${roster.map(n=>`<option value="${n.id}">${esc(n.name)}</option>`).join('')}</select><button class="btn btn-secondary btn-xs" onclick="setLoreNPC(document.getElementById('lore-npc').value)">Link</button><button class="btn btn-gold btn-xs" onclick="createNPCFromLore()">Create NPC</button></div>`;
    }
    h+=`</div>`;
  }

  // Related — derived from name/alias mentions, so navigation works without
  // asking the user (or the model) to write any link syntax.
  if(_wikiOpenId){
    const rel=loreRelated(e);
    if(rel.out.length||rel.in.length){
      h+=`<div class="card-sm"><div class="label mb-1">Related</div>`;
      if(rel.out.length)h+=`<div style="font-size:10px;color:var(--muted);margin-bottom:3px">Mentioned here</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${rel.out.map(r=>`<button class="btn btn-secondary btn-xs" onclick="openLoreEditor('${r.id}')">${loreTypeDef(r.type).ico} ${esc(r.name)}</button>`).join('')}</div>`;
      if(rel.in.length)h+=`<div style="font-size:10px;color:var(--muted);margin-bottom:3px">Mentions this</div><div style="display:flex;flex-wrap:wrap;gap:4px">${rel.in.map(r=>`<button class="btn btn-secondary btn-xs" onclick="openLoreEditor('${r.id}')">${loreTypeDef(r.type).ico} ${esc(r.name)}</button>`).join('')}</div>`;
      h+=`</div>`;
    }
  }

  h+=`<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-secondary" style="flex:1" onclick="closeLoreEditor()">${_wikiEditMode?'Cancel':'Close'}</button>`;
  if(_wikiEditMode){
    if(_wikiOpenId)h+=`<button class="btn btn-danger" onclick="if(confirm('Delete this entry?')){deleteLoreEntry('${_wikiOpenId}');closeLoreEditor();}">Delete</button>`;
    h+=`<button class="btn btn-primary" style="flex:1" onclick="saveLoreFromEditor()">Save</button>`;
  }
  h+=`</div></div>`;
  document.getElementById('lore-modal-body').innerHTML=h;
}
function _loreReadEditor(){
  const g=id=>document.getElementById(id),split=v=>String(v||'').split(',').map(s=>s.trim()).filter(Boolean);
  const e=window._loreDraft||blankLoreEntry();
  e.type=g('lore-type')?.value||e.type;
  e.name=(g('lore-name')?.value||'').trim();
  e.aliases=split(g('lore-aliases')?.value);
  e.tags=split(g('lore-tags')?.value);
  e.body=g('lore-body')?.value||'';
  e.secret=g('lore-secret')?.value||'';
  e.hidden=!!(g('lore-hidden')&&g('lore-hidden').checked);
  return e;
}
function saveLoreFromEditor(){
  const e=_loreReadEditor();
  if(!e.name){alert('Name required');return;}
  saveLoreEntry(e);
  _wikiOpenId=e.id;
  flashSaved();closeLoreEditor();
}
function setLoreNPC(npcId){
  const e=_loreReadEditor();
  e.npcId=npcId||null;
  saveLoreEntry(e);_wikiOpenId=e.id;renderLoreEditor();
}
// Spin a roster NPC out of a lore entry: name and blurb carry over, stats are
// built in the NPC Builder. The two stay joined by id, not duplicated.
function createNPCFromLore(){
  const e=_loreReadEditor();
  if(!e.name){alert('Give the entry a name first.');return;}
  const npc=ensureId({type:'rogue',name:e.name,desc:(e.body||'').slice(0,200),aspects:[],skills:{},
    forms:[{name:'Main Form',powerSets:[],gear:[]}],activeForm:0,stunts:[],
    stress:Array(4).fill(false),consequences:{mild:'',moderate:'',severe:''}});
  S.npcs.push(npc);save();
  e.npcId=npc.id;saveLoreEntry(e);_wikiOpenId=e.id;
  closeLoreEditor();
  showTab('npcs');_npcTab='rogue';openFullNPCBuilder(S.npcs.indexOf(npc));
}
function gotoLinkedNPC(npcId){
  const i=S.npcs.findIndex(n=>n.id===npcId);
  if(i<0){alert('That NPC is no longer on the roster.');return;}
  closeLoreEditor();showTab('npcs');_npcTab=S.npcs[i].type||'rogue';openFullNPCBuilder(i);
}

document.addEventListener('click',function(e){if(e.target&&e.target.classList&&e.target.classList.contains('modal-overlay')&&!e.target.classList.contains('locked'))e.target.classList.remove('open');});
document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('.modal-overlay.open').forEach(function(m){if(!m.classList.contains('locked'))m.classList.remove('open');});});
// ═══════════════════════════════════════════════════════════
// MULTIPLAYER (optional — see MULTIPLAYER.md)
// ═══════════════════════════════════════════════════════════
// With no config the app is exactly the offline app it was: no SDK is fetched,
// no network call is made, and the Multiplayer button explains what to do.
// The config lives in firebase-config.js, loaded on demand so a solo session
// never touches it — see MULTIPLAYER.md. It sits in its own small file so a
// fork can point at a different Firebase project without editing this one.
window.FIREBASE_CONFIG=window.FIREBASE_CONFIG||{
  apiKey:'', authDomain:'', databaseURL:'', projectId:'', appId:''
};

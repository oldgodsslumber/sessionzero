let _npcTab='',_npcEdit=null,_npcFullMode=false;

// The kinds of thing on the roster. Cast, Rogues, Nameless, Main and Team are
// FATE's categories and Daring Comics' cast list — in a dungeon there are Mobs,
// Bosses and the people you meet, and there is no super-team at all. A pack
// declares its own; one that says nothing gets the comic's, which is what every
// game used to get.
const NPC_TABS_DEFAULT=[{id:'supporting',label:'Cast'},{id:'rogue',label:'Rogues'},{id:'nameless',label:'Nameless'},{id:'main',label:'Main'},{id:'team',label:'Team'}];
const NPC_TYPE_LABELS_DEFAULT={supporting:'Cast Member',rogue:'Rogue',nameless:'Nameless',main:'Main NPC'};

function npcKinds(){
  const k=(SYS&&SYS.npc&&SYS.npc.kinds);
  const list=(typeof k==='function')?k():k;
  return (Array.isArray(list)&&list.length)?list:NPC_TABS_DEFAULT;
}
function npcKindLabel(id){
  const k=npcKinds().filter(function(x){return x.id===id;})[0];
  return (k&&(k.one||k.label))||NPC_TYPE_LABELS_DEFAULT[id]||id;
}
function npcFirstKind(){return (npcKinds()[0]||{}).id||'supporting';}

// Which tab is open. It cannot be a constant any more: 'supporting' is not a
// kind of thing in every game.
function npcTab(){
  const ids=npcKinds().map(function(k){return k.id;});
  if(ids.indexOf(_npcTab)<0)_npcTab=npcFirstKind();
  return _npcTab;
}

// An entry filed under a kind this game does not have — one made before the
// pack described its own roster, or imported from elsewhere — belongs in the
// first one rather than nowhere. It is shown, not silently dropped.
function npcKindOf(n){
  const ids=npcKinds().map(function(k){return k.id;});
  const t=(n&&n.type)||'';
  return ids.indexOf(t)>=0?t:npcFirstKind();
}
const NPC_SKILL_HINTS={supporting:'Supporting cast usually need 1-3 skills at Average(+1) to Good(+3) — enough to be useful in a scene.',rogue:'Rogues need 3-6 skills at Good(+3) to Fantastic(+6).',nameless:'Nameless goons rarely need more than 1-2 skills. The Obstacle rating usually does the work.',main:'Main NPCs are built like heroes — 5-8 skills spanning the ladder.'};
// Expandable roster cards. Tap a card header to reveal the full stat block.
let _npcOpen={};
function npcKey(npc,ri){return npc.id||('idx'+ri);}
function toggleNPCCard(k){_npcOpen[k]=!_npcOpen[k];renderNPCs();}
function npcPowerSets(npc){return npc.forms?npc.forms.flatMap(f=>f.powerSets||[]):(npc.powerSets||[]);}
// What a card says about one of these, in chips. The shell's own chips are
// Fate's — skills, powers, forms, stunts, stress boxes — so a Mob built with
// this pack's own builder showed a name and nothing else: Level, Health Bar
// slots, DR, Evade and its attacks were all stored and none of them drawn.
function npcChips(npc){
  const fn=(SYS&&SYS.npc&&SYS.npc.readout);
  if(!fn)return null;
  try{
    const out=fn(npc);
    return Array.isArray(out)?out.filter(Boolean):null;
  }catch(e){return null;}
}

// The stat block behind the caret, for a pack that describes its own entries.
// Built from the same field list the builder uses, so what you typed is what
// you read back — in the groups the pack put them in.
function npcPackBody(npc){
  const fields=(typeof sysNpcFields==='function')?sysNpcFields():null;
  if(!fields||!fields.length)return '';
  let h='',group=null;
  fields.forEach(function(f){
    let v=npc[f.key];
    if(f.derive){try{v=f.derive(npc);}catch(e){v=undefined;}}
    if(v===undefined||v===null||String(v).trim()==='')return;
    if(f.group!==group){
      group=f.group;
      h+=`<div class="label mb-1" style="margin-top:6px">${esc(group||'')}</div>`;
    }
    h+=`<div class="npc-derived"><span>${esc(f.label)}</span><strong>${esc(String(v))}</strong></div>`;
  });
  return h;
}

function npcCardHTML(npc,ri){
  const k=npcKey(npc,ri),open=!!_npcOpen[k];
  const packChips=npcChips(npc);
  const ps=npcPowerSets(npc),pwCount=ps.reduce((n,p)=>n+(p.powers?.length||0),0),fc=npc.forms?.length||0;
  const skills=Object.entries(npc.skills||{}).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const stressUsed=(npc.stress||[]).filter(Boolean).length;
  let h=`<div class="npc-card ${open?'open':''}">`;

  // ── Header (always visible) ──
  h+=`<div class="npc-card-head" onclick="toggleNPCCard('${esc(k)}')">`;
  h+=`<div class="npc-card-main"><div class="npc-card-name">${esc(npc.name)}</div>`;
  if(npc.desc)h+=`<div class="npc-card-desc">${esc(npc.desc)}</div>`;
  h+=`<div class="npc-card-chips">`;
  if(npc.fromHero)h+=`<span class="npc-chip hero">◆ ${esc(lexU('hero'))}</span>`;
  if(packChips){
    // The pack said what matters about this one; nothing below applies to it.
    packChips.forEach(function(c){h+=`<span class="npc-chip">${esc(c)}</span>`;});
    h+=`</div></div><div class="npc-caret">▶</div></div>`;
    if(!open)return h+`</div>`;
    h+=`<div class="npc-card-body">${npcPackBody(npc)}`;
    h+=`<div class="npc-card-acts edit-only">`;
    h+=`<button class="btn btn-gold btn-xs" onclick="openFullNPCBuilder(${ri})">Builder</button>`;
    h+=`<button class="btn btn-danger btn-xs" onclick="if(confirm('Delete?')){S.npcs.splice(${ri},1);save();renderNPCs();}">✕</button>`;
    return h+`</div></div></div>`;
  }
  if(npc.type==='nameless')h+=`<span class="npc-chip ob">Obstacle ${esc(npc.obstacle||'+0')}</span>`;
  if(skills.length)h+=`<span class="npc-chip">${skills.length} skill${skills.length>1?'s':''}</span>`;
  if(ps.length)h+=`<span class="npc-chip pw">⚡ ${pwCount} power${pwCount!==1?'s':''}</span>`;
  else if(npc.powers)h+=`<span class="npc-chip pw">⚡ Powers</span>`;
  if(fc>1)h+=`<span class="npc-chip pw">${fc} forms</span>`;
  if(npc.stunts?.length)h+=`<span class="npc-chip st">★ ${npc.stunts.length} stunt${npc.stunts.length>1?'s':''}</span>`;
  if(npc.stress?.length)h+=`<span class="npc-chip"${stressUsed?' style="color:var(--accent);border-color:var(--accent)"':''}>Stress ${stressUsed}/${npc.stress.length}</span>`;
  h+=`</div></div><div class="npc-caret">▶</div></div>`;

  if(!open)return h+`</div>`;

  // ── Expanded body ──
  h+=`<div class="npc-card-body">`;
  if(npc.desc)h+=`<div class="npc-sec" style="font-size:12px;color:var(--muted);white-space:pre-wrap">${esc(npc.desc)}</div>`;
  if(npc.aspects?.length)h+=`<div class="npc-sec"><div class="npc-sec-lab">Aspects</div>${npc.aspects.filter(Boolean).map(a=>`<span class="tag" style="background:var(--surface3);color:var(--text);border:1px solid var(--border)">${esc(a)}</span>`).join(' ')}</div>`;
  if(skills.length)h+=`<div class="npc-sec"><div class="npc-sec-lab">Skills</div>${skills.map(([n,v])=>`<span class="npc-chip" style="color:var(--text)">${esc(n)} +${v}</span>`).join(' ')}</div>`;
  else if(npc.skillText)h+=`<div class="npc-sec"><div class="npc-sec-lab">Skills</div><div style="font-size:12px;color:var(--muted)">${esc(npc.skillText)}</div></div>`;

  if(ps.length){
    h+=`<div class="npc-sec"><div class="npc-sec-lab">Powers</div>`;
    (npc.forms||[{name:'',powerSets:npc.powerSets||[]}]).forEach(f=>{
      if(fc>1&&f.name)h+=`<div style="font-family:var(--font-label);font-size:11px;font-weight:700;color:var(--muted);margin:6px 0 3px">${esc(f.name)}</div>`;
      (f.powerSets||[]).forEach(p=>{
        h+=`<div class="card-sm" style="border-color:var(--purple)"><div class="fw-700" style="font-size:13px;color:var(--purple)">${esc(p.name||'Power Set')}</div>`;
        if(p.aspect)h+=`<div style="font-size:11px;font-style:italic;color:var(--muted)">${esc(p.aspect)}</div>`;
        (p.powers||[]).forEach(pw=>{const pd=POWERS.find(x=>x.id===pw.powerId);
          h+=`<div style="font-size:12px;margin-top:4px"><span class="fw-700">${powerIco(pw)}${esc(pw.customName||pd?.name||pw.powerId)}</span>${pw.level>1?` <span class="text-accent">Lv${pw.level}</span>`:''}`;
          if(pd?.desc)h+=`<div style="font-size:11px;color:var(--muted)">${esc(pd.desc)}</div>`;
          if(pw.selectedSE?.length)h+=`<div>${pw.selectedSE.map(se=>`<span class="tag tag-se">${esc(se)}</span>`).join(' ')}</div>`;
          if(pw.selectedLim?.length)h+=`<div>${pw.selectedLim.map(l=>`<span class="tag tag-lim">${esc(l)}</span>`).join(' ')}</div>`;
          h+=`</div>`;});
        h+=`</div>`;
      });
    });
    h+=`</div>`;
  } else if(npc.powers){
    h+=`<div class="npc-sec"><div class="npc-sec-lab">Powers</div><div style="font-size:12px;color:var(--purple)">${esc(npc.powers)}</div></div>`;
  }

  if(npc.stunts?.length){
    h+=`<div class="npc-sec"><div class="npc-sec-lab">Stunts</div>`;
    npc.stunts.forEach(st=>{h+=`<div class="card-sm"><div class="fw-700" style="font-size:12px">${esc(st.name)}</div>${st.desc?`<div style="font-size:11px;color:var(--muted)">${esc(st.desc)}</div>`:''}</div>`;});
    h+=`</div>`;
  }

  if(npc.stress?.length){
    h+=`<div class="npc-sec"><div class="npc-sec-lab">Stress</div><div style="display:flex;gap:4px;flex-wrap:wrap">`;
    npc.stress.forEach((v,si)=>{h+=`<div class="stress-box ${v?'filled':''}" style="width:24px;height:24px;font-size:10px" onclick="S.npcs[${ri}].stress[${si}]=!S.npcs[${ri}].stress[${si}];save();renderNPCs()">${si+1}</div>`;});
    h+=`</div></div>`;
  }

  const cq=npc.consequences||{};
  if(cq.mild||cq.moderate||cq.severe){
    h+=`<div class="npc-sec"><div class="npc-sec-lab">Consequences</div>`;
    [['Mild',cq.mild],['Moderate',cq.moderate],['Severe',cq.severe]].forEach(([lab,v])=>{if(v)h+=`<div style="font-size:12px"><span class="text-muted">${lab}:</span> ${esc(v)}</div>`;});
    h+=`</div>`;
  }
  if(typeof npc.gear==='string'&&npc.gear.trim())h+=`<div class="npc-sec"><div class="npc-sec-lab">Gear & Notes</div><div style="font-size:12px;color:var(--muted);white-space:pre-wrap">${esc(npc.gear)}</div></div>`;

  h+=`<div class="npc-card-acts edit-only">`;
  if(npc.fromHero){h+=`<button class="btn btn-secondary btn-xs" onclick="exportNPCToSlot(${ri})" title="Copy into a save slot to play">→ Slot</button>`;}
  else{
    h+=`<button class="btn btn-gold btn-xs" onclick="openFullNPCBuilder(${ri})">Builder</button>`;
    if(npc.type==='main'||npc.type==='rogue')h+=`<button class="btn btn-secondary btn-xs" onclick="exportNPCToSlot(${ri})" title="Save this NPC as a playable character in a save slot">→ Slot</button>`;
    h+=`<button class="btn btn-secondary btn-xs" onclick="editNPC(${ri})">Edit</button><button class="btn btn-danger btn-xs" onclick="if(confirm('Delete?')){S.npcs.splice(${ri},1);save();renderNPCs();}">X</button>`;
  }
  h+=`</div></div></div>`;
  return h;
}
function renderNPCs(){
  const el=document.getElementById('npcs-content');
  if(_npcFullMode){renderFullNPCEditor();return;}
  let h=universeBarHTML()+`<div class="${_npcEditMode?'':'no-edit'}">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:start;gap:8px;flex-wrap:wrap;margin-bottom:4px"><div><div class="pg-title">${esc(npcPanelTitle())}</div><div class="pg-sub">${esc(npcPanelHint())}</div></div>${editToggleBtn(_npcEditMode,'toggleNPCEdit')}</div>`;
  if(!_npcEditMode)h+=noEditBanner();
  const _tab=npcTab();
  h+=`<div class="npc-tabs">${npcKinds().map(t=>`<div class="npc-tab ${_tab===t.id?'active':''}" onclick="_npcTab='${esc(t.id)}';renderNPCs()">${esc(t.label)}</div>`).join('')}</div>`;
  if(_tab==='team'){let teamH='';renderTeamInner({set innerHTML(v){teamH=v;}});h+=teamH+'</div>';el.innerHTML=h;return;}
  const _kindHint=(npcKinds().filter(function(t){return t.id===_tab;})[0]||{}).hint||'';
  if(_kindHint)h+=`<div style="font-size:11px;color:var(--muted);margin:-6px 0 8px">${esc(_kindHint)}</div>`;
  const _list=S.npcs.filter(n=>npcKindOf(n)===_tab && !(n.fromHero&&S.char&&n.heroId===S.char.heroId));
  h+=`<div class="npc-grid">`;
  _list.forEach(npc=>{h+=npcCardHTML(npc,S.npcs.indexOf(npc));});
  if(!_list.length)h+=`<div class="tac text-muted" style="grid-column:1/-1;padding:20px 10px;font-size:12px">No ${esc((npcKinds().find(t=>t.id===_tab)||{}).label||'entries')} yet.</div>`;
  h+=`</div>`;
  h+=`<div class="edit-only" style="display:flex;gap:6px;margin-top:8px"><button class="btn btn-primary" style="flex:1" onclick="openAddNPC()">+ Quick Add</button>`;
  h+=`<button class="btn btn-gold" style="flex:1" onclick="openFullNPCBuilder(null)">+ Full Builder</button>`;
  h+=`</div><div class="edit-only" style="font-size:10px;color:var(--muted);margin-top:4px;text-align:center">Quick Add = name, blurb & stress. Full Builder = aspects, skills, powers, stunts & consequences.</div></div>`;
  el.innerHTML=h;
}
// What this panel is called and what it says it is for. A bestiary is not a
// cast list, and a pack that has said `roster: 'Bestiary'` should not be handed
// a heading about villains and a super-team.
function npcPanelTitle(){
  // Only what the pack SAYS. Reaching for lex('roster') renamed Daring Comics'
  // panel to "Rogues Gallery", which is one of the five things on it rather
  // than the name of the lot.
  return (SYS&&SYS.npc&&SYS.npc.title)||'NPCs';
}
function npcPanelHint(){
  return (SYS&&SYS.npc&&SYS.npc.panelHint)||'Characters, Villains & Team';
}

function openAddNPC(){_npcEdit=null;renderNM();document.getElementById('npc-modal').classList.add('open');}
function editNPC(i){_npcEdit=i;renderNM();document.getElementById('npc-modal').classList.add('open');}
function closeNM(){document.getElementById('npc-modal').classList.remove('open');}
function renderNM(){
  const npc=_npcEdit!==null?S.npcs[_npcEdit]:null,type=npc?.type||_npcTab;
  let h=`<h2 style="font-family:var(--font-title);font-size:20px;margin-bottom:12px">${npc?'Edit':'Add'} NPC</h2><div class="form-group"><label>Name</label><input id="nm-name" value="${esc(npc?.name||'')}"></div><div class="form-group"><label>Description</label><textarea id="nm-desc">${esc(npc?.desc||'')}</textarea></div>`;
  if(type==='main'||type==='rogue')h+=`<div class="form-group"><label>Aspects (comma-sep)</label><input id="nm-asp" value="${esc((npc?.aspects||[]).join(', '))}"></div><div class="form-group"><label>Key Skills</label><input id="nm-sk" value="${esc(npc?.skillText||'')}"></div><div class="form-group"><label>Powers Summary</label><input id="nm-pw" value="${esc(npc?.powers||'')}"></div><div class="form-group"><label>Stress Boxes</label><input type="number" id="nm-st" min="0" max="10" value="${npc?.stress?.length||4}"></div>`;
  if(type==='nameless')h+=`<div class="form-group"><label>Obstacle Rating</label><input id="nm-ob" value="${esc(npc?.obstacle||'+2')}"></div><div class="form-group"><label>Stress Boxes</label><input type="number" id="nm-st" min="0" max="6" value="${npc?.stress?.length||2}"></div>`;
  h+=`<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-secondary" style="flex:1" onclick="closeNM()">Cancel</button><button class="btn btn-primary" style="flex:1" onclick="saveNPC()">Save</button></div>`;
  h+=`<div class="tac mt-2"><button class="btn btn-gold btn-xs" onclick="promoteToFullBuilder(${_npcEdit})">Open Full Builder \u2192</button></div>`;
  document.getElementById('npc-modal-body').innerHTML=h;
}
function saveNPC(){
  const type=_npcEdit!==null?S.npcs[_npcEdit].type:_npcTab,name=document.getElementById('nm-name').value.trim();if(!name)return alert('Name required');
  const existing=_npcEdit!==null?S.npcs[_npcEdit]:{};
  const npc={...existing,type,name,desc:document.getElementById('nm-desc').value};
  if(type==='main'||type==='rogue'){npc.aspects=(document.getElementById('nm-asp')?.value||'').split(',').map(s=>s.trim()).filter(Boolean);npc.skillText=document.getElementById('nm-sk')?.value||'';npc.powers=document.getElementById('nm-pw')?.value||'';npc.stress=Array(parseInt(document.getElementById('nm-st')?.value)||4).fill(false);if(!npc.consequences)npc.consequences={mild:'',moderate:'',severe:''};}
  if(type==='nameless'){npc.obstacle=document.getElementById('nm-ob')?.value||'+2';npc.stress=Array(parseInt(document.getElementById('nm-st')?.value)||2).fill(false);}
  if(type==='supporting'){npc.skills=npc.skills||{};npc.aspects=npc.aspects||[];}
  ensureId(npc);if(_npcEdit!==null)S.npcs[_npcEdit]=npc;else S.npcs.push(npc);save();closeNM();renderNPCs();
}

// ─── Full NPC Builder ─────────────────────────────────────
function promoteToFullBuilder(idx){
  const n=document.getElementById('nm-name')?.value||'',ds=document.getElementById('nm-desc')?.value||'';
  closeNM();openFullNPCBuilder(idx);
  if(idx===null&&S._npcDraft){if(n.trim())S._npcDraft.name=n.trim();if(ds.trim())S._npcDraft.desc=ds.trim();renderFullNPCEditor();}
}
// A pack can describe what one of its NPCs is made of. Everything below this
// point is Daring Comics' Fate NPC — Aspects, a skill ladder, stress boxes,
// consequences, powerSets, stunts. A Dungeon Crawler Carl Mob has none of
// those: it is a Level, a Health Bar of that many slots, a DR taken from the
// floor, an Evade, a Move and some attacks. Building one through the Fate form
// threw on the first Daring Comics global it reached, so the button did
// nothing at all.
function sysNpcFields() {
  const n = (typeof SYS !== 'undefined' && SYS && SYS.npc) || null;
  if (!n) return null;
  const f = typeof n.fields === 'function' ? n.fields() : n.fields;
  return (f && f.length) ? f : null;
}

function sysNpcDefaults(existing) {
  const fields = sysNpcFields() || [];
  const d = { type: (existing && existing.type) || npcTab() };
  fields.forEach(function (f) {
    const had = existing ? existing[f.key] : undefined;
    d[f.key] = (had === undefined || had === null)
      ? (typeof f.def === 'function' ? f.def() : (f.def === undefined ? '' : f.def))
      : had;
  });
  if (existing && existing.id) d.id = existing.id;
  return d;
}

// Store only; never repaint on a keystroke, or the field loses the caret.
function sysNpcSet(key, value) {
  if (!S._npcDraft) return;
  const fields = sysNpcFields() || [];
  const f = fields.filter(function (x) { return x.key === key; })[0];
  S._npcDraft[key] = (f && f.type === 'number') ? (value === '' ? '' : Number(value)) : value;
  save();
  sysNpcRefreshDerived();
}

// Derived values (a Mob's DR from the floor, its Health Bar from its Level)
// update in place, without redrawing the field being typed into.
function sysNpcRefreshDerived() {
  (sysNpcFields() || []).forEach(function (f) {
    if (!f.derive) return;
    const el = document.getElementById('npcf-' + f.key);
    if (!el) return;
    let v = '';
    try { v = f.derive(S._npcDraft, S) ; } catch (e) { v = ''; }
    el.textContent = (v === undefined || v === null) ? '' : String(v);
  });
}

function renderSysNPCEditor() {
  const d = S._npcDraft, fields = sysNpcFields();
  const el = document.getElementById('npcs-content');
  if (!d || !fields || !el) return;
  const label = ((SYS.npc && SYS.npc.label) || lexU('npc'));
  let h = `<div class="${_npcEditMode ? '' : 'no-edit'}">`;
  h += `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
    <div class="pg-title" style="font-size:20px">${esc(_npcEdit === null ? 'New ' + label : 'Edit ' + label)}</div>
    <button class="btn btn-secondary btn-xs" onclick="closeFullNPCBuilder()">Cancel</button></div>`;
  if (SYS.npc && SYS.npc.hint) {
    h += `<div class="card-sm" style="font-size:11px;color:var(--muted)">${esc(SYS.npc.hint)}</div>`;
  }
  // Which kind of thing this is. Without it a Boss built here was filed under
  // whichever tab happened to be open, and there was no way to say otherwise.
  const kinds = npcKinds().filter(function (k) { return k.id !== 'team'; });
  if (kinds.length > 1) {
    h += `<div class="form-group"><label>Type</label>` +
      `<select onchange="sysNpcSet('type',this.value)">` +
      kinds.map(function (k) {
        return `<option value="${esc(k.id)}"${k.id === (d.type || npcTab()) ? ' selected' : ''}>` +
          esc(k.one || k.label) + `</option>`;
      }).join('') + `</select></div>`;
  }
  let group = null;
  fields.forEach(function (f) {
    if (f.group !== group) {
      if (group !== null) h += `</div>`;
      group = f.group;
      h += `<div class="card"><div class="label mb-1">${esc(group || label)}</div>`;
    }
    if (f.derive) {
      let v = '';
      try { v = f.derive(d, S); } catch (e) { v = ''; }
      h += `<div class="npc-derived"><span>${esc(f.label)}</span>
        <strong id="npcf-${esc(f.key)}">${esc(String(v === undefined || v === null ? '' : v))}</strong>
        ${f.hint ? `<em>${esc(f.hint)}</em>` : ''}</div>`;
      return;
    }
    h += `<div class="form-group"><label>${esc(f.label)}</label>`;
    if (f.options) {
      const opts = typeof f.options === 'function' ? f.options() : f.options;
      h += `<select onchange="sysNpcSet('${esc(f.key)}',this.value)">` +
        (opts || []).map(function (o) {
          const val = o.value === undefined ? o : o.value;
          const lab = o.label === undefined ? val : o.label;
          return `<option value="${esc(val)}"${String(val) === String(d[f.key]) ? ' selected' : ''}>${esc(lab)}</option>`;
        }).join('') + `</select>`;
    } else if (f.rows) {
      h += `<textarea rows="${f.rows}" placeholder="${esc(f.hint || '')}"
        oninput="sysNpcSet('${esc(f.key)}',this.value)">${esc(String(d[f.key] || ''))}</textarea>`;
    } else {
      h += `<input type="${f.type === 'number' ? 'number' : 'text'}" value="${esc(String(d[f.key] === undefined ? '' : d[f.key]))}"
        placeholder="${esc(f.hint || '')}" oninput="sysNpcSet('${esc(f.key)}',this.value)">`;
    }
    h += `</div>`;
  });
  if (group !== null) h += `</div>`;
  h += `<div style="display:flex;gap:6px;margin-top:8px">
    <button class="btn btn-secondary" style="flex:1" onclick="closeFullNPCBuilder()">Cancel</button>
    <button class="btn btn-primary" style="flex:1" onclick="saveSysNPC()">Save ${esc(label)}</button></div></div>`;
  el.innerHTML = h;
}

function saveSysNPC() {
  const d = S._npcDraft;
  if (!d) return;
  if (!String(d.name || '').trim()) return alert('Give it a name first.');
  // Bake the derived values in, so the roster and the printed page can read
  // them without recomputing against a floor that may since have changed.
  (sysNpcFields() || []).forEach(function (f) {
    if (!f.derive) return;
    try { d[f.key] = f.derive(d, S); } catch (e) {}
  });
  d.desc = d.desc || '';
  ensureId(d);
  if (_npcEdit !== null) S.npcs[_npcEdit] = d; else S.npcs.push(d);
  save();
  closeFullNPCBuilder();
}

function openFullNPCBuilder(idx){
  _npcEdit=idx;
  _npcFullMode=true;
  if(idx===null)_npcEditMode=true;
  const existing=idx!==null?S.npcs[idx]:null;
  // A pack that describes its own NPC gets its own form.
  if(sysNpcFields()){S._npcDraft=sysNpcDefaults(existing);renderSysNPCEditor();return;}
  // Migrate legacy powerSets into forms structure
  const forms = existing?.forms ? JSON.parse(JSON.stringify(existing.forms))
    : [{name:'Main Form', powerSets: existing?.powerSets ? JSON.parse(JSON.stringify(existing.powerSets)) : []}];
  const draftSkills = existing?.skills ? JSON.parse(JSON.stringify(existing.skills)) : {};
  migrateControllingSkill(draftSkills);
  const _dtype=existing?.type||(npcTab()==='team'?npcFirstKind():npcTab());
  const _defStress=_dtype==='nameless'?2:(_dtype==='supporting'?3:4);
  S._npcDraft={
    type:_dtype,
    obstacle:existing?.obstacle||'+2',
    name:existing?.name||'',
    desc:existing?.desc||'',
    aspects:existing?.aspects||[],
    skills:draftSkills,
    forms,
    activeForm: existing?.activeForm||0,
    stunts:existing?.stunts?JSON.parse(JSON.stringify(existing.stunts)):[],
    stress:existing?.stress||Array(_defStress).fill(false),
    consequences:existing?.consequences||{mild:'',moderate:'',severe:''},
    gear:existing?.gear||''
  };
  renderFullNPCEditor();
}
function closeFullNPCBuilder(){_npcFullMode=false;S._npcDraft=null;renderNPCs();}
function saveFullNPC(){
  const d=S._npcDraft;if(!d.name.trim())return alert('Name required');
  // Keep legacy fields for backwards-compat display
  d.skillText=Object.entries(d.skills||{}).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([n,v])=>`${n} +${v}`).join(', ');
  d.powers=(d.forms||[]).flatMap(f=>(f.powerSets||[]).flatMap(ps=>(ps.powers||[]).map(pw=>pw.customName||POWERS.find(p=>p.id===pw.powerId)?.name||pw.powerId))).join(', ');
  delete d.powerSets; // forms supersedes legacy powerSets
  if(d.type!=='nameless')delete d.obstacle;
  ensureId(d);if(_npcEdit!==null)S.npcs[_npcEdit]=d;else S.npcs.push(d);
  save();closeFullNPCBuilder();
}
function renderFullNPCEditor(){
  const d=S._npcDraft;if(!d)return;
  if(sysNpcFields())return renderSysNPCEditor();
  const el=document.getElementById('npcs-content');
  let h=`<div class="${_npcEditMode?'':'no-edit'}">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap"><div class="pg-title" style="font-size:22px">${npcKindLabel(d.type)||'NPC'} Builder</div><div style="display:flex;gap:4px;flex-wrap:wrap">${editToggleBtn(_npcEditMode,'toggleNPCEdit')}${_npcEdit!==null?`<button class="btn btn-secondary btn-xs" onclick="exportNPCToSlot(${_npcEdit})" title="Save as playable character in a save slot">→ Slot</button>`:''}<button class="btn btn-secondary btn-xs" onclick="closeFullNPCBuilder()">Close</button><button class="btn btn-primary btn-xs edit-only" onclick="saveFullNPC()">Save</button></div></div>`;
  if(!_npcEditMode)h+=noEditBanner();

  // Identity
  h+=`<div class="card"><div class="label mb-1">Identity</div><div class="form-group"><label>Name</label><input class="editable-input" value="${esc(d.name)}" oninput="S._npcDraft.name=this.value;save()" placeholder="e.g. The Joker"></div><div class="form-group"><label>Description</label><textarea class="editable-textarea" oninput="S._npcDraft.desc=this.value;save()" placeholder="Concept, backstory, appearance...">${esc(d.desc)}</textarea></div>`;
  h+=`<div class="edit-only form-group"><label>Type</label><select onchange="changeNPCDraftType(this.value)" style="font-size:13px">${npcKinds().filter(k=>k.id!=='team').map(k=>[k.id,k.one||k.label]).map(([k,v])=>`<option value="${k}" ${d.type===k?'selected':''}>${v}</option>`).join('')}</select></div>`;
  if(d.type==='nameless')h+=`<div class="form-group"><label>Obstacle Rating</label><input class="editable-input" value="${esc(d.obstacle||'+2')}" oninput="S._npcDraft.obstacle=this.value;save()" placeholder="+2"></div>`;
  h+=`</div>`;

  // Aspects
  h+=`<div class="card"><div class="label mb-1">Aspects <span class="text-muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:9px">(high concept, trouble, flaws, etc.)</span></div>`;
  d.aspects.forEach((a,i)=>{h+=`<div style="display:flex;gap:4px;margin-bottom:4px"><input class="editable-input" style="flex:1" value="${esc(a)}" oninput="S._npcDraft.aspects[${i}]=this.value;save()" placeholder="Aspect phrase..."><button class="btn btn-danger btn-xs edit-only" onclick="S._npcDraft.aspects.splice(${i},1);save();renderFullNPCEditor()">X</button></div>`;});
  h+=`<button class="btn btn-secondary btn-sm edit-only" onclick="S._npcDraft.aspects.push('');save();renderFullNPCEditor()">+ Add Aspect</button></div>`;

  // Skills
  h+=`<div class="card"><div class="label mb-1">Skills</div><div class="edit-only" style="font-size:10px;color:var(--muted);margin-bottom:6px">${NPC_SKILL_HINTS[d.type]||NPC_SKILL_HINTS.rogue}</div>`;
  const assignedSkills=SKILLS.filter(sk=>(d.skills[sk]||0)>0).sort((a,b)=>(d.skills[b]||0)-(d.skills[a]||0));
  assignedSkills.forEach(sk=>{const v=d.skills[sk];h+=`<div class="skill-row"><div class="sk-name">${sk}</div><div class="sk-label">${ladderName(v)}</div><button class="sk-btn edit-only" onclick="adjNPCSkill('${sk}',-1)" ${v<=0?'disabled':''}>−</button><div class="sk-val">+${v}</div><button class="sk-btn edit-only" onclick="adjNPCSkill('${sk}',1)" ${v>=6?'disabled':''}>+</button></div>`;});
  // Unassigned skill picker
  h+=`<div class="edit-only" style="display:flex;gap:4px;margin-top:6px"><select id="npc-add-skill" style="flex:1;font-size:12px"><option value="">— Add skill —</option>${SKILLS.filter(sk=>!(d.skills[sk]>0)).map(sk=>`<option value="${sk}">${sk}</option>`).join('')}</select><button class="btn btn-secondary btn-xs" onclick="const v=document.getElementById('npc-add-skill').value;if(v){S._npcDraft.skills[v]=1;save();renderFullNPCEditor();}">Add</button></div></div>`;

  // Forms (tabs) + Power Sets for the active form
  if(d.activeForm==null||d.activeForm>=d.forms.length)d.activeForm=0;
  const _naf=d.activeForm,_ncForm=d.forms[_naf]||{name:'',powerSets:[]};
  h+=`<div class="card"><div class="label mb-1">Forms <span class="text-muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:9px">(alternate states, transformations, armor variants)</span></div><div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:6px">`;
  d.forms.forEach((f,fi)=>{h+=`<button class="btn btn-xs ${fi===_naf?'btn-primary':'btn-secondary'}" onclick="switchNPCForm(${fi})" style="font-family:var(--font-label)">${esc(f.name||'Form '+(fi+1))}</button>`;});
  h+=`<button class="btn btn-gold btn-xs edit-only" onclick="addNPCForm()">+ New Form</button></div>`;
  h+=`<div style="display:flex;gap:6px;align-items:center"><input class="editable-input" value="${esc(_ncForm.name||'')}" oninput="S._npcDraft.forms[${_naf}].name=this.value;save()" placeholder="Form name" style="flex:1;font-size:13px;font-family:var(--font-label);font-weight:700">`;
  if(d.forms.length>1)h+=`<button class="btn btn-danger btn-xs edit-only" onclick="deleteNPCForm(${_naf})">Delete Form</button>`;
  h+=`</div></div>`;
  h+=`<div class="card"><div class="label mb-1">Power Sets</div>`;
  (_ncForm.powerSets||[]).forEach((ps,psi)=>{
    {const psFlav=ps.flavor||'';const flavRO=_npcEditMode?'':'readonly';const flavHide=!_npcEditMode&&!psFlav?' style="display:none"':'';
    h+=`<div class="powerset-card"><div style="display:flex;justify-content:space-between;align-items:start;gap:6px"><div style="flex:1"><input class="editable-input" value="${esc(ps.name)}" oninput="S._npcDraft.forms[${_naf}].powerSets[${psi}].name=this.value;save()" placeholder="Power Set Name" style="font-family:var(--font-title);font-size:16px;color:var(--purple);background:transparent;border:none;padding:0;width:100%"><input class="editable-input" value="${esc(ps.aspect)}" oninput="S._npcDraft.forms[${_naf}].powerSets[${psi}].aspect=this.value;save()" placeholder="Power Set Aspect" style="font-size:12px;font-style:italic;color:var(--muted);background:transparent;border:none;padding:0;width:100%;margin-top:2px"><textarea class="ps-flavor" ${flavRO}${flavHide} oninput="S._npcDraft.forms[${_naf}].powerSets[${psi}].flavor=this.value;save()" placeholder="Optional flavor — what these powers feel like, where they came from, signature look or sensation...">${esc(psFlav)}</textarea></div><button class="btn btn-danger btn-xs edit-only" onclick="delNPCPowerSet(${psi})">X</button></div>`;}
    (ps.powers||[]).forEach((pw,pwi)=>{const pd=POWERS.find(p=>p.id===pw.powerId);h+=`<div class="card-sm mt-2" style="border-color:var(--purple)"><div style="display:flex;justify-content:space-between;align-items:center"><div><span class="fw-700">${powerIco(pw)}${esc(pw.customName||pd?.name||pw.powerId)}</span>${pw.level>1?` <span class="text-accent">Lv${pw.level}</span>`:''}</div><div class="edit-only" style="display:flex;gap:3px"><button class="btn btn-secondary btn-xs" onclick="editPD('npc',${psi},${pwi})" title="Edit power">Edit</button><button class="btn btn-danger btn-xs" onclick="delNPCPower(${psi},${pwi})">X</button></div></div>${pd?.desc?`<div style="font-size:11px;color:var(--muted);margin-top:2px">${esc(pd.desc)}</div>`:''}${pw.selectedSE?.length?'<div style="margin-top:3px">'+pw.selectedSE.map(se=>`<span class="tag tag-se">${se}</span>`).join(' ')+'</div>':''}${pw.selectedLim?.length?'<div style="margin-top:2px">'+pw.selectedLim.map(l=>`<span class="tag tag-lim">${l}</span>`).join(' ')+'</div>':''}${pw.flavor?'<div style="font-style:italic;font-size:11px;color:var(--blue);margin-top:6px;padding:5px 7px;background:rgba(52,152,219,.06);border-left:2px solid var(--blue);border-radius:3px">'+esc(pw.flavor)+'</div>':''}</div>`;});
    h+=`<button class="btn btn-secondary btn-xs mt-1 edit-only" onclick="openPowerBrowser(${psi},'npc')">+ Add Power</button></div>`;
  });
  h+=`<button class="btn btn-gold btn-sm edit-only" onclick="addNPCPowerSet()">+ New Power Set</button></div>`;

  // Gear (per form)
  h+=renderGearList(_ncForm,'npc');

  // Stunts
  h+=`<div class="card"><div class="label mb-1">Stunts</div>`;
  (d.stunts||[]).forEach((st,i)=>{h+=`<div class="card-sm" style="display:flex;gap:6px;align-items:start"><div style="flex:1"><div class="fw-700" style="font-size:13px">${esc(st.name)}</div><div style="font-size:12px;color:var(--muted)">${esc(st.desc)}</div></div><button class="btn btn-danger btn-xs edit-only" onclick="S._npcDraft.stunts.splice(${i},1);save();renderFullNPCEditor()">X</button></div>`;});
  h+=`<div class="edit-only" style="display:flex;gap:4px"><button class="btn btn-secondary btn-sm" onclick="openNPCStuntBrowser()" style="flex:1">+ Browse Stunts</button><button class="btn btn-secondary btn-sm" onclick="addCustomNPCStunt()">+ Custom</button></div></div>`;

  // Stress & Consequences
  h+=`<div class="card"><div class="label mb-1">Stress <span class="text-muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:9px">(${d.stress.length} boxes)</span></div>`;
  h+=`<div style="display:flex;gap:6px;margin-bottom:6px">`;
  d.stress.forEach((v,i)=>{h+=`<div class="stress-box ${v?'filled':''}" onclick="S._npcDraft.stress[${i}]=!S._npcDraft.stress[${i}];save();renderFullNPCEditor()">${i+1}</div>`;});
  h+=`</div><div class="edit-only" style="display:flex;gap:4px;align-items:center"><span style="font-size:11px;color:var(--muted)">Boxes:</span><button class="sk-btn" style="width:22px;height:22px;font-size:14px" onclick="if(S._npcDraft.stress.length>0)S._npcDraft.stress.pop();save();renderFullNPCEditor()">−</button><button class="sk-btn" style="width:22px;height:22px;font-size:14px" onclick="if(S._npcDraft.stress.length<10)S._npcDraft.stress.push(false);save();renderFullNPCEditor()">+</button></div></div>`;

  h+=`<div class="card"><div class="label mb-1">Consequences</div><div class="conseq-row"><div class="conseq-label">Mild (2)</div><div class="conseq-input"><input value="${esc(d.consequences.mild)}" oninput="S._npcDraft.consequences.mild=this.value;save()" placeholder="\u2014"></div></div><div class="conseq-row"><div class="conseq-label">Moderate (4)</div><div class="conseq-input"><input value="${esc(d.consequences.moderate)}" oninput="S._npcDraft.consequences.moderate=this.value;save()" placeholder="\u2014"></div></div><div class="conseq-row"><div class="conseq-label">Severe (6)</div><div class="conseq-input"><input value="${esc(d.consequences.severe)}" oninput="S._npcDraft.consequences.severe=this.value;save()" placeholder="\u2014"></div></div></div>`;

  // Notes / Gear
  h+=`<div class="card"><div class="label mb-1">Gear & Notes</div><textarea oninput="S._npcDraft.gear=this.value;save()" placeholder="Equipment, tactics, secrets...">${esc(d.gear||'')}</textarea></div>`;

  // Bottom save/cancel
  h+=`<div style="display:flex;gap:6px;margin-top:12px"><button class="btn btn-secondary" style="flex:1" onclick="closeFullNPCBuilder()">Close</button><button class="btn btn-primary edit-only" style="flex:1" onclick="saveFullNPC()">Save NPC</button></div>`;

  // Stunt browser inline (if open)
  h+=renderNPCStuntBrowser();

  h+=`</div>`;
  el.innerHTML=h;
}
function changeNPCDraftType(t){if(!S._npcDraft||!npcKinds().some(function(k){return k.id===t;}))return;S._npcDraft.type=t;if(t==='nameless'&&!S._npcDraft.obstacle)S._npcDraft.obstacle='+2';_npcTab=t;save();renderFullNPCEditor();}
function adjNPCSkill(sk,d){const n=S._npcDraft;const cur=n.skills[sk]||0,nv=cur+d;if(nv<0||nv>6)return;n.skills[sk]=nv;if(!nv)delete n.skills[sk];save();renderFullNPCEditor();}
let _npcStuntBrowseOpen=false,_npcStuntSearch='',_npcStuntSkillFilter='';
function openNPCStuntBrowser(){_npcStuntBrowseOpen=true;_npcStuntSearch='';_npcStuntSkillFilter='';renderFullNPCEditor();}
function renderNPCStuntBrowser(){
  if(!_npcStuntBrowseOpen)return'';
  const q=_npcStuntSearch.toLowerCase(),sf=_npcStuntSkillFilter;
  const filtered=SAMPLE_STUNTS.filter(s=>{if(q&&!s.name.toLowerCase().includes(q)&&!s.desc.toLowerCase().includes(q))return false;if(sf&&s.skill!==sf)return false;return true;});
  const skillFilters=['All',...[...new Set(SAMPLE_STUNTS.map(s=>s.skill))].sort()];
  let h=`<div class="card" style="border-color:var(--accent)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div class="label" style="margin:0">Sample Stunts</div><button class="btn btn-secondary btn-xs" onclick="_npcStuntBrowseOpen=false;renderFullNPCEditor()">Close</button></div>`;
  h+=`<input id="npc-stunt-search" placeholder="Search stunts..." value="${esc(_npcStuntSearch)}" oninput="_npcStuntSearch=this.value;renderFullNPCEditor();_refocus('npc-stunt-search',this.selectionStart)" style="margin-bottom:6px;font-size:12px;padding:7px">`;
  h+=`<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px">${skillFilters.map(f=>`<button class="btn btn-xs ${(f==='All'&&!sf)||sf===f?'btn-primary':'btn-secondary'}" onclick="_npcStuntSkillFilter='${f==='All'?'':f}';renderFullNPCEditor()" style="font-size:10px;padding:3px 7px">${f}</button>`).join('')}</div>`;
  h+=`<div style="max-height:40vh;overflow-y:auto">`;
  const existing=(S._npcDraft.stunts||[]).map(s=>s.name);
  filtered.forEach(s=>{const have=existing.includes(s.name);h+=`<div class="card-sm" style="display:flex;gap:8px;align-items:start;${have?'opacity:.5':''}"><div style="flex:1"><div class="fw-700" style="font-size:12px">${esc(s.name)} <span class="text-muted" style="font-weight:400;font-size:10px">[${s.skill}]</span></div><div style="font-size:11px;color:var(--muted)">${esc(s.desc)}</div></div>${have?'<span class="text-green" style="font-size:10px">\u2713</span>':`<button class="btn btn-primary btn-xs" onclick="pickNPCStunt('${esc(s.name)}')">Add</button>`}</div>`;});
  if(!filtered.length)h+='<div class="tac text-muted" style="padding:12px">No matches</div>';
  h+=`</div></div>`;
  return h;
}
function pickNPCStunt(name){const s=SAMPLE_STUNTS.find(x=>x.name===name);if(!s)return;S._npcDraft.stunts=S._npcDraft.stunts||[];S._npcDraft.stunts.push({name:s.name,desc:s.desc,cost:s.cost});save();renderFullNPCEditor();}
function addCustomNPCStunt(){const n=prompt('Stunt Name:');if(!n)return;const d=prompt('Description:')||'';S._npcDraft.stunts=S._npcDraft.stunts||[];S._npcDraft.stunts.push({name:n,desc:d,cost:1});save();renderFullNPCEditor();}

// ═══════════════════════════════════════════════════════════
// DICE
// ═══════════════════════════════════════════════════════════

function parseIssues(log){const g=[];let cur={label:'Campaign Log',entries:[]};log.forEach(e=>{if(e.type==='issue_break'){g.push(cur);cur={label:e.title||'Issue',entries:[]};}else cur.entries.push(e);});g.push(cur);return g.filter(g=>g.label==='Campaign Log'?g.entries.length>0:true);}

function renderNotes(){
  const el=document.getElementById('notes-content');if(!el)return;
  const nf=window._logNewest,reorder=window._logReorder,entries=S.notes||[];
  let h='';
  // Header
  h+=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:6px"><div class="pg-title">Journal</div><div style="display:flex;gap:4px;flex-wrap:wrap">`;
  if(!reorder){
    h+=`<button class="btn btn-xs btn-gold" onclick="addIssueBreak()">\u25b6 NEW ISSUE</button>`;
    h+=`<button class="btn btn-xs btn-secondary" onclick="exportLog()">\u2197 Export</button>`;
    h+=`<button class="btn btn-xs btn-secondary" onclick="window._logNewest=!window._logNewest;renderNotes()">${nf?'\u2193 Newest':'\u2191 Oldest'}</button>`;
  }
  h+=`<button class="btn btn-xs ${reorder?'btn-primary':'btn-secondary'}" onclick="window._logReorder=!window._logReorder;renderNotes()">${reorder?'\u2713 Done':'\u2982 Reorder'}</button>`;
  h+=`</div></div>`;

  if(!entries.length){
    h+=`<div class="tac" style="padding:40px"><div style="font-size:36px;margin-bottom:8px">\ud83d\udcd6</div><div class="text-muted">No entries yet. Start a new Issue or add an entry.</div></div>`;
  } else {
    const ordered=(nf&&!reorder)?[...entries].map((n,i)=>({n,i})).reverse():entries.map((n,i)=>({n,i}));
    ordered.forEach(({n:entry,i})=>{
      const drag=reorder?` draggable="true" ondragstart="logDS(event,${i})" ondragover="logDO(event)" ondragleave="logDL(event)" ondrop="logDD(event,${i})"`:' ';
      if(entry.type==='issue_break'){
        h+=`<div class="log-episode"${drag}>${reorder?'<span class="log-grip">\u2982</span>':''}<div class="log-episode-label">${esc(entry.title||'Issue')}</div>${!reorder?`<button class="btn btn-xs btn-secondary" onclick="editIssue(${i})" style="padding:2px 6px">\u270e</button><button class="btn btn-xs btn-danger" onclick="deleteLogEntry(${i})" style="padding:2px 6px">\u2715</button>`:''}</div>`;
        return;
      }
      const ti=LOG_TYPES.find(t=>t.key===entry.type)||LOG_TYPES[0];
      const emoji=entry.emoji||ti.emoji;
      const isMajor=entry.type==='main',isAlert=entry.type==='battle',isSupp=entry.type==='supplemental';
      const cls=isMajor?'log-major':isAlert?'log-alert':isSupp?'log-supplemental':'log-base';
      h+=`<div class="${cls}"${drag}${reorder?' style="cursor:grab"':''}>
        <div style="display:flex;align-items:flex-start;gap:8px">
          ${reorder?'<span class="log-grip" style="margin-top:2px">\u2982</span>':''}
          <span style="font-size:${isMajor?'20':'16'}px">${emoji}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:${isMajor?'14':'12'}px;font-weight:700;color:${isMajor?'var(--accent)':isAlert?'var(--red)':isSupp?'var(--blue)':'var(--text)'}">${esc(entry.title||ti.label)}</div>
            <div style="font-size:9px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-top:1px">${ti.label} \u00b7 ${entry.date||''}</div>
          </div>
          ${!reorder?`<button class="btn btn-xs btn-secondary" onclick="editLogEntry(${i})" style="padding:2px 6px">\u270e</button><button class="btn btn-xs btn-danger" onclick="deleteLogEntry(${i})" style="padding:2px 6px">\u2715</button>`:''}
        </div>
        ${entry.body?`<div style="font-size:${isMajor?'13':'12'}px;color:var(--text);line-height:1.6;margin-top:6px;white-space:pre-wrap">${esc(entry.body)}</div>`:''}
      </div>`;
    });
  }
  // FAB
  if(!reorder)h+=`<div style="position:fixed;bottom:80px;right:20px;z-index:50"><button class="roll-btn" style="width:52px;height:52px;font-size:28px" onclick="showAddEntry()">+</button></div>`;
  el.innerHTML=h;
}

// Issue breaks
function addIssueBreak(){
  const n=S.notes.filter(e=>e.type==='issue_break').length+1;
  const val=prompt('Issue label:','Issue '+n);if(!val||!val.trim())return;
  S.notes.push({type:'issue_break',title:val.trim()});
  save();renderNotes();showAddEntry();
}
function editIssue(i){const e=S.notes[i];if(!e)return;const v=prompt('Issue label:',e.title||'Issue');if(v&&v.trim()){e.title=v.trim();save();renderNotes();}}

// Add entry flow
function showAddEntry(){
  let h=`<div class="card"><div class="pg-title" style="font-size:18px;margin-bottom:8px">New Entry</div>`;
  h+=`<div class="label mb-2">Select type</div>`;
  // Primary
  const main=LOG_TYPES[0];
  h+=`<button class="btn btn-primary btn-full mb-2" onclick="showEntryForm('${main.key}')" style="padding:14px;font-size:14px">${main.emoji} ${main.label}</button>`;
  // Secondary
  const supp=LOG_TYPES[1];
  h+=`<button class="btn btn-secondary btn-full mb-2" onclick="showEntryForm('${supp.key}')">${supp.emoji} ${supp.label}</button>`;
  // Rest
  h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">`;
  LOG_TYPES.slice(2).forEach(t=>{h+=`<button class="btn btn-secondary" onclick="showEntryForm('${t.key}')" style="padding:10px;font-size:12px">${t.emoji} ${t.label}</button>`;});
  h+=`</div></div>`;
  document.getElementById('notes-content').innerHTML=h;
}

function showEntryForm(typeKey){
  const t=LOG_TYPES.find(l=>l.key===typeKey)||LOG_TYPES[0];
  let h=`<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><button class="btn btn-secondary btn-xs" onclick="renderNotes()">\u2190 Back</button><span style="font-size:18px">${t.emoji}</span><span class="pg-title" style="font-size:16px;margin:0">${t.label}</span></div>`;
  h+=`<div style="font-size:11px;color:var(--muted);margin-bottom:8px">${t.desc}</div>`;
  h+=`<div class="form-group"><label>Title</label><input id="log-title-in" placeholder="${esc(t.placeholder)}"></div>`;
  h+=`<div class="form-group"><label>Entry</label><textarea id="log-body-in" rows="6" placeholder="${esc(t.desc)}"></textarea></div>`;
  h+=`<input type="hidden" id="log-type-in" value="${t.key}"><input type="hidden" id="log-emoji-in" value="${t.emoji}">`;
  h+=`<div style="display:flex;gap:8px"><button class="btn btn-primary" style="flex:1" onclick="saveNewEntry()">Save Entry</button><button class="btn btn-secondary" onclick="renderNotes()">Cancel</button></div></div>`;
  document.getElementById('notes-content').innerHTML=h;
}

function saveNewEntry(){
  const type=document.getElementById('log-type-in').value;
  const emoji=document.getElementById('log-emoji-in').value;
  const title=document.getElementById('log-title-in').value.trim();
  const body=document.getElementById('log-body-in').value.trim();
  if(!title&&!body)return;
  const now=new Date();const date=now.getFullYear()+'.'+String(now.getMonth()+1).padStart(2,'0')+'.'+String(now.getDate()).padStart(2,'0');
  S.notes.push({type,emoji,title,body,date});
  save();renderNotes();
}

// Edit/delete
function editLogEntry(i){
  const entry=S.notes[i];if(!entry)return;
  const t=LOG_TYPES.find(l=>l.key===entry.type)||LOG_TYPES[0];
  let h=`<div class="card"><div class="pg-title" style="font-size:16px;margin-bottom:8px">\u270e Edit Entry</div>`;
  h+=`<div class="form-group"><label>Title</label><input id="log-title-in" value="${esc(entry.title||'')}" placeholder="${esc(t.placeholder)}"></div>`;
  h+=`<div class="form-group"><label>Entry</label><textarea id="log-body-in" rows="6">${esc(entry.body||'')}</textarea></div>`;
  h+=`<input type="hidden" id="log-edit-idx" value="${i}">`;
  h+=`<div style="display:flex;gap:8px"><button class="btn btn-primary" style="flex:1" onclick="saveEntryEdit()">Save</button><button class="btn btn-secondary" onclick="renderNotes()">Cancel</button></div></div>`;
  document.getElementById('notes-content').innerHTML=h;
}
function saveEntryEdit(){
  const i=parseInt(document.getElementById('log-edit-idx').value);
  const entry=S.notes[i];if(!entry)return;
  entry.title=document.getElementById('log-title-in').value.trim();
  entry.body=document.getElementById('log-body-in').value.trim();
  save();renderNotes();
}
function deleteLogEntry(i){if(!confirm('Delete this entry?'))return;S.notes.splice(i,1);save();renderNotes();}

// Drag reorder
function logDS(e,i){window._logDragSrc=i;e.dataTransfer.effectAllowed='move';e.currentTarget.style.opacity='.4';}
function logDO(e){e.preventDefault();e.dataTransfer.dropEffect='move';e.currentTarget.classList.add('log-drag-over');}
function logDL(e){e.currentTarget.classList.remove('log-drag-over');}
function logDD(e,t){e.preventDefault();e.currentTarget.classList.remove('log-drag-over');const s=window._logDragSrc;if(s==null||s===t){window._logDragSrc=null;return;}const item=S.notes.splice(s,1)[0];S.notes.splice(s<t?t-1:t,0,item);window._logDragSrc=null;save();renderNotes();}

// ═══════════════════════════════════════════════════════════
// LOG EXPORT
// ═══════════════════════════════════════════════════════════
function exportLog(){
  const episodes=parseIssues(S.notes||[]);
  const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const heroName=e(sysCharName(S.char)||lexU('hero'));
  // NPC cards
  const npcHTML=(S.npcs||[]).map((n,i)=>`<div class="src-card" draggable="true" ondragstart="srcDS(event,'npc',${i})"><div style="font-size:13px;font-weight:700">${e(n.name)}</div><div style="font-size:10px;color:var(--muted)">${e(n.type)} ${n.desc?'\u2014 '+e(n.desc):''}</div>${n.powers?`<div style="font-size:10px;color:var(--purple);margin-top:2px">${e(n.powers)}</div>`:''}</div>`).join('')||'<div style="font-size:11px;color:var(--muted);padding:10px">No NPCs.</div>';
  // Region maps
  const regHTML=(S.regions||[]).map((r,ri)=>{const cells=r.cells||[];return`<div class="src-card" draggable="true" ondragstart="srcDS(event,'map',${ri})" style="margin-bottom:10px"><div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--accent);margin-bottom:6px;font-weight:700">${e(r.name)}</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:2px">${cells.slice(0,25).map(c=>`<div style="aspect-ratio:1;background:${c.isVoid?'transparent':c.name?'var(--card-bg)':'var(--empty-cell)'};border:1px solid ${c.isVoid?'transparent':'var(--cell-border)'};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1px;border-radius:2px;font-size:14px">${e(c.icon||'')}${c.name?`<span style="font-size:7px;color:var(--cell-text);text-align:center;overflow:hidden">${e(c.name)}</span>`:''}</div>`).join('')}</div></div>`;}).join('');
  // Character stats
  const ch=S.char;
  const statsHTML=ch?`<div class="src-card" draggable="true" ondragstart="srcDS(event,'stats',0)"><div style="font-size:13px;font-weight:700;color:var(--accent)">${e(ch.costumedName)}</div><div style="font-size:10px;color:var(--muted);margin-bottom:4px">${e(ch.civilianName)}</div><div style="font-size:10px">Concept: ${e(ch.aspects?.concept||'')}</div><div style="font-size:10px">Motivation: ${e(ch.aspects?.motivation||'')}</div><div style="font-size:9px;color:var(--muted);margin-top:4px">${SKILLS.filter(sk=>(ch.skills[sk]||0)>0).sort((a,b)=>(ch.skills[b]||0)-(ch.skills[a]||0)).map(sk=>sk+' +'+ch.skills[sk]).join(', ')}</div></div>`:'<div style="font-size:11px;color:var(--muted);padding:10px">No character.</div>';
  // Episode checkboxes
  const epChecks=`<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="ep-all" onchange="document.querySelectorAll('.ep-chk').forEach(c=>c.checked=this.checked);renderOut()" checked> ALL</label>`+episodes.map((ep,i)=>`<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" class="ep-chk" checked onchange="document.getElementById('ep-all').checked=![...document.querySelectorAll('.ep-chk')].some(c=>!c.checked);renderOut()"> ${e(ep.label)}</label>`).join('');

  const css=`:root{--bg:#0a0e1a;--text:#f0f0f0;--muted:#7a8a9e;--accent:#e63946;--accent-dim:#3a1520;--purple:#9b59b6;--blue:#3b82f6;--red:#e74c3c;--green:#2ecc71;--card-bg:#121828;--card-border:#2a3a5a;--empty-cell:#0d1020;--cell-border:#1a2236;--cell-text:#7a8a9e;--left-bg:#0a0e1a;--divider:#e63946;--src-card-bg:#121828;--src-card-border:#2a3a5a;--drop-hint:#1a2236;--drop-hint-text:#4a5a6e;font-family:'Comic Neue','Segoe UI',sans-serif}
body.print-mode{--bg:#fff;--text:#222;--muted:#888;--accent:#555;--accent-dim:#ccc;--purple:#666;--blue:#666;--red:#888;--green:#666;--card-bg:#f8f8f8;--card-border:#ccc;--empty-cell:#f0f0f0;--cell-border:#ccc;--cell-text:#666;--left-bg:#f5f5f5;--divider:#bbb;--src-card-bg:#fff;--src-card-border:#ddd;--drop-hint:#eee;--drop-hint-text:#aaa}
*{box-sizing:border-box;margin:0;padding:0}
html{height:100%;background:var(--bg)}
body{height:100%;background:var(--bg);color:var(--text);display:flex;flex-direction:column;overflow:hidden}
#topbar{background:var(--bg);border-bottom:3px solid var(--accent);padding:8px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;flex-shrink:0}
#tb-title{font-size:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--accent);flex-shrink:0}
#ep-sel{display:flex;gap:8px;flex-wrap:wrap;flex:1;font-size:11px;align-items:center}
#ep-sel input{accent-color:var(--accent)}
.tb-btn{background:var(--bg);border:1px solid var(--accent-dim);color:var(--text);font-size:11px;padding:5px 12px;cursor:pointer;border-radius:50vh;text-transform:uppercase;font-family:inherit;letter-spacing:1px}
.tb-btn:hover{border-color:var(--accent);color:var(--accent)}
.accent-strip{height:5px;background:linear-gradient(90deg,var(--accent) 60%,var(--purple) 60%,var(--purple) 75%,var(--blue) 75%,var(--blue) 87%,var(--green) 87%);flex-shrink:0}
#main{display:flex;flex:1;min-height:0}
#src-panel{width:250px;flex-shrink:0;background:var(--left-bg);overflow-y:auto;display:flex;flex-direction:column;border-right:1px solid var(--accent-dim)}
#src-tabs{display:flex;border-bottom:2px solid var(--accent-dim);flex-shrink:0}
.stab{flex:1;padding:7px 4px;background:transparent;border:none;color:var(--muted);font-size:10px;letter-spacing:1px;cursor:pointer;text-transform:uppercase;font-family:inherit}
.stab.active{color:var(--accent);border-bottom:2px solid var(--accent);margin-bottom:-2px}
.src-card{background:var(--src-card-bg);border:1px solid var(--src-card-border);border-radius:4px;padding:10px;margin-bottom:8px;cursor:grab;transition:border-color .15s}
.src-card:hover{border-color:var(--accent)}.src-card:active{cursor:grabbing;opacity:.7}
#doc-area{flex:1;display:grid;grid-template-columns:38% 1fr;min-width:0;min-height:0;overflow:hidden}
#doc-left{overflow-y:auto;padding:16px;border-right:2px solid var(--accent-dim);min-width:0}
#doc-right{overflow-y:auto;padding:16px;min-width:0}
.col-hdr{font-size:8px;letter-spacing:3px;text-transform:uppercase;font-weight:700;padding:5px 16px;margin:-16px -16px 14px;line-height:2}
.col-hdr-annex{background:var(--accent);color:#fff}
.col-hdr-log{background:var(--blue);color:#fff}
#drop-zone{border:2px dashed var(--drop-hint);border-radius:6px;padding:12px;text-align:center;font-size:10px;letter-spacing:2px;color:var(--drop-hint-text);margin-bottom:12px;text-transform:uppercase;transition:border-color .15s}
#drop-zone.drag-over{border-color:var(--accent);color:var(--accent)}
.ep-banner{background:var(--accent);color:#fff;padding:10px 16px;border-radius:4px;margin:16px 0 10px}
.ep-banner-label{font-size:9px;letter-spacing:3px;text-transform:uppercase;opacity:.7}
.ep-banner-title{font-size:18px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
.log-card{border-left:4px solid var(--accent);background:var(--card-bg);border-radius:0 6px 6px 0;padding:10px 12px;margin-bottom:10px}
.log-card.supplemental{border-color:var(--blue);margin-left:16px}
.log-card.alert{border-color:var(--red);background:rgba(231,76,60,.05)}
.log-card.base{border-color:var(--card-border);margin-left:32px}
.log-card-header{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.log-card-title{font-size:13px;font-weight:700;color:var(--accent)}
.log-card.supplemental .log-card-title{color:var(--blue)}
.log-card.alert .log-card-title{color:var(--red)}
.log-card.base .log-card-title{color:var(--text)}
.log-card-meta{font-size:9px;color:var(--muted);letter-spacing:1px;text-transform:uppercase}
.log-card-body{font-size:11px;color:var(--text);line-height:1.6;white-space:pre-wrap;margin-top:6px}
.dropped-card{border:1px solid var(--purple);border-radius:6px;padding:10px 12px;margin-bottom:10px;background:var(--card-bg);position:relative}
.dropped-card .rm-btn{position:absolute;top:6px;right:6px;background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:12px}
.dropped-card .rm-btn:hover{color:var(--red)}
.dc-wrap{margin-bottom:10px;border-radius:6px}
.dc-wrap.drag-over-top{border-top:2px solid var(--accent)}
.dc-handle{display:flex;align-items:center;gap:6px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);cursor:grab;padding:4px 10px;background:var(--accent-dim);border-radius:4px 4px 0 0;user-select:none;margin-bottom:-4px}
.dc-handle:hover{color:var(--accent)}
.dc-wrap .dropped-card{border-radius:0 0 6px 6px;margin-bottom:0}
.notes-ta{width:100%;background:transparent;border:1px solid var(--accent-dim);color:var(--text);font-family:inherit;font-size:11px;padding:8px;border-radius:4px;resize:vertical;min-height:80px;margin-top:6px}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{overflow:visible;height:auto}body.print-mode,body.print-mode #doc-left,body.print-mode #doc-right,body.print-mode #doc-area{background:#fff!important}body.print-mode .log-card,body.print-mode .dropped-card{background:#f8f8f8!important}body.print-mode .log-card.alert{background:#fff0f0!important}body.print-mode .col-hdr{background:#ccc!important;color:#222!important}#topbar,#src-panel{display:none}#doc-area{grid-template-columns:38% 1fr}#doc-left{border-right:1px solid var(--accent-dim)}#drop-zone,.dc-handle,.rm-btn{display:none}.dc-wrap .dropped-card{border-radius:6px}#doc-left,#doc-right{overflow:visible;height:auto}.log-card,.dropped-card,.ep-banner,.col-hdr{page-break-inside:avoid}.notes-ta{border:none;resize:none;padding:0;min-height:unset}}`;

  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Issue Report \u2014 ${heroName}</title><style>${css}</style></head><body>
<div id="topbar"><div id="tb-title">ISSUE REPORT // ${heroName}</div><div id="ep-sel">${epChecks}</div><button class="tb-btn" id="theme-btn" onclick="document.body.classList.toggle('print-mode');var pm=document.body.classList.contains('print-mode');document.documentElement.style.background=pm?'#fff':'#0a0e1a';this.textContent=pm?'\u25d0 DARK':'\u25d1 PRINT MODE'">\u25d1 PRINT MODE</button><button class="tb-btn" onclick="window.print()">\ud83d\udda8 PRINT</button></div>
<div class="accent-strip"></div>
<div id="main">
<div id="src-panel"><div id="src-tabs"><button class="stab active" onclick="['npcs','maps','stats'].forEach(n=>{document.getElementById('st-'+n).style.display=n==='npcs'?'':'none';document.querySelectorAll('.stab').forEach((b,i)=>b.className='stab'+(i===0?' active':''))})">NPCs</button><button class="stab" onclick="['npcs','maps','stats'].forEach(n=>{document.getElementById('st-'+n).style.display=n==='maps'?'':'none';document.querySelectorAll('.stab').forEach((b,i)=>b.className='stab'+(i===1?' active':''))})">MAPS</button><button class="stab" onclick="['npcs','maps','stats'].forEach(n=>{document.getElementById('st-'+n).style.display=n==='stats'?'':'none';document.querySelectorAll('.stab').forEach((b,i)=>b.className='stab'+(i===2?' active':''))})">HERO</button></div>
<div id="st-npcs" style="padding:10px;overflow-y:auto;flex:1">${npcHTML}</div>
<div id="st-maps" style="padding:10px;overflow-y:auto;flex:1;display:none">${regHTML}</div>
<div id="st-stats" style="padding:10px;overflow-y:auto;flex:1;display:none">${statsHTML}<div class="src-card" draggable="true" ondragstart="srcDS(event,'notes',0)"><div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">NOTES BLOCK</div><div style="font-size:10px;color:var(--muted)">Drag to add a text area</div></div></div>
</div>
<div id="doc-area"><div id="doc-left" ondragover="event.preventDefault();event.dataTransfer.dropEffect='copy';document.getElementById('drop-zone').classList.add('drag-over')" ondragleave="if(!document.getElementById('doc-left').contains(event.relatedTarget))document.getElementById('drop-zone').classList.remove('drag-over')" ondrop="event.preventDefault();document.getElementById('drop-zone').classList.remove('drag-over');if(!_srcItem)return;DROPPED.push(_srcItem);_srcItem=null;renderDI()"><div class="col-hdr col-hdr-annex">ANNEXES</div><div id="drop-zone">DRAG ITEMS HERE</div><div id="dropped-items"></div></div><div id="doc-right"><div class="col-hdr col-hdr-log">ISSUE LOG</div><div id="log-output"></div></div></div>
</div>
<script>
var EPISODES=${JSON.stringify(episodes).replace(/<\//g,'<\\/')};
var SRC_NPCS=${JSON.stringify(S.npcs||[]).replace(/<\//g,'<\\/')};
var ALL_REGIONS=${JSON.stringify(S.regions||[]).replace(/<\//g,'<\\/')};
var CHAR=${JSON.stringify(S.char||{}).replace(/<\//g,'<\\/')};
var DROPPED=[];
var _srcItem=null;var _reIdx=null;
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function srcDS(e,kind,idx){_srcItem={kind:kind,idx:idx};_reIdx=null;e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('text/plain',kind);}
function renderOut(){var sel=[];document.querySelectorAll('.ep-chk').forEach(function(c,i){if(c.checked)sel.push(i);});var h='';sel.forEach(function(ei){var ep=EPISODES[ei];if(!ep)return;h+='<div class="ep-banner"><div><div class="ep-banner-label">Issue</div><div class="ep-banner-title">'+esc(ep.label)+'</div></div></div>';ep.entries.forEach(function(en){var isMajor=en.type==='main',isAlert=en.type==='battle',isSupp=en.type==='supplemental';var cls=isAlert?'log-card alert':isSupp?'log-card supplemental':isMajor?'log-card':'log-card base';h+='<div class="'+cls+'"><div class="log-card-header"><span style="font-size:'+(isMajor?'20':'16')+'px">'+esc(en.emoji||'')+'</span><div><div class="log-card-title">'+esc(en.title||en.type||'Log')+'</div><div class="log-card-meta">'+esc(en.date||'')+'</div></div></div>'+(en.body?'<div class="log-card-body">'+esc(en.body)+'</div>':'')+'</div>';});});document.getElementById('log-output').innerHTML=h||'<div style="font-size:12px;color:var(--muted);padding:20px">No issues selected.</div>';}
function renderDI(){document.getElementById('dropped-items').innerHTML=DROPPED.map(function(item,i){return'<div class="dc-wrap" draggable="true" ondragstart="cdS(event,'+i+')" ondragover="cdO(event,'+i+')" ondrop="cdD(event,'+i+')" ondragend="cdE()"><div class="dc-handle">\\u2982 DRAG TO REORDER</div>'+renderDC(item,i)+'</div>';}).join('');}
function renderDC(item,i){var h='<div class="dropped-card"><button class="rm-btn" onclick="DROPPED.splice('+i+',1);renderDI()">\\u2715</button>';if(item.kind==='npc'){var n=SRC_NPCS[item.idx]||{};h+='<div style="font-size:14px;font-weight:700;color:var(--purple)">'+esc(n.name)+'</div><div style="font-size:10px;color:var(--muted)">'+esc(n.type||'')+' '+esc(n.desc||'')+'</div>'+(n.powers?'<div style="font-size:10px;color:var(--purple);margin-top:2px">'+esc(n.powers)+'</div>':'');}
else if(item.kind==='map'){var r=ALL_REGIONS[item.idx]||{cells:[]};h+='<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--blue);margin-bottom:6px">'+esc(r.name)+'</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:2px">'+r.cells.slice(0,25).map(function(c){return\x27<div style="aspect-ratio:1;background:\x27+(c.isVoid?\x27transparent\x27:c.name?\x27var(--card-bg)\x27:\x27var(--empty-cell)\x27)+\x27;border:1px solid \x27+(c.isVoid?\x27transparent\x27:\x27var(--cell-border)\x27)+\x27;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:14px;border-radius:2px">\x27+esc(c.icon||"")+(c.name?\x27<span style="font-size:7px;color:var(--cell-text);text-align:center">\x27+esc(c.name)+\x27</span>\x27:\x27\x27)+\x27</div>\x27;}).join(\x27\x27)+\x27</div>\x27;}
else if(item.kind==='stats'&&CHAR.costumedName){h+='<div style="font-size:14px;font-weight:700;color:var(--accent)">'+esc(CHAR.costumedName)+'</div><div style="font-size:10px;color:var(--muted)">'+esc(CHAR.civilianName||'')+'</div><div style="font-size:10px;margin-top:4px">Concept: '+esc(CHAR.aspects?.concept||'')+'</div><div style="font-size:10px">Motivation: '+esc(CHAR.aspects?.motivation||'')+'</div>';}
else if(item.kind==='notes'){h+='<div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">NOTES</div><textarea class="notes-ta" placeholder="Add notes here..."></textarea>';}
h+='</div>';return h;}
function cdS(e,i){_reIdx=i;_srcItem=null;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','reorder');e.stopPropagation();}
function cdO(e,i){if(_reIdx===null||_reIdx===i)return;e.preventDefault();e.dataTransfer.dropEffect='move';e.currentTarget.classList.add('drag-over-top');}
function cdD(e,i){e.preventDefault();e.stopPropagation();if(_reIdx===null||_reIdx===i){_reIdx=null;return;}var it=DROPPED.splice(_reIdx,1)[0];DROPPED.splice(i,0,it);_reIdx=null;renderDI();}
function cdE(){_reIdx=null;document.querySelectorAll('.dc-wrap').forEach(function(el){el.classList.remove('drag-over-top');});}
window.addEventListener('DOMContentLoaded',renderOut);
<\/script></body></html>`;

  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const w=window.open(url,'_blank');
  if(!w){URL.revokeObjectURL(url);alert('Please allow pop-ups.');return;}
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

// ═══════════════════════════════════════════════════════════
// LIVE HUD
// ═══════════════════════════════════════════════════════════
let _hudCh=null;
function hudBroadcast(){try{if(!_hudCh)_hudCh=new BroadcastChannel('daring-comics-hud');_hudCh.postMessage({type:'state',char:S.char,team:S.team,dice:S.dice,conflict:S.conflict,notes:(S.notes||[]).slice(-8)});}catch(e){}}
function openHUD(){const w=window.open('','_blank','width=1280,height=720');if(!w)return;w.document.write(buildHUD());w.document.close();setTimeout(()=>hudBroadcast(),600);}
function buildHUD(){return`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Daring Comics HUD</title><link href="https://fonts.googleapis.com/css2?family=Bangers&family=Oswald:wght@400;700&family=Comic+Neue:wght@400;700&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0a0e1a;color:#f0f0f0;font-family:'Comic Neue',sans-serif;padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:20px}.hc{background:#121828;border:1px solid #2a3a5a;border-radius:12px;padding:16px}.ht{font-family:'Bangers',cursive;font-size:28px;color:#e63946}.hl{font-family:'Oswald',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7a8a9e;margin-bottom:4px}.sb{display:inline-flex;width:32px;height:32px;border:2px solid #2a3a5a;border-radius:6px;align-items:center;justify-content:center;margin:2px;font-size:14px;font-weight:700}.sb.f{background:#e63946;border-color:#e63946;color:#fff}.fd{display:inline-flex;width:56px;height:56px;border-radius:12px;align-items:center;justify-content:center;font-size:36px;font-weight:900;border:2px solid #2a3a5a;background:#1a2236;margin:4px}.fd.p{color:#2ecc71;border-color:#2ecc71}.fd.m{color:#e74c3c;border-color:#e74c3c}</style></head><body><div class="hc" id="hh" style="grid-column:span 2"><div class="ht" id="hn">Waiting...</div></div><div class="hc"><div class="hl">Stress & FP</div><div id="hs"></div></div><div class="hc"><div class="hl">Last Roll</div><div id="hd" style="text-align:center"></div></div><div class="hc"><div class="hl">Conflict</div><div id="hcf"></div></div><div class="hc"><div class="hl">Journal</div><div id="hn2"></div></div><script>const ch=new BroadcastChannel('daring-comics-hud');ch.postMessage({type:'ping'});ch.onmessage=function(e){const d=e.data;if(d.type!=='state')return;if(d.char){document.getElementById('hn').innerHTML=d.char.costumedName;let s='<div style="margin-top:8px"><div class="hl">Physical</div>';d.char.stress.physical.forEach(function(v,i){s+='<div class="sb'+(v?' f':'')+'\">'+(i+1)+'</div>';});s+='</div><div style="margin-top:8px"><div class="hl">Mental</div>';d.char.stress.mental.forEach(function(v,i){s+='<div class="sb'+(v?' f':'')+'\">'+(i+1)+'</div>';});s+='</div><div style="margin-top:12px;font-size:28px;font-weight:900;color:#f1c40f">FP: '+d.char.fatePoints+'</div>';document.getElementById('hs').innerHTML=s;}if(d.dice&&d.dice.dice){var dh=d.dice.dice.map(function(v){return'<div class="fd'+(v>0?' p':v<0?' m':'')+'\">'+(v>0?'+':v<0?'\\u2212':'0')+'</div>';}).join('');dh+='<div style="font-size:48px;font-weight:900;font-family:Bangers;color:#e63946;margin-top:8px">'+(d.dice.total>=0?'+':'')+d.dice.total+'</div>';document.getElementById('hd').innerHTML=dh;}if(d.conflict&&d.conflict.active){var c='<div style="font-size:16px;font-weight:700">Round '+d.conflict.round+'</div>';d.conflict.turnOrder.forEach(function(t,i){c+='<div style="padding:4px 0;'+(i===d.conflict.currentTurn?'color:#e63946;font-weight:700':'color:#7a8a9e')+'">'+t.name+'</div>';});document.getElementById('hcf').innerHTML=c;}else document.getElementById('hcf').innerHTML='<div style="color:#7a8a9e">No conflict</div>';if(d.notes&&d.notes.length){var n='';d.notes.slice(-5).forEach(function(x){n+='<div style="font-size:13px;padding:2px 0;color:#ccc">'+(x.title||x.body||'')+'</div>';});document.getElementById('hn2').innerHTML=n;}};<\/script></body></html>`;}
(function(){try{var hc=new BroadcastChannel('daring-comics-hud');hc.onmessage=function(e){if(e.data&&e.data.type==='ping')hudBroadcast();};}catch(e){}})();

// ═══════════════════════════════════════════════════════════
// MAP
// ═══════════════════════════════════════════════════════════

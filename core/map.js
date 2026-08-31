window._mapZoom=null;window._selMapCell=null;
function heroMarker(){const n=sysCharName(S.char);return n?esc(n.charAt(0)):'H';}
function isAdj(a,b){const ar=Math.floor(a/5),ac=a%5,br=Math.floor(b/5),bc=b%5;return Math.abs(ar-br)+Math.abs(ac-bc)===1;}
// Kept under its old name; the test for it lives in core/icons.js now.
function isGiSlug(v){return iconIsSlug(v);}
// Render a cell's stored icon big — a game-icon mask when the value is a slug,
// the legacy emoji/text otherwise, or the hero/dot fallback.
function cellIco(c,cur){
  if(c.icon){
    // No size: .cell-gi sizes it, and grows at the 481px breakpoint.
    if(isGiSlug(c.icon))return iconHTML(c.icon,null,cur?'var(--accent)':'var(--text)','cell-gi');
    return c.icon;
  }
  return cur?`<span style="color:var(--accent);font-weight:900;font-family:var(--font-title);font-size:22px">${heroMarker()}</span>`:'<span style="color:var(--muted)">·</span>';
}

// ---- Map cell icon picker (same preview + search UX as the power icons) ----
// The currently-edited cell's picker state. Only one cell detail panel is open
// at a time, so a single set of ids/state mirrors the power picker exactly.
var _miScope=null,_miIdx=null,_miVal='',_miDefault='',_miTimer=null;
function giId(v){return iconId(v);}
// The cell picker, on the shared component. Only one cell detail panel is open
// at a time, so one instance is right.
function _miPicker(){
  return iconInit('mi',{value:_miVal,fallback:_miDefault||'building',
    els:{preview:'mi-preview',search:'mi-search',results:'mi-results'},
    onPick:function(v){_miVal=v;mapIconCommit();}});
}
function mapIconPreview(){_miPicker();iconPreview('mi');}
function mapIconResults(icons){_miPicker();iconResults('mi',icons);}
function mapIconSearch(q){_miPicker();iconSearch('mi',q);}
function selectMapIcon(id){_miPicker();iconPick('mi',id);}
function mapIconCommit(){
  if(_miScope==='sz'){if(!window._mapZoom)return;window._mapZoom.subZone.cells[_miIdx].icon=_miVal;var r=S.regions[S.activeRegion];if(r)r.cells[window._mapZoom.cellIdx].subZone=window._mapZoom.subZone;}
  else{var rg=S.regions[S.activeRegion];if(rg)rg.cells[_miIdx].icon=_miVal;}
  save();mapIconUpdateCell();
}
// Repaint just the edited cell in the grid — a full renderMap() would wipe the
// open search results and input focus, so we update the one cell in place.
function mapIconUpdateCell(){
  var grid=document.getElementById('map-grid');if(!grid)return;
  var cellEl=grid.children[_miIdx];if(!cellEl)return;
  var iconEl=cellEl.querySelector('.cell-icon');if(!iconEl)return;
  var cObj,cur;
  if(_miScope==='sz'){cObj=window._mapZoom.subZone.cells[_miIdx];cur=window._mapZoom.subZone.currentCell===_miIdx;}
  else{var r=S.regions[S.activeRegion];cObj=r.cells[_miIdx];cur=r.currentCell===_miIdx;}
  iconEl.innerHTML=cellIco(cObj,cur);
}
// The picker markup for a cell detail panel (matches the power form's layout).
function mapIconField(){
  return '<div class="form-group"><label>Icon <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px">(from game-icons.net)</span></label><div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><div id="mi-preview" style="width:42px;height:42px;flex-shrink:0;border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--surface2)"></div><input id="mi-search" placeholder="Search icons — building, tower, skull…" oninput="mapIconSearch()"></div><div id="mi-results" style="display:flex;flex-wrap:wrap;gap:5px;max-height:148px;overflow-y:auto"></div></div>';
}

function renderMap(){
  if(!S.regions)S.regions=[defaultRegion()];
  if(S.activeRegion===undefined)S.activeRegion=0;
  const el=document.getElementById('map-content');
  el.innerHTML=renderMapContent();
  if(document.getElementById('mi-preview')){mapIconPreview();mapIconSearch();}
}

function renderMapContent(){
  const region=S.regions[S.activeRegion];if(!region)return'<div class="card">No region data.</div>';

  // SUB-ZONE VIEW
  if(window._mapZoom){
    const sz=window._mapZoom.subZone,szCI=window._mapZoom.cellIdx;
    let g='<div id="map-grid">';
    for(let i=0;i<25;i++){const c=sz.cells[i],cur=sz.currentCell===i,adj=isAdj(sz.currentCell,i)&&!c.isVoid;
      let cls='map-cell';if(c.isVoid)cls+=' void';else if(cur)cls+=' current';else if(adj)cls+=' adjacent';else if(c.type==='explored')cls+=' explored';else cls+=' unexplored';
      const ico=cellIco(c,cur);
      g+=`<div class="${cls}" onclick="clickSZCell(${i})"><span class="cell-num">${i+1}</span><span class="cell-icon">${ico}</span>${c.name?`<span class="cell-name">${esc(c.name)}</span>`:''}</div>`;}
    g+='</div>';
    const si=window._selMapCell??sz.currentCell,sc=sz.cells[si];
    let det='';
    if(sc&&!sc.isVoid){const cur=si===sz.currentCell,adj=isAdj(sz.currentCell,si);
      _miScope='sz';_miIdx=si;_miVal=isGiSlug(sc.icon)?sc.icon:'';_miDefault=sc.name||sz.name||'';
      det=`<div class="card"><div class="fw-700" style="font-size:14px;font-family:var(--font-title);color:var(--accent);margin-bottom:6px">Area ${si+1}: ${esc(sc.name)||'Unknown'}</div><div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">${!cur&&adj?`<button class="btn btn-primary btn-xs" onclick="travelSZ(${si})">Travel Here</button>`:''}<button class="btn btn-secondary btn-xs" onclick="toggleSZVoid(${si})">${sc.isVoid?'Clear Void':'Mark Void'}</button></div><div class="form-group"><label>Name</label><input value="${esc(sc.name)}" onchange="setSZProp(${si},'name',this.value)" placeholder="${esc(mapHint('areaName','e.g. Rooftop, Lab, Alley...'))}"></div>${mapIconField()}<div class="form-group"><label>Feature</label><input value="${esc(sc.feature)}" onchange="setSZProp(${si},'feature',this.value)" placeholder="${esc(mapHint('areaFeature','e.g. Sniper Nest, Evidence Room...'))}"></div><div class="form-group"><label>Notes</label><textarea rows="2" onchange="setSZProp(${si},'notes',this.value)">${esc(sc.notes)}</textarea></div></div>`;}
    return`<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap"><button class="btn btn-secondary btn-xs" onclick="exitSZ()">\u2190 Back to ${esc(region.name)}</button><span class="pg-title" style="font-size:18px;margin:0">${esc(sz.name)}</span>${sz.type?`<span class="tag" style="background:var(--surface3);color:var(--text);border:1px solid var(--border)">${sz.type}</span>`:''}</div><div class="form-group"><label>Zone Name</label><input value="${esc(sz.name)}" onchange="setSZName(this.value)" style="font-weight:700;color:var(--accent)"></div><div style="font-size:10px;color:var(--muted);margin-bottom:8px">Click adjacent area to travel. Click any cell to view/edit.</div>${g}<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:10px;color:var(--muted)"><span style="color:var(--accent)">\u25a3 You</span><span style="color:var(--blue)">\u25a3 Adjacent</span><span>\u25a0 Explored</span><span style="opacity:.5">\u25a0 Unexplored</span><span style="opacity:.3">\u25a0 Void</span></div></div>${det}`;
  }

  // NORMAL REGION VIEW
  let sw='<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:10px">';
  S.regions.forEach((r,i)=>{sw+=`<button class="btn btn-xs ${i===S.activeRegion?'btn-primary':'btn-secondary'}" onclick="switchRegion(${i})">${esc(r.name)}</button>`;});
  sw+=`<button class="btn btn-xs btn-gold" onclick="newRegion()">+ New</button></div>`;

  let g='<div id="map-grid">';
  for(let i=0;i<25;i++){const c=region.cells[i],cur=region.currentCell===i,adj=isAdj(region.currentCell,i)&&!c.isVoid;
    let cls='map-cell';if(c.isVoid)cls+=' void';else if(cur)cls+=' current';else if(adj)cls+=' adjacent';else if(c.type==='explored')cls+=' explored';else cls+=' unexplored';
    const ico=cellIco(c,cur);
    g+=`<div class="${cls}" onclick="clickMapCell(${i})"><span class="cell-num">${i+1}</span><span class="cell-icon">${ico}</span>${c.name?`<span class="cell-name">${esc(c.name)}</span>`:''}</div>`;}
  g+='</div>';

  const si=window._selMapCell??region.currentCell,sc=region.cells[si];
  let det='';
  if(sc&&!sc.isVoid){const cur=si===region.currentCell,adj=isAdj(region.currentCell,si);
    _miScope='region';_miIdx=si;_miVal=isGiSlug(sc.icon)?sc.icon:'';_miDefault=sc.name||region.name||'';
    det=`<div class="card"><div class="fw-700" style="font-size:14px;font-family:var(--font-title);color:var(--accent);margin-bottom:6px">Location ${si+1}: ${esc(sc.name)||'Unknown'}</div><div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">${!cur&&adj?`<button class="btn btn-primary btn-xs" onclick="travelTo(${si})">Travel Here</button>`:''}<button class="btn btn-secondary btn-xs" onclick="toggleMapVoid(${si})">${sc.isVoid?'Clear Void':'Mark Void'}</button><button class="btn btn-gold btn-xs" onclick="enterSZ(${si})">Zoom In${sc.subZone?' ('+sc.subZone.type+')':''}</button></div><div class="form-group"><label>Location Name</label><input value="${esc(sc.name)}" onchange="setMapProp(${si},'name',this.value)" placeholder="${esc(mapHint('cellName','e.g. Wayne Tower, City Hall, Docks...'))}"></div>${mapIconField()}<div class="form-group"><label>Feature</label><input value="${esc(sc.feature)}" onchange="setMapProp(${si},'feature',this.value)" placeholder="${esc(mapHint('cellFeature','e.g. Villain HQ, Hospital, Park...'))}"></div><div class="form-group"><label>Notes</label><textarea rows="2" onchange="setMapProp(${si},'notes',this.value)">${esc(sc.notes)}</textarea></div></div>`;}

  const heroInfo=S.char?`<div class="card-sm" style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:22px;font-weight:900;font-family:var(--font-title);color:var(--accent)">${heroMarker()}</span><div><div style="font-weight:700;color:var(--accent)">${esc(S.char.costumedName)}</div><div style="font-size:10px;color:var(--muted)">${esc(S.char.civilianName)}</div></div></div>`:'';

  return`<div class="pg-title">Region Map</div><div class="pg-sub">Explore the city</div>${sw}<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><span style="font-size:16px;font-weight:700;font-family:var(--font-title);color:var(--accent)">${esc(region.name)}</span><div style="display:flex;gap:4px"><button class="btn btn-secondary btn-xs" onclick="renameRegion()">Rename</button>${S.regions.length>1?`<button class="btn btn-danger btn-xs" onclick="deleteRegion()">Delete</button>`:''}</div></div>${heroInfo}<div style="font-size:10px;color:var(--muted);margin-bottom:8px">5\u00d75 grid. Click adjacent location to travel. Click any cell to view/edit.</div>${g}<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;font-size:10px;color:var(--muted)"><span style="color:var(--accent)">\u25a3 You</span><span style="color:var(--blue)">\u25a3 Adjacent</span><span>\u25a0 Explored</span><span style="opacity:.5">\u25a0 Unexplored</span><span style="opacity:.3">\u25a0 Void</span></div></div>${det}`;
}

// Region operations
function clickMapCell(i){window._selMapCell=i;const r=S.regions[S.activeRegion];if(r)r.cells[i].type='explored';save();renderMap();}
function travelTo(i){const r=S.regions[S.activeRegion];if(!r)return;r.cells[r.currentCell].isCurrent=false;r.currentCell=i;r.cells[i].isCurrent=true;r.cells[i].type='explored';window._selMapCell=i;save();renderMap();}
function setMapProp(i,p,v){const r=S.regions[S.activeRegion];if(r)r.cells[i][p]=v;save();}
function toggleMapVoid(i){const r=S.regions[S.activeRegion];if(r)r.cells[i].isVoid=!r.cells[i].isVoid;save();renderMap();}
function switchRegion(i){S.activeRegion=i;window._selMapCell=null;window._mapZoom=null;save();renderMap();}
function newRegion(){const n=prompt('Region name:','Neighborhood '+(S.regions.length+1));if(!n)return;S.regions.push(defaultRegion(n));S.activeRegion=S.regions.length-1;window._selMapCell=null;save();renderMap();}
function renameRegion(){const r=S.regions[S.activeRegion];if(!r)return;const n=prompt('Rename region:',r.name);if(n)r.name=n;save();renderMap();}
function deleteRegion(){if(S.regions.length<=1)return alert('Cannot delete the only region.');if(!confirm('Delete this region?'))return;S.regions.splice(S.activeRegion,1);S.activeRegion=Math.max(0,S.activeRegion-1);save();renderMap();}

// The map's vocabulary belongs to the game, not the shell: a superhero city
// has streets and rooftops, a dungeon has hallways and stairwells. A pack
// that says nothing still gets Daring Comics' city, so the map keeps working.
function mapZoneTypes() {
  const m = (typeof SYS !== 'undefined' && SYS && SYS.map) || {};
  if (m.zoneTypes && m.zoneTypes.length) return m.zoneTypes.map(z => z.name || z);
  return ['Building', 'Street', 'Underground', 'Rooftop', 'Hideout'];
}
function mapZoneIcons() {
  const m = (typeof SYS !== 'undefined' && SYS && SYS.map) || {};
  if (m.zoneTypes && m.zoneTypes.length) {
    const out = {};
    m.zoneTypes.forEach(z => { if (z && z.name) out[z.name] = z.icon || ''; });
    return out;
  }
  return { Building: '\ud83c\udfe2', Street: '\ud83c\udfd9',
           Underground: '\ud83d\ude87', Rooftop: '\ud83c\udf06',
           Hideout: '\ud83d\udd75' };
}
// Placeholder copy, so the examples name places this game actually has.
function mapHint(key, fallback) {
  const m = (typeof SYS !== 'undefined' && SYS && SYS.map) || {};
  return (m.hints && m.hints[key]) || fallback;
}

// Sub-zone operations
function enterSZ(ci){
  const r=S.regions[S.activeRegion];if(!r)return;const c=r.cells[ci];
  if(!c.subZone){
    const types=mapZoneTypes();
    let h='<div class="card"><div class="pg-title" style="font-size:18px">Zone Type</div><div style="font-size:12px;color:var(--muted);margin-bottom:10px">What kind of location is this?</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
    types.forEach(t=>{const icons=mapZoneIcons();h+=`<button class="btn btn-primary" style="padding:12px;font-size:13px" onclick="createSZ(${ci},'${t}')">${icons[t]||''} ${t}</button>`;});
    h+='</div></div>';
    document.getElementById('map-content').innerHTML=h;return;
  }
  window._mapZoom={cellIdx:ci,subZone:c.subZone};window._selMapCell=null;renderMap();
}
function createSZ(ci,type){
  const r=S.regions[S.activeRegion];if(!r)return;const c=r.cells[ci];
  c.subZone={name:c.name||('Area '+(ci+1)),type,currentCell:12,cells:Array.from({length:25},()=>({name:'',icon:'',isVoid:false,notes:'',feature:'',type:'unknown'}))};
  save();window._mapZoom={cellIdx:ci,subZone:c.subZone};window._selMapCell=null;renderMap();
}
function exitSZ(){window._mapZoom=null;window._selMapCell=null;renderMap();}
function setSZName(v){if(!window._mapZoom)return;window._mapZoom.subZone.name=v;const r=S.regions[S.activeRegion];if(r)r.cells[window._mapZoom.cellIdx].subZone=window._mapZoom.subZone;save();}
function setSZProp(i,p,v){if(!window._mapZoom)return;window._mapZoom.subZone.cells[i][p]=v;const r=S.regions[S.activeRegion];if(r)r.cells[window._mapZoom.cellIdx].subZone=window._mapZoom.subZone;save();}
function clickSZCell(i){if(!window._mapZoom)return;window._selMapCell=i;window._mapZoom.subZone.cells[i].type='explored';const r=S.regions[S.activeRegion];if(r)r.cells[window._mapZoom.cellIdx].subZone=window._mapZoom.subZone;save();renderMap();}
function travelSZ(i){if(!window._mapZoom)return;const sz=window._mapZoom.subZone;sz.currentCell=i;sz.cells[i].type='explored';window._selMapCell=i;const r=S.regions[S.activeRegion];if(r)r.cells[window._mapZoom.cellIdx].subZone=sz;save();renderMap();}
function toggleSZVoid(i){if(!window._mapZoom)return;window._mapZoom.subZone.cells[i].isVoid=!window._mapZoom.subZone.cells[i].isVoid;const r=S.regions[S.activeRegion];if(r)r.cells[window._mapZoom.cellIdx].subZone=window._mapZoom.subZone;save();renderMap();}

// ═══════════════════════════════════════════════════════════
// UTILITY & INIT
// ═══════════════════════════════════════════════════════════


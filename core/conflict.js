// A pack can supply its own combat tracker; the zone-based one below is Daring
// Comics'. The shared S.conflict object is what multiplayer syncs, so a pack
// tracker that lives there gets party sync for free.
function renderConflict(){
  const el=document.getElementById('conflict-content');
  if(SYS&&SYS.combat&&typeof SYS.combat.render==='function'){
    if(!S.conflict||S.conflict.systemId!==SYS.id){
      S.conflict=SYS.combat.init?SYS.combat.init():{systemId:SYS.id,active:false};
      S.conflict.systemId=SYS.id;
    }
    el.innerHTML=SYS.combat.render({state:S.conflict,floor:S.floor||3});
    return;
  }
  const c=S.conflict;
  let h=`<div class="pg-title">Conflict</div><div class="pg-sub">Zone-based combat tracker</div>`;
  if(!c.active){h+=`<div class="tac" style="padding:30px"><div style="font-size:36px;margin-bottom:8px">\u2694</div><div class="text-muted mb-3">No active conflict</div><button class="btn btn-primary" onclick="startConflict()">Start Conflict</button></div>`;}
  else{
    h+=`<div class="card-sm" style="display:flex;justify-content:space-between;align-items:center"><div><span class="label">Round</span> <span class="fw-700 text-accent" style="font-size:20px">${c.round}</span></div><div style="display:flex;gap:4px"><button class="btn btn-secondary btn-xs" onclick="nextRound()">Next Round</button><button class="btn btn-danger btn-xs" onclick="endConflict()">End</button></div></div>`;
    h+=`<div class="card"><div class="label mb-1">Turn Order</div>`;
    c.turnOrder.forEach((t,i)=>{h+=`<div class="combatant ${i===c.currentTurn?'current':''}"><div style="width:20px;font-size:12px;font-weight:700;color:${i===c.currentTurn?'var(--accent)':'var(--muted)'}">${i+1}</div><div style="flex:1;font-weight:600;font-size:13px">${esc(t.name)}</div><span style="font-size:11px;color:var(--muted)">${t.type}</span><button class="btn btn-danger btn-xs" onclick="S.conflict.turnOrder.splice(${i},1);if(S.conflict.currentTurn>=${i}&&S.conflict.currentTurn>0)S.conflict.currentTurn--;save();renderConflict()" style="padding:2px 6px">X</button></div>`;});
    h+=`<div style="display:flex;gap:4px;margin-top:6px"><input id="ct-name" placeholder="Name" style="flex:1;font-size:12px;padding:6px"><select id="ct-type" style="width:80px;font-size:12px;padding:6px"><option>Hero</option><option>NPC</option><option>Villain</option><option>Team</option></select><button class="btn btn-secondary btn-xs" onclick="addCombat()">Add</button></div>`;
    if(S.team?.expanded&&!c.turnOrder.some(t=>t.type==='Team')){h+=`<button class="btn btn-gold btn-xs btn-full mt-1" onclick="addTeamToConflict()">+ Add ${esc(S.team.name)}</button>`;}
    h+=`<button class="btn btn-primary btn-sm btn-full mt-2" onclick="nextTurn()">Next Turn \u2192</button></div>`;
    h+=`<div class="card"><div class="label mb-1">Zones</div>`;
    c.zones.forEach((z,i)=>{h+=`<div class="zone-card"><div style="display:flex;justify-content:space-between;align-items:center"><div class="zone-name">${esc(z.name)}</div><button class="btn btn-danger btn-xs" onclick="S.conflict.zones.splice(${i},1);save();renderConflict()">X</button></div>${z.aspects?`<div style="font-size:11px;color:var(--muted);font-style:italic">${esc(z.aspects)}</div>`:''}<div style="font-size:11px;margin-top:4px">${(z.occupants||[]).map(o=>`<span class="tag" style="background:var(--surface3);color:var(--text);border:1px solid var(--border)">${esc(o)}</span>`).join(' ')}</div><div style="display:flex;gap:4px;margin-top:4px"><input id="za-${i}" placeholder="Add occupant" style="flex:1;font-size:11px;padding:4px"><button class="btn btn-secondary btn-xs" onclick="addToZone(${i})">+</button></div></div>`;});
    h+=`<div style="display:flex;gap:4px"><input id="zn-name" placeholder="New zone" style="flex:1;font-size:12px;padding:6px"><button class="btn btn-secondary btn-xs" onclick="addZone()">+ Zone</button></div></div>`;
    if(c.log.length){h+=`<div class="card"><div class="label mb-1">Log</div>`;c.log.slice(-8).reverse().forEach(e=>{h+=`<div style="font-size:11px;color:var(--muted);padding:2px 0">${esc(e)}</div>`;});h+='</div>';}
  }
  el.innerHTML=h;
}
function startConflict(){S.conflict={active:true,zones:[{name:'Zone 1',aspects:'',occupants:[]}],turnOrder:[],currentTurn:0,round:1,log:['Conflict started']};if(S.char)S.conflict.turnOrder.push({name:S.char.costumedName,type:'Hero'});if(S.team?.expanded)S.conflict.turnOrder.push({name:S.team.name+' (Team)',type:'Team'});save();renderConflict();}
function endConflict(){if(confirm('End conflict?')){S.conflict={active:false,zones:[],turnOrder:[],currentTurn:0,round:1,log:[]};save();renderConflict();}}
function nextTurn(){const c=S.conflict;c.currentTurn=(c.currentTurn+1)%Math.max(1,c.turnOrder.length);c.log.push('Turn: '+(c.turnOrder[c.currentTurn]?.name||'?'));save();renderConflict();}
function nextRound(){S.conflict.round++;S.conflict.currentTurn=0;S.conflict.log.push('--- Round '+S.conflict.round+' ---');save();renderConflict();}
function addCombat(){const n=document.getElementById('ct-name').value.trim(),t=document.getElementById('ct-type').value;if(!n)return;S.conflict.turnOrder.push({name:n,type:t});S.conflict.log.push(n+' joined');save();renderConflict();}
function addZone(){const n=document.getElementById('zn-name').value.trim()||('Zone '+(S.conflict.zones.length+1));S.conflict.zones.push({name:n,aspects:'',occupants:[]});save();renderConflict();}
function addToZone(i){const inp=document.getElementById('za-'+i),n=inp?.value?.trim();if(!n)return;S.conflict.zones[i].occupants.push(n);save();renderConflict();}

// ═══════════════════════════════════════════════════════════
// JOURNAL (LOG SYSTEM)
// ═══════════════════════════════════════════════════════════
window._logNewest=true;window._logReorder=false;window._logDragSrc=null;


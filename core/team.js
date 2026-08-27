function renderTeam(targetEl){
  const el=targetEl||document.getElementById('npcs-content');
  let h=`<div class="pg-title">NPCs</div><div class="pg-sub">Characters, Villains & Team</div><div class="npc-tabs">${NPC_TABS.map(t=>`<div class="npc-tab ${_npcTab===t.id?'active':''}" onclick="_npcTab='${t.id}';renderNPCs()">${t.label}</div>`).join('')}</div>`;
  let teamH='';renderTeamInner({set innerHTML(v){teamH=v;}});h+=teamH;
  el.innerHTML=h;
}
function renderTeamInner(el){
  if(S.team){renderTeamSheet(el);}else{renderTeamCreate(el);}
}
function renderTeamCreate(el){el.innerHTML=`<div class="pg-title">Super Team</div><div class="pg-sub">Create your team identity</div><div class="card"><div class="form-group"><label>Team Name</label><input id="tm-name" placeholder="e.g. Sentinels of Society"></div><div class="form-group"><label>Charter Aspect (Mission)</label><input id="tm-charter" placeholder="e.g. United Nations Global Response Team"></div><div class="form-group"><label>Friction Aspect (Conflict)</label><input id="tm-friction" placeholder="e.g. Clashing Egos and Hidden Agendas"></div></div><button class="btn btn-primary btn-full" onclick="createTeam()">Create Team</button>`;}
function createTeam(){const n=document.getElementById('tm-name').value.trim(),c=document.getElementById('tm-charter').value.trim(),f=document.getElementById('tm-friction').value.trim();if(!n)return alert('Name required');S.team={name:n,charter:c,friction:f,rogues:[],stunts:[],complications:[]};save();renderNPCs();}
function renderTeamSheet(el){
  const t=S.team,mx=(S.char?1:0)+t.rogues.length;
  let h=`<div class="pg-title">${esc(t.name)}</div><div class="pg-sub">Super Team</div><div class="card"><div class="label">Charter</div><div style="font-size:14px;margin-bottom:6px">${esc(t.charter)}</div><div class="label">Friction</div><div style="font-size:14px">${esc(t.friction)}</div></div>`;
  h+=`<div class="card"><div class="label mb-1">Team Rogues <span class="text-muted" style="font-weight:400">(max 3, +1 stunt each)</span></div>`;
  t.rogues.forEach((r,i)=>{h+=`<div class="card-sm" style="display:flex;gap:6px"><div style="flex:1"><strong>${esc(r.name)}</strong><br><span class="text-muted" style="font-size:12px">${esc(r.desc)}</span></div><button class="btn btn-danger btn-xs edit-only" onclick="S.team.rogues.splice(${i},1);save();renderNPCs()">X</button></div>`;});
  if(t.rogues.length<3)h+=`<button class="btn btn-secondary btn-sm edit-only" onclick="addTR()">+ Add Rogue</button>`;
  h+=`</div><div class="card"><div class="label mb-1">Team Stunts <span class="text-muted" style="font-weight:400">(${t.stunts.length}/${mx})</span></div>`;
  TEAM_STUNTS.forEach(ts=>{const sel=t.stunts.includes(ts.id),req=!ts.requires||t.stunts.includes(ts.requires),can=t.stunts.length<mx||sel;h+=`<label style="display:flex;gap:8px;align-items:start;padding:6px 0;border-bottom:1px solid var(--border);cursor:${req&&can?'pointer':'default'};opacity:${req?1:.4}"><input type="checkbox" class="edit-checkbox" ${sel?'checked':''} ${req&&can?'':'disabled'} onchange="toggleTS('${ts.id}')"><div><div class="fw-700" style="font-size:13px">${ts.name}</div><div style="font-size:11px;color:var(--muted)">${ts.desc}</div>${ts.requires?`<div style="font-size:10px;color:var(--yellow)">Requires: ${TEAM_STUNTS.find(s=>s.id===ts.requires)?.name}</div>`:''}</div></label>`;});
  h+=`</div><div class="card"><div class="label mb-1">Complications <span class="text-muted" style="font-weight:400">(optional)</span></div>`;
  TEAM_COMPLICATIONS.forEach(tc=>{const sel=t.complications.includes(tc.id);h+=`<label style="display:flex;gap:8px;align-items:start;padding:6px 0;cursor:pointer"><input type="checkbox" class="edit-checkbox" ${sel?'checked':''} onchange="toggleTC('${tc.id}')"><div><div class="fw-700" style="font-size:13px">${tc.name}</div><div style="font-size:11px;color:var(--muted)">${tc.desc}</div></div></label>`;});
  h+=`</div>`;
  // Expanded Super Team
  h+=`<div class="divider"></div>`;
  const ex=t.expanded;
  if(!ex){
    h+=`<div class="card"><div class="label mb-1">Expanded Super Team</div><div style="font-size:12px;color:var(--muted);margin-bottom:8px">Treat the wider team roster as a single character for peripheral adventures (once per Issue, 15-20 min). Requires the Robust Team stunt.</div><button class="btn btn-gold btn-sm btn-full" onclick="initExpandedTeam()">Create Expanded Roster</button></div>`;
  } else {
    const{tone}=getSeriesConfig();
    const stressMax=tone?2+tone.stressBonus:4;
    h+=`<div class="card" style="border-color:var(--purple)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div class="label" style="color:var(--purple);margin:0;font-size:13px">Expanded Super Team</div><button class="btn btn-danger btn-xs edit-only" onclick="if(confirm('Remove expanded roster?')){delete S.team.expanded;save();renderNPCs();}">Remove</button></div>`;
    // Aspects
    h+=`<div class="form-group"><label>Expanded Aspect 1</label><input class="editable-input" value="${esc(ex.aspect1)}" oninput="S.team.expanded.aspect1=this.value;save()" placeholder="Team aspect for expanded adventures"></div>`;
    h+=`<div class="form-group"><label>Expanded Aspect 2</label><input class="editable-input" value="${esc(ex.aspect2)}" oninput="S.team.expanded.aspect2=this.value;save()" placeholder="Second team aspect"></div>`;
    // Skills
    h+=`<div class="label mt-2 mb-1">Team Skills <span class="text-muted" style="font-weight:400">(3 pts to distribute, max +3 each)</span></div>`;
    const exSkills=['Combat','Expertise','Social','Undercover'];
    const exSkillDesc={Combat:'Offense, defense, powers in conflict',Expertise:'Knowledge, investigation, science, sorcery',Social:'Rapport, intimidation, contacts, persuasion',Undercover:'Stealth, disguises, infiltration, thievery'};
    const exUsed=exSkills.reduce((s,sk)=>s+(ex.skills[sk]||0),0);
    const exRem=3-exUsed;
    exSkills.forEach(sk=>{const v=ex.skills[sk]||0;h+=`<div class="skill-row"><div class="sk-name">${sk}<div style="font-size:9px;color:var(--muted);font-weight:400;font-family:var(--font-body)">${exSkillDesc[sk]}</div></div><div class="sk-label">${ladderName(v)}</div><button class="sk-btn edit-only" onclick="adjExSkill('${sk}',-1)" ${v<=0?'disabled':''}>−</button><div class="sk-val">+${v}</div><button class="sk-btn edit-only" onclick="adjExSkill('${sk}',1)" ${v>=3||exRem<=0?'disabled':''}>+</button></div>`;});
    h+=`<div style="font-size:11px;color:var(--muted);margin-top:4px">${exUsed}/3 points used</div>`;
    // Hero Points / Stunts & Powers — supports both legacy {name,desc,cost} and rich {powerId,...} entries
    const exStuntCost=(ex.stunts||[]).reduce((s,st)=>s+(st.cost||0),0);
    const exPowerCost=(ex.powers||[]).reduce((s,p)=>s+(p.totalCost||p.cost||0),0);
    const exHPSpent=exStuntCost+exPowerCost;
    const exHPRem=10-exHPSpent;
    h+=`<div class="divider"></div><div class="label mb-1">Team Stunts & Powers <span class="text-muted" style="font-weight:400">(${exHPSpent}/10 HP)</span></div>`;
    (ex.stunts||[]).forEach((st,i)=>{h+=`<div class="card-sm" style="display:flex;gap:6px;align-items:start"><div style="flex:1"><div class="fw-700" style="font-size:12px">${esc(st.name)} <span class="tag tag-cost">${st.cost} HP</span></div><div style="font-size:11px;color:var(--muted)">${esc(st.desc||'')}</div></div><button class="btn btn-danger btn-xs edit-only" onclick="S.team.expanded.stunts.splice(${i},1);save();renderNPCs()">X</button></div>`;});
    (ex.powers||[]).forEach((pw,i)=>{
      const pd=pw.powerId?POWERS.find(p=>p.id===pw.powerId):null;
      const pwName=pw.customName||pd?.name||pw.name||'Power';
      const pwCost=pw.totalCost||pw.cost||0;
      const isRich=!!pw.powerId;
      h+=`<div class="card-sm" style="display:flex;gap:6px;align-items:start;border-color:var(--purple)"><div style="flex:1"><div class="fw-700" style="font-size:12px">${powerIco(pw)}${esc(pwName)}${pw.level>1?` <span class="text-accent">Lv${pw.level}</span>`:''} <span class="tag tag-cost">${pwCost} HP</span></div>${pd?.desc?`<div style="font-size:11px;color:var(--muted);margin-top:1px">${esc(pd.desc)}</div>`:(pw.desc?`<div style="font-size:11px;color:var(--muted);margin-top:1px">${esc(pw.desc)}</div>`:'')}${pd?.levelDesc&&pd.levelDesc[pw.level]?`<div style="font-size:11px;color:var(--accent);margin-top:1px">${esc(pd.levelDesc[pw.level])}</div>`:''}${pw.selectedSE?.length?'<div style="margin-top:3px">'+pw.selectedSE.map(se=>`<span class="tag tag-se">${esc(se)}</span>`).join(' ')+'</div>':''}${pw.selectedLim?.length?'<div style="margin-top:2px">'+pw.selectedLim.map(l=>`<span class="tag tag-lim">${esc(l)}</span>`).join(' ')+'</div>':''}${pw.flavor?`<div style="font-style:italic;font-size:11px;color:var(--blue);margin-top:6px;padding:5px 7px;background:rgba(52,152,219,.06);border-left:2px solid var(--blue);border-radius:3px">${esc(pw.flavor)}</div>`:''}</div><div class="edit-only" style="display:flex;flex-direction:column;gap:3px;align-self:center">${isRich?`<button class="btn btn-secondary btn-xs" onclick="editPD('team',0,${i})" title="Edit power">Edit</button>`:''}<button class="btn btn-danger btn-xs" onclick="S.team.expanded.powers.splice(${i},1);save();renderNPCs()">X</button></div></div>`;
    });
    if(exHPRem>0){
      h+=`<div class="edit-only" style="display:flex;gap:4px;flex-wrap:wrap"><button class="btn btn-secondary btn-xs" onclick="openTeamStuntBrowser()">+ Sample Stunt</button><button class="btn btn-secondary btn-xs" onclick="addExStunt()">+ Custom Stunt</button><button class="btn btn-gold btn-xs" onclick="openPowerBrowser(0,'team')">+ Power (Browser)</button><button class="btn btn-gold btn-xs" onclick="addExPower()">+ Custom Power</button></div>`;
      h+=renderTeamStuntBrowser();
    }
    // Stress
    h+=`<div class="divider"></div><div class="label mb-1">Team Stress</div>`;
    h+=`<div style="margin-bottom:6px"><span style="font-size:11px;font-weight:700;color:var(--muted)">Physical</span><div style="display:flex;gap:6px;margin-top:3px">`;
    for(let i=0;i<stressMax;i++){h+=`<div class="stress-box ${ex.stress?.physical?.[i]?'filled':''}" onclick="toggleExStress('physical',${i})">${i+1}</div>`;}
    h+=`</div></div><div><span style="font-size:11px;font-weight:700;color:var(--muted)">Mental</span><div style="display:flex;gap:6px;margin-top:3px">`;
    for(let i=0;i<stressMax;i++){h+=`<div class="stress-box ${ex.stress?.mental?.[i]?'filled':''}" onclick="toggleExStress('mental',${i})">${i+1}</div>`;}
    h+=`</div></div>`;
    // Consequences
    h+=`<div class="divider"></div><div class="label mb-1">Team Consequences <span class="text-muted" style="font-weight:400">(no Extreme)</span></div>`;
    h+=`<div class="conseq-row"><div class="conseq-label">Mild (2)</div><div class="conseq-input"><input value="${esc(ex.consequences?.mild||'')}" oninput="S.team.expanded.consequences.mild=this.value;save()" placeholder="\u2014"></div></div>`;
    h+=`<div class="conseq-row"><div class="conseq-label">Moderate (4)</div><div class="conseq-input"><input value="${esc(ex.consequences?.moderate||'')}" oninput="S.team.expanded.consequences.moderate=this.value;save()" placeholder="\u2014"></div></div>`;
    h+=`<div class="conseq-row"><div class="conseq-label">Severe (6)</div><div class="conseq-input"><input value="${esc(ex.consequences?.severe||'')}" oninput="S.team.expanded.consequences.severe=this.value;save()" placeholder="\u2014"></div></div>`;
    // Refresh / FP
    const exRefresh=tone?.refresh||5;
    h+=`<div class="divider"></div><div style="display:flex;align-items:center;justify-content:space-between"><div><div class="label">Team Fate Points</div><div style="font-size:10px;color:var(--muted)">Refresh: ${exRefresh}</div></div><div style="display:flex;align-items:center;gap:8px"><button class="sk-btn" onclick="S.team.expanded.fp=Math.max(0,(S.team.expanded.fp||${exRefresh})-1);save();renderNPCs()">−</button><span style="font-size:22px;font-weight:900;font-family:var(--font-title);color:var(--gold)">${ex.fp!==undefined?ex.fp:exRefresh}</span><button class="sk-btn" onclick="S.team.expanded.fp=(S.team.expanded.fp||${exRefresh})+1;save();renderNPCs()">+</button></div></div>`;
    h+=`</div>`;
  }
  h+=`<button class="btn btn-danger btn-full mt-2 edit-only" onclick="if(confirm('Disband?')){S.team=null;save();renderNPCs();}">Disband Team</button>`;el.innerHTML=h;
}
function addTR(){const n=prompt('Rogue Name:');if(!n)return;S.team.rogues.push({name:n,desc:prompt('Description:')||''});save();renderNPCs();}
function toggleTS(id){const t=S.team,i=t.stunts.indexOf(id);if(i>=0){t.stunts.splice(i,1);TEAM_STUNTS.filter(ts=>ts.requires===id).forEach(ts=>{const di=t.stunts.indexOf(ts.id);if(di>=0)t.stunts.splice(di,1);});}else t.stunts.push(id);save();renderNPCs();}
function toggleTC(id){const t=S.team,i=t.complications.indexOf(id);if(i>=0)t.complications.splice(i,1);else t.complications.push(id);save();renderNPCs();}
function initExpandedTeam(){
  const{tone}=getSeriesConfig();const stressMax=tone?2+tone.stressBonus:4;
  S.team.expanded={aspect1:'',aspect2:'',skills:{Combat:0,Expertise:0,Social:0,Undercover:0},stunts:[],powers:[],
    stress:{physical:Array(stressMax).fill(false),mental:Array(stressMax).fill(false)},
    consequences:{mild:'',moderate:'',severe:''},fp:tone?.refresh||5};
  save();renderNPCs();
}
function adjExSkill(sk,d){const ex=S.team.expanded,cur=ex.skills[sk]||0,nv=cur+d;if(nv<0||nv>3)return;
  const used=Object.values(ex.skills).reduce((s,v)=>s+v,0);if(d>0&&used>=3)return;
  ex.skills[sk]=nv;save();renderNPCs();}
function toggleExStress(track,i){const ex=S.team.expanded;if(!ex.stress[track])ex.stress[track]=[];ex.stress[track][i]=!ex.stress[track][i];save();renderNPCs();}
function addExStunt(){const n=prompt('Team Stunt Name:');if(!n)return;const d=prompt('Description:')||'';const c=Math.max(1,Math.min(3,parseInt(prompt('HP Cost (1-3):','1'))||1));S.team.expanded.stunts.push({name:n,desc:d,cost:c});save();renderNPCs();}
function addExPower(){const n=prompt('Power Name:');if(!n)return;const d=prompt('Description:')||'';const c=Math.max(1,Math.min(6,parseInt(prompt('HP Cost (1-6):','1'))||1));S.team.expanded.powers.push({name:n,desc:d,cost:c});save();renderNPCs();}

// Team-targeted Sample Stunts browser (mirrors the NPC stunt browser but pushes to team.expanded.stunts)
let _teamStuntBrowseOpen=false,_teamStuntSearch='',_teamStuntSkillFilter='';
function openTeamStuntBrowser(){_teamStuntBrowseOpen=true;_teamStuntSearch='';_teamStuntSkillFilter='';renderNPCs();}
function pickTeamStunt(name){const s=SAMPLE_STUNTS.find(x=>x.name===name);if(!s)return;if(!S.team.expanded.stunts)S.team.expanded.stunts=[];S.team.expanded.stunts.push({name:s.name,desc:s.desc,cost:s.cost});save();renderNPCs();}
function renderTeamStuntBrowser(){
  if(!_teamStuntBrowseOpen)return'';
  const q=_teamStuntSearch.toLowerCase(),sf=_teamStuntSkillFilter;
  const filtered=SAMPLE_STUNTS.filter(s=>{if(q&&!s.name.toLowerCase().includes(q)&&!s.desc.toLowerCase().includes(q))return false;if(sf&&s.skill!==sf)return false;return true;});
  const skillFilters=['All',...[...new Set(SAMPLE_STUNTS.map(s=>s.skill))].sort()];
  let h=`<div class="card" style="border-color:var(--accent)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div class="label" style="margin:0">Sample Stunts</div><button class="btn btn-secondary btn-xs" onclick="_teamStuntBrowseOpen=false;renderNPCs()">Close</button></div>`;
  h+=`<input id="team-stunt-search" placeholder="Search stunts..." value="${esc(_teamStuntSearch)}" oninput="_teamStuntSearch=this.value;renderNPCs();_refocus('team-stunt-search',this.selectionStart)" style="margin-bottom:6px;font-size:12px;padding:7px">`;
  h+=`<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px">${skillFilters.map(f=>`<button class="btn btn-xs ${(f==='All'&&!sf)||sf===f?'btn-primary':'btn-secondary'}" onclick="_teamStuntSkillFilter='${f==='All'?'':f}';renderNPCs()" style="font-size:10px;padding:3px 7px">${f}</button>`).join('')}</div>`;
  h+=`<div style="max-height:40vh;overflow-y:auto">`;
  const existing=(S.team.expanded.stunts||[]).map(s=>s.name);
  filtered.forEach(s=>{const have=existing.includes(s.name);h+=`<div class="card-sm" style="display:flex;gap:8px;align-items:start;${have?'opacity:.5':''}"><div style="flex:1"><div class="fw-700" style="font-size:12px">${esc(s.name)} <span class="text-muted" style="font-weight:400;font-size:10px">[${s.skill}]</span></div><div style="font-size:11px;color:var(--muted)">${esc(s.desc)}</div></div>${have?'<span class="text-green" style="font-size:10px">✓</span>':`<button class="btn btn-primary btn-xs" onclick="pickTeamStunt('${esc(s.name)}')">Add</button>`}</div>`;});
  if(!filtered.length)h+='<div class="tac text-muted" style="padding:12px">No matches</div>';
  h+=`</div></div>`;
  return h;
}

// ═══════════════════════════════════════════════════════════
// NPCs
// ═══════════════════════════════════════════════════════════

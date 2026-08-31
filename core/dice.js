// ═══════════════════════════════════════════════════════════
// SHELL ROLL SURFACES
// ═══════════════════════════════════════════════════════════
// Rolling is the thing a player does most, so it is offered in three places,
// not one: the Dice tab, a sticky roller beside the sheet on desktop, and a
// tap-to-expand bar on the sheet on mobile.
//
// All three used to be Daring Comics'. The sidebar and the mobile bar were
// built inside renderSheet() in core/sheet.js, which only Daring Comics calls —
// a block pack forks away at core/creation.js and never reaches it. That was
// survivable until you notice core/shell.css hides #nb-dice below 700px,
// because the sheet was supposed to be carrying a roller instead. For Dungeon
// Crawler Carl it was not, so at phone width there was no way to roll a die at
// all. See DEBRIEF.md.
//
// So the surfaces live here now, behind three functions both sheet renderers
// call. A change to the roller can no longer reach one surface and miss the
// other two.

// Which roller a pack gets. 'sys' — it declared SYS.dice. 'fate' — it is
// Daring Comics (or another hand-written pack still on the old renderer).
// 'none' — a block pack with no dice contract, which gets no roller rather
// than somebody else's.
function rollSurfaces(){
  if(typeof SYS!=='undefined'&&SYS&&SYS.dice&&typeof SYS.dice.resolve==='function')return 'sys';
  if(typeof sysUsesBlocks==='function'&&sysUsesBlocks())return 'none';
  return 'fate';
}

// Where a mobile roll result appears. Sticky, so it stays on screen while you
// scroll the sheet under it.
function rollToastHTML(){
  return '<div id="quick-roll-toast" style="position:sticky;top:0;z-index:50"></div>';
}

// The mobile bar, drawn into the sheet by whichever renderer owns the pack.
function rollBarHTML(){
  const m=rollSurfaces();
  if(m==='sys')return sysRollBarHTML();
  if(m==='fate')return fateRollBarHTML();
  return '';
}

// The desktop sidebar. Called after the sheet HTML is in the DOM, because it
// fills a container that lives outside it (#page-hero is a flex row).
function renderRollSidebar(){
  const el=document.getElementById('hero-dice-sidebar');if(!el)return;
  const m=rollSurfaces();
  el.innerHTML=m==='sys'?sysRollPanelHTML():m==='fate'?buildDicePanel():'';
  markRollSurfaces();
}

// core/shell.css hides the Dice tab below 700px *on the grounds that the sheet
// carries a roller instead*. That was an invariant living in one person's head;
// it is a class on <body> now, so the rule can only fire when it is true.
function markRollSurfaces(){
  if(!document.body)return;
  document.body.classList.toggle('has-sheet-roller',!!document.getElementById('dice-bar-body'));
}

// ═══════════════════════════════════════════════════════════
// PACK ROLLER  (any pack that declares SYS.dice)
// ═══════════════════════════════════════════════════════════
// The Skill loaded from a sheet row, shared by all three surfaces so tapping a
// Skill on the sheet arrives in whichever roller you then open.
let _sysLoaded='';

// Which blocks hold rollable Skills. Hardcoded to Dungeon Crawler Carl's two
// until a pack needed a third; a pack says so itself now.
function sysRollBlocks(){
  return (SYS&&SYS.dice&&SYS.dice.skillBlocks)||['skills','spells'];
}

// The Skills a pack roller can offer: whatever the character actually has.
function sysDiceSkills(){
  const ch=S.char;
  if(!ch||!ch.blocks)return [];
  const out=[];
  sysRollBlocks().forEach(function(id){
    const b=ch.blocks[id];
    if(!b||!Array.isArray(b.skills))return;
    b.skills.forEach(function(sk){
      if(sk&&sk.name)out.push({name:String(sk.name),rank:sk.rank||0,stat:sk.stat||''});
    });
  });
  return out.sort(function(a,b){return a.name.localeCompare(b.name);});
}

// The roll form, drawn three times over under three id prefixes: 'sd' for the
// Dice tab, 'ss' for the sheet sidebar, 'sm' for the mobile bar.
function sysRollFormHTML(p,compact){
  const d=SYS.dice,kinds=d.checkKinds||[],list=sysDiceSkills();
  const sz=compact?' style="font-size:12px;padding:7px"':'';
  const row=compact?' style="display:flex;gap:6px;margin-bottom:6px"':' class="grid-2 mb-2"';
  const opts='<option value="">— Flat roll —</option>'+list.map(function(sk){
    return '<option value="'+esc(sk.name)+'"'+(sk.name===_sysLoaded?' selected':'')+'>'+
      esc(sk.name)+' (Rank '+sk.rank+(sk.stat?', '+esc(sk.stat):'')+')</option>';}).join('');
  let h='<div'+row+'>'+
    '<div class="form-group" style="flex:1;min-width:0;margin:0"><label>'+esc(lexU('skill'))+'</label>'+
    '<select id="'+p+'-skill"'+sz+' onchange="_sysLoaded=this.value">'+opts+'</select></div>'+
    '<div class="form-group" style="'+(compact?'width:54px;':'')+'margin:0"><label>Mod</label>'+
    '<input type="number" id="'+p+'-mod" value="0"'+sz+'></div></div>';
  h+='<div'+row+'>';
  if(kinds.length){
    h+='<div class="form-group" style="flex:1;min-width:0;margin:0"><label>Check</label>'+
      '<select id="'+p+'-kind"'+sz+'>'+kinds.map(function(k){
        return '<option value="'+esc(k.id)+'">'+esc(k.name||k.id)+'</option>';}).join('')+'</select></div>';
  }
  h+='<div class="form-group" style="flex:1;min-width:0;margin:0"><label>Roll</label>'+
    '<select id="'+p+'-adv"'+sz+'><option value="0">Straight</option>'+
    '<option value="1">Advantage</option><option value="-1">Disadvantage</option></select></div></div>';
  return h;
}

// Surface 1 — the Dice tab.
function sysDiceHTML(){
  return '<div class="pg-title">'+esc(lexU('roll'))+'</div><div class="pg-sub">'+
    esc(SYS.dice.formula||'')+' + Rank + Stat Mod</div><div class="card">'+
    sysRollFormHTML('sd',false)+
    '<div class="tac"><button class="roll-btn" onclick="sysDoRollFrom(&#39;sd&#39;)">ROLL</button></div>'+
    '</div><div id="sd-result"></div>';
}

// Surface 2 — the sticky sidebar beside the sheet on desktop.
function sysRollPanelHTML(){
  return '<div class="card"><div class="pg-title" style="font-size:18px;margin-bottom:2px">'+
    esc(lexU('roll'))+'</div>'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">'+
    esc(SYS.dice.formula||'')+' + Rank + Stat Mod</div>'+
    sysRollFormHTML('ss',true)+
    '<div class="tac"><button class="roll-btn" style="width:60px;height:60px;font-size:18px" '+
    'onclick="sysDoRollFrom(&#39;ss&#39;)">ROLL</button></div>'+
    '<div id="ss-result" style="margin-top:8px"></div></div>';
}

// Surface 3 — the tap-to-expand bar on the sheet on mobile. #dice-bar-body is
// also what markRollSurfaces() looks for, so this element IS the claim that the
// Dice tab may be hidden.
function sysRollBarHTML(){
  return '<div id="hero-dice-mobile"><div class="dice-bar-toggle" '+
    'onclick="document.getElementById(&#39;dice-bar-body&#39;).classList.toggle(&#39;open&#39;)">'+
    '<div style="display:flex;align-items:center;gap:6px"><span style="font-size:16px">&#127922;</span>'+
    '<span class="fw-700" style="font-size:13px;font-family:var(--font-label)">'+esc(lexU('roll'))+'</span>'+
    '<span id="sm-loaded" style="font-size:10px;color:var(--accent)"></span></div>'+
    '<span class="text-muted" style="font-size:11px">tap to expand</span></div>'+
    '<div class="dice-bar-body" id="dice-bar-body">'+sysRollFormHTML('sm',true)+
    '<div class="tac"><button class="roll-btn" style="width:44px;height:44px;font-size:14px" '+
    'onclick="sysDoRollFrom(&#39;sm&#39;)">ROLL</button></div></div></div>';
}

// Roll a named Skill with no form to read. A fight screen rolls straight off an
// attack card, with nothing on screen to take a modifier from, so the roll
// itself cannot depend on the DOM. This is the single choke point every pack
// roll goes through — the multiplayer feed wraps THIS, not its callers.
function sysRollSkill(name,opts){
  const o=opts||{};
  const sk=sysDiceSkills().find(function(x){return x.name===name;});
  const mod=Number(o.bonus)||0;
  // The Stat Mod comes from the pack's own table, applied to the character's
  // Enhanced score for that Stat.
  let statMod=0;
  if(sk&&sk.stat){
    const f=sysDerive('statMod');
    if(f&&typeof dccStatOf==='function')statMod=f(dccStatOf(S.char,sk.stat))||0;
    else if(f)statMod=f(S.char,sk.stat)||0;
  }
  const r=SYS.dice.resolve({rank:sk?sk.rank:0,statMod:statMod,bonus:mod,
                            adv:Number(o.adv)||0,kind:o.kind,floor:S.floor||3});
  // `skill` as well as `label`: the multiplayer roll feed reads S.dice.skill, so
  // without it a pack roll reached the table as a bare number with no name on it.
  S.dice=Object.assign({},r,{label:sk?sk.name:'Flat roll',skill:sk?sk.name:'',
                             mod:mod,systemId:SYS.id});
  _sysLoaded=name||'';
  save();
  return S.dice;
}

// One roll, from whichever surface asked. The result goes back to that surface:
// the mobile bar answers in the sticky toast, everything else answers in place.
function sysDoRollFrom(p){
  const g=function(f){return document.getElementById(p+'-'+f);};
  sysRollSkill((g('skill')||{}).value||'',{
    bonus:parseInt((g('mod')||{}).value,10)||0,
    kind:(g('kind')||{}).value||undefined,
    adv:parseInt((g('adv')||{}).value,10)||0,
  });
  if(p==='sm')sysRenderRollInto('quick-roll-toast',true);
  else sysRenderRollInto(p+'-result',false);
  return S.dice;
}

// Tap a Skill on the sheet and it lands in every roller at once — the
// affordance Daring Comics has had all along and a block pack never got.
function sysLoadRoll(name){
  _sysLoaded=name||'';
  ['sd','ss','sm'].forEach(function(p){
    const s=document.getElementById(p+'-skill');if(s)s.value=_sysLoaded;
  });
  const lab=document.getElementById('sm-loaded');
  if(lab)lab.textContent=_sysLoaded?' · '+_sysLoaded:'';
  const bar=document.getElementById('dice-bar-body');
  if(bar)bar.classList.add('open');
  const side=document.getElementById('hero-dice-sidebar');
  if(side&&side.firstChild&&typeof side.scrollIntoView==='function'){
    try{side.scrollIntoView({block:'nearest'});}catch(e){}
  }
}

function sysRollResultHTML(d){
  const dice=d.dice.map(function(v){
    const used=v===d.nat;
    return '<span class="fate-die '+(used?'plus':'blank')+'" style="width:38px;height:38px;'+
      'font-size:18px;border-radius:8px">'+v+'</span>';
  }).join('');
  const deg=d.degree||{};
  return '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px">'+dice+'</div>'+
    '<div style="font-size:11px;color:var(--muted)">'+esc(d.label||'')+
    (d.mod?' | Mod '+(d.mod>=0?'+':'')+d.mod:'')+
    (d.difficulty!==undefined?' | vs '+d.difficulty:'')+'</div>'+
    '<div style="font-size:32px;font-weight:900;font-family:var(--font-title);'+
    'color:var(--accent);margin:4px 0">'+d.total+'</div>'+
    (deg.name?'<div style="font-size:16px;font-weight:700;color:'+(deg.color||'var(--text)')+'">'+
      esc(deg.name)+'</div>':'')+
    (deg.desc?'<div style="font-size:11px;color:var(--muted)">'+esc(deg.desc)+'</div>':'');
}

// The Dice tab's own ROLL button, kept under its old name so anything holding a
// reference to it still works.
function sysDoRoll(){return sysDoRollFrom('sd');}

function sysRenderRollInto(elId,toast){
  const area=document.getElementById(elId);if(!area)return;
  const d=S.dice;
  if(!d||!d.dice||d.systemId!==SYS.id){area.innerHTML='';return;}
  area.innerHTML='<div class="card tac"'+(toast?' style="border-color:var(--accent)"':'')+'>'+
    sysRollResultHTML(d)+
    (toast?'<div style="margin-top:6px"><button class="btn btn-xs btn-secondary" '+
      'onclick="clearRollToast()">Dismiss</button></div>':'')+'</div>';
}

// Kept for the Dice tab's own repaint path.
function sysRenderRoll(){sysRenderRollInto('sd-result',false);}

// ═══════════════════════════════════════════════════════════
// DICE TAB
// ═══════════════════════════════════════════════════════════
// The Fate roller below belongs to Daring Comics. A pack that declares its own
// dice contract (SYS.dice) gets a roller built from that instead — before this,
// Dungeon Crawler Carl's Dice tab rendered "Fate Dice — 4dF", listed its Skills
// as "[object Object] (+0)", showed `undefined` Fate Points, and threw
// `ladderName is not defined` the moment you pressed ROLL.
function renderDice(){
  const el=document.getElementById('dice-content');
  const m=rollSurfaces();
  if(m==='sys'){el.innerHTML=sysDiceHTML();sysRenderRoll();return;}
  // A block pack with no dice contract gets a straight answer rather than
  // another game's roller, which would throw on the first Fate constant.
  if(m==='none'){
    el.innerHTML='<div class="pg-title">'+esc(lexU('roll'))+'</div>'+
      '<div class="card tac" style="padding:26px;color:var(--muted);font-size:13px">'+
      esc(SYS&&SYS.name?SYS.name:'This game')+' does not declare a dice engine yet.</div>';
    return;
  }
  return renderDiceFate();
}

function renderDiceFate(){
  const el=document.getElementById('dice-content'),ch=S.char;
  const ex=S.team?.expanded;const exSkills=ex?['Combat','Expertise','Social','Undercover']:[];
  let h=`<div class="pg-title">Fate Dice</div><div class="pg-sub">4dF + Skill + Modifier</div><div class="card"><div class="grid-2 mb-2"><div class="form-group"><label>Skill</label><select id="d-sk" onchange="updateDP()"><option value="">— None —</option>${sysList('SKILLS','skills').map(sk=>`<option value="${sk}">${sk} (+${ch?.skills?.[sk]||0})</option>`).join('')}${exSkills.length?`<optgroup label="Team: ${esc(S.team.name)}">${exSkills.map(sk=>`<option value="team:${sk}">${sk} (+${ex.skills[sk]||0})</option>`).join('')}</optgroup>`:''}</select></div><div class="form-group"><label>Modifier</label><input type="number" id="d-mod" value="0" onchange="updateDP()"></div></div><div id="d-preview" class="tac text-muted mb-2" style="font-size:12px"></div><div class="tac"><button class="roll-btn" onclick="doRoll()">ROLL</button></div></div><div id="d-result"></div>`;
  if(ch)h+=`<div class="card" style="display:flex;align-items:center;justify-content:space-between"><div class="label">Fate Points</div><div style="display:flex;align-items:center;gap:8px"><button class="sk-btn" onclick="adjFP(-1);renderDice()">−</button><span style="font-size:22px;font-weight:900;color:var(--gold)">${ch.fatePoints}</span><button class="sk-btn" onclick="adjFP(1);renderDice()">+</button></div></div>`;
  h+=`<div id="d-actions" style="display:none" class="card tac"><button class="btn btn-gold btn-sm" onclick="invokeAsp()">Invoke (+2)</button> <button class="btn btn-secondary btn-sm" onclick="rerollDice()">Reroll</button> <button class="btn btn-success btn-sm" onclick="compelAsp()">Compel (+1 FP)</button></div><div id="d-hist"></div>`;
  el.innerHTML=h;renderDR();
}
let _loadedSkill='',_loadedMod=0,_loadedPower='';
function loadRoll(skill,bonus,powerName){
  _loadedSkill=skill;_loadedMod=bonus||0;_loadedPower=powerName||'';
  // Update mobile bar
  const msk=document.getElementById('dm-sk');if(msk){msk.value=skill;}
  const mmod=document.getElementById('dm-mod');if(mmod)mmod.value=_loadedMod;
  const mbar=document.getElementById('dice-bar-body');if(mbar)mbar.classList.add('open');
  updateLoadedInfo('m');
  // Update sidebar
  const ssk=document.getElementById('ds-sk');if(ssk)ssk.value=skill;
  const smod=document.getElementById('ds-mod');if(smod)smod.value=_loadedMod;
  updateLoadedInfo('s');
}
function updateLoadedInfo(target){
  const sk=target==='s'?document.getElementById('ds-sk')?.value:document.getElementById('dm-sk')?.value;
  const sv=S.char?.skills?.[sk]||0;
  const mod=parseInt((target==='s'?document.getElementById('ds-mod'):document.getElementById('dm-mod'))?.value)||0;
  const label=_loadedPower||sk||'';
  const el=document.getElementById(target==='s'?'ds-loaded':'dm-loaded-info');
  const el2=document.getElementById('dm-loaded');
  if(el&&target==='m')el.innerHTML=label?`<div style="font-size:12px;color:var(--purple);font-weight:700;font-family:var(--font-title)">${esc(label)}</div>`:'';
  if(el2)el2.textContent=label?' \u2022 '+label:'';
}
function fateOutcome(shifts){
  if(shifts<0)return{label:'FAIL',color:'var(--red)',desc:'You don\u2019t achieve your goal.'};
  if(shifts===0)return{label:'TIE',color:'var(--yellow)',desc:'Success at a minor cost.'};
  if(shifts<=2)return{label:'SUCCESS',color:'var(--green)',desc:shifts+' shift'+(shifts>1?'s':'')+'.'};
  return{label:'SUCCESS WITH STYLE',color:'var(--cyan)',desc:shifts+' shifts! Gain a Boost.'};
}
function renderRollResult(d,tn,target){
  const dh=d.dice.map(v=>`<span class="fate-die ${v>0?'plus':v<0?'minus':'blank'}" style="width:${target==='s'?'36':'32'}px;height:${target==='s'?'36':'32'}px;font-size:${target==='s'?'20':'18'}px;border-radius:${target==='s'?'8':'6'}px">${v>0?'+':v<0?'\u2212':'0'}</span>`).join('');
  const shifts=d.total-tn;
  const out=fateOutcome(shifts);
  const pn=d.powerName?`<div style="font-size:14px;font-weight:900;font-family:var(--font-title);color:var(--purple);margin-bottom:2px">${d.powerName}</div>`:'';
  return`<div style="text-align:center"><div style="display:flex;gap:${target==='s'?'6':'8'}px;justify-content:center;margin-bottom:6px">${dh}</div>${pn}<div style="font-size:10px;color:var(--muted)">${d.skill?d.skill+' (+'+d.skillVal+')':'Flat roll'}${d.mod?' + bonus(+'+d.mod+')':''}${tn?' vs TN '+tn:''}</div><div style="font-size:22px;font-weight:900;font-family:var(--font-title);color:var(--accent);margin:2px 0">${d.total>=0?'+':''}${d.total} ${ladderName(d.total)}</div>${tn!==0||tn===0?`<div style="font-size:16px;font-weight:900;color:${out.color};margin:2px 0">${out.label}</div><div style="font-size:11px;color:var(--muted)">${out.desc}</div>`:''}<div style="margin-top:6px"><button class="btn btn-gold btn-xs" onclick="if(S.char&&S.char.fatePoints>0){S.char.fatePoints--;S.dice.total+=2;save();refreshRollResult('${target}');}else alert('No FP!')">Invoke +2</button> <button class="btn btn-secondary btn-xs" onclick="if(S.char&&S.char.fatePoints>0){S.char.fatePoints--;S.dice.dice=[rollFD(),rollFD(),rollFD(),rollFD()];S.dice.diceSum=S.dice.dice.reduce((a,b)=>a+b,0);S.dice.total=S.dice.diceSum+S.dice.skillVal+S.dice.mod;save();refreshRollResult('${target}');}else alert('No FP!')">Reroll</button>${target==='m'?' <button class="btn btn-xs btn-secondary" onclick="clearRollToast()">Dismiss</button>':''}</div></div>`;
}
function refreshRollResult(target){
  const d=S.dice;if(!d)return;
  const tn=d.tn||0;
  if(target==='s'){const el=document.getElementById('ds-result');if(el)el.innerHTML=renderRollResult(d,tn,'s');renderSheet();}
  else{const toast=document.getElementById('quick-roll-toast');if(toast)toast.innerHTML=`<div class="card" style="border-color:var(--accent);animation:fadeIn .15s ease">${renderRollResult(d,tn,'m')}</div>`;}
}
function doSidebarRoll(){
  const sk=document.getElementById('ds-sk')?.value||'';
  const mod=parseInt(document.getElementById('ds-mod')?.value)||0;
  const tn=parseInt(document.getElementById('ds-tn')?.value)||0;
  const sv=getSkillVal(sk);
  const dice=[rollFD(),rollFD(),rollFD(),rollFD()];
  const ds=dice.reduce((a,b)=>a+b,0);
  const tot=ds+sv+mod;
  S.dice={skill:getSkillLabel(sk),skillVal:sv,mod,dice,diceSum:ds,total:tot,powerName:_loadedPower,tn};
  save();
  const el=document.getElementById('ds-result');if(el)el.innerHTML=renderRollResult(S.dice,tn,'s');
}
function doMobileRoll(){
  const sk=document.getElementById('dm-sk')?.value||'';
  const mod=parseInt(document.getElementById('dm-mod')?.value)||0;
  const tn=parseInt(document.getElementById('dm-tn')?.value)||0;
  const sv=S.char?.skills?.[sk]||0;
  const dice=[rollFD(),rollFD(),rollFD(),rollFD()];
  const ds=dice.reduce((a,b)=>a+b,0);
  const tot=ds+sv+mod;
  S.dice={skill:sk,skillVal:sv,mod,dice,diceSum:ds,total:tot,powerName:_loadedPower,tn};
  save();
  const toast=document.getElementById('quick-roll-toast');
  if(toast){toast.innerHTML=`<div class="card" style="border-color:var(--accent);animation:fadeIn .15s ease">${renderRollResult(S.dice,tn,'m')}</div>`;toast.scrollIntoView({behavior:'smooth',block:'nearest'});}
}
function updateDSP(){}
function getSkillVal(sk){if(sk.startsWith('team:')){const tsk=sk.substring(5);return S.team?.expanded?.skills?.[tsk]||0;}return S.char?.skills?.[sk]||0;}
function getSkillLabel(sk){return sk.startsWith('team:')?sk.substring(5):sk;}
function updateDP(){const sk=document.getElementById('d-sk')?.value,mod=parseInt(document.getElementById('d-mod')?.value)||0,sv=getSkillVal(sk||'');const el=document.getElementById('d-preview');if(el)el.textContent=sk?`4dF + ${getSkillLabel(sk)}(+${sv})${mod?' + '+(mod>0?'+':'')+mod:''}`:'4dF';}
function rollFD(){return[-1,0,1][Math.floor(Math.random()*3)];}
function doRoll(){const sk=document.getElementById('d-sk')?.value||'',mod=parseInt(document.getElementById('d-mod')?.value)||0,sv=getSkillVal(sk),dice=[rollFD(),rollFD(),rollFD(),rollFD()],ds=dice.reduce((a,b)=>a+b,0),tot=ds+sv+mod;S.dice={skill:getSkillLabel(sk),skillVal:sv,mod,dice,diceSum:ds,total:tot};save();renderDR();}
function renderDR(){
  const area=document.getElementById('d-result'),act=document.getElementById('d-actions');if(!area)return;const d=S.dice;
  if(!d||!d.dice){area.innerHTML='';if(act)act.style.display='none';return;}
  const dh=d.dice.map(v=>`<div class="fate-die ${v>0?'plus':v<0?'minus':'blank'}">${v>0?'+':v<0?'\u2212':'0'}</div>`).join('');
  area.innerHTML=`<div class="card tac"><div style="display:flex;gap:10px;justify-content:center;margin-bottom:10px">${dh}</div><div style="font-size:12px;color:var(--muted)">Dice: ${d.diceSum>=0?'+':''}${d.diceSum}${d.skill?' | '+d.skill+': +'+d.skillVal:''}${d.mod?' | Mod: '+(d.mod>=0?'+':'')+d.mod:''}</div><div style="font-size:32px;font-weight:900;font-family:var(--font-title);color:var(--accent);margin:4px 0">${d.total>=0?'+':''}${d.total}</div><div style="font-size:16px;font-weight:700">${ladderName(d.total)}</div></div>`;
  if(act)act.style.display=S.char?'block':'none';
}
function invokeAsp(){if(!S.char||S.char.fatePoints<=0)return alert('No Fate Points!');S.char.fatePoints--;S.dice.total+=2;save();renderDR();renderDice();}
function rerollDice(){if(!S.char||S.char.fatePoints<=0)return alert('No Fate Points!');S.char.fatePoints--;S.dice.dice=[rollFD(),rollFD(),rollFD(),rollFD()];S.dice.diceSum=S.dice.dice.reduce((a,b)=>a+b,0);S.dice.total=S.dice.diceSum+S.dice.skillVal+S.dice.mod;save();renderDR();}
function compelAsp(){if(!S.char)return;S.char.fatePoints++;save();renderDice();}

// Daring Comics mobile dice bar. Lifted out of renderSheet() so that both
// sheet renderers reach their roller through rollBarHTML(), and neither one
// owns a surface the other cannot see.
function fateRollBarHTML(){
  const ch=S.char;
  return `<div id="hero-dice-mobile"><div class="dice-bar-toggle" onclick="document.getElementById('dice-bar-body').classList.toggle('open')"><div style="display:flex;align-items:center;gap:6px"><span style="font-size:16px">&#127922;</span><span class="fw-700" style="font-size:13px;font-family:var(--font-label)">Dice Roller</span><span id="dm-loaded" style="font-size:10px;color:var(--accent)"></span></div><span class="text-muted" style="font-size:11px">tap to expand</span></div><div class="dice-bar-body" id="dice-bar-body"><div id="dm-loaded-info" style="margin-bottom:6px"></div><div style="display:flex;gap:6px;align-items:end"><div style="flex:1"><div class="label" style="margin-bottom:2px">Skill</div><select id="dm-sk" style="font-size:12px;padding:7px" onchange="_loadedPower='';updateLoadedInfo('m')"><option value="">— None —</option>${sysList('SKILLS','skills').map(sk=>`<option value="${sk}">${sk} (+${ch?.skills?.[sk]||0})</option>`).join('')}</select></div><div style="width:50px"><div class="label" style="margin-bottom:2px">Mod</div><input type="number" id="dm-mod" value="0" style="font-size:12px;padding:7px"></div><div style="width:50px"><div class="label" style="margin-bottom:2px">TN</div><input type="number" id="dm-tn" value="0" style="font-size:12px;padding:7px"></div><button class="roll-btn" style="width:44px;height:44px;font-size:14px;flex-shrink:0" onclick="doMobileRoll()">ROLL</button></div></div></div>`;
}

// ═══════════════════════════════════════════════════════════
// CONFLICT
// ═══════════════════════════════════════════════════════════

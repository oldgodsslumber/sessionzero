// The Fate dice roller below belongs to Daring Comics. A pack that declares its
// own dice contract (SYS.dice) gets a roller built from that instead — before
// this, Dungeon Crawler Carl's Dice tab rendered "Fate Dice — 4dF", listed its
// Skills as "[object Object] (+0)", showed `undefined` Fate Points, and threw
// `ladderName is not defined` the moment you pressed ROLL.
function renderDice(){
  const el=document.getElementById('dice-content');
  if(SYS&&SYS.dice&&typeof SYS.dice.resolve==='function'){el.innerHTML=sysDiceHTML();sysRenderRoll();return;}
  return renderDiceFate();
}

// The Skills a pack roller can offer: whatever the character actually has.
function sysDiceSkills(){
  const ch=S.char;
  if(!ch||!ch.blocks)return [];
  const out=[];
  ['skills','spells'].forEach(function(id){
    const b=ch.blocks[id];
    if(!b||!Array.isArray(b.skills))return;
    b.skills.forEach(function(sk){
      if(sk&&sk.name)out.push({name:String(sk.name),rank:sk.rank||0,stat:sk.stat||''});
    });
  });
  return out.sort(function(a,b){return a.name.localeCompare(b.name);});
}

function sysDiceHTML(){
  const d=SYS.dice,kinds=d.checkKinds||[];
  const list=sysDiceSkills();
  let h='<div class="pg-title">'+esc(lexU('roll'))+'</div><div class="pg-sub">'+esc(d.formula||'')+
    ' + Rank + Stat Mod</div><div class="card"><div class="grid-2 mb-2">'+
    '<div class="form-group"><label>'+esc(lexU('skill'))+'</label>'+
    '<select id="sd-skill"><option value="">— Flat roll —</option>'+
    list.map(function(sk){
      return '<option value="'+esc(sk.name)+'">'+esc(sk.name)+' (Rank '+sk.rank+
        (sk.stat?', '+esc(sk.stat):'')+')</option>';
    }).join('')+'</select></div>'+
    '<div class="form-group"><label>Modifier</label><input type="number" id="sd-mod" value="0"></div>'+
    '</div><div class="grid-2 mb-2">';
  if(kinds.length){
    h+='<div class="form-group"><label>Check</label><select id="sd-kind">'+
      kinds.map(function(k){return '<option value="'+esc(k.id)+'">'+esc(k.name||k.id)+'</option>';}).join('')+
      '</select></div>';
  }
  h+='<div class="form-group"><label>Advantage</label><select id="sd-adv">'+
    '<option value="0">Straight</option><option value="1">Advantage</option>'+
    '<option value="-1">Disadvantage</option></select></div></div>'+
    '<div class="tac"><button class="roll-btn" onclick="sysDoRoll()">ROLL</button></div></div>'+
    '<div id="sd-result"></div>';
  return h;
}

function sysDoRoll(){
  const name=(document.getElementById('sd-skill')||{}).value||'';
  const sk=sysDiceSkills().find(function(x){return x.name===name;});
  const mod=parseInt((document.getElementById('sd-mod')||{}).value,10)||0;
  const kind=(document.getElementById('sd-kind')||{}).value||undefined;
  const adv=parseInt((document.getElementById('sd-adv')||{}).value,10)||0;
  // The Stat Mod comes from the pack's own table, applied to the character's
  // Enhanced score for that Stat.
  let statMod=0;
  if(sk&&sk.stat){
    const f=sysDerive('statMod');
    if(f&&typeof dccStatOf==='function')statMod=f(dccStatOf(S.char,sk.stat))||0;
    else if(f)statMod=f(S.char,sk.stat)||0;
  }
  const r=SYS.dice.resolve({rank:sk?sk.rank:0,statMod:statMod,bonus:mod,adv:adv,
                            kind:kind,floor:S.floor||3});
  S.dice=Object.assign({},r,{label:sk?sk.name:'Flat roll',mod:mod,systemId:SYS.id});
  save();sysRenderRoll();
}

function sysRenderRoll(){
  const area=document.getElementById('sd-result');
  if(!area)return;
  const d=S.dice;
  if(!d||!d.dice||d.systemId!==SYS.id){area.innerHTML='';return;}
  const dice=d.dice.map(function(v){
    const used=v===d.nat;
    return '<span class="fate-die '+(used?'plus':'blank')+'" style="width:38px;height:38px;font-size:18px;border-radius:8px">'+v+'</span>';
  }).join('');
  const deg=d.degree||{};
  area.innerHTML='<div class="card tac">'+
    '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px">'+dice+'</div>'+
    '<div style="font-size:11px;color:var(--muted)">'+esc(d.label||'')+
    (d.mod?' | Mod '+(d.mod>=0?'+':'')+d.mod:'')+
    (d.difficulty!==undefined?' | vs '+d.difficulty:'')+'</div>'+
    '<div style="font-size:32px;font-weight:900;font-family:var(--font-title);color:var(--accent);margin:4px 0">'+
    d.total+'</div>'+
    (deg.name?'<div style="font-size:16px;font-weight:700;color:'+(deg.color||'var(--text)')+'">'+esc(deg.name)+'</div>':'')+
    (deg.desc?'<div style="font-size:11px;color:var(--muted)">'+esc(deg.desc)+'</div>':'')+
    '</div>';
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

// ═══════════════════════════════════════════════════════════
// CONFLICT
// ═══════════════════════════════════════════════════════════

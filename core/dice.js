// ═══════════════════════════════════════════════════════════
// SHELL ROLL SURFACES
// ═══════════════════════════════════════════════════════════
// Rolling is the thing a player does most, so it is offered wherever they are:
// the Dice tab, a sticky roller beside the sheet on desktop, a tap-to-expand bar
// on the sheet on mobile, the same pair on the HUD, and a popover that appears
// where you click a Stat or a Skill.
//
// That is six copies of one form, so it is ONE component instantiated six times
// rather than six hand-placed copies. Every instance carries an id; its fields,
// its ROLL button and its result element are all derived from that id, and the
// helpers below find live instances by querying [data-roller] rather than
// holding a list. A list would go stale the moment a tab repainted, and the
// hardcoded ids it replaced (#dice-bar-body, #quick-roll-toast) were already
// being read by three functions that had no business knowing them.
//
// The history: all of this used to be Daring Comics', built inside renderSheet()
// in core/sheet.js, which only Daring Comics calls. core/shell.css hid the Dice
// tab below 700px because the sheet was supposed to be carrying a roller
// instead — true for Daring Comics, false for a block pack, so Dungeon Crawler
// Carl had no way to roll a die at phone width at all. See DEBRIEF.md.

// The breakpoint the layout switches at. This MUST track the @media rule in
// core/shell.css: the whole dice bug was one rule assuming what another file
// drew, and a popover that opens at a width where the sidebar is hidden would
// be the same mistake wearing a different hat.
const ROLL_DESKTOP_MQ = '(min-width:700px)';

// Split out so a test can stub it: JSDOM implements matchMedia as a stub that
// always reports false, so the desktop path is unreachable otherwise.
function sysRollerIsDesktop(){
  try{ return !!(window.matchMedia && window.matchMedia(ROLL_DESKTOP_MQ).matches); }
  catch(e){ return false; }
}

// Which roller a pack gets. 'sys' — it declared SYS.dice. 'fate' — it is
// Daring Comics (or another hand-written pack still on the old renderer).
// 'none' — a block pack with no dice contract, which gets no roller rather
// than somebody else's.
function rollSurfaces(){
  if(typeof SYS!=='undefined'&&SYS&&SYS.dice&&typeof SYS.dice.resolve==='function')return 'sys';
  if(typeof sysUsesBlocks==='function'&&sysUsesBlocks())return 'none';
  return 'fate';
}

// Where a mobile roll result appears on the hero sheet. Sticky, so it stays on
// screen while you scroll the sheet under it.
function rollToastHTML(){
  return '<div id="quick-roll-toast" style="position:sticky;top:0;z-index:50"></div>';
}

// The collapsible bar. Defaults to the hero sheet's instance, because that is
// the one core/shell.css hides the Dice tab in favour of.
function rollBarHTML(id,opts){
  const m=rollSurfaces();
  const o=Object.assign({sheet:true,resultIn:'quick-roll-toast',toast:true},opts||{});
  if(m==='sys')return rollerBarHTML(id||'sm',o);
  if(m==='fate')return fateRollBarHTML();
  return '';
}

// The desktop sidebar. Called after its page's HTML is in the DOM, because it
// fills a container that lives outside it — a .roller-page is a flex row with
// the sheet on the left and this on the right.
function renderRollSidebar(hostId,instId){
  const el=document.getElementById(hostId||'hero-dice-sidebar');if(!el)return;
  const m=rollSurfaces();
  el.innerHTML=m==='sys'?rollerHTML(instId||'ss',{compact:true})
             :m==='fate'?buildDicePanel():'';
  markRollSurfaces();
}

// core/shell.css hides the Dice tab below 700px *on the grounds that the hero
// sheet carries a roller instead*. That was an invariant living in one person's
// head; it is a class on <body> now, set from the sheet's own bar, so the rule
// can only fire when it is true. Deliberately still the SHEET's bar and not the
// HUD's: the hero page is where a player lands.
function markRollSurfaces(){
  if(!document.body)return;
  document.body.classList.toggle('has-sheet-roller',!!document.querySelector('[data-roller-sheet]'));
}

// ═══════════════════════════════════════════════════════════
// PACK ROLLER  (any pack that declares SYS.dice)
// ═══════════════════════════════════════════════════════════
// What is loaded into every roller at once, as a ref (see rollEntries). Shared
// on purpose: pick a Stat on the sheet, open the HUD, and it is still there.
let _rollLoaded='';

// Which blocks hold rollable Skills, and which hold rollable Stats. Both were
// going to end up hardcoded to Dungeon Crawler Carl's; a pack names its own,
// and the Stat default reads the schema rather than a list, so any pack with a
// traitGrid can roll its traits without declaring anything.
function sysRollBlocks(){
  return (SYS&&SYS.dice&&SYS.dice.skillBlocks)||['skills','spells'];
}
function sysRollTraitBlocks(){
  if(SYS&&SYS.dice&&SYS.dice.statBlocks)return SYS.dice.statBlocks;
  return ((SYS&&SYS.schema&&SYS.schema.blocks)||[])
    .filter(function(b){return b.type==='traitGrid';})
    .map(function(b){return b.id;});
}

// A ref names one rollable thing unambiguously: 'stat:stats:STR',
// 'skill:spells:Heal'. The block id is in there because a Stat called Strength
// and a Skill called Strength are different rolls, and a bare name cannot say
// which — the roller's <option value> used to be a bare name and would have
// picked whichever came first.
function rollRef(kind,blockId,name){return kind+':'+blockId+':'+name;}

// Everything the character can roll, grouped for the dropdown.
function rollEntries(){
  const ch=S.char;
  if(!ch||!ch.blocks)return [];
  const out=[];
  // Stats first: a Stat Check adds no Ranks, so rank is 0 and the maths below
  // is the same as any other roll.
  sysRollTraitBlocks().forEach(function(id){
    const b=sysBlock?sysBlock(id):null;
    const data=ch.blocks[id];
    if(!b||!data)return;
    (b.traits||[]).forEach(function(t){
      const tid=t.id||t;
      out.push({ref:rollRef('stat',id,tid),kind:'stat',name:t.name||tid,
                statId:tid,rank:0,group:b.label||'Stats'});
    });
  });
  sysRollBlocks().forEach(function(id){
    const b=ch.blocks[id];
    if(!b||!Array.isArray(b.skills))return;
    const def=sysBlock?sysBlock(id):null;
    const group=(def&&def.label)||id;
    b.skills.slice().sort(function(a,z){
      return String(a.name).localeCompare(String(z.name));
    }).forEach(function(sk){
      if(!sk||!sk.name)return;
      out.push({ref:rollRef('skill',id,sk.name),kind:'skill',name:String(sk.name),
                statId:sk.stat||'',rank:sk.rank||0,group:group});
    });
  });
  return out;
}

// Kept as it was — a flat list of Skills only, by name. The HUD's attack cards
// and the existing suites read it, and adding Stats to it would have quietly
// changed what "the Skills you have" means.
function sysDiceSkills(){
  return rollEntries().filter(function(e){return e.kind==='skill';})
    .map(function(e){return {name:e.name,rank:e.rank,stat:e.statId};})
    .sort(function(a,b){return a.name.localeCompare(b.name);});
}

// Resolve a ref, or a bare name for the callers that only have one — the HUD's
// attack cards say dccHudRoll('Unarmed Combat'), and should not have to know
// which block it lives in.
function rollFind(refOrName){
  if(!refOrName)return null;
  const list=rollEntries();
  return list.find(function(x){return x.ref===refOrName;})
      || list.find(function(x){return x.kind==='skill'&&x.name===refOrName;})
      || list.find(function(x){return x.name===refOrName;})
      || null;
}

// The Stat Mod for a trait, from the pack's own table. A pack's statMod either
// takes the Enhanced score (Dungeon Crawler Carl) or the character and the trait
// id; both shapes were already in use here, so both are still handled.
function rollStatMod(statId){
  if(!statId)return 0;
  const modFn=sysDerive('statMod');
  if(!modFn)return 0;
  const statFn=sysDerive('stat')||(typeof dccStatOf==='function'?dccStatOf:null);
  try{
    if(statFn)return Number(modFn(statFn(S.char,statId)))||0;
    return Number(modFn(S.char,statId))||0;
  }catch(e){return 0;}
}

// ── the component ───────────────────────────────────────────────────────────
// One form, six instances. Every id below is derived from `id`, so two
// instances on screen at once cannot collide.
function rollerFormHTML(id,compact){
  const d=SYS.dice,kinds=d.checkKinds||[],list=rollEntries();
  const sz=compact?' style="font-size:12px;padding:7px"':'';
  const row=compact?' style="display:flex;gap:6px;margin-bottom:6px"':' class="grid-2 mb-2"';
  let opts='<option value="">— Flat roll —</option>',group='';
  list.forEach(function(e){
    if(e.group!==group){
      if(group)opts+='</optgroup>';
      group=e.group;
      opts+='<optgroup label="'+esc(group)+'">';
    }
    opts+='<option value="'+esc(e.ref)+'"'+(e.ref===_rollLoaded?' selected':'')+'>'+
      esc(e.name)+(e.kind==='stat'?'':' (Rank '+e.rank+')')+
      (e.statId&&e.kind!=='stat'?' · '+esc(e.statId):'')+'</option>';
  });
  if(group)opts+='</optgroup>';
  let h='<div'+row+'>'+
    '<div class="form-group" style="flex:1;min-width:0;margin:0"><label>Roll what</label>'+
    '<select id="'+id+'-skill"'+sz+' onchange="rollerPick(&#39;'+id+'&#39;)">'+opts+'</select></div>'+
    '<div class="form-group" style="'+(compact?'width:54px;':'')+'margin:0"><label>Mod</label>'+
    '<input type="number" id="'+id+'-mod" value="0"'+sz+'></div></div>';
  h+='<div'+row+'>';
  if(kinds.length){
    h+='<div class="form-group" style="flex:1;min-width:0;margin:0"><label>Check</label>'+
      '<select id="'+id+'-kind"'+sz+'>'+kinds.map(function(k){
        return '<option value="'+esc(k.id)+'">'+esc(k.name||k.id)+'</option>';}).join('')+'</select></div>';
  }
  h+='<div class="form-group" style="flex:1;min-width:0;margin:0"><label>Roll</label>'+
    '<select id="'+id+'-adv"'+sz+'><option value="0">Straight</option>'+
    '<option value="1">Advantage</option><option value="-1">Disadvantage</option></select></div></div>';
  return h;
}

// The wrapper carries the instance id and where its answer goes, so
// sysDoRollFrom() reads those off the DOM instead of special-casing by name.
function rollerAttrs(id,o){
  return ' data-roller="'+esc(id)+'"'+
    ' data-result="'+esc(o.resultIn||(id+'-result'))+'"'+
    (o.toast?' data-toast="1"':'')+
    (o.sheet?' data-roller-sheet="1"':'');
}

// A panel instance: the Dice tab, either sidebar, or the popover.
function rollerHTML(id,opts){
  const o=opts||{};
  const big=!o.compact;
  return '<div class="card"'+rollerAttrs(id,o)+'>'+
    (o.bare?'':'<div class="pg-title" style="font-size:'+(big?'26px':'18px')+';margin-bottom:2px">'+
      esc(o.title||lexU('roll'))+'</div>'+
      '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">'+
      esc(SYS.dice.formula||'')+' + Rank + Stat Mod</div>')+
    rollerFormHTML(id,!!o.compact)+
    '<div class="tac"><button class="roll-btn"'+(o.compact?' style="width:60px;height:60px;font-size:18px"':'')+
    ' onclick="sysDoRollFrom(&#39;'+id+'&#39;)">ROLL</button></div>'+
    '<div id="'+esc(o.resultIn||(id+'-result'))+'" style="margin-top:8px"></div></div>';
}

// A collapsed bar instance: tap the strip to open the form. The strip is the
// control, not the body — the body is display:none until it is opened, so
// anything testing the body for reachability would call a working roller hidden.
function rollerBarHTML(id,opts){
  const o=opts||{};
  const resultIn=o.resultIn||(id+'-result');
  return '<div class="roller-bar" id="'+id+'-bar"'+rollerAttrs(id,o)+'>'+
    '<div class="dice-bar-toggle" onclick="rollerToggle(&#39;'+id+'&#39;)">'+
    '<div style="display:flex;align-items:center;gap:6px"><span style="font-size:16px">&#127922;</span>'+
    '<span class="fw-700" style="font-size:13px;font-family:var(--font-label)">'+esc(lexU('roll'))+'</span>'+
    '<span id="'+id+'-loaded" style="font-size:10px;color:var(--accent)"></span></div>'+
    '<span class="text-muted" style="font-size:11px">tap to expand</span></div>'+
    '<div class="dice-bar-body" id="'+id+'-body">'+rollerFormHTML(id,true)+
    '<div class="tac"><button class="roll-btn" style="width:44px;height:44px;font-size:14px" '+
    'onclick="sysDoRollFrom(&#39;'+id+'&#39;)">ROLL</button></div>'+
    (resultIn===id+'-result'?'<div id="'+id+'-result" style="margin-top:8px"></div>':'')+
    '</div></div>';
}

function rollerToggle(id){
  const b=document.getElementById(id+'-body');
  if(b)b.classList.toggle('open');
}

// Every instance currently in the DOM. Queried, never remembered: a tab repaint
// throws instances away without telling anyone.
function rollerLive(){
  return [].slice.call(document.querySelectorAll('[data-roller]'));
}

// Picking a Stat should also pick the pack's Stat Check, because a Stat Check
// adds no Skill Ranks and rolling one as "Unopposed" is a different difficulty.
function rollerPick(id){
  const sel=document.getElementById(id+'-skill');
  if(!sel)return;
  _rollLoaded=sel.value||'';
  const e=rollFind(_rollLoaded);
  const kindSel=document.getElementById(id+'-kind');
  const statKind=SYS&&SYS.dice&&SYS.dice.statKind;
  if(kindSel&&e&&e.kind==='stat'&&statKind)kindSel.value=statKind;
  rollerLabel(id);
}

function rollerLabel(id){
  const lab=document.getElementById(id+'-loaded');
  if(!lab)return;
  const e=rollFind(_rollLoaded);
  lab.textContent=e?' · '+e.name:'';
}

// ── rolling ─────────────────────────────────────────────────────────────────
// Roll a named thing with no form to read. A fight screen rolls straight off an
// attack card and a popover rolls straight off a Stat row, so the roll itself
// cannot depend on the DOM. This is the single choke point every pack roll goes
// through — the multiplayer feed wraps THIS, not its callers.
function sysRollSkill(refOrName,opts){
  const o=opts||{};
  const e=rollFind(refOrName);
  const mod=Number(o.bonus)||0;
  const statMod=e?rollStatMod(e.statId):0;
  // A Stat Check adds no Ranks and has its own difficulty. When the caller did
  // not name a kind — an attack card, a popover — the pack's own says so.
  const kind=o.kind||((e&&e.kind==='stat'&&SYS.dice.statKind)?SYS.dice.statKind:undefined);
  const r=SYS.dice.resolve({rank:e?e.rank:0,statMod:statMod,bonus:mod,
                            adv:Number(o.adv)||0,kind:kind,floor:S.floor||3});
  // `skill` as well as `label`: the multiplayer roll feed reads S.dice.skill, so
  // without it a pack roll reached the table as a bare number with no name on it.
  S.dice=Object.assign({},r,{label:e?e.name:'Flat roll',skill:e?e.name:'',
                             ref:e?e.ref:'',mod:mod,systemId:SYS.id});
  _rollLoaded=e?e.ref:'';
  save();
  return S.dice;
}

// One roll, from whichever instance asked. Where the answer goes is written on
// the instance, so nothing here has to know that the sheet's bar answers in a
// sticky toast while everything else answers in place.
function sysDoRollFrom(id){
  const g=function(f){return document.getElementById(id+'-'+f);};
  const wrap=document.querySelector('[data-roller="'+id+'"]');
  sysRollSkill((g('skill')||{}).value||'',{
    bonus:parseInt((g('mod')||{}).value,10)||0,
    kind:(g('kind')||{}).value||undefined,
    adv:parseInt((g('adv')||{}).value,10)||0,
  });
  const target=(wrap&&wrap.getAttribute('data-result'))||(id+'-result');
  sysRenderRollInto(target,!!(wrap&&wrap.getAttribute('data-toast')));
  return S.dice;
}

// Tap a Stat or a Skill and it lands in every roller at once, so whichever one
// you open next is already holding it.
function sysRollLoad(refOrName){
  const e=rollFind(refOrName);
  _rollLoaded=e?e.ref:'';
  rollerLive().forEach(function(w){
    const id=w.getAttribute('data-roller');
    const sel=document.getElementById(id+'-skill');
    if(sel)sel.value=_rollLoaded;
    const kindSel=document.getElementById(id+'-kind');
    const statKind=SYS&&SYS.dice&&SYS.dice.statKind;
    if(kindSel&&e&&e.kind==='stat'&&statKind)kindSel.value=statKind;
    rollerLabel(id);
    const body=document.getElementById(id+'-body');
    if(body)body.classList.add('open');
  });
}
// The name it shipped under. Callers pass a bare Skill name; rollFind resolves it.
function sysLoadRoll(name){return sysRollLoad(name);}

// The entry point a sheet row uses. On desktop the roller comes to the row; on
// a phone there is nowhere to put a popover, so the sticky bar opens instead.
function sysOpenRoller(refOrName,anchor){
  if(!sysRollerIsDesktop()){sysRollLoad(refOrName);return;}
  rollPopOpen(refOrName,anchor);
}

// ── the popover ─────────────────────────────────────────────────────────────
// Mounted on <body>, not inside a page: a block repaint replaces the row you
// clicked, and a popover living inside it would be torn out mid-roll.
// The roller's use of the shell popover in core/chrome.js. The panel itself is
// generic now that the icon picker summons one too.
function rollPopOpen(refOrName,anchor){
  if(rollSurfaces()!=='sys')return;
  const e=rollFind(refOrName);
  _rollLoaded=e?e.ref:'';
  popOpen(rollerHTML('sp',{compact:true,title:e?e.name:lexU('roll')}),anchor);
  rollerLabel('sp');
  const kindSel=document.getElementById('sp-kind');
  const statKind=SYS&&SYS.dice&&SYS.dice.statKind;
  if(kindSel&&e&&e.kind==='stat'&&statKind)kindSel.value=statKind;
}
function rollPopClose(){popClose();}

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

// Show the last roll in every instance on screen. A card that rolls on its own —
// a HUD attack, a Hotlist item — has no originating form to answer into, and the
// screen it is on has two instances (a sidebar and a bar) with the CSS deciding
// which one the player can actually see.
function sysRenderRollAll(){
  rollerLive().forEach(function(w){
    const id=w.getAttribute('data-roller');
    sysRenderRollInto(w.getAttribute('data-result')||(id+'-result'),
                      !!w.getAttribute('data-toast'));
  });
}

// Surface 1 — the Dice tab.
function sysDiceHTML(){
  return rollerHTML('sd',{compact:false});
}

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
  return `<div id="hero-dice-mobile" class="roller-bar" data-roller-sheet="1"><div class="dice-bar-toggle" onclick="document.getElementById('dice-bar-body').classList.toggle('open')"><div style="display:flex;align-items:center;gap:6px"><span style="font-size:16px">&#127922;</span><span class="fw-700" style="font-size:13px;font-family:var(--font-label)">Dice Roller</span><span id="dm-loaded" style="font-size:10px;color:var(--accent)"></span></div><span class="text-muted" style="font-size:11px">tap to expand</span></div><div class="dice-bar-body" id="dice-bar-body"><div id="dm-loaded-info" style="margin-bottom:6px"></div><div style="display:flex;gap:6px;align-items:end"><div style="flex:1"><div class="label" style="margin-bottom:2px">Skill</div><select id="dm-sk" style="font-size:12px;padding:7px" onchange="_loadedPower='';updateLoadedInfo('m')"><option value="">— None —</option>${sysList('SKILLS','skills').map(sk=>`<option value="${sk}">${sk} (+${ch?.skills?.[sk]||0})</option>`).join('')}</select></div><div style="width:50px"><div class="label" style="margin-bottom:2px">Mod</div><input type="number" id="dm-mod" value="0" style="font-size:12px;padding:7px"></div><div style="width:50px"><div class="label" style="margin-bottom:2px">TN</div><input type="number" id="dm-tn" value="0" style="font-size:12px;padding:7px"></div><button class="roll-btn" style="width:44px;height:44px;font-size:14px;flex-shrink:0" onclick="doMobileRoll()">ROLL</button></div></div></div>`;
}

// ═══════════════════════════════════════════════════════════
// CONFLICT
// ═══════════════════════════════════════════════════════════

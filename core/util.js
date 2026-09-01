function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
const HERO_NAME_A=['Captain','Doctor','Iron','Shadow','Ultra','Crimson','Silver','Phantom','Atomic','Mystic','Storm','Night','Star','Hyper','Omega','Cosmic','Mighty','Thunder','Turbo','Rogue','Dark','Quantum','Blaze','Titan','Venom','Neon','Cyber','Cryo','Pyro','Emerald','Obsidian','Onyx','Solar','Lunar','Primal','Apex','Ghost','Royal','Savage','Steel','Raven','Scarlet','Golden','Jade','Cobalt','Rapid','Inferno','Nova','Volt','Hex'];
const HERO_NAME_B=['Hawk','Fist','Bolt','Shield','Blade','Fury','Strike','Wing','Star','Knight','Storm','Fire','Mask','Pulse','Force','Arrow','Sentinel','Vanguard','Phoenix','Hunter','Specter','Hammer','Talon','Blaze','Guardian','Patriot','Crusader','Wolf','Falcon','Frost','Surge','Shadow','Valor','Justice','Marvel','Siren','Titan','Oracle','Reaper','Wraith','Dynamo','Aegis','Phantom','Ronin','Warden','Dusk','Zenith','Lance','Panther','Spark'];
function randHeroName(){return HERO_NAME_A[Math.floor(Math.random()*HERO_NAME_A.length)]+' '+HERO_NAME_B[Math.floor(Math.random()*HERO_NAME_B.length)];}
const ASPECT_PARTS={
  concept_a:['Vigilante','Renegade','Armored','Psychic','Mythic','Cybernetic','Alien','Mutant','Exiled','Reluctant','Vengeful','Brilliant','Street-Level','Cosmic','Government','Mystical','Time-Lost','Reformed','Young','Battle-Hardened','Tech-Enhanced','Divine','Elemental','Dimension-Hopping','Shapeshifting'],
  concept_b:['Detective','Warrior','Scientist','Protector','Sorcerer','Speedster','Inventor','Assassin','Champion','Avenger','Outcast','Prodigy','Soldier','Guardian','Healer','Hunter','Mastermind','Wanderer','Brawler','Diplomat','Mercenary','Crusader','Anarchist','Tactician','Berserker'],
  motivation:['Protect the Innocent at Any Cost','Make Up for a Dark Past','Prove Myself Worthy of the Power','Hunt Down Those Who Prey on the Weak','Find a Cure Before Time Runs Out','Honor the Legacy of My Mentor','Keep My Loved Ones Safe','Bring Justice Where the Law Fails','Redeem Myself in the Eyes of the World','Prevent the Catastrophe I Foresaw','Defend My People From Extinction','Uncover the Truth Behind My Powers','Stand Against Tyranny Everywhere','Earn the Trust I Have Been Given','Stop the Coming War Before It Starts','Prove That Power Does Not Corrupt','Find My Way Home Across the Stars','Break the Cycle of Violence','Protect This City From the Shadows','Build a Better World One Fight at a Time'],
  life_event:['Survived a Lab Explosion That Changed Everything','Witnessed a Murder That Set Me on This Path','Was Betrayed by Someone I Trusted Completely','Found an Ancient Artifact That Chose Me','Emerged From a Government Super-Soldier Program','Lost Everything in the Cataclysm','Made a Deal With a Being Beyond Comprehension','Was the Sole Survivor of an Alien Attack','Woke Up With No Memories and Strange Powers','Returned From the Dead With a Mission'],
  core_value:['Violence Is Always the Last Resort','Everyone Deserves a Second Chance','The Team Comes Before the Individual','There Is No Justice Without Mercy','Power Must Serve the People','A Promise Is Unbreakable','Truth Is Worth Any Price','Freedom Cannot Be Negotiated','Compassion Is Not Weakness','Hope Is the Greatest Weapon'],
  flaw:['Haunted by Nightmares of What I Have Done','My Temper Burns Hotter Than My Powers','I Trust No One Completely','Addicted to the Thrill of the Fight','My Powers Are Slowly Killing Me','I Cannot Resist a Challenge','Everyone I Love Becomes a Target','My Arrogance Blinds Me to Danger','I Carry a Secret That Could Destroy the Team','I Am Terrified of Losing Control'],
  inner_demons:['The Darkness Inside Wants Out','I Hear Voices That Are Not My Own','The Monster I Fight Is Myself','Every Victory Feels Hollow','I Cannot Forgive What Was Done to Me','My Other Self Is Getting Stronger','The Guilt of Those I Could Not Save','I Am Becoming What I Swore to Destroy','The Power Hungers for More','I See the Worst in Everyone'],
  inner_strength:['I Always Get Back Up','My Will Is Stronger Than Any Power','I Fight Hardest When All Seems Lost','My Friends Are My Greatest Power','I Have Stared Into the Abyss and Walked Away','Nothing Can Break My Spirit','I Find Clarity in the Chaos of Battle','I Carry the Hope of Those Who Cannot Fight','My Resolve Has Been Forged in Fire','I Choose to Be Better Every Day'],
  dark_secret:['I Once Killed Someone Who Did Not Deserve It','My Powers Come From a Villainous Source','I Am Not Who My Team Thinks I Am','I Have Been Secretly Working Both Sides','My Origin Story Is a Lie I Told Myself','I Know Who the Traitor Is and Said Nothing','I Made a Pact That Has a Terrible Price','I Destroyed Evidence to Protect Someone','The Government Has Leverage Over Me','I Am a Clone of Someone Famous'],
  relationships:['My Mentor Is the Only Family I Have Left','My Rival Pushes Me to Be Better','I Would Do Anything for My Partner','My Sidekick Keeps Me Grounded','My Enemy Was Once My Best Friend','The Reporter Who Knows My Identity','The Child I Swore to Protect','My Ex-Partner Who Turned Villain','The Cop Who Looks the Other Way','My Sibling Who Got Different Powers']
};
const ASPECT_CAT_MAP={'Life Changing Event':'life_event','Core Value':'core_value','Flaw':'flaw','Inner Demons':'inner_demons','Inner Strength':'inner_strength','Dark Secret':'dark_secret','Relationships':'relationships','Life Secret':'dark_secret','Personal Belief':'core_value'};
function randFrom(arr){return arr[Math.floor(Math.random()*arr.length)];}
function randConcept(){return randFrom(ASPECT_PARTS.concept_a)+' '+randFrom(ASPECT_PARTS.concept_b);}
function randMotivation(){return randFrom(ASPECT_PARTS.motivation);}
function randContingent(cat){const key=ASPECT_CAT_MAP[cat];return key?randFrom(ASPECT_PARTS[key]):randFrom(ASPECT_PARTS.core_value);}
function exportJSON(){
  // Stamp the export with the game that produced it. Without this an export
  // from one game imports cleanly into the other and then throws on every
  // render, which bricked the app on the next launch.
  const payload=Object.assign({},S,{systemId:(typeof SYS!=='undefined'&&SYS)?SYS.id:S.systemId||null});
  const data=JSON.stringify(payload,null,2);
  const name=(typeof sysCharName==='function'?sysCharName(S.char):null)
    ||S.char?.costumedName||S.creation?.costumedName||'character';
  const blob=new Blob([data],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=name.replace(/[^a-zA-Z0-9_-]/g,'_')+'.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}
function importJSON(){
  const inp=document.createElement('input');inp.type='file';inp.accept='.json';
  inp.addEventListener('change',()=>{
    const file=inp.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=function(e){
      try{
        const data=JSON.parse(e.target.result);
        if(!data.series&&!data.char&&!data.creation){alert('Invalid save file.');return;}
        // A save from another game has a different shape entirely. Importing it
        // used to succeed, become the active save, and then throw on every
        // render — including inside boot, which left the app blank with no way
        // back to the save list.
        const here=(typeof SYS!=='undefined'&&SYS)?SYS.id:null;
        const from=data.systemId||null;
        if(here&&from&&from!==here){
          alert('That save is from a different game ('+from+'). Open it in that game instead.');
          return;
        }
        if(here&&!from&&typeof sysUsesBlocks==='function'&&sysUsesBlocks()!==!!(data.blocks)){
          // Older saves carry no stamp, so fall back to the one structural
          // difference that always holds: a block pack stores char.blocks.
          alert('That save does not match this game. Open it in the game that made it.');
          return;
        }
        data.systemId=here||from;
        // Imports always land in a NEW save file — never overwrite whatever
        // happens to be open.
        if(!data.universeId&&currentUniverse())data.universeId=currentUniverse().id;
        const _id=createSave(data);
        if(!_id){alert('Import failed — storage is full. Delete a save file and try again.');return;}
        loadSave(_id);closeSlotModal();renderAll();
      }catch(err){alert('Failed to parse JSON: '+err.message);}
    };
    reader.readAsText(file);
  });
  inp.click();
}
function hardinessBonus(ch){var b={box:0,mild:0,moderate:0,severe:0};if(!ch||!ch.forms)return b;var f=ch.forms[ch.activeForm||0]||ch.forms[0];if(!f)return b;(f.powerSets||[]).forEach(function(ps){(ps.powers||[]).forEach(function(pw){if(pw.powerId!=='hardiness')return;var L=pw.level||1;b.box+=(L>=1?1:0)+(L>=3?1:0)+(L>=5?1:0);if(L>=2)b.mild++;if(L>=4)b.moderate++;if(L>=6)b.severe++;});});return b;}
function syncHardiness(ch){var b=hardinessBonus(ch);if(!Array.isArray(ch.hardStress))ch.hardStress=[];while(ch.hardStress.length<b.box)ch.hardStress.push(false);if(ch.hardStress.length>b.box)ch.hardStress.length=b.box;if(!ch.hardCons)ch.hardCons={mild:[],moderate:[],severe:[]};['mild','moderate','severe'].forEach(function(k){if(!Array.isArray(ch.hardCons[k]))ch.hardCons[k]=[];while(ch.hardCons[k].length<b[k])ch.hardCons[k].push('');if(ch.hardCons[k].length>b[k])ch.hardCons[k].length=b[k];});return b;}
function toggleHardStress(i){if(!S.char||!S.char.hardStress)return;S.char.hardStress[i]=!S.char.hardStress[i];save();renderSheet();}
function _hcExtra(ch){var o='';var hc=ch.hardCons||{};[['mild','Mild (2)'],['moderate','Moderate (4)'],['severe','Severe (6)']].forEach(function(p){(hc[p[0]]||[]).forEach(function(v,i){o+='<div class="conseq-row"><div class="conseq-label" style="color:var(--purple)">'+p[1]+' \u2726</div><div class="conseq-input"><input value="'+esc(v)+'" oninput="S.char.hardCons.'+p[0]+'['+i+']=this.value;save()" placeholder="\u2014 Hardiness bonus"></div></div>';});});return o;}
// ===== power icons (game-icons.net), save flash, modal UX =====
function clearRollToast(){var t=document.getElementById('quick-roll-toast');if(t)t.innerHTML='';}
function addTeamToConflict(){if(!S.team||!S.conflict)return;S.conflict.turnOrder.push({name:S.team.name+' (Team)',type:'Team'});S.conflict.log.push(S.team.name+' joined');save();renderConflict();}
var _saveFlashT=null;
function _saveFlashEl(){var el=document.getElementById('save-flash');if(!el){el=document.createElement('div');el.id='save-flash';document.body.appendChild(el);}return el;}
function flashSaved(){var el=_saveFlashEl();el.textContent=voice('saved','Saved ✓');el.style.background='';el.style.color='';clearTimeout(_saveFlashT);el.classList.add('show');_saveFlashT=setTimeout(function(){el.classList.remove('show');},900);}
// A failed write used to still flash "Saved ✓" — the flash now tells the truth.
function flashSaveError(msg){var el=_saveFlashEl();el.textContent='⚠ '+(msg||'Not saved');el.style.background='var(--red)';el.style.color='#fff';clearTimeout(_saveFlashT);el.classList.add('show');_saveFlashT=setTimeout(function(){el.classList.remove('show');},2600);}
// Neither a save nor a failure: an answer. "Scroll written into your Inventory"
// is not an error and flashing it in red said something the app did not mean.
function flashNote(msg){if(!msg)return;var el=_saveFlashEl();el.textContent=msg;el.style.background='';el.style.color='';clearTimeout(_saveFlashT);el.classList.add('show');_saveFlashT=setTimeout(function(){el.classList.remove('show');},2200);}
// One icon, at a size. Kept under its old name: six renderers call it.
function powerIco(pw,size){return (pw&&pw.icon)?iconHTML(pw.icon,size||18)+' ':'';}
// Daring Comics' power editor, on the shared picker in core/icons.js. Its own
// element ids and its _pdIcon variable are kept: core/creation.js writes that
// markup and reads that variable in five places, and migrating the reference
// pack's power editor buys nothing a player can see.
var _pdIcon='';
function _pdPicker(){
  var pw=(typeof POWERS!=='undefined'?POWERS:[]).find(function(p){return p.id===window._pdId;});
  return iconInit('pd',{value:_pdIcon,fallback:pw?pw.name:'power',
    els:{preview:'pw-icon-preview',search:'pw-icon-search',results:'pw-icon-results'},
    onPick:function(v){_pdIcon=v;}});
}
function pdIconPreview(){_pdPicker();iconPreview('pd');}
function selectPdIcon(id){_pdPicker();iconPick('pd',id);}
function renderPdIcons(icons){_pdPicker();iconResults('pd',icons);}
function pdIconSearch(q){_pdPicker();iconSearch('pd',q);}
// ═══════════════════════════════════════════════════════════
// LLM (Gemini + any OpenAI-compatible local endpoint)
// ═══════════════════════════════════════════════════════════
// Settings live outside the save slot and outside the universe — they're a
// property of THIS DEVICE, not of the game. Never export them with a slot.
var LLM_DEFAULTS={backend:'gemini',geminiKey:'',geminiModel:'gemini-3.7-flash',localUrl:'http://localhost:5000/v1',localModel:'',localKey:''};
// Suggestions for the model field (it stays free-text). Every id here was
// pinged against the live API on 2026-08-21 and answered. gemini-2.5-pro and
// gemini-2.5-flash-lite are deliberately absent: they return 404 "no longer
// available to new users", so they work only on keys that used them before.
var LLM_MODEL_SUGGESTIONS=[
  {id:'gemini-3.7-flash',label:'newest, best coding/agents (default)'},
  {id:'gemini-3.6-flash',label:'previous default'},
  {id:'gemini-3.5-flash',label:'balanced'},
  {id:'gemini-3.5-flash-lite',label:'faster / cheaper'},
  {id:'gemini-3.1-pro-preview',label:'deepest reasoning (preview)'},
  {id:'gemini-2.5-flash',label:'older, still available'}
];
var _llmCfg=null;
// Model ids Google has removed — each returns a hard 404 NOT_FOUND (pinged
// live 2026-08-21). gemini-2.0-flash was this app's default, so most saved
// configs point at a dead model; remap on read or the AI tab just errors.
var LLM_RETIRED_MODELS=['gemini-2.0-flash','gemini-2.0-flash-lite','gemini-1.5-flash','gemini-1.5-pro','gemini-pro','gemini-3-pro-preview','gemma-3-27b-it','gemma-3-12b-it','gemma-4-e4b-it','gemma-4-e2b-it'];
